// Split voiceover-source.md into per-slide narration/sceneNN.txt, applying the
// PRONUNCIATIONS.md convention respellings so af_heart says them correctly.
// Reusable across modules. Run: node build-narration.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine"];
const TEENS = ["ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
function numToWords(n) {
  n = parseInt(n, 10);
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  return String(n);
}

// Keyword emphasis (VIDEO-CONVENTIONS.md): Python keywords that are also English
// words must stand out so they don't blend into the sentence. Quotes inline.
// Conservative, high-confidence patterns only (avoid false hits on plain English).
function emphasizeKeywords(t) {
  const D = "—"; // em dash forces a firm pause around the word
  // "for" is the most ambiguous (common English word) — set it off with dashes
  t = t.replace(/\bfor\b(\s+loops?\b)/gi, (_, r) => `${D} for ${D}${r}`);
  t = t.replace(/\bfor\b(\s+[a-z]{1,5}\s+in\b)/gi, (_, r) => `${D} for ${D}${r}`);
  t = t.replace(/\b(write|writes|loop)\s+for\b/gi, (_, v) => `${v} ${D} for ${D}`);
  // "while" + others: quotes inline (these land fine)
  t = t.replace(/\bwhile\b(\s+loops?\b)/gi, (_, r) => `"while"${r}`);
  t = t.replace(/\b(if|elif|else)\b(\s+(?:statement|clause|block)s?\b)/gi, (_, k, r) => `"${k}"${r}`);
  t = t.replace(/\b(write|writes)\s+(while|if|elif|else)\b/gi, (_, v, k) => `${v} "${k}"`);
  t = t.replace(/\b(break|continue)\b/gi, (_, k) => `"${k}"`);
  t = t.replace(/\b(def|import|try|except|finally|raise|return|class|lambda|yield)\b(\s+(?:keyword|statement|block|function)\b)/gi, (_, k, r) => `"${k}"${r}`);
  return t;
}

// Convention respellings (PRONUNCIATIONS.md). Order matters a little.
function applyConventions(text) {
  let t = emphasizeKeywords(text);
  t = t.replace(/Python/gi, "pie-thawn");
  t = t.replace(/\bKali\b/gi, "kal-ee");
  t = t.replace(/\belif\b/gi, "el-if"); // also fixes "elif" inside quotes -> "el-if"
  // domain jargon Kokoro garbles (PRONUNCIATIONS.md). Scoped so they don't hit ordinary words.
  t = t.replace(/\bstr\b/g, "stir");                 // bare type "str" reads as "S-D-R"; NOT "string"/"instructor"
  t = t.replace(/\bimport re\b/gi, "import R E");     // module "re" else read as "read"
  t = t.replace(/\bre(\s+(?:dot|HOWTO)\b)/gi, (_, r) => `R E${r}`); // "re dot search", "re HOWTO"
  t = t.replace(/\bOOP\b/g, "O O P");
  t = t.replace(/\bVS Code\b/g, "V S Code");          // else "versus Code"
  t = t.replace(/\bmacOS\b/g, "mac O S");             // else "mackos"
  // dotted IP-like numbers (3+ octets) -> say "dot" between (NOT "point"): 10.0.0.5 -> "10 dot 0 dot 0 dot 5"
  t = t.replace(/\b\d{1,3}(?:\.\d{1,3}){2,}\b/g, (m) => m.replace(/\./g, " dot "));
  // decimal section/version numbers like 5.1 -> "five point one" (avoid sentence-end pauses)
  t = t.replace(/\b(\d{1,2})\.(\d{1,2})\b/g, (_, a, b) => `${numToWords(a)} point ${numToWords(b)}`);
  return t;
}

const src = readFileSync(new URL("./voiceover-source.md", import.meta.url), "utf8");
// split into blocks starting at each "### Slide N"
const re = /^###\s+Slide\s+(\d+)\b.*$/gim;
const marks = [];
let m;
while ((m = re.exec(src))) marks.push({ n: +m[1], start: m.index, headEnd: m.index + m[0].length });

// VOICE=eleven (or --clean) skips the Kokoro respellings (pie-thawn etc. would be read literally) and
// instead runs applyElevenConventions(): ElevenLabs-specific respellings + quote emphasis on
// keywords/operators (the clone does NOT set "and"/"or"/"not"/"if"/"elif" apart on its own).
const CLEAN = process.env.VOICE === "eleven" || process.argv.includes("--clean");

// Keyword/operator emphasis for ElevenLabs (clean mode). The clone does NOT set Python keywords or
// the operators "and"/"or"/"not" apart on its own — they melt into the sentence (Randy, 2026-06). So
// we add quote emphasis (Randy A/B-picked quotes over em-dashes), but ONLY in keyword/operator-naming
// frames — never inside an expression ("443 and protocol") or plain English ("does not use", "and
// then"). High precision over recall: a missed emphasis just reads normally; a false hit mis-stresses
// an ordinary word. Quotes don't change the spoken words, so Whisper captions stay correct.
function emphasizeKeywordsEleven(t) {
  // --- control-flow keywords: if / elif / else / while ---
  t = t.replace(/\b(write|writes)\s+(if|elif|else|while)\b/gi, (_, v, k) => `${v} "${k}"`);
  t = t.replace(/\b(if|elif|else)\b(?=\s+(?:statement|clause|block|branch|condition)(?:es|s)?\b)/gi, (_, k) => `"${k}"`);
  t = t.replace(/\b(if|elif)\b(?=\s+[a-z_]+\s+double-equals\b)/gi, (_, k) => `"${k}"`); // "if port double-equals", "elif port double-equals"
  t = t.replace(/\bthe word\s+(if|elif|else)\b/gi, (_, k) => `the word "${k}"`);
  t = t.replace(/\bthe\s+(if|elif|else)\b(?=[,.])/gi, (_, k) => `the "${k}"`);           // "the if,", "belong to the if."
  t = t.replace(/\b(else)\b(?=,\s+print\b)/gi, (_, k) => `"${k}"`);                       // "and finally else, print"
  t = t.replace(/\bwhile\b(?=\s+loops?\b)/gi, () => `"while"`);
  // --- logical operators: and / or / not — ONLY when named/defined, never in an expression ---
  t = t.replace(/\bwords?\s+and,\s*or,\s*and\s+not\b/gi, () => `words "and", "or", and "not"`); // "the actual words and, or, and not"
  t = t.replace(/\b(is|are)\s+(and|or|not)\b(?=,?\s+(?:which|when)\b)/gi, (_, v, k) => `${v} "${k}"`); // "The first is and, which"
  t = t.replace(/\bevaluates\s+and\s+before\s+or\b/gi, () => `evaluates "and" before "or"`);
  t = t.replace(/\bthe word\s+(and|or|not)\b/gi, (_, k) => `the word "${k}"`);
  t = t.replace(/\b(?:the\s+)?(and|or|not)\s+(operators?)\b/gi, (_, k, w) => `"${k}" ${w}`);  // "the and operator"
  return t;
}

// ElevenLabs-specific respellings (clean mode ONLY). A few terms the clone mispronounces. Kept minimal
// and scoped to the exact token. Captions are corrected back to the real word after transcription via
// the transcript-patch in batch-eleven.sh (Whisper can't hear the respelling). See PRONUNCIATIONS.md.
function applyElevenConventions(t) {
  t = emphasizeKeywordsEleven(t);          // quote emphasis first, so "elif" -> "elif" -> respelled below
  t = t.replace(/\belif\b/gi, "ell-iff");  // clone says plain "elif" as "AH-lif"; "ell-iff" -> "ELL-if" (Randy-picked)
  t = t.replace(/\bregex\b/g, "rej-ex");   // -> "REJ-eks" (NOT "regular expression")
  t = t.replace(/\bRegex\b/g, "Rej-ex");
  return t;
}
mkdirSync(new URL("./narration/", import.meta.url), { recursive: true });
let count = 0;
for (let i = 0; i < marks.length; i++) {
  const bodyStart = marks[i].headEnd;
  const bodyEnd = i + 1 < marks.length ? marks[i + 1].start : src.length;
  let body = src.slice(bodyStart, bodyEnd);
  body = body.replace(/^\s*-{3,}\s*$/gm, "").trim(); // drop --- separators
  body = (CLEAN ? applyElevenConventions(body) : applyConventions(body)).replace(/\s+\n/g, "\n").trim();
  const nn = String(marks[i].n).padStart(2, "0");
  writeFileSync(new URL(`./narration/scene${nn}.txt`, import.meta.url), body + "\n");
  count++;
}
console.log(`wrote ${count} narration files${CLEAN ? " (VOICE=eleven: clean/raw, no Kokoro respellings)" : ""}`);
if (!CLEAN) {
  // quick proof: show any remaining bare decimals or the word python (should be none)
  const leftover = [];
  for (let i = 1; i <= count; i++) {
    const nn = String(i).padStart(2, "0");
    const txt = readFileSync(new URL(`./narration/scene${nn}.txt`, import.meta.url), "utf8");
    if (/\bpython\b/i.test(txt)) leftover.push(`scene${nn}: python`);
    if (/\b\d{1,2}\.\d{1,2}\b/.test(txt)) leftover.push(`scene${nn}: bare-decimal`);
  }
  console.log(leftover.length ? "LEFTOVERS: " + leftover.join(", ") : "no leftover python/decimals — clean");
}
