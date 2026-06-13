# Video Conventions — NVCC HyperFrames coding videos

Cross-project conventions for the course videos in this workspace. (Voice/pronunciation rules live
in `PRONUNCIATIONS.md`.)

## Highlight the code being discussed

**Point the student's eyes at the exact code under discussion.** Two behaviors, applied by default
to every coding video:

### A. Logic walk-through → moving line highlight
When the narration steps through *how code runs* (if/elif order, nesting, tracing values), animate a
highlight bar down the code **line-by-line, synced to the words** ("first… then… and notice line 7…").
**In-context only:** the line-highlight and the window glow must **clear once the narration moves on**
from reading the code (don't leave it stuck on the last line) — clear ~1.8s after the last code line is
spoken. `build-lecture.mjs` does this automatically (matches each code row to its spoken token, then
fades the highlight + glow at the code-discussion end).

### B. Snippet reference → window callout
When narration points at a code block ("in this example…", "this line…"), **frame the code window
with a gold border + soft glow** (optional slight scale-up) while it's discussed, and remove it when
the topic moves on. For a single token (a variable / operator / flag), tint or box **just that token**.

## HyperFrames mechanism (reuse what already exists)

- **Line highlight:** the `.code.tracer` + `.step-hl` pattern (already in the Module 04 CSS). A
  positioned semi-transparent bar inside the `.code` block, moved per line:
  `tl.to("#sX-hl", { top: <line px> }, T)`. Use `.ln-row.dim` (opacity 0.3) for skipped/untaken lines.
- **Window callout:** `tl.to("#sX-code", { boxShadow: "0 0 0 3px rgba(204,153,0,.55), 0 0 28px rgba(204,153,0,.35)", borderColor: "#cc9900" }, T)` on focus; revert on the `out` time.
- **Token highlight:** wrap the token in a `.tok` span and tint/box it gold.
- **Palette:** gold = "look here", green = correct / the result, red = error / untaken branch.
- **Sync:** transcribe the scene's narration clip (word-level Whisper) and pin each line/step to its
  spoken trigger — the same "find real timings" technique used for animation beats (`BEAT-MAP.md`).
  The highlight should land *as* the line is spoken, not before.
- Keep inactive highlight/border elements `visibility:hidden` so the WCAG contrast checker skips them.
- **Verify from rendered frames** — confirm each highlight sits on the right line/token and clears on `out`.
- Deeper patterns: `hyperframes` skill → `references/css-patterns.md` (seek-safe marker sweeps,
  line-step bar, circles, underlines); `nvcc-video` skill → §4b "Highlight the code being discussed".

## Emphasize Python keywords & operators

When narration says a **Python keyword/operator that is also an ordinary English word**
(`for`, `while`, `if`, `and`, `or`, `not`, `in`, `is`, `break`, `continue`, `else`, `def`, `import`,
`try`, `except`, `return`, `class`, …), it must land as a distinct term, not melt into the sentence.
Kokoro has no stress/SSML control, so the only lever is **punctuation that isolates the word with pauses**.

**Finalized technique (tested by ear):**
- `for` is the worst offender (super-common English word) → **dashes**: `a — for — loop`, `— for — p in ports`.
- `while` and the others → **quotes inline**: `the "while" loop`, `"break"`, `"continue"`, `we write "while" count …`.
- **Dashes when formally defining/introducing** a keyword; quotes for ordinary inline mentions.
- Do NOT emphasize when the word is plain English (`for example`, `looking for`) — only the keyword sense.

Both generators encode this: `build-narration.mjs` → `emphasizeKeywords()` (Kokoro path).

**ElevenLabs path (clone voice) — same need, different lever.** The clone does NOT set keywords/operators
apart on its own either (Randy, 2026-06 — the original "ElevenLabs emphasizes naturally" assumption was
wrong). The clean-mode generator runs `emphasizeKeywordsEleven()`, which uses **quotes** for everything
(`if`/`elif`/`else`/`while` and `and`/`or`/`not`) — Randy A/B-picked quotes over em-dashes for the clone.
Detection is **automatic by context** (high precision): it quotes only the naming/keyword sense
(`the "if" statement`, `The first is "and", which…`, `the actual words "and", "or", and "not"`) and leaves
**expression operators** (`443 and protocol`, `"WARN" or severity`, `so not is_locked`) and **plain English**
(`does not use`, `and then`) untouched. Quotes change only prosody, so Whisper captions stay correct.
(`elif` is additionally respelled `ell-iff` for pronunciation and caption-patched back — see PRONUNCIATIONS.md.)

### A. Audio
- **Single operator being defined** → recast to name it and set the word off with a dash + stop:
  `The first operator is — and. It is true only when both sides are true.`
- **List of operators** → quote each one:
  `Python uses the actual words: "and", "or", and "not".`
- **Do NOT emphasize when the operator is read inside a condition** (e.g. "x greater than 5 *and* y
  less than 5", "True *and* True is True") — there it's part of the expression and should stay natural.

### B. Slides / visuals
Render operators as prominent keywords, not filler — bold, **gold accent / chip**, larger weight — so
`and` / `or` / `not` clearly read as distinct terms (e.g. scene-7 gate labels and any inline mention).

## Status
- These are the standing defaults for **future** coding videos (code highlighting + operator emphasis).
- Not yet retrofitted into `itp270-module04-decision-control-v2`: its 7 code scenes still show static
  code, and its operator mentions use plain phrasing. The `.step-hl` / `.code.tracer` CSS is already
  present, so a retrofit pass (highlights + operator re-phrasing + slide emphasis) is ready when wanted.
