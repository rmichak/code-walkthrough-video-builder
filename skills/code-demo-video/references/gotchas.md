# Gotchas — every one of these caused a real failure

The template and build script encode most of these. They're listed so you (a) don't undo them
when hand-tweaking, and (b) recognize the symptom instantly when something regresses.

1. **Every `<audio>` needs `data-duration` (≤ actual length, 2 decimals)** or lint reports
   phantom same-track overlaps. The build ffprobes and floors — never hand-type durations.
2. **Audio clips all live on `data-track-index="2"`** with non-overlapping windows. The cascade
   guarantees no overlap; if you hand-move a beat, re-run the build.
3. **`gsap.fromTo` always, never `gsap.from`** — `from`'s immediateRender writes state at
   construction and breaks under the renderer's non-linear seeking (elements flash or vanish).
4. **No infinite repeats anywhere** (`repeat: -1` breaks the capture engine). Cursor blink and
   glow breathing compute finite repeats from their window. Breathe repeats must be ODD so the
   element ends at base scale.
5. **Scene exits are transitions + a hard `tl.set(scene, {visibility:"hidden"})` kill.** Opacity
   0 alone leaves the scene capturable: contrast warnings fire on invisible text, stacking bugs appear.
   Only the FINAL scene may fade out (then also visibility-killed).
6. **Decorative glows/ghost text get `data-layout-ignore`**, intentional overflow (terminal
   slide-up, callout tags) gets `data-layout-allow-overflow` — or `inspect` reports phantom issues.
7. **Fonts**: local `@font-face` woff2 only (Bricolage Grotesque bundled in assets/fonts/;
   JetBrains Mono is auto-embedded by the compiler). Never hotlink Google Fonts — the renderer
   can't fetch them and text falls back silently.
8. **GSAP via the exact pinned CDN tag with SRI** (gsap@3.14.2, sha384-sG0Hv1tP…). In the
   template — don't regress it when editing.
9. **Deterministic only**: no `Math.random()`, `Date.now()`, network fetches, async timeline
   construction. One paused timeline registered on `window.__timelines["main"]`.
10. **Render duration comes from STATIC html attributes.** After ANY spec or audio change:
    re-run TTS for changed beats → `node build-demo.mjs` → then render. Rendering a stale
    index.html silently produces the old video.
11. **Typing via `tl.call` doesn't rewind** — scrubbing backward in the Studio preview shows
    fully-typed text. That's expected; the forward-seeking renderer captures it correctly.
12. **Never trust the render exit code.** Extract frames at the beat-map midpoints with ffmpeg
    and READ them (title, each typing moment, terminal output, every pause card, outro).
    Verify the typing state matches the narration at that timestamp.
13. **Caption strip vs window**: the editor window is sized to leave ~140px at the bottom.
    Don't enlarge the window; don't move `.cap-g` above `bottom: 30px`.
14. **`npx hyperframes validate` can time out on low-memory machines** — `lint` + frame
    verification is the fallback; don't skip both.
15. **The template ships as `template.html.src`, not `.html`.** A second root-level .html
    containing `data-composition-id` makes lint fail with `multiple_root_compositions` and
    crashes `inspect` (`Cannot read properties of undefined (reading 'totalDuration')` — it
    finds the un-built template with placeholder duration). Keep the `.src` extension.
16. **`hyperframes lint` STATICALLY analyzes gsap calls.** Tweens with computed selectors
    (`tl.to(q(s, ".hero"), ...)` in a loop) become `__unresolved__` and falsely overlap each
    other — dozens of `overlapping_gsap_tweens` warnings. That's why build-demo.mjs emits
    every tween as a literal line (literal selector, literal time) and only `tl.call` typing
    and `tl.set` captions stay data-driven. Never add variable-selector tweens to the template.
17. **Marker replacement**: build uses `replaceAll`/function replacements — `String.replace`
    hits only the first occurrence (a marker named in a comment eats the real one) and treats
    `$` in replacement strings specially.
