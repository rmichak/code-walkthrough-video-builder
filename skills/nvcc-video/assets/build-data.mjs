// build-data.mjs — generates data.js for the NVCC video composition from transcript.json.
//
//   node build-data.mjs proof   → short proof window (set PROOF below) for look approval
//   node build-data.mjs full    → the whole (optionally front-trimmed) recording
//
// It also bakes the clip-timing attributes into index.html, because the renderer reads
// the duration from the STATIC attributes at compile time (before any runtime JS runs).
//
// ► EDIT ONLY THE CONFIG BLOCK BELOW for each new video. Everything under the line is engine.

import { readFileSync, writeFileSync } from "node:fs";

// ============================== CONFIG (edit per video) ==============================

const TITLE_CARD = {
  kicker: "ITP&nbsp;270 · PROGRAMMING FOR CYBERSECURITY", // small gold line; HTML entities ok
  title: "Video Title",                                   // big headline
  subtitle: "Module 0X · Subtitle",                       // line under the rule
  prompt: "student@kali:~$",                              // mono accent line; set "" to hide
};

const TITLE_DUR = 4;     // seconds the branded title card plays before the recording
const TRIM_START = 0;    // seconds to DROP off the FRONT of the recording (0 = none; e.g. 132 = start at 2:12)

// Short window for `proof` mode — pick a stretch that shows a couple of notes + captions.
const PROOF = { start: TRIM_START, len: 120 };

// The fly-in notes. One object per note. trigger = the FIRST time (in-window) its regex
// matches the transcript is when the card flies in. See references/note-kb-guide.md for the
// full field list and how to choose robust triggers. Every field except trigger+title is optional.
const NOTES = [
  // command-reference example:
  // { trigger: /\bls\b|long listing/i, code: true, title: "ls", subtitle: "List",
  //   summary: "Lists the files in the current directory.",
  //   syntax: "ls [options] [path]", example: "$ ls\nDocuments  notes.txt",
  //   rows: [["-l","long listing"],["-a","show hidden files"]], note: "Windows equivalent: **dir**" },
  //
  // concept/step example:
  // { trigger: /browser-based lab/i, kicker: "THE PLATFORM", title: "VA Cyber Range",
  //   summary: "A free, browser-based cybersecurity lab.",
  //   bullets: ["Nothing to install","Reached from a Canvas link"], note: "Used for security tools." },
];

// ====================================================================================
// Engine — generally no need to edit below here.

const MODE = (process.argv[2] || "full").toLowerCase();
const W = JSON.parse(readFileSync(new URL("./transcript.json", import.meta.url)));
const AUDIO_END = W[W.length - 1].end;

const WINDOWS = {
  proof: { start: PROOF.start, len: PROOF.len },
  full: { start: TRIM_START, len: Math.ceil(AUDIO_END - TRIM_START) + 1 },
};
const win = WINDOWS[MODE];
if (!win) throw new Error("mode must be proof|full");
const winEnd = win.start + win.len;

// ---- locate first in-window mention of each note ----
const WIN_W = W.filter((w) => w.start >= win.start && w.start < winEnd);
const offs = [];
let pos = 0;
const parts = [];
for (const w of WIN_W) { offs.push(pos); parts.push(w.text); pos += w.text.length + 1; }
const txt = parts.join(" ");
function wordIndexAt(charIdx) {
  let idx = 0;
  for (let i = 0; i < offs.length; i++) { if (offs[i] <= charIdx) idx = i; else break; }
  return idx;
}
let panels = [];
for (const n of NOTES) {
  const m = txt.match(n.trigger);
  if (!m) { console.warn(`[warn] no in-window match for note "${n.title}" (${n.trigger})`); continue; }
  panels.push({ ...n, _start: WIN_W[wordIndexAt(m.index)].start });
}
panels.sort((a, b) => a._start - b._start);
const MAX_HOLD = 16; // a card stays up at most this long, or until the next card (whichever first)
for (let i = 0; i < panels.length; i++) {
  const next = panels[i + 1];
  let end = panels[i]._start + MAX_HOLD;
  if (next) end = Math.min(end, next._start - 0.5);
  panels[i]._end = Math.max(end, panels[i]._start + 6);
}

// ---- caption grouping (word-level paint-on) ----
const groups = [];
let cur = [];
for (let i = 0; i < W.length; i++) {
  const w = W[i];
  cur.push(w);
  const next = W[i + 1];
  const gap = next ? next.start - w.end : 99;
  const n = cur.length;
  if (n >= 6 || (/[.!?]$/.test(w.text) && n >= 2) || (/,$/.test(w.text) && n >= 4) || gap > 0.5) {
    groups.push(cur); cur = [];
  }
}
if (cur.length) groups.push(cur);
let caps = groups.map((g) => ({
  t0: g[0].start, natEnd: g[g.length - 1].end, words: g.map((w) => ({ t: w.start, text: w.text })),
}));
for (let i = 0; i < caps.length; i++) {
  const next = caps[i + 1];
  let t1 = caps[i].natEnd + 0.8;
  if (next) t1 = Math.min(t1, next.t0);
  caps[i].t1 = Math.max(t1, caps[i].t0 + 0.6);
}

// ---- filter to window + map onto the composition timeline ----
const mapT = (t) => +(t - win.start + TITLE_DUR).toFixed(3);
function clampWin(t0, t1) {
  if (t1 <= win.start || t0 >= winEnd) return null;
  return [Math.max(t0, win.start), Math.min(t1, winEnd)];
}
const outCaps = [];
for (const c of caps) {
  const cw = clampWin(c.t0, c.t1);
  if (!cw) continue;
  const t0 = mapT(cw[0]); const t1 = mapT(cw[1]);
  outCaps.push({ t0, t1, words: c.words.map((w) => ({ t: Math.max(t0, mapT(w.t)), text: w.text })) });
}
const outPanels = [];
for (const p of panels) {
  const cw = clampWin(p._start, p._end);
  if (!cw) continue;
  const { trigger, _start, _end, ...content } = p;
  outPanels.push({ t0: mapT(cw[0]), t1: mapT(cw[1]), ...content });
}

const out = {
  mode: MODE, titleDur: TITLE_DUR, win, total: +(TITLE_DUR + win.len).toFixed(3),
  title: TITLE_CARD, videoSrc: "walkthrough.mp4", captions: outCaps, panels: outPanels,
};
writeFileSync(new URL("./data.js", import.meta.url), "window.__VID = " + JSON.stringify(out, null, 1) + ";\n");

// ---- bake static timing attributes into index.html (renderer reads these at compile time) ----
const idxUrl = new URL("./index.html", import.meta.url);
let html = readFileSync(idxUrl, "utf8");
html = html.replace(/(<div id="root"[^>]*?data-duration=")[^"]*(")/, `$1${out.total}$2`);
html = html.replace(/(<div id="titlecard"[^>]*?data-duration=")[^"]*(")/, `$1${TITLE_DUR}$2`);
for (const tag of ["vid", "aud"]) {
  const re = new RegExp(`(<(?:video|audio) id="${tag}"[^>]*?)data-start="[^"]*"([^>]*?)data-media-start="[^"]*"([^>]*?)data-duration="[^"]*"`);
  html = html.replace(re, `$1data-start="${TITLE_DUR}"$2data-media-start="${win.start}"$3data-duration="${win.len}"`);
}
writeFileSync(idxUrl, html);

console.log(`[${MODE}] trim@${win.start}s len ${win.len}s → total ${out.total}s | captions ${outCaps.length} | notes ${outPanels.length}`);
for (const p of outPanels) console.log(`  ${String(p.title).padEnd(22)} ${p.t0.toFixed(1)}s → ${p.t1.toFixed(1)}s`);
