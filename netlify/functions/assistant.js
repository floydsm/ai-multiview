// netlify/functions/assistant.js
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  let prompt = "";
  try {
    const body = JSON.parse(event.body || "{}");
    prompt = body.prompt || "";
  } catch {
    return json(400, { error: "Bad JSON body" });
  }
  if (!prompt) return json(400, { error: "Missing 'prompt'" });

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5";
  if (!apiKey) return json(500, { error: "OPENAI_API_KEY missing" });

  // System/User prompts include the word "JSON" to satisfy the Responses API guardrail
  const system = [
    "You are a control parser for a live multiviewer.",
    "Return ONLY a single JSON object with the following intent options:",
    "- setGrid { type, rows, cols }",
    "- fullscreen { type, slot }",
    "- swap { type, a, b }",
    "- loadActive { type }",
    "- nameSlot { type, slot, name }",
    "- setStream { type, slot, playerUrl }",
    "- preset { type, action, name }",
    "No markdown, no extra keys. Respond ONLY in valid JSON."
  ].join("\n");

  const user = `Command: ${prompt}\nRespond ONLY with a valid JSON object.`;

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "medium" },
        input: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        // New Responses API format
        text: { format: { type: "json_object" } }
      })
    });

    const data = await r.json();
    if (!r.ok) return json(r.status, { error: data });

    // For json_object format, OpenAI returns the JSON as a string in output_text
    const text =
      data.output_text ??
      (data.content && Array.isArray(data.content) && data.content[0]?.text) ??
      data?.choices?.[0]?.message?.content ??
      "{}";

    // Validate it's JSON
    let intent;
    try {
      intent = JSON.parse(text);
    } catch {
      // Tiny fallback for commands like "3x3"
      const m = /^(\d)\s*[xX]\s*(\d)$/.exec(prompt.trim());
      if (m) return json(200, { type: "setGrid", rows: Number(m[1]), cols: Number(m[2]) });
      return json(502, { error: "Assistant returned non-JSON" });
    }

    return json(200, intent);
  } catch (e) {
    return json(500, { error: e?.message || "Unknown server error" });
  }
};

// ---------- helpers ----------
function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...cors() },
    body: JSON.stringify(body)
  };
}
