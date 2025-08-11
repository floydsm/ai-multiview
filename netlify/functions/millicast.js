// netlify/functions/millicast.js

// ========== 1) Friendly names you provided ==========
const CUSTOM_NAMES = {
  "QTL07-W02STR003": "Andrew",
  "QTL13-W02STR013": "Andrew",
  "QTL12-W02STR012": "Nick",
  "QTL06-W02STR001": "Nick",
  "QTL14-W02STR014": "CJ",
  "QTL15-W02STR015": "CJ",
  "CQTL1-W01STR001": "Shawn",
  "QTL08-W01STR004": "Shawn",
  "QTL10-W02STR010": "Israel",
  "QTL11-W02STR011": "Phil",
  "QTL16-W03STR001": "Nuria",      // (QTL 16 → QTL16)
  "MXQTL-W13STR002": "Aurora",     // (MX QTL  → MXQTL)
  "MXQTL2-W13STR003": "Pau",       // (MX QTL 2 → MXQTL2)
  "QTL17-W02STR025": "Robert"
};

// For safety, also accept keys with spaces (aliases).
const ALIAS_NAMES = {
  "QTL 16-W03STR001": "Nuria",
  "MX QTL-W13STR002": "Aurora",
  "MX QTL 2-W13STR003": "Pau"
};

// ========== 2) Player URL template ==========
// Uses your pattern. You can also set HOSTED_PLAYER_TEMPLATE in Netlify if needed.
const DEFAULT_TEMPLATE =
  process.env.HOSTED_PLAYER_TEMPLATE ||
  "https://viewer.millicast.com?streamId=snsuzX/{id}&pip=false&cast=false&userCount=false&disableSettings=true";

// Optional: per-stream hard overrides (only if some streams differ)
const CUSTOM_URLS = {
  // "SOME-ID": "https://viewer.millicast.com?streamId=otherNs/SOME-ID&pip=false&cast=false&userCount=false&disableSettings=true"
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
      const rawId = s.streamName || s.id || s.streamId || s.name || "";
      const id = normalizeId(rawId); // strip spaces in the ID for template use
      const rawName = s.streamName || s.name || s.id || "Stream";
      const name =
        CUSTOM_NAMES[id] ||
        ALIAS_NAMES[rawId] ||
        CUSTOM_NAMES[rawId] ||
        rawName;

      // Prefer any URL from API…
      let playerUrl =
        s.hostedPlayerUrl || s.playerUrl || s.player_url || s.embedUrl || s.embed_url || "";

      // …otherwise per-stream override…
      if (!playerUrl) {
        playerUrl = CUSTOM_URLS[id] || CUSTOM_URLS[rawId] || "";
      }

      // …otherwise build from template.
      if (!playerUrl && DEFAULT_TEMPLATE) {
        playerUrl = DEFAULT_TEMPLATE
          .replace("{id}", encodeURIComponent(id))
          .replace("{name}", encodeURIComponent(rawName));
      }

      const viewers = s.viewers ?? s.viewerCount ?? null;
      return { id, name, playerUrl, viewers };
    });

    return json(200, {
      source: "millicast-monitoring",
      count: streams.length,
      missingUrls: streams.filter(x => !x.playerUrl).length,
      streams
    });
  } catch (e) {
    return json(500, { error: e?.message || "Unknown server error" });
  }
};

// ------- helpers -------
function normalizeId(s) {
  // remove spaces in things like "QTL 16" → "QTL16", "MX QTL 2" → "MXQTL2"
  return String(s || "").replace(/\s+/g, "");
}
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
