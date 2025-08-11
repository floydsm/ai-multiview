// netlify/functions/assistant.ts
import { z } from "zod";

export default async (req: Request) => {
  const origin = req.headers.get("origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors(origin)
    });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method Not Allowed" }, origin);
  }

  const { prompt } = await req.json().catch(() => ({ prompt: "" }));
  if (!prompt) return json(400, { error: "Missing 'prompt'" }, origin);

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5";
  if (!apiKey) return json(500, { error: "Server not configured: OPENAI_API_KEY missing" }, origin);

  // Zod schema for structured intents
  const Intent = z.discriminatedUnion("type", [
    z.object({ type: z.literal("setGrid"), rows: z.number().int().min(1).max(6), cols: z.number().int().min(1).max(6) }),
    z.object({ type: z.literal("fullscreen"), slot: z.number().int().min(1).max(36) }),
    z.object({ type: z.literal("swap"), a: z.number().int().min(1).max(36), b: z.number().int().min(1).max(36) }),
    z.object({ type: z.literal("loadActive") }),
    z.object({ type: z.literal("nameSlot"), slot: z.number().int().min(1).max(36), name: z.string().min(1).max(100) }),
    z.object({ type: z.literal("setStream"), slot: z.number().int().min(1).max(36), playerUrl: z.string().url() }),
    z.object({ type: z.literal("preset"), action: z.enum(["save", "load", "delete"]), name: z.string().min(1).max(50) })
  ]);

  const systemPrompt = `You are a control parser for a live multiviewer.
Return ONLY a single JSON object that exactly matches this schema:
${Intent.toString()}
Do not return markdown, comments, or extra keys. Respond ONLY in valid JSON.`;

  const userPrompt = `Command: ${prompt}
Respond ONLY with a valid JSON object matching the schema above.`;

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "medium" },
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        text: { format: { type: "json_object" } }
      })
    });

    const data = await r.json();
    if (!r.ok) return json(r.status, { error: data }, origin);

    const text =
      data.output_text ??
      data?.choices?.[0]?.message?.content ??
      data?.content?.[0]?.text ??
      "{}";

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json(502, { error: "Assistant returned non-JSON" }, origin);
    }

    const result = Intent.safeParse(parsed);
    if (!result.success) {
      // fallback for "3x3" style commands
      const m = /^(\d)\s*[xX]\s*(\d)$/.exec(prompt.trim());
      if (m) {
        return json(200, { type: "setGrid", rows: Number(m[1]), cols: Number(m[2]) }, origin);
      }
      return json(422, { error: `Invalid intent shape: ${result.error.message}` }, origin);
    }

    return json(200, result.data, origin);
  } catch (e: any) {
    return json(500, { error: e?.message || "Unknown server error" }, origin);
  }
};

/** ---------- Helpers ---------- */
function cors(origin: string | null) {
  const allowOrigin = origin || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function json(status: number, obj: unknown, origin?: string | null) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(origin ? cors(origin) : {})
    }
  });
}
