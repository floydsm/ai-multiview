// netlify/functions/millicast.js
// --- EDIT THESE NAMES to your liking ---
// Map by streamName (preferred) or id/streamId if that's what your tenant returns.
const CUSTOM_NAMES = {
  // "your-stream-name": "Main Stage",
  // "stage-2": "Breakouts",
  // "cam-remote-1": "Remote Cam 1",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors(), body: "" };
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return json(405, { error: "Method Not Allowed. Use POST (or GET for debugging)." });
  }

  const bearer = process.env.MILLICAST_BEARER;
  if (!bearer) return json(500, { error: "MILLICAST_BEARER missing" });

  try {
    const url = "https://api.millicast.com/api/monitoring/streams?isActive=true";
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json" }
    });
    const data = await r.json();
    if (!r.ok) return json(r.status, { error: data });

    const list = (data?.data?.data || data?.data || data || []);
    const streams = list.map((s) => {
      const id = s.streamName || s.id || s.streamId || s.name || "";
      const rawName = s.streamName || s.name || s.id || "Stream";
      const custom = CUSTOM_NAMES[id] || CUSTOM_NAMES[rawName];
      const name = custom || rawName;
      const playerUrl =
        s.hostedPlayerUrl || s.playerUrl || s.player_url || s.embedUrl || s.embed_url || "";
      const viewers = s.viewers ?? s.viewerCount ?? null;

      return { id, name, playerUrl, viewers };
    });

    return json(200, {
      source: "millicast-monitoring",
      count: streams.length,
      streams
    });
  } catch (e) {
    return json(500, { error: e?.message || "Unknown server error" });
  }
};

// ------- helpers -------
function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", ...cors() }, body: JSON.stringify(body, null, 2) };
}
