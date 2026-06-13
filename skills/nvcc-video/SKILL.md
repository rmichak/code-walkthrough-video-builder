---
name: nvcc-video
description: >-
  Build a branded, captioned NVCC course video with HyperFrames — two modes: (A) enhance an existing
  screen-recording (.mp4) with an NVCC green/gold title card, word-by-word captions, fly-in note panels,
  and on-screen code highlights; or (B) build a narrated lecture from a module's slide deck + per-slide
  voiceover.md (TTS narration, each slide a scene, word-by-word captions, in-context line-by-line code
  highlighting). Default narration voice is Kokoro af_heart @ 0.95; use Randy's ElevenLabs cloned voice
  ONLY when he explicitly asks ("use my ElevenLabs voice", "my 11labs voice", "my real voice"). Bundles
  the pronunciation rules and the code-animation + keyword-emphasis conventions so videos stay consistent
  without re-explaining. Use whenever the user wants to caption, brand, enhance, narrate, or add
  notes/code-highlights to a course recording, lecture, walkthrough, slide deck, or demo for an NVCC class
  (ITP 270, ITN 170, any course) — phrasings like "gen an NVCC video", "make a lecture video from these
  slides", "narrate this module", "add CC and notes to this recording", "fly in notes about the commands",
  or "enhance this walkthrough" — even when they don't say "HyperFrames". Also trims the front off a
  recording before enhancing.
---

# NVCC Video Builder

Produce a branded, captioned NVCC course video from a raw screen recording. The recording stays
the predominant full-frame layer; on top go three things: a short NVCC title card, **word-by-word
closed captions** transcribed from the audio, and **fly-in note panels** that surface relevant
detail (a command's syntax/flags, or a concept/step) exactly when the instructor talks about it.

This is a proven pipeline. Per video you mostly edit one config block. Default flow is
**proof-first**: render a short segment, confirm the look, then render the whole thing.

> **Core principle — point the student's eyes.** Any time a segment is *just code on screen
> while the instructor talks through the logic*, put a visible highlight on the exact thing being
> discussed. Don't make students hunt the page for what "this line" or "that variable" refers to —
> draw a box/border or tint around it, synced to when it's spoken, and remove it when the topic
> moves on. A simple highlight or border is enough; step through the code line by line when that
> helps. See **[Highlight the code being discussed](#4b--highlight-the-code-being-discussed)**.

## Two production modes — pick by what you're handed

- **Mode A — enhance a screen recording.** You have a `walkthrough.mp4`; overlay an NVCC title card +
  word-by-word captions + fly-in note panels + code highlights on top of it. This is the **Workflow**
  section below.
- **Mode B — lecture from a slide deck + voiceover.** No recording — you have a module's slide deck
  (`module-0X-slides.html` built on the shared `_template/slides.css`) and a per-slide `voiceover.md`.
  Generate TTS narration, render each slide as a scene, and add word-by-word captions + in-context
  code highlighting. This is the proven pipeline used for ITP 270 modules 1–9. See **[Mode B](#mode-b--build-a-lecture-from-a-slide-deck--voiceover)**.

Both modes share the **Voice** rule and the **Conventions** below.

## Voice (both modes)

- **Default — Kokoro `af_heart` @ speed 0.95.** Use this for every video unless the user explicitly
  says otherwise: `npx hyperframes tts <file> --voice af_heart --speed 0.95 -o <out>.wav`.
- **ElevenLabs (Randy's cloned voice) — OPT-IN, only when explicitly asked.** Triggers: "use my
  ElevenLabs voice", "my 11labs voice", "my real voice". Then run `assets/lecture/tts-eleven.mjs`
  (voice `WDNcQRsDvU7LRpZE7Ya3`, model `eleven_turbo_v2_5`; all settings env-overridable). It reads
  `ELEVENLABS_API_KEY` from the environment (or a project `.env` fallback) — **the key is never stored
  in the skill**; if it's missing the script errors with where to put it. **When using ElevenLabs,
  build the narration in clean mode** (`VOICE=eleven node build-narration.mjs`) so the Kokoro
  respellings and keyword quote/dash emphasis are skipped — ElevenLabs pronounces and emphasizes
  naturally, and "pie-thawn"/quotes would be read literally. Everything downstream (transcribe,
  captions, code highlight, render) is identical to the af_heart path.

## Humanize generated narration & scripts (both modes) — REQUIRED

Any narration or script text **you generate** for a video must be run through the **`humanizer`**
skill before it is used. TTS will faithfully speak whatever AI-isms you leave in, so an un-humanized
script produces a video that *sounds* AI-written. This step is not optional.

**REQUIRED SUB-SKILL:** Use `humanizer` on the generated text, steering it with its spoken
*Teaching Materials (NOVA)* / read-aloud voice (this is narration spoken to students, not an article).

- **What to humanize:** prose **you wrote** — Mode B's `voiceover-source.md`; in Mode A, any note-card
  `summary`/`bullets` and title text you authored.
- **What NOT to humanize:** text transcribed from a real recording. Mode A captions are the
  instructor's *actual spoken words* — leave them exactly as transcribed.
- **Order matters — humanize the RAW script first, before the mechanical passes.** The Kokoro
  respellings + keyword emphasis (`applyConventions()` in `build-narration.mjs`) and the Whisper
  caption transcript run *after*. So the flow is: write the script → **humanizer pass** →
  `build-narration.mjs` → TTS. Humanizing after the respellings would rewrite "pie-thawn" and the
  quote/dash emphasis into nonsense.
- **Preserve structure:** the humanizer must keep every `### Slide N` header and the one-block-per-slide
  split intact, so re-run the **count check** afterward — headers must still equal the slide count.

## Conventions (both modes) — applied automatically by the generators

These are baked into the lecture generators so you don't re-explain them per video:

- **[references/PRONUNCIATIONS.md](references/PRONUNCIATIONS.md)** — Kokoro respellings: Python→pie-thawn,
  Kali→kal-ee, elif→el-if, str→stir, `re`→"R E", OOP→"O O P", VS Code, macOS, decimals→"…point…",
  IP/dotted addresses→"…dot…". **Kokoro-only — skipped for ElevenLabs.** Add new module-specific terms
  here as you confirm them.
- **[references/VIDEO-CONVENTIONS.md](references/VIDEO-CONVENTIONS.md)** — keyword/operator emphasis
  (`for`→em-dashes, `while`/`break`/`if`/etc.→quotes, dashes when *defining* an operator) and
  **in-context** code highlighting: a line-by-line highlight bar synced to the narration + a gold
  window glow on the code block, both cleared once the narration moves on. Palette: gold = "look here",
  green = correct/result, red = error/untaken branch. Inactive overlays stay `visibility:hidden`.

`assets/lecture/build-narration.mjs` (`applyConventions()`) encodes the pronunciations + keyword
emphasis + IP/decimal handling; `assets/lecture/build-lecture.mjs` encodes the 2× slide scaling,
captions, code highlights, entrance animations, and the float-safe timing cascade.

## Prerequisites

- `node` ≥ 22, `ffmpeg`, and `npx hyperframes` (the CLI fetches itself). Run `npx hyperframes doctor` if unsure.
- Captions use **local Whisper** (free, offline, word-level timestamps) via `hyperframes transcribe`.
- Renders are CPU/GPU + memory heavy. On a low-RAM machine use `--workers 2` and warn the user that
  `validate`/`inspect` may hit a 10s page-load timeout on large (>250MB) source videos (see Gotchas).

## Workflow (Mode A — enhance a screen recording)

### 1 · Scaffold the project

Create a sibling HyperFrames project next to the source video and drop in this skill's templates.
Name it after the video.

```bash
cd "<folder containing the source mp4>"
npx hyperframes init <Name>-hyperframes --example blank --non-interactive
cp "<source>.mp4" <Name>-hyperframes/walkthrough.mp4
cp <SKILL_DIR>/assets/index.html  <Name>-hyperframes/index.html
cp <SKILL_DIR>/assets/build-data.mjs <Name>-hyperframes/build-data.mjs
cp <SKILL_DIR>/assets/design.md   <Name>-hyperframes/design.md
```

`<SKILL_DIR>` is this skill's directory. Copying a 250MB+ video is fine; it makes the render
self-contained.

### 2 · Transcribe the audio (word-level)

```bash
cd <Name>-hyperframes
npx hyperframes transcribe walkthrough.mp4 --model small.en
```

Use `small.en` only for English audio. For another language use `--model small --language <code>`
(never the `.en` models on non-English — they translate instead of transcribe). Output: `transcript.json`
(a flat array of `{text,start,end}` words). This drives **both** captions and note timing.

### 3 · Study the content and find real timings  ⚠ most important step

Recordings improvise and diverge from any written script, and Whisper mangles short command tokens.
So derive the notes and their timing from the **actual transcript**, not a lesson plan. Probe it
without dumping it into context (use `ctx_execute_file`, or a small node script):

```js
// inside ctx_execute_file over transcript.json (FILE_CONTENT)
const TRIM = 0; // set to your front-trim seconds
const W = JSON.parse(FILE_CONTENT).filter(w => w.start >= TRIM);
const off=[]; let p=0, parts=[]; for(const w of W){off.push(p);parts.push(w.text);p+=w.text.length+1;}
const txt = parts.join(" ");
const at = ci => { let i=0; for(let k=0;k<off.length;k++){ if(off[k]<=ci) i=k; else break;} return i; };
const fmt = t => `${Math.floor(t/60)}:${(t%60).toFixed(1).padStart(4,"0")}`;
const probe = re => { const m=txt.match(re); return m ? `${fmt(W[at(m.index)].start)}  …${txt.slice(Math.max(0,m.index-20),m.index+44).replace(/\s+/g," ")}…` : "NONE"; };
for (const [k,re] of Object.entries({ /* candidate terms → regexes */ })) console.log(k.padEnd(12), probe(re));
```

For each candidate note, confirm: it's actually covered, *when* the teaching starts, and how the
term was transcribed. There's usually a companion guide in `instructor-videos/module-*.md` — use it
to know what to look for, but trust the transcript for timing. See
[references/note-kb-guide.md](references/note-kb-guide.md) for trigger-design rules.

### 4 · Fill in the config block of `build-data.mjs`

Edit **only** the CONFIG block:
- `TITLE_CARD` — `title`, `subtitle`, optional `kicker`, and `prompt` (`""` to hide the mono line).
- `TRIM_START` — seconds to drop off the front (0 = none).
- `PROOF` — a `{start,len}` window that contains a couple of notes for the look check.
- `NOTES` — one entry per fly-in card. Unified schema (any field optional except `trigger`+`title`):
  command cards use `code:true`+`subtitle`+`syntax`/`example`/`rows`; concept cards use `kicker`+`bullets`.
  Full field list and trigger guidance: [references/note-kb-guide.md](references/note-kb-guide.md).

### 4b · Highlight the code being discussed

Whenever a stretch of the recording is **code on screen + the instructor narrating the logic**,
don't leave students scanning for "this line" or "that variable." Put a marker on the exact spot,
synced to when it's spoken, and clear it when the discussion moves on. This is the single biggest
comprehension win for code segments — treat it as the default, not an extra.

**What a marker is** (cheapest first — a simple one is plenty):
- a **border/box** drawn around the line(s), block, function, or token being discussed;
- a soft **highlight tint** (NVCC-gold or green wash) over that region;
- an **arrow / underline** pointing at a single token (a variable, an operator, a flag);
- a **moving highlight that steps line by line** when the instructor walks through execution
  order — advance it on each "and then…", dim lines that were skipped (e.g. an untaken `if`
  branch). Use this when the *flow* is the point, not just one line.

**How it's built in this pipeline.** A marker is just another timed overlay, same mechanism as the
fly-in note panels — a positioned, semi-transparent element over the recording, shown/hidden on the
transcript clock. Add a `HIGHLIGHTS` array alongside `NOTES` in `build-data.mjs`, each entry:
`{ trigger, atLine|box, style: "border"|"tint"|"arrow", out }` where the rectangle is positioned
over the code region in the recording. Because the code lives **inside the recorded video**, you
must eyeball the pixel rectangle from a representative frame (`ffmpeg -ss <t> -i walkthrough.mp4
-frames:v 1`), then place the overlay there. Keep markers `visibility:hidden` when inactive so the
WCAG checker skips them (same rule as notes). Trigger and verify timing from the transcript exactly
like notes (step 3) — highlight should land *as* the instructor says it, not before.

**Guidance:**
- One marker at a time per idea; don't light up the whole screen. Move/replace it as the topic moves.
- Match NVCC palette — gold for "look here", green for "this is correct/the result", red only for an error/skip.
- Border or tint is enough for a held explanation; reserve the line-by-line step for genuine execution walk-throughs.
- If the instructor edits the code while talking, re-check the rectangle — the line may have moved.
- Verify every highlight from rendered frames (step 5), confirming it sits on the right region and clears on `out`.

> Authoring code-execution highlights from scratch (not over a recording)? The `hyperframes` skill's
> `references/css-patterns.md` covers seek-safe marker sweeps, circles, and underlines, and a moving
> line-highlight bar pattern. Pull from there for the overlay styling.

### 5 · Proof: generate, validate, render a short segment

```bash
node build-data.mjs proof            # writes data.js + bakes timing into index.html; prints the note map
npx hyperframes lint                 # must be clean
npx hyperframes validate             # WCAG/console check (may time out on huge videos — see Gotchas)
npx hyperframes inspect --at <title,note1,note2,...>   # layout overflow check at hero frames
npx hyperframes render --output renders/proof.mp4 --quality standard --workers 3
```

Then **verify by extracting frames** (don't trust "it rendered") and show the user:

```bash
for t in 2 <note-times>; do ffmpeg -loglevel error -y -ss $t -i renders/proof.mp4 -frames:v 1 /tmp/p_$t.png; done
```

Read the PNGs: title card correct, notes fly in synced to the terminal/screen, captions paint on
word by word, panels gone when inactive. Get the user's OK (or iterate on NOTES/styling).

### 6 · Full render

```bash
node build-data.mjs full
npx hyperframes render --output renders/<Name>-final.mp4 --quality standard --workers 3
```

Verify the output: `ffprobe -show_entries format=duration` should equal `total` from step 6's log,
and `Capturing frame N/N` should match `total × fps`. Spot-check frames at a few note times — and,
if you trimmed, at a frame just after the title card to confirm the recording starts at the trim point.
Report the final path, duration, and size.

## Mode B — Build a lecture from a slide deck + voiceover

Use this when there's **no recording** — just a module's slide deck and a per-slide script. Inputs:
`content/module-0X/slides/module-0X-slides.html` (deck on the shared `_template/slides.css`) and
`content/module-0X/slides/voiceover.md` (one `### Slide N` block per deck page). Output:
`module-0X-lecture.mp4`, placed next to the deck. Same proof-first discipline; the two generators do
the heavy lifting so each module is mostly copy-config-run.

### B1 · Scaffold

Create a HyperFrames project under a working folder (e.g. `itp270_lecture/module-0X/hyperframes/`).
Copy in:
- `content/_template/slides.css` and `nova-logo.svg` → `assets/`
- this skill's lecture scripts from **`assets/lecture/`** → project root:
  `build-narration.mjs`, `build-lecture.mjs`, `tts-eleven.mjs`, `patch-captions.mjs` (eleven caption fixes)
- the deck → `deck.html`; the voiceover → `voiceover-source.md`

### B2 · Count check (stop if mismatch)

The number of top-level `.slide` pages in `deck.html` must equal the number of `### Slide` blocks in
`voiceover-source.md`. If they differ, reconcile before going further — a drift here misaligns every
scene downstream.

### B2b · Humanize the script (required, before narration)

Run `voiceover-source.md` through the **`humanizer`** skill (see *Humanize generated narration &
scripts* above) and save the cleaned result back to `voiceover-source.md`. Do this **before** B3 —
`build-narration.mjs` applies the Kokoro respellings, so it has to run on the already-humanized text.
The humanizer must keep every `### Slide N` header; re-run the **B2 count check** after it to confirm
the block count still matches the deck.

### B3 · Narration

- Default (af_heart): `node build-narration.mjs` → writes `narration/sceneNN.txt` with all conventions
  applied (respellings + keyword emphasis + IP/decimal handling). It logs any leftover `python`/bare
  decimals as a self-check.
- ElevenLabs (only if asked): `VOICE=eleven node build-narration.mjs` → clean/raw text, no respellings.

### B4 · TTS

- Default: for each scene, `npx hyperframes tts narration/sceneNN.txt --voice af_heart --speed 0.95 -o assets/audio/sceneNN.wav`.
- ElevenLabs (only if asked): `node tts-eleven.mjs` — loops every `narration/sceneNN.txt` → ElevenLabs
  → `ffmpeg` → `assets/audio/sceneNN.wav` (44.1 kHz mono). Requires `ELEVENLABS_API_KEY` in env/.env.

### B5 · Transcribe (word-level, for captions)

For each clip: `npx hyperframes transcribe assets/audio/sceneNN.wav --model small.en`, then move the
emitted `transcript.json` to `narration/sceneNN.json`. (Whisper usually re-hears the respellings as
the real word, so captions stay correct.)

**ElevenLabs only — B5b · Patch captions.** A few eleven respellings don't survive Whisper (e.g.
`ell-iff` → heard as "LIF"), and the clone mis-hears a couple of tokens even when the audio is right
(`dict`→"dick", `kwargs`→"quarks"). Run `node patch-captions.mjs` **after** transcribe and **before**
build-lecture — it rewrites those mis-heard caption tokens back to the correct on-screen spelling
(audio untouched). Quote-emphasized keywords/operators need no patch (quotes change only prosody).

### B6 · Generate the composition

`node build-lecture.mjs` → writes `index.html` + `assets/cc-data.js`: each `.slide` wrapped in a scene
and `transform: scale(2)` (origin top-left) to fill 1920×1080 crisply, word-by-word captions, in-context
code-line highlights + window glow, entrance animations, and the float-safe timing cascade
(`scene data-duration = sceneDur − 0.01` to avoid overlap).

### B7 · Lint, render, place

`npx hyperframes lint` must be clean, then
`npx hyperframes render --output renders/module-0X-lecture.mp4 --quality standard --workers 2`.
Verify frames (title, a code slide with a highlight + a caption word, the wrap), confirm
`ffprobe` duration ≈ Σ clip durations, then copy the mp4 next to the deck:
`content/module-0X/slides/module-0X-lecture.mp4`.

> **Why the 2× scale:** the deck CSS is a WeasyPrint *print* stylesheet (254 mm × 142.9 mm ≈ 960×540 px).
> Wrapping each `.slide` and scaling 2× fills 1080p while keeping every element addressable for the
> entrance animations, code highlights, and caption sync.

## Gotchas (learned the hard way)

- **Render duration comes from STATIC html attributes**, read at compile time before any runtime JS.
  `build-data.mjs` bakes `data-duration`/`data-media-start` into `index.html` for this reason. If a
  "full" render comes out the length of the proof, you ran `render` without re-running `node build-data.mjs full` first. Always regenerate before rendering.
- **Detection is windowed.** A command spoken in a trimmed/discarded section can't claim a card —
  good, but it means triggers must match something said *after* `TRIM_START`.
- **Whisper ≠ the script.** Trigger on distinctive spoken phrases, not literal tokens. Verify every note's timestamp.
- **Fonts:** use `Roboto` (sans) + `JetBrains Mono` — both embeddable. Arial/Arimo are *not* in the
  renderer's font list and will warn / fall back.
- **Contrast false-positives:** note/caption text sits over the video; inactive overlays are
  `visibility:hidden` so the WCAG checker skips them. Keep that — don't switch to opacity-only.
- **Big videos + low RAM:** `validate`/`inspect` load the page in headless Chrome with a 10s nav
  timeout; a 290MB video under memory pressure can exceed it. `lint` still works; verify layout from
  rendered frames instead, and consider `--workers 2`.
- **Always verify by looking at rendered frames**, never by the render exit code alone.

## Regenerating / tweaking later

Everything is regenerable: edit the `NOTES`/title in `build-data.mjs`, run `node build-data.mjs full`,
re-render. The composition HTML and `design.md` rarely need touching.
