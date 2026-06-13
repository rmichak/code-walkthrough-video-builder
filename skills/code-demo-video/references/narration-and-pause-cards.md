# Narration script + pause-card conventions

## Script math

- Kokoro af_heart @ 0.95 speaks ≈ **2.4–2.5 words/second**.
- Budget words per beat: `target seconds × 2.5`. A 35s explainer ≈ 75–85 words total;
  a 4-minute walkthrough ≈ 550–600 words.
- Write narration **per beat**, never one monolith — beats are the unit of TTS, timing, and revision.
- The script should feel SHORTER than the video. The typing and terminal moments carry
  visual interest; silence while code types is good.

## Voice & style

- Present tense, second person, contractions: "Now we run it", "you'll see".
- One idea per beat. Name what's on screen as it appears: "watch the terminal."
- **Respell for TTS** per `/Users/randymichak/.claude/skills/nvcc-video/references/PRONUNCIATIONS.md`
  (pie-thawn, dot P Y, V S Code, …). New terms: test the wav, add the respelling back to that file.
- Captions must show the CORRECT spelling — add every respelling to `captionFixes` in the spec:
  `[["pie thawn", "Python"], ["P Y", "py"]]`.

## Explain each line as you type it

The most important pacing rule. When a line of code types in, the narration for that beat must
say what THAT line does — in order, as it appears. The viewer's eye is on the focus border
(the blue left-rail that marks the line being typed); your words should match what's lit.

- **One typed line ≈ one spoken explanation.** "We import the keyboard module" → import line.
  "A function that runs on every key press" → the `def` line. Don't batch three lines under
  "now we set everything up."
- **Pace the typing to the talking.** Space typed lines with `at: "prev+0.8"`–`"prev+1.2"` so each
  line lands, gets explained, and breathes before the next — not a wall of code in 2 seconds.
- **Budget ~8–15 narration words per typed line.** The build warns under ~8. A beat that types
  4 lines wants ~40–50 words, or split it into two beats.
- **Calm typing.** Default is 11 cps. If a line feels rushed, lower its `cps` (e.g. 9), don't raise it.
- The focus border is automatic — you don't author it. Just make sure you're TALKING about the
  line that's lit.

## Explainer structure

Hook (title beat, one line that names the payoff) → concept beats (one code idea each, typed
while narrated) → run beat (terminal proves it) → recap/outro (what they now know + what's next).
Don't open with "Welcome to…" — open with the thing: "Every value in Python has a type."

## Pause-card rules (walkthrough mode)

1. **One pause per student work-step, as an OVERLAY.** Use `pauseOverlay: true` on an editor beat
   (NOT the full-screen `pause` scene) so the code the student just watched you type stays visible
   behind a small bottom-right card. Randy's standing rule: never hide the code when you ask them
   to pause.
2. **Narration phrasing is fixed**: the beat's narration ALWAYS ends with the literal cue
   *"Pause the video now, and …"* + the exact deliverable. Students learn the rhythm fast.
3. **`holdAfter: 4`** on every pause beat — ~4 seconds of silence so the student can actually
   reach the pause button before anything moves.
4. **Card contents**: `STEP n OF m` badge, imperative task headline ("Your turn: create your
   five variables"), 2–3 checklist items max (these mirror the rubric), optional one-line hint.
   The footer "▶ PRESS PLAY WHEN YOU'RE DONE" is automatic.
5. **Demo before pause**: the editor beat right before a pause demonstrates the step with
   EXAMPLE values (a fictional student — "Avery Chen"), never the literal answer, so students
   write their own.

## Beginner walkthroughs — Randy's standing requirements

These apply to every guided assignment walkthrough (ITP 270 etc.). Assume the student has never
written code and has barely used the editor.

- **Read the assignment first.** Open with 2–3 `doc` scenes (a paper handout) walking the real
  assignment: Purpose + sample output → Requirements → Rubric + how to submit. THEN build it.
- **Start from nothing.** First editor beat uses `fileCreate` — empty folder, then show the
  EXACT steps: "in the Explorer, hover the folder name, click the New File icon, type the name
  exactly `name.py`, press Enter." Explain that `.py` tells the computer it's a Python file.
  Never assume they know how to make or open a file.
- **Explain every Python term the first time it appears** — comment/`#`, variable, string/quotes,
  `print()`, f-string, the `{ }` placeholders, snake_case (define it: "lowercase, underscores
  instead of spaces, because names can't have spaces"). One gold callout per concept, one per line.
- **The terminal**: when you first run, REMIND them how to open it — "from the Terminal menu choose
  New Terminal, or press Control + backtick (the key above Tab)" — and fire `terminal-open` as the
  narration says "here it is." Don't let it just appear unexplained.
- **Python extension**: mention once (during setup) that if they've installed the Python extension
  their code is color-coded and they get a one-click **Run** button (the ▷ triangle, top-right).
  The editor chrome renders that Run button automatically.
- **Realistic everything**: the VS Code chrome (menu bar, minimap, activity bar, full status bar,
  Run button) is built in. Typing is ~8 cps so it looks like a person typing each character.

## Recap-after-pause pattern

The editor beat after a pause card:

- **`prefill`** everything the student has already written — it renders instantly. NEVER re-type it.
- Open the narration with re-orientation: *"Welcome back — your file should look like this."*
- `highlight-line` sweep over the prefilled line(s) while saying it.
- Then type ONLY the new delta for the next step.

## Pacing targets

| Mode | Target | Beats |
|---|---|---|
| Explainer | 60–120s | 5–9 |
| Quick walkthrough | ≤ 4 min | title + (demo+pause)×n + run + outro |
| **Detailed beginner walkthrough** | **~8 min (Randy's default for ITP 270 labs)** | title + doc×3 + fileCreate + (demo×k + pauseOverlay)×n + run + outro |
| Embedded clip (clipMode) | 20–60s | editor beats only |

Detailed beginner walkthroughs run long on purpose — they read the assignment, create the file,
and explain every term. ~8 minutes is the gauge; let thoroughness, not a hard cap, set the length.
Confirm target length with Randy at the script step.
