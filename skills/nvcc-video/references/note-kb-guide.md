# Authoring the note knowledge base

The `NOTES` array in `build-data.mjs` is the only creative part of each video. Each entry is a
card that flies in the first time its `trigger` matches the transcript (within the trim window).

## Note fields

| Field      | Required | What it is                                                                          |
| ---------- | -------- | ----------------------------------------------------------------------------------- |
| `trigger`  | yes      | A regex. First in-window match = when the card appears. **Choose carefully — see below.** |
| `title`    | yes      | The headline (a command like `ls`, or a concept like `VA Cyber Range`).             |
| `code`     | no       | `true` → render the title in gold monospace (use for commands/code). Omit for concepts. |
| `kicker`   | no       | Small gold uppercase label above the title (`THE PLATFORM`, `STEP 1`, `SECURITY TOOL`). |
| `subtitle` | no       | Plain-English name beside the title (`List`, `Make Directory`).                     |
| `summary`  | no       | One-sentence explanation under the divider.                                         |
| `syntax`   | no       | Mono block, labelled "Syntax". e.g. `ls [options] [path]`.                           |
| `example`  | no       | Mono block, labelled "Example". Multiline ok with `\n`.                             |
| `rows`     | no       | Array of `[key, value]` spec rows — key in gold mono. Great for flags/options.      |
| `bullets`  | no       | Array of strings — gold-diamond bullet list. Great for concept facts / steps.       |
| `note`     | no       | Footer line. `**bold**` renders gold-bold (e.g. `Windows equivalent: **dir**`).     |

**Command card** = `code:true` + `subtitle` + `syntax`/`example`/`rows`.
**Concept/step card** = `kicker` + `summary` + `bullets`.
Mix freely — the renderer shows only the fields you include.

## Choosing triggers (the part that bites)

Two realities to design around:

1. **The narration almost never matches a written script.** Instructors improvise, reorder, skip
   sections, and re-record. Always derive notes and timing from the **actual transcript**, never
   from a lesson plan. Run the timing check (below) and read the surrounding context.

2. **Whisper mangles short command tokens.** `ls` → "LS"/"Alas", `cp` → "see pee"/"copy",
   `rm` → "are em", `pwd` → "PWD". A literal `/\bls\b/` may miss. So trigger on the **distinctive
   spoken phrase** the instructor actually says, not the typed token:
   - `mkdir` → `/create a director|make a director|\bmkdir\b/i`
   - `cp` → `/\bcopy\b|copies a|\bcp\b/i`
   - `pwd` → `/print working directory|\bpwd\b/i`
   - a concept → a phrase from its definition, e.g. `/free,? browser-based/i`

   Anchor to the *teaching moment*, not an incidental earlier mention (e.g. trigger `rm` on
   "dash r for recursive", not the first casual "delete this").

If a note logs `[warn] no in-window match`, its trigger didn't fire — widen/fix it or drop the note.

## How to find real timings (do this before writing NOTES)

Use a small script over `transcript.json` so you don't dump the whole transcript into context.
Probe how each candidate term was actually transcribed and when it's first said in-window:

```js
const W = JSON.parse(require('fs').readFileSync('transcript.json','utf8')).filter(w => w.start >= TRIM_START);
const txt = W.map(w=>w.text).join(' ');
// build a char-offset → word-start map, then for each probe regex print the timestamp + context.
```

(The skill's main flow shows the exact pattern via `ctx_execute_file`.) For each note, confirm the
match lands where the instructor *starts teaching* that thing, and that the context reads sensibly.

## Density & timing

- Aim for one note per genuinely distinct topic — roughly 6–12 across a 15–20 min lesson. Don't
  card every sentence; the captions already carry the words.
- Cards hold up to `MAX_HOLD` (16s) or until the next card. If two triggers land within a few
  seconds, merge them into one richer card (e.g. `chmod` symbolic + numeric) so neither flashes.
- Keep `summary` to ~1 sentence and `bullets`/`rows` to 2–4 items so the card never overflows
  520px wide. The permission-string card (3-line summary + 2 rows) is about the safe maximum.

## Trim (dropping a flubbed intro)

Set `TRIM_START` to the seconds to cut off the front (e.g. `132` for a 2:12 restart). Detection is
restricted to the window, so a command spoken in the discarded section can't claim the card. The
title card still plays first; the recording then starts at the trim point.
