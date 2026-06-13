# demo.spec.mjs — full schema

The spec is a plain ES module exporting one object. `build-demo.mjs` reads it, ffprobes the
narration wavs, runs the timing cascade, and writes `index.html` from `template.html`.

## Top level

| Key | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | project slug, used in logs |
| `mode` | `"explainer" \| "walkthrough"` | yes | documentation only — beats define actual structure |
| `branding` | `"neutral" \| "nvcc"` | no (neutral) | nvcc = green/gold title/outro/pause cards; editor never rebranded |
| `clipMode` | boolean | no (false) | true → title/outro beats dropped, 0.5s hold frames added at both ends, no final fade. For splicing into a bigger video. Also via `--clip` flag |
| `course`, `module` | string | no | meta line on title card + editor label |
| `title` | object | if a title beat exists | `{ hero, accent?, sub?, chip?, ghost? }` — accent renders in accent color after hero; ghost is the oversized faded background text |
| `file` | object | yes | `{ name, lang, folder?, siblings? }` — lang: `python \| bash \| javascript \| plain` (file badge color) |
| `statusRight` | string | no | status-bar text next to the checkmark, e.g. `"Python 3.12.1"` |
| `terminalPrompt` | string | no | default `student@{folder} % ` |
| `captions` | boolean | no (true) | false disables caption generation even when transcripts exist |
| `focus` | boolean | no (true) | line-focus border. Each typed line lights with a blue left-rail + tint while it's typed/explained, releasing when focus moves to the next typed line. Set `false` to disable globally (rare). Brand-neutral blue `#3794ff` — the editor is never rebranded |
| `captionFixes` | `[[from, to], ...]` | no | repairs TTS respellings in captions: `[["pie thawn", "Python"]]`. Matching is case/punctuation-insensitive and can span multiple transcript words (timings merge) |
| `voice` | object | no | documentation of what was used; TTS is run by the workflow, not the build |
| `beats` | array | yes | see below |

## Beats

One beat = one narration clip + the visuals that accompany it. Audio file naming is fixed:
beat at index *i* (0-based, original order) reads `audio/vo-{i+1 padded to 2}-{id}.wav`
and optional transcript `audio/vo-NN-{id}.json`.

| Key | Type | Notes |
|---|---|---|
| `id` | string | used in audio filename — keep short, no spaces |
| `scene` | `"title" \| "editor" \| "pause" \| "outro" \| "browser" \| "doc"` | consecutive `editor` beats share ONE editor window; any other kind is its own full-screen scene. A `pauseOverlay` editor beat closes its editor scene (next step starts fresh). **Prefer `pauseOverlay` over the full-screen `pause` scene** — it keeps the code visible behind a small card. |
| `narration` | string | the TTS text (respelled per PRONUNCIATIONS.md) |
| `voDelay` | number | seconds after beat start before audio plays. Defaults: 0.5 (first beat), 0.8 (first beat of a new scene), 0.3 (subsequent editor beats) |
| `holdAfter` | number | silence held after narration ends (default 0.6). Pause cards use 4 |
| `transition` | `"zoom" \| "blur" \| "cut"` | transition INTO this beat's scene. Default: title→editor zoom, everything else blur |
| `prefill` | `[{ line, segs }]` | lines rendered instantly (already "written"). Use for recap-after-pause — never re-type what the student just wrote |
| `actions` | array | see below |
| `viewTop` | number | editor beats — first visible line number ("scrolled" editor, true line numbers). ~14 lines fit; ~8 above an open terminal. Set on the FIRST beat of an editor scene. Long walkthrough files: scroll later scenes (`viewTop: 5`), and put the run scene's terminal view at the print block (`viewTop: 12`) |
| `pauseOverlay` | boolean | **editor beats only** — renders the "your turn" prompt as a small bottom-right card OVER the still-visible editor (not a full-screen scene), so students can pause and still see the code they just watched you type. Needs `step`/`task`/`checklist` (and optional `hint`) just like a pause scene. The beat types nothing; it closes its editor scene. **This is the preferred pause style.** |
| `step` | `{ n, of }` | pause scenes AND `pauseOverlay` beats — the STEP n OF m badge |
| `task` | string | pause scenes AND `pauseOverlay` beats — card headline |
| `checklist` | string[] | pause scenes AND `pauseOverlay` beats — 2–3 items max |
| `hint` | string | pause scenes AND `pauseOverlay` beats — optional mono hint line |
| `fileCreate` | boolean | editor beats — the "absolute beginner" opening: the Explorer starts empty, the New File icon pulses, a sidebar row appears and the filename types in, then the editor "opens" it (tab + breadcrumb fade in). Use for the very first beat so students see HOW to create/open the file. |
| `fileCreateAt` | number | with `fileCreate` — seconds into the beat when the filename starts typing (sync to narration "click New File and type the name"). Default 1.8. |
| `fileOpenAt` | number | with `fileCreate` — seconds into the beat when the editor opens the file / the tab appears (sync to narration "press enter"). Default = right after the name finishes. |
| `outro` | `{ headline, accent?, bullets?, foot? }` | outro beats only |
| `stepsOverlay` | `{ title, items[], at?, hold? }` | editor beats — a small RED-bordered card (top-right) listing the literal steps for something you can't click-by-click animate (open the terminal, create a file). Fades in at `at` (default 1.0s into beat), out after `hold`. Use it alongside narrating the steps, especially for terminal/file actions. |
| `doc` | `{ title?, tag?, body, callout? }` | doc beats only — a clean white "handout/paper" sheet for showing the **assignment instructions** at the very start. `body` is raw HTML (NOT escaped) using `.doc-body` base styles + helper classes: `.ex` (dark code-output block), `.codename` (inline code chip), `.doc-table`/`td.pts` (rubric table). `tag` is a small mono label, `callout: {text, at}` adds a gold chip. Use 2–3 doc beats to walk Purpose → Requirements → Rubric/Submit before any code. |
| `browser` | `{ pageHTML, pageStyle?, url?, tab?, engine?, callout? }` | browser beats only — a Chrome-style window rendering an ACTUAL page. `pageHTML` is raw HTML with inline styles (NOT escaped — keep it self-contained, no external refs); `pageStyle` styles the viewport (e.g. `background:#0f172a; text-align:center;`); `callout: {text, at}` adds a gold chip. Use for HTML/CSS lessons: editor scene types the code, browser scene shows the real rendered result |

## Actions

`at` is **relative to the beat's start**: a number, or `"prev+N"` (N seconds after the previous
action in this beat ends).

| Action | Fields | What happens |
|---|---|---|
| `type` | `line, at, cps?, segs` | code types char-by-char into syntax-colored spans, with blinking cursor. `segs` = `[[tokClass, text], ...]` — hand-tokenize per references/syntax-colors.md. **Default cps 8 — simulate a real person typing each character; never instant-fill a line (no cps above ~14, even for `====` borders).** Don't raise cps to fit; split the beat. The line auto-gets the **focus border** while it types/explains (see `focus`) |
| `highlight-line` vs focus | — | `highlight-line` is a one-shot gold pulse for recap sweeps over PREFILLED lines; the blue **focus border** is automatic on TYPED lines. Don't put a `highlight-line` on a line you also type in the same scene |
| `term-type` | `at, cps?, text` | command types at a fresh terminal prompt. Default cps 10 |
| `term-out` | `at, lines, callout?` | output block appears (multi-line ok). `callout: "label"` adds the gold ring + ✓ LABEL tag. A fresh prompt appears automatically 1.2s after the last term-out |
| `terminal-open` | `at` | terminal panel slides up. Required before any term-* action in the scene |
| `callout` | `line, at, text` | gold chip flies in to the right of a code line |
| `highlight-line` | `line, at` | gold background pulse on a code line (recap sweeps) |
| `file-activate` | `at` | sidebar file row lights up (the "file created" moment). If used, the row starts inactive |
| `redbox` | `at, target, hold?` (or `line, at, hold?`) | **draws a pulsing RED highlight ring around a UI element to draw the student's eye.** `target`: `"newfile"` (New File icon), `"runbtn"` (▷ Run button), `"terminal"`, `"tab"`, `"sidebarfile"`; or pass `line: N` for a code line. `hold` = seconds the ring stays (default 3). Use it whenever you point at something ("click the New File icon", "the Run button", "here's the terminal"). |

## Timing cascade (what the build computes)

```
beat.start    = previous beat's end (first beat: 0, or 0.5 in clipMode)
audioAt       = beat.start + voDelay
visualEnd     = latest action end (typing end = at + totalChars/cps)
beat.end      = max(audioAt + audioDur + holdAfter, visualEnd + 0.6)
duration      = last beat.end + 1.0   (0.5 in clipMode)
```

Scene boundaries get transitions at the incoming beat's start. The build prints a **beat map**
(start/audio/end/midpoint per beat) plus ready-made `inspect --at` and frame-extraction
commands — use those exact times for verification.

## Warnings the build emits and how to fix them

| Warning | Fix |
|---|---|
| `visuals run Ns past narration` | raise that action's `cps`, split the beat, or add narration |
| `only ~N narration words per typed line` | explain each line as you type it — add narration for each line, or split the beat so each line gets its own |
| `no transcript ... captions skipped` | run `npx hyperframes transcribe` on that wav (workflow step 7) |
| `clipMode: dropping ...` | expected — title/outro don't belong in spliced clips |
