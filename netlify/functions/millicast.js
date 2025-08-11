// netlify/functions/millicast.js
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors(), body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  const bearer = process.env.MILLICAST_BEARER;
  if (!bearer) return json(500, { error: "MILLICAST_BEARER missing" });

  const r = await fetch("https://api.millicast.com/api/monitoring/streams?isActive=true", {
    headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json" }
  });
  const data = await r.json();
  if (!r.ok) return json(r.status, { error: data });

  const streams = (data?.data?.data || []).map((s) => ({
    id: s.streamName || s.id || s.streamId,
    name: s.streamName || "Unnamed Stream",
    isActive: true,
    playerUrl: s.hostedPlayerUrl || s.playerUrl || "",
    analytics: { viewers: s.viewers ?? s.viewerCount ?? 0 }
  }));

  return json(200, { streams });
};

function cors() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
}
function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", ...cors() }, body: JSON.stringify(body) };
}
