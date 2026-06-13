// Generate a HyperFrames lecture composition from an NVCC slide deck + per-slide
// af_heart TTS + transcripts. Reusable per module.
//   inputs:  deck.html, assets/audio/sceneNN.wav, narration/sceneNN.json
//   outputs: index.html, assets/cc-data.js
// Features: deck slides scaled 2x as scenes, word-by-word captions, code-window
// glow + line-by-line code highlight synced to narration, bullet entrance.
// Run: node build-lecture.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const LEAD = 0.5, TAIL = 1.0;
const dur = (f) => parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${f}"`).toString().trim());

// ---- 1. extract each top-level .slide block from the deck (div-depth walk) ----
const deck = readFileSync(new URL("./deck.html", import.meta.url), "utf8");
const slides = [];
{
  let i = 0;
  while (i < deck.length) {
    const startIdx = deck.indexOf('<div class="slide', i);
    if (startIdx < 0) break;
    const tag = /<div\b[^>]*>|<\/div>/gi; tag.lastIndex = startIdx;
    let depth = 0, m, end = -1;
    while ((m = tag.exec(deck))) { if (m[0][1] === "/") depth--; else depth++; if (depth === 0) { end = tag.lastIndex; break; } }
    if (end < 0) break;
    let html = deck.slice(startIdx, end).replace(/\.\.\/\.\.\/_template\/nova-logo\.svg/g, "assets/nova-logo.svg");
    slides.push(html);
    i = end;
  }
}
const N = slides.length;

// ---- tag the main (dark) code-block's line rows with ids; collect tokens ----
function tagCodeBlock(html, k) {
  const open = html.indexOf('<div class="code-block">'); // dark block only (light is "code-block light")
  if (open < 0) return { html, rows: [] };
  const tag = /<div\b[^>]*>|<\/div>/gi; tag.lastIndex = open;
  let depth = 0, m, end = -1;
  while ((m = tag.exec(html))) { if (m[0][1] === "/") depth--; else depth++; if (depth === 0) { end = tag.lastIndex; break; } }
  if (end < 0) return { html, rows: [] };
  const openEnd = html.indexOf(">", open) + 1;
  const inner = html.slice(openEnd, end - "</div>".length);
  let r = 0; const rows = [];
  const newInner = inner.replace(/<div\b[^>]*>[\s\S]*?<\/div>/g, (full) => {
    const id = `sc${k}-cl${r}`;
    const txt = full.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/^\s*\d+\s*/, "");
    const tokens = (txt.toLowerCase().match(/[a-z_]{2,}/g) || []);
    rows.push({ id, tokens }); r++;
    return full.replace("<div", `<div id="${id}"`);
  });
  return { html: html.slice(0, openEnd) + newInner + html.slice(end - "</div>".length), rows };
}

// ---- 2. durations + cascade; tag code; load transcripts ----
const scene = [];
let t = 0;
for (let k = 1; k <= N; k++) {
  const nn = String(k).padStart(2, "0");
  const a = +dur(`assets/audio/scene${nn}.wav`);
  const ad = +(a + 0.1).toFixed(2);
  const sd = +(LEAD + ad + TAIL).toFixed(2);
  const start = +t.toFixed(2);
  const as = +(start + LEAD).toFixed(2);
  const { html, rows } = tagCodeBlock(slides[k - 1], k);
  let words = [];
  try { words = JSON.parse(readFileSync(new URL(`./narration/scene${nn}.json`, import.meta.url))); } catch {}
  scene.push({ nn, k, start, sd, as, ad, end: +(start + sd).toFixed(2), html, rows, words });
  t = +(start + sd).toFixed(2);
}
const TOTAL = +t.toFixed(2);

// match each content code row to the earliest spoken token after the previous row
function rowTimes(sc) {
  const out = []; let cur = 0;
  for (const row of sc.rows) {
    if (!row.tokens.length) continue;
    let found = -1;
    for (let i = cur; i < sc.words.length; i++) {
      const w = (sc.words[i].text.toLowerCase().match(/[a-z_]+/) || [""])[0];
      if (w && row.tokens.includes(w)) { found = i; break; }
    }
    if (found >= 0) { out.push({ id: row.id, t: +(sc.as + sc.words[found].start).toFixed(2) }); cur = found + 1; }
  }
  return out;
}

// ---- 3. captions ----
const MAXW = 9; const ccLines = [];
for (const sc of scene) {
  const off = sc.as; let line = [];
  const flush = () => { if (line.length) { ccLines.push(line.map(w => ({ t: w.text, s: +(w.start + off).toFixed(3), e: +(w.end + off).toFixed(3) }))); line = []; } };
  for (const w of sc.words) {
    line.push(w);
    const ends = /[.?!]["')\]]?$/.test(w.text), clause = /[,;:]["')\]]?$/.test(w.text);
    if (ends || line.length >= MAXW || (clause && line.length >= 5)) flush();
  }
  flush();
}
writeFileSync(new URL("./assets/cc-data.js", import.meta.url), `// AUTO-GENERATED — do not edit.\nwindow.__ccLines = ${JSON.stringify(ccLines)};\n`);

// ---- 4. emit ----
const sceneDivs = scene.map(sc =>
  `      <div id="sc${sc.k}" class="scene clip" data-start="${sc.start}" data-duration="${(sc.sd - 0.01).toFixed(2)}" data-track-index="5">
        <div class="slide-wrap">${sc.html}</div>
      </div>`).join("\n");

const audioEls = scene.map(sc =>
  `      <audio id="narr-${sc.nn}" class="clip" src="assets/audio/scene${sc.nn}.wav" data-start="${sc.as}" data-duration="${sc.ad}" data-track-index="8"></audio>`).join("\n");

let codeRows = 0;
const tweens = scene.map(sc => {
  const S = sc.start;
  let js = `      tl.from("#sc${sc.k} .slide-wrap", { opacity: 0, duration: 0.5, ease: "power2.out" }, ${S});\n`;
  if (/class="bullet-list"/.test(sc.html))
    js += `      tl.from("#sc${sc.k} .bullet-list > li", { opacity: 0, x: -12, duration: 0.45, ease: "power3.out", stagger: 0.5 }, ${(S + 0.8).toFixed(2)});\n`;
  if (sc.rows.length) {
    const rt = rowTimes(sc);
    // code emphasis stays only while the code is being read; clears ~1.8s after the last line
    const codeEnd = rt.length ? Math.min(+(rt[rt.length - 1].t + 1.8).toFixed(2), +(sc.end - 0.3).toFixed(2)) : +(S + 4).toFixed(2);
    js += `      tl.fromTo("#sc${sc.k} .code-block:not(.light)", { boxShadow: "0 0 0 0 rgba(204,153,0,0)" }, { boxShadow: "0 0 0 3px rgba(204,153,0,.7), 0 0 24px rgba(204,153,0,.35)", duration: 0.5 }, ${(S + 0.9).toFixed(2)});\n`;
    rt.forEach((row, i) => {
      js += `      tl.to("#${row.id}", { backgroundColor: "rgba(204,153,0,0.32)", duration: 0.25 }, ${row.t});\n`;
      if (i > 0) js += `      tl.to("#${rt[i - 1].id}", { backgroundColor: "rgba(204,153,0,0)", duration: 0.25 }, ${row.t});\n`;
    });
    if (rt.length) js += `      tl.to("#${rt[rt.length - 1].id}", { backgroundColor: "rgba(204,153,0,0)", duration: 0.35 }, ${codeEnd});\n`;
    js += `      tl.to("#sc${sc.k} .code-block:not(.light)", { boxShadow: "0 0 0 0 rgba(204,153,0,0)", duration: 0.5 }, ${codeEnd});\n`;
    codeRows += rt.length;
  }
  return js;
}).join("");

const htmlOut = `<!doctype html>
<html lang="en" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script src="assets/cc-data.js"></script>
    <link rel="stylesheet" href="assets/slides.css" />
    <style>
      html, body { width: 1920px; height: 1080px; margin: 0; overflow: hidden; background: #ffffff; }
      #root { position: absolute; inset: 0; }
      .scene { position: absolute; top: 0; left: 0; width: 1920px; height: 1080px; z-index: 10; }
      .slide-wrap { position: absolute; top: 0; left: 0; width: 960px; height: 540px; transform: scale(2); transform-origin: top left; }
      .slide-wrap .slide { box-shadow: none; }
      .code-block > div { border-radius: 3px; }
      .cc { position: absolute; left: 0; right: 0; bottom: 40px; z-index: 60; display: flex; justify-content: center; pointer-events: none; }
      .cc-inner { position: relative; height: 0; }
      .cc-line { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); white-space: nowrap;
        background: rgba(11,26,18,0.94); color: #fff; border: 1px solid rgba(255,255,255,0.08);
        font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 26px; font-weight: 600;
        padding: 10px 24px; border-radius: 12px; box-shadow: 0 12px 34px -12px rgba(0,0,0,0.6); visibility: hidden; }
      .cc-w { color: #fff; opacity: 0.5; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1920" data-height="1080">
${sceneDivs}

      <div id="cc" class="cc clip" data-start="0" data-duration="${TOTAL}" data-track-index="9"><div id="cc-inner"></div></div>

      <!-- narration -->
${audioEls}
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

${tweens}
      (function () {
        const lines = window.__ccLines || [];
        const inner = document.getElementById("cc-inner");
        lines.forEach((ln, i) => {
          const el = document.createElement("div"); el.className = "cc-line";
          ln.forEach((w) => { const s = document.createElement("span"); s.className = "cc-w"; s.textContent = w.t + " "; el.appendChild(s); });
          inner.appendChild(el);
          const spans = el.querySelectorAll(".cc-w");
          const showAt = Math.max(0, ln[0].s - 0.06);
          const lastEnd = ln[ln.length - 1].e;
          const nextStart = i + 1 < lines.length ? lines[i + 1][0].s : lastEnd + 0.6;
          const hideAt = Math.max(showAt + 0.25, Math.min(nextStart - 0.04, lastEnd + 0.7));
          tl.set(el, { autoAlpha: 0 }, 0);
          tl.set(spans, { opacity: 0.5 }, 0);
          tl.set(el, { autoAlpha: 1 }, showAt);
          ln.forEach((w, wi) => tl.set(spans[wi], { opacity: 1 }, Math.max(showAt, w.s)));
          tl.set(el, { autoAlpha: 0 }, hideAt);
        });
      })();

      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
writeFileSync(new URL("./index.html", import.meta.url), htmlOut);
console.log(`wrote index.html — ${N} scenes, ${TOTAL}s (${(TOTAL/60).toFixed(1)} min), ${ccLines.length} caption lines, ${codeRows} code-line highlights`);
