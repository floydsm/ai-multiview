# Multiviewer (Frontend + Netlify Functions)

This bundle lets you deploy a GPT‑assisted Millicast multiviewer to **Netlify** with no build tools.

## What’s inside
- `public/index.html` — a CDN‑based React page (no Node build step).
- `netlify/functions/assistant.js` — calls OpenAI GPT‑5 to parse commands like `3x3`, `fullscreen 2`, `swap 1 and 3`, `load active`.
- `netlify/functions/millicast.js` — fetches active streams from Millicast Monitoring using your **Secret** as Bearer.
- `netlify.toml` — sets Netlify to publish the `public` folder.

## Deploy (3 steps)
1. Create a GitHub repo and upload these files.
2. In Netlify → Add new site → Import from Git → choose the repo.
3. Add **Environment Variables**:
   - `OPENAI_API_KEY` (starts with `sk-...`)
   - `OPENAI_MODEL` = `gpt-5`
   - `MILLICAST_BEARER` = your Millicast **Secret** (from the Millicast dashboard)

Open your site, click **Load Active**, then try commands in the box like `3x3`, `fullscreen 2`.

## Notes
- If your Millicast response doesn’t include a `hostedPlayerUrl`, you can paste direct Hosted Player URLs into slots with the `setStream` command, e.g. `set slot 1 to https://player.millicast.com/...?token=...`
- This is a simple starter—once it works, we can switch to a custom player, add analytics overlays, and make it pretty.
