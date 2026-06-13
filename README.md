# Code Walkthrough Video Builder

Build short, branded, captioned **coding / lecture videos programmatically** — no screen
recording, no video editor, no timeline scrubbing. You describe what should happen in a small
config or spec file, run a build script, and out comes a 1080p MP4 with typed-out code, real
terminal output, TTS voiceover, and word-synced burned-in captions.

Everything is generated from text, so a video is **regenerable**: change a line, re-render in
~30 seconds. The whole pipeline is driven by the open-source [`hyperframes`](https://www.npmjs.com/package/hyperframes)
CLI (fetched automatically via `npx`) plus the two **skills** in this repo.

> These are [Agent Skills](https://docs.claude.com/en/docs/claude-code/skills) — folders of
> instructions + assets that an AI coding agent (Claude Code) loads on demand. You can also run
> the pipeline **by hand** without any agent; both paths are documented below.

---

## What's in here

Two complementary skills. Pick by **what you're starting from**:

| Skill | Use it when you have… | What it produces |
|---|---|---|
| **[`code-demo-video`](skills/code-demo-video/)** | …just code (or an assignment) and want it *demonstrated* | A **simulated VS Code window** where the code types itself character-by-character, with a fake terminal showing real program output, line-focus highlighting, optional "your turn" pause cards, TTS voiceover, and captions. Nothing was ever recorded on screen. |
| **[`nvcc-video`](skills/nvcc-video/)** | …an existing screen recording **or** a slide deck + script | **Mode A:** overlays a title card, word-by-word captions, fly-in note panels, and synced code highlights *on top of* your `.mp4`. **Mode B:** turns a slide deck + per-slide narration into a fully narrated, captioned lecture video. |

**Rule of thumb:** `code-demo-video` *fabricates* footage that was never recorded;
`nvcc-video` *decorates* footage (or slides) you already have.

They share one foundation — the `hyperframes` engine, the same default voice, the same
word-by-word caption pipeline (local Whisper), the same "proof-first then verify from rendered
frames" discipline, and the same palette convention (gold = "look here", green = result,
red = error).

---

## How it works (the pipeline)

```
  your spec / config + narration text
            │
            ▼
   node build-*.mjs        ← pure Node (no extra npm deps); emits index.html + timing + a beat/note map
            │
   npx hyperframes tts        ← Kokoro/ElevenLabs text-to-speech → audio/*.wav
   npx hyperframes transcribe ← local Whisper → word-level timestamps → captions
            │
   npx hyperframes lint / validate / inspect   ← quality gates (0 errors, WCAG contrast, layout)
            │
   npx hyperframes render --output out.mp4      ← headless-Chrome compositor → H.264 MP4
            │
            ▼
       a finished 1080p video
```

`hyperframes` is a real, publicly installable CLI — `npx` fetches it the first time you run it.
The build scripts in this repo (`build-demo.mjs`, `build-data.mjs`, `build-lecture.mjs`,
`build-narration.mjs`) use **only Node built-ins**, so there is nothing else to `npm install`.

---

## Prerequisites

| Requirement | Why | Check |
|---|---|---|
| **Node.js ≥ 22** | runs the build scripts and the `hyperframes` CLI | `node --version` |
| **ffmpeg** | rendering, audio mux, frame extraction for verification | `ffmpeg -version` |
| **Internet (first run only)** | `npx` fetches the `hyperframes` package and Whisper downloads its model once | — |
| **~2–4 GB free RAM** | the renderer composits in headless Chrome | — |

That's it — no API keys are required for the default voice. Run a one-shot health check anytime:

```bash
npx hyperframes doctor
```

> **Voiceover:** the default voice is **Kokoro `af_heart` @ speed 0.95**, which runs locally and
> needs no account or key. An optional ElevenLabs path exists (see [Voice options](#voice-options)).

---

## Quick start — clone and build the bundled example

The `code-demo-video` skill ships a complete, working ~35-second example (a "hello world"
explainer). Here's the exact sequence to render it from a clean clone:

```bash
# 1. Clone
git clone https://github.com/rmichak/code-walkthrough-video-builder.git
cd code-walkthrough-video-builder

# 2. Scaffold a HyperFrames project and drop in the code-demo-video skill's engine + example
SKILL="$PWD/skills/code-demo-video"
npx hyperframes init demo --example blank --non-interactive
cd demo
cp "$SKILL/assets/template.html.src" "$SKILL/assets/build-demo.mjs" .
mkdir -p fonts audio
cp "$SKILL/assets/fonts/BricolageGrotesque-Variable.woff2" fonts/
cp "$SKILL/assets/example-explainer.spec.mjs" demo.spec.mjs

# 3. Generate voiceover for each beat (the example has 4: title, typing, run, outro).
#    Beat i (0-based) with id X  →  audio/vo-<i+1, 2 digits>-X.wav
npx hyperframes tts "Let's write our very first Python program." --voice af_heart --speed 0.95 -o audio/vo-01-title.wav
npx hyperframes tts "We call print, and pass it our message in quotes." --voice af_heart --speed 0.95 -o audio/vo-02-typing.wav
npx hyperframes tts "Run it, and there's our greeting in the terminal."  --voice af_heart --speed 0.95 -o audio/vo-03-run.wav
npx hyperframes tts "And that's your first program. Nice work."          --voice af_heart --speed 0.95 -o audio/vo-04-outro.wav
#    ^ swap in the exact narration strings from demo.spec.mjs if you edit the beats.

# 4. Transcribe each clip for word-synced captions.
#    `transcribe` always writes audio/transcript.json next to the input, so rename it to match
#    the clip (the build script looks for audio/vo-NN-id.json beside each vo-NN-id.wav).
for clip in vo-01-title vo-02-typing vo-03-run vo-04-outro; do
  npx hyperframes transcribe "audio/$clip.wav" --model small.en
  mv audio/transcript.json "audio/$clip.json"
done

# 5. Build → writes index.html, prints the beat map + any warnings (fix warnings, rebuild)
node build-demo.mjs

# 6. Quality gates (lint must be 0 errors)
npx hyperframes lint
npx hyperframes validate

# 7. Render
npx hyperframes render --output renders/hello-world.mp4 --quality standard
```

`renders/hello-world.mp4` is your finished video. Open it, or extract a frame to spot-check:

```bash
ffmpeg -ss 5 -i renders/hello-world.mp4 -frames:v 1 /tmp/frame.png
```

> **The number-one habit:** always verify by *looking at rendered frames*, never by the render's
> exit code alone. Confirm the typing state matches the narration, captions show the right
> spellings, and pause cards / terminal output are complete. Fix → rebuild → re-render until clean.

---

## How you'd actually use this (the two paths)

### Path A — with an AI coding agent (Claude Code)

This is what the skills are designed for. The agent reads the `SKILL.md`, asks you for intake
(topic, language, length, branding, voice), writes the spec for you, generates audio, builds,
runs the quality gates, and verifies the frames.

1. **Install the skills** so the agent can find them — either user-wide or per-project:

   ```bash
   # User-wide (available in every project):
   mkdir -p ~/.claude/skills
   cp -R skills/code-demo-video skills/nvcc-video ~/.claude/skills/

   # …or per-project (committed alongside the code you're documenting):
   mkdir -p .claude/skills
   cp -R /path/to/this-repo/skills/* .claude/skills/
   ```

2. **Just ask, in plain language.** The skills trigger on phrases like:
   - *"Make a typing-demo video that explains this function."*
   - *"Build a guided walkthrough video for this assignment — pause-and-try after each step."*
   - *"Add captions and fly-in notes to this screen recording."*
   - *"Turn this slide deck into a narrated lecture video."*

   The agent picks the right skill, drafts the **beat script for your approval first** (the
   cheapest place to iterate), then runs the full pipeline and hands you the MP4 path.

### Path B — by hand (no agent)

Everything the agent does is plain CLI. Read the relevant `SKILL.md` as a runbook:

- **`skills/code-demo-video/SKILL.md`** — the 10-step workflow (scaffold → write spec → TTS →
  transcribe → build → lint/validate/inspect → render → verify frames). The **spec schema** is in
  `skills/code-demo-video/references/spec-format.md`; syntax-highlight token tables are in
  `references/syntax-colors.md`. Start from `assets/example-explainer.spec.mjs` or
  `assets/example-walkthrough.spec.mjs`.
- **`skills/nvcc-video/SKILL.md`** — Mode A (enhance a recording) edits one `CONFIG` block in
  `assets/build-data.mjs`; Mode B (lecture from slides) uses the scripts in `assets/lecture/`.

---

## Voice options

| Voice | When | Setup |
|---|---|---|
| **Kokoro `af_heart` @ 0.95** (default) | every video unless told otherwise | none — runs locally |
| **ElevenLabs (a cloned/custom voice)** | only when explicitly requested | set `ELEVENLABS_API_KEY` in your environment (or a `.env` in the project dir / your home dir). Set `ELEVENLABS_VOICE_ID` to **your own** voice. Then run the `nvcc-video` lecture pipeline in clean mode (`VOICE=eleven node build-narration.mjs`). See `skills/nvcc-video/assets/lecture/tts-eleven.mjs`. |

**No API key is stored in this repo.** The ElevenLabs script reads the key from your environment
at run time and errors with instructions if it's missing.

---

## Repository layout

```
code-walkthrough-video-builder/
├── README.md                     ← you are here
├── LICENSE
├── skills/
│   ├── code-demo-video/          ← simulated-VS-Code typing videos
│   │   ├── SKILL.md              ← the runbook (workflow, defaults, gotchas)
│   │   ├── assets/
│   │   │   ├── template.html.src ← composition shell (VS Code chrome, runtime). .src is load-bearing.
│   │   │   ├── build-demo.mjs    ← spec → index.html (timing cascade, captions, beat map)
│   │   │   ├── example-explainer.spec.mjs    ← working ~35s example
│   │   │   ├── example-walkthrough.spec.mjs  ← working ~80s pause-card example
│   │   │   └── fonts/            ← bundled Bricolage Grotesque (woff2)
│   │   └── references/           ← spec schema, syntax colors, vscode anatomy, narration math, gotchas
│   └── nvcc-video/               ← enhance-a-recording OR slides-to-lecture
│       ├── SKILL.md
│       ├── assets/
│       │   ├── index.html        ← Mode A composition shell
│       │   ├── build-data.mjs    ← Mode A: edit the CONFIG block (title, notes, highlights)
│       │   ├── design.md
│       │   └── lecture/          ← Mode B: build-narration / build-lecture / patch-captions / tts-eleven
│       └── references/           ← pronunciations, video conventions, note-card guide
└── examples/                     ← sample outputs go here (see below)
```

---

## Examples

The `examples/` folder holds finished videos paired with the spec that produced them.

- **[`examples/hello-world/`](examples/hello-world/)** — a ~32s Python "Hello, World!" explainer
  rendered end-to-end by the `code-demo-video` skill (the same example the quick start builds).
  It ships with the rendered MP4, its single source `demo.spec.mjs`, and the exact build commands.

If you build something with these skills, an example spec + a short rendered clip is a great
contribution.

---

## Notes, conventions, and gotchas

These are baked into the build scripts so you don't have to re-learn them, but they're worth knowing:

- **Type like a human.** Code types at ~8 characters/second; lines are never instant-filled. If a
  beat feels rushed, split it — don't speed up the typing.
- **Point the student's eyes.** Whenever code is on screen while the voice explains it, a synced
  highlight marks the exact line/token being discussed, and clears when the topic moves on.
- **Pause cards stay over the editor** (`pauseOverlay`), so code remains visible during "your turn"
  moments — not a full-screen interstitial.
- **The `.html.src` extension is load-bearing.** A second root `.html` with a composition id makes
  `hyperframes lint` fail with `multiple_root_compositions`. Keep the template as `.html.src`.
- **Regenerate before rendering.** Render duration is read from static HTML attributes at compile
  time — always re-run the build script after any spec/audio change, then render.
- **Pronunciations & emphasis** for the Kokoro voice live in
  `skills/nvcc-video/references/PRONUNCIATIONS.md` (e.g. Python → "pie-thawn") and are shared by
  both skills. They're applied automatically and skipped for ElevenLabs (which says them correctly).

Full failure-mode list: `skills/code-demo-video/references/gotchas.md` and the **Gotchas** section
of `skills/nvcc-video/SKILL.md`.

---

## Contributing

Issues and PRs welcome — especially additional example specs, language token tables, or fixes to
the build scripts. Please keep the repo self-contained (Node built-ins only in the build scripts;
no secrets committed).

## License

MIT — see [LICENSE](LICENSE). The bundled Bricolage Grotesque font is licensed under the SIL Open
Font License by its authors.
