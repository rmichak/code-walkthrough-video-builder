// tts-eleven.mjs — OPTIONAL ElevenLabs narration for the lecture pipeline.
// Use ONLY when the user explicitly asks for "my ElevenLabs voice". Default is Kokoro af_heart
// via `hyperframes tts` (see SKILL.md). Run build-narration.mjs with VOICE=eleven first so the
// narration/sceneNN.txt files are the CLEAN script (no Kokoro respellings — ElevenLabs says them right).
//
// Reads every narration/sceneNN.txt and writes assets/audio/sceneNN.wav (44.1 kHz mono).
// Then transcribe each wav with Whisper and run build-lecture.mjs exactly as in the af_heart path.
//
// Usage:   node tts-eleven.mjs
// Env:
//   ELEVENLABS_API_KEY        (required) — exported, or it is loaded from a project .env (see ENV_FALLBACKS)
//   ELEVENLABS_VOICE_ID       default WDNcQRsDvU7LRpZE7Ya3  (Randy's clone)
//   ELEVENLABS_MODEL_ID       default eleven_turbo_v2_5
//   ELEVENLABS_STABILITY      default 0.5
//   ELEVENLABS_SIMILARITY     default 0.75
//   ELEVENLABS_SPEED          default 1.09   (0.7–1.2 on turbo/v2.5)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "WDNcQRsDvU7LRpZE7Ya3";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";
const STABILITY = parseFloat(process.env.ELEVENLABS_STABILITY || "0.5");
const SIMILARITY = parseFloat(process.env.ELEVENLABS_SIMILARITY || "0.75");
const SPEED = parseFloat(process.env.ELEVENLABS_SPEED || "1.09");
// If the key isn't exported, try these .env files (read-only convenience):
// the current project dir, then a `.env` in your home directory. Add your own if needed.
const ENV_FALLBACKS = [
  `${process.cwd()}/.env`,
  `${process.env.HOME || ""}/.env`,
];

function loadEnvFile(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

if (!process.env.ELEVENLABS_API_KEY) for (const f of ENV_FALLBACKS) { loadEnvFile(f); if (process.env.ELEVENLABS_API_KEY) break; }
const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("ERROR: ELEVENLABS_API_KEY not set. Export it (e.g. `export ELEVENLABS_API_KEY=...`) or place it in one of:\n  " + ENV_FALLBACKS.join("\n  "));
  process.exit(1);
}

async function tts(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: STABILITY, similarity_boost: SIMILARITY, style: 0.0, use_speaker_boost: true, speed: SPEED },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return Buffer.from(await res.arrayBuffer());
}

const dir = new URL("./narration/", import.meta.url);
const scenes = readdirSync(dir).filter((f) => /^scene\d+\.txt$/.test(f)).sort();
if (!scenes.length) { console.error("ERROR: no narration/sceneNN.txt found — run build-narration.mjs (VOICE=eleven) first."); process.exit(1); }
mkdirSync(new URL("./assets/audio/", import.meta.url), { recursive: true });
console.error(`ElevenLabs voice=${VOICE_ID} model=${MODEL_ID} speed=${SPEED} — ${scenes.length} scenes`);

for (const f of scenes) {
  const nn = f.match(/scene(\d+)\.txt/)[1];
  const text = readFileSync(new URL(`./narration/${f}`, import.meta.url), "utf8").trim();
  const mp3 = await tts(text);
  const tmp = new URL(`./assets/audio/.scene${nn}.mp3`, import.meta.url);
  writeFileSync(tmp, mp3);
  const wav = new URL(`./assets/audio/scene${nn}.wav`, import.meta.url);
  const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp.pathname, "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", wav.pathname]);
  rmSync(tmp, { force: true });
  if (ff.status !== 0) { console.error(`ffmpeg failed on scene${nn}`); process.exit(1); }
  console.error(`  scene${nn}: ${(mp3.length / 1024).toFixed(0)} KB -> wav`);
}
console.error("done — now transcribe each wav (whisper) and run build-lecture.mjs");
