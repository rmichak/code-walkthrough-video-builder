// patch-captions.mjs — fix caption text after Whisper transcription on the ElevenLabs path.
// Some narration tokens are respelled for the clone voice (e.g. elif -> "ell-iff") or are simply
// mis-heard by Whisper even when the audio is correct (e.g. dict -> "dick"). Captions are built from
// the Whisper transcript (build-lecture.mjs reads narration/sceneNN.json verbatim), so we rewrite the
// mis-heard word text back to the correct on-screen spelling here. Audio is untouched.
//
// Run AFTER transcribe, BEFORE build-lecture.  Usage: node patch-captions.mjs
//
// SAFETY RULE: only map forms that NEVER legitimately appear in the narration, so a blanket
// replace can't corrupt a real word. (e.g. "read"->"re" is NOT safe — "read" is a real word — so
// we do not do it; the `re` module audio is left as-is.)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

// [regex over a single Whisper token (case-insensitive), replacement display text].
// `\b` anchors keep trailing punctuation (e.g. "dick," -> "dict,").
const SINGLE = [
  // elif respelled to "ell-iff" — Whisper consistently hears it as the single token "LIF" (also
  // seen: liff, lcif, alif, ell-iff). None of these are real words in the scripts, so this is safe.
  [/\b(?:lif|liff|lcif|alif|ell?[\-\s]?iff?|el[\-\s]?if|elif)\b/gi, "elif"],
  // tokens Whisper mangles even though the clone says them fine (audio NOT respelled):
  [/\bdick\b/gi, "dict"],     // "dict" -> Whisper "dick"
  [/\bquarks\b/gi, "kwargs"], // "kwargs" -> Whisper "quarks"
];

// Two-token mis-hearings: Whisper splits one spoken word into two tokens. Each entry merges a
// matching [w_i, w_{i+1}] pair into a single caption word (first.start .. second.end).
// Filled in only if the proof transcript shows a split; empty by default.
const PAIRS = [
  // example: { a: /^ell$/i, b: /^if[.,]?$/i, to: "elif" }
];

const dir = new URL("./narration/", import.meta.url);
const files = readdirSync(dir).filter((f) => /^scene\d+\.json$/.test(f)).sort();
let changed = 0, scenesTouched = 0;

for (const f of files) {
  const url = new URL(`./narration/${f}`, import.meta.url);
  let words;
  try { words = JSON.parse(readFileSync(url, "utf8")); } catch { continue; }
  if (!Array.isArray(words) || !words.length) continue;
  let touched = false;

  // pass 1: merge split pairs
  if (PAIRS.length) {
    for (let i = 0; i < words.length - 1; i++) {
      for (const p of PAIRS) {
        const at = (words[i].text || "").trim(), bt = (words[i + 1].text || "").trim();
        if (p.a.test(at) && p.b.test(bt)) {
          const punct = (bt.match(/[.,!?;:]+$/) || [""])[0];
          words[i] = { text: p.to + punct, start: words[i].start, end: words[i + 1].end };
          words.splice(i + 1, 1);
          touched = true; changed++;
        }
      }
    }
  }
  // pass 2: single-token replacements
  for (const w of words) {
    const before = w.text;
    for (const [re, to] of SINGLE) w.text = w.text.replace(re, to);
    if (w.text !== before) { touched = true; changed++; }
  }

  if (touched) { writeFileSync(url, JSON.stringify(words)); scenesTouched++; }
}
console.log(`patch-captions: ${changed} word(s) fixed across ${scenesTouched} scene(s)`);
