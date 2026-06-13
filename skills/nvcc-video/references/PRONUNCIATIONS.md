# TTS Pronunciation Overrides — NVCC course videos

The HyperFrames `tts` CLI (Kokoro `af_heart`) has **no phoneme/pronunciation flag** — it reads the
narration text literally. To fix a mispronounced word, **respell it phonetically in the scene's
`narration/sceneNN.txt`**, then regenerate that one clip:

```bash
npx hyperframes tts narration/sceneNN.txt --voice af_heart --speed 0.95 --output assets/audio/sceneNN.wav
```

Then re-transcribe that clip and rebuild captions. **Caption-safe check:** after regenerating, run
`transcribe` — if Whisper hears the respelling as the real word (it did for Python and Kali below),
the on-screen caption stays correct automatically. If Whisper writes the phonetic spelling instead,
add a display-text override when building captions.

> Only matters for **TTS** videos. Videos narrated in Randy's own recorded voice (e.g.
> `itp270-module04-decision-control`) are fixed by re-recording, not respelling.

## Known overrides

| Word | Respell in narration as | Target sound | Notes |
|------|-------------------------|--------------|-------|
| Kali | `kal-ee` | KAL-ee | "a" like **Al/Albert** (not "KAH-lee"). Hindu goddess; Kali Linux. |
| Python | `pie-thawn` | PIE-thawn | "PY" rhymes with "eye", "thon" → "thawn". |
| elif | `el-if` | EL-if | First syllable like the start of "**el**ephant", second like "if". Shorthand for "else if". (Some say "EE-liff" — EL-if is most common.) |
| str (the type) | `stir` | stir | Bare `str` is read as "S-D-R" (garbled). "stir" lands as one clean syllable. Scope to the standalone token — do NOT touch "string"/"instructor". |
| re (the module) | `R E` | letters R-E | Bare module `re` is read as the English word **"read"** ("import read", "read.search"). Scope to real module contexts only (`import re`, `re dot …`, `re HOWTO`) so it never hits the "re" in *you're / we're / you'll*. |
| OOP | `O O P` | letters O-O-P | Guarantees letter pronunciation. |
| VS Code | `V S Code` | "V-S Code" | Bare `VS` can read as "versus". |
| macOS | `mac O S` | "mac-O-S" | Avoid "mackos". |

> **Kokoro note:** `regex` reads correctly as "REJ-ex" on the af_heart path — leave it there.
> **Module-specific terms:** scan each new module's narration and add rows above as you confirm them
> (test with a `pron-tests/` clip first). The Kokoro path applies these automatically:
> `build-narration.mjs` → `applyConventions()`.

## ElevenLabs-only overrides (clean mode)

The ElevenLabs path runs the **clean** script (no Kokoro respellings — the clone reads "pie-thawn" etc.
literally). But the clone does **not** pronounce every token right, and it does **not** set Python
keywords/operators apart on its own (they melt into the sentence). So `build-narration.mjs` →
`applyElevenConventions()` applies these when `VOICE=eleven`:

| Word | Respell as | Target sound | Notes |
|------|------------|--------------|-------|
| regex | `rej-ex` (`Rej-ex` when capitalized) | REJ-eks | ElevenLabs otherwise mis-says it; `rej-ex` lands as REJ-eks (Randy A/B-picked, 2026-06). Scope to the token `regex` only — never "regular expression". Whisper re-hears it as "regex", so on-screen captions stay correct (no display override needed). |
| elif | `ell-iff` | ELL-if | Clone says plain `elif` as "AH-lif". `ell-iff` → "ELL-if" (Randy A/B-picked, 2026-06). Whisper hears `ell-iff` as **"LIF"**, so captions are corrected back to "elif" by `patch-captions.mjs` (run after transcribe, before build-lecture). |

**Keyword/operator quote emphasis (eleven path).** `applyElevenConventions()` also calls
`emphasizeKeywordsEleven()`, which wraps Python keywords (`if`/`elif`/`else`/`while`) and the operators
`and`/`or`/`not` in **quotes** — Randy A/B-picked quotes over em-dashes (2026-06). This is applied **only
in the naming/keyword sense** (`the "if" statement`, `The first is "and", which…`, `the actual words
"and", "or", and "not"`), **never** inside an expression (`443 and protocol`, `"WARN" or severity`) or
plain English (`does not use`, `and then`). Quotes change only the spoken prosody, so Whisper captions
stay correct — no patch needed for the quoted words.

**Broad-sweep token check (2026-06).** Whisper-diagnosed clone mis-hearings: `re`→"read"/"remodel",
`str`→"this TR", `dict`→"dick", `kwargs`→"quarks" (audio sounded fine to Randy, so **not** respelled —
the captions for `dict`/`kwargs` are patched via `patch-captions.mjs`; `re`/`str` left as-is). `int`,
`os`, `sys`, `args`, `tuple`, `enum`, `API`, `CLI`, `IP`, `ASCII`, `hex`, `env`, `PATH` read fine — leave them.

Add ElevenLabs-only rows here as you confirm them — A/B a `pron-tests/` clip in the **clone voice**
first (Kokoro respellings do NOT belong here; the clone reads them literally).

## Technique cheat-sheet

- **Hyphenate syllables** to force stress/vowels: `kal-ee`, `pie-thawn`.
- **Periods for acronyms** → letter-by-letter: `S.S.H.`, `A.C.`, `user I.D.`
- **Decimal numbers** (section/version refs like `4.2`) → spell the point: `four point two`. The bare `4.2` makes Kokoro treat the `.` as a sentence end → a hard pause mid-reference. (On-screen text like `§4.2` is fine; only the spoken narration needs respelling.)
- **IP / dotted addresses** (`10.0.0.5`) → say "dot", keep the digits: `10 dot 0 dot 0 dot 5`. Do NOT run the decimal→"point" rule on these (it mangles `10.0.0.5` into "ten point zero·zero point five"). `build-narration.mjs` handles IPs (3+ octets) before the decimal rule.
- **Commas** insert a small pause/beat.
- **Homophones** are fair game (swap in a word that sounds identical).
- **Verify by ear first:** generate a few candidates into a `pron-tests/` folder and listen before
  baking in + re-rendering, e.g.:
  ```bash
  npx hyperframes tts "with a name of kal-ee and an ID." --voice af_heart --speed 0.95 --output pron-tests/test.wav
  ```
- A respell that changes a clip's length: if it still fits the scene's audio slot, just bump that
  `<audio data-duration>`; if it overflows, recompute the scene-start cascade.
