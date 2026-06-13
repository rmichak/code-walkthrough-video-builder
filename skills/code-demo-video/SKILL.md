---
name: code-demo-video
description: >-
  Use when the user wants a short coding video without screen recording — a simulated VS Code
  window where code types itself with TTS voiceover and terminal output, for Canvas embedding
  or splicing into a bigger lecture video. Triggers: "code demo video", "typing demo video",
  "make a video showing this code", "explainer video for <topic>", "assignment walkthrough
  video", "pause-and-try video", "simulated VS Code video", "interactive coding example video"
  — for any course (ITP 270, IT 431, etc.) and any language (Python, Bash, JavaScript), even
  when HyperFrames isn't mentioned. Default voice Kokoro af_heart @ 0.95; Randy's ElevenLabs
  cloned voice ONLY when he explicitly asks.
---

# Code Demo Video Builder

Builds a 30s–10min video of someone "coding" in VS Code — except nobody coded on camera. The
editor is a pixel-tuned Dark+ mock with realistic chrome (menu bar, activity bar, minimap, full
status bar, ▷ Run button), the typing is character-by-character animation, the terminal output is
real program output, the voice is TTS, and word-synced captions are burned in. Everything is
generated from one spec file; re-rendering after a change takes ~30 seconds.

**Two modes:**

- **Explainer** — narrated concept demo: code types while the voice explains, terminal proves
  the result, callouts point at what matters. 60–120s.
- **Guided walkthrough** — steps a student through an assignment. Each step: demo with example
  values → **`pauseOverlay` "STEP n OF m — Your turn"** card (small, bottom-right, code stays
  visible) → recap with the student's code prefilled. For ITP 270 beginner labs this is the
  **detailed** form: read the assignment (doc scenes) → create the file (`fileCreate`) → build it,
  explaining every term → run. ~8 min.

## Defaults

| Setting | Default |
|---|---|
| Canvas / fps | 1920×1080, 30fps, H.264 mp4 |
| Voice | Kokoro `af_heart` @ 0.95 — ElevenLabs clone ONLY on explicit request |
| Branding | `neutral` (blue/gold). `nvcc` (green/gold) when an NVCC course is the audience and Randy wants it. The VS Code editor itself is NEVER rebranded |
| Captions | ON — word-synced, auto-built from Whisper transcripts |
| Typing speed | **8 cps code, 8 cps terminal — simulate a person typing each character. NEVER instant-fill a line (no cps > ~14, even for `====` borders).** Don't raise to "fit"; split the beat |
| Line focus | AUTO — the line being typed gets a blue left-rail + tint, released when focus moves to the next line. Disable with `focus: false` at spec top level |
| Pauses | `pauseOverlay` (small card over the editor) — NOT the full-screen `pause` scene. Code stays visible while they pause |
| VS Code chrome | Realistic & automatic: menu bar (File…Help), activity bar w/ bottom icons, minimap, full status bar, tab close ✕, ▷ Run button |
| Length | explainer 60–120s · quick walkthrough ≤ 4 min · **detailed beginner walkthrough ~8 min** · clipMode 20–60s |

**Pace it slow, explain every line — and every Python term.** Each typed line gets its own spoken
explanation; the focus border shows which line you mean, one gold callout per concept. For
beginners, define terms the first time they appear (comment, variable, string, `print()`,
f-string, `{ }`, snake_case). The build warns if a beat types ≥2 lines with <~8 narration words/line.

**Beginner-walkthrough must-dos (Randy's standing rules — see references/narration-and-pause-cards.md):**
read the assignment first (doc scenes) · start from an empty folder and show the exact New-File
steps · explain how to open the terminal (Terminal menu / Ctrl+\`) when it first appears · mention
the Python-extension Run button + syntax highlighting once · `pauseOverlay` so code stays visible ·
nothing cut off (terminal is sized for full output; keep ≤13 code lines per editor scene).

## Prerequisite skills — invoke, don't duplicate

- `hyperframes` — composition rules (only needed if hand-tweaking the generated HTML)
- `hyperframes-cli` — lint / inspect / render commands
- `hyperframes-media` — `tts` and `transcribe` usage
- Pronunciations: `/Users/randymichak/.claude/skills/nvcc-video/references/PRONUNCIATIONS.md`

## Workflow

**1 · Intake.** Mode, topic (or read the assignment file + rubric for walkthroughs), language,
branding, target length, voice. For walkthroughs: map rubric items → pause-card steps.

**2 · Write the beat script.** Per-beat narration at ~2.5 words/sec
(references/narration-and-pause-cards.md), respelled for TTS. **Show Randy the script + beat
list for approval BEFORE generating any audio** — it's the cheapest iteration point.

**3 · Scaffold.**
```bash
npx hyperframes init <project-name> --example blank --non-interactive
cd <project-name>
cp <skill>/assets/template.html.src <skill>/assets/build-demo.mjs .
mkdir -p fonts audio && cp <skill>/assets/fonts/BricolageGrotesque-Variable.woff2 fonts/
```
The `.src` extension is load-bearing — a second root `.html` with `data-composition-id`
makes lint fail with `multiple_root_compositions`.

**4 · Write `demo.spec.mjs`.** Schema: references/spec-format.md. Hand-tokenize code per
references/syntax-colors.md. Start from `assets/example-explainer.spec.mjs` or
`assets/example-walkthrough.spec.mjs`. Add every respelling to `captionFixes`.

**5 · TTS per beat.** Beat i (0-based) with id X → `audio/vo-{i+1, 2 digits}-X.wav`:
```bash
npx hyperframes tts "<beat narration>" --voice af_heart --speed 0.95 --output audio/vo-01-title.wav
```
Only regenerate clips whose narration changed.

**6 · Transcribe per beat (captions).** Transcribe writes `audio/transcript.json` (next to
the input) — rename it after each run:
```bash
npx hyperframes transcribe audio/vo-01-title.wav --model small.en   # English narration
mv audio/transcript.json audio/vo-01-title.json
```

**7 · Build.**
```bash
node build-demo.mjs            # → index.html + beat map + warnings
```
Fix every warning (raise `cps`, adjust `holdAfter`, add missing transcript), re-run.

**8 · Quality gates.**
```bash
npx hyperframes lint           # must be 0 errors; only composition_file_too_large is acceptable
npx hyperframes validate       # WCAG contrast + console errors (GSAP "target not found" = bug)
npx hyperframes inspect --at <times from the beat map>
```

**9 · Render.**
```bash
npx hyperframes render --output renders/<course>-<module>-<slug>.mp4 --quality standard
```

**10 · REVIEW — watch the video, frame by frame (MANDATORY — do NOT skip or deliver without it).**
Extract a frame at EVERY beat midpoint (and a few extra frames inside long beats — file-create,
each pause, the run output) and READ each one. This is a real QA pass, not a formality — Randy has
rejected videos for exactly the failures below. Check every frame against this checklist:

  1. **Nothing cut off.** No callout, code line, terminal output line, doc text, or card may touch
     or cross the right/bottom edge. The full terminal output (every line + trailing prompt) must
     be inside the panel. Doc-sheet text must not overflow the sheet. If anything is clipped → fix
     (right-anchored callouts handle this automatically; for output raise the terminal room / fewer
     code lines; for docs shorten the section).
  2. **Pause card never overlaps code.** The editor auto-shrinks so the card sits in clear space —
     confirm no code is under the card and the code is still legible (smaller, to the left).
  3. **Voiceover matches what's on screen.** Read the caption in the frame and confirm the visual
     matches the words AT THAT MOMENT: when narration says "click the New File icon", the New File
     redbox is firing and the name is about to type; when it says "press enter, it opens", the tab
     appears; when it names a line/term, THAT line is lit / being typed. Re-time actions (`at`,
     `fileCreateAt`, `fileOpenAt`, `terminal-open` time, redbox/stepsOverlay `at`) so the picture
     tracks the words. Misalignment is a defect, not a nicety.
  4. **Captions spelled right** (check `captionFixes`), pause cards complete, redboxes on the right
     element, doc pages readable, syntax colors correct, focus border on the line being discussed.

Iterate (fix → rebuild → re-render → re-review) until a full pass is clean. Only then deliver the
mp4 path + beat map. When building several modules, run this review on EACH one — a clean lint and
inspect do NOT replace watching the frames.

## Embedding

- **Canvas**: upload/embed the mp4 directly; keep ≤ 4 min; descriptive filename
  (`itp270-m02-variables-explainer.mp4`).
- **Inside a bigger video**: set `clipMode: true` (or `node build-demo.mjs --clip`) — title and
  outro are dropped, 0.5s hold frames are added at both ends for clean splice points, no final fade.

## Gotcha quick list (details: references/gotchas.md)

audio data-duration is built, never hand-typed · fromTo not from · finite repeats only ·
transitions end in visibility kills · glows are data-layout-ignore · local woff2 fonts only ·
keep the SRI'd GSAP tag · rebuild after every spec/audio change · deterministic JS only ·
typing doesn't rewind when scrubbing (renderer is fine) · always read rendered frames.

## Files

| Path | What |
|---|---|
| `assets/template.html` | battle-tested composition shell: VS Code chrome, all scene kinds, token CSS, caption layer, runtime (typeInto/blink/transitions) |
| `assets/build-demo.mjs` | spec → index.html: ffprobe, timing cascade, scene/audio/caption generation, beat map |
| `assets/example-explainer.spec.mjs` | working ~35s example (hello-world) |
| `assets/example-walkthrough.spec.mjs` | working ~80s pause-card example |
| `assets/fonts/` | bundled Bricolage Grotesque variable woff2 |
| `references/spec-format.md` | full spec schema + timing model + build warnings |
| `references/vscode-sim.md` | window anatomy, what the build derives, hard rules |
| `references/syntax-colors.md` | Dark+ token tables (Python/Bash/JS) + tokenizing rules |
| `references/narration-and-pause-cards.md` | script math, pause-card + recap patterns |
| `references/gotchas.md` | the 14 failure modes and their fixes |
