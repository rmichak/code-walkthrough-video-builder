# Design — NVCC course video overlay

Brand: **NVCC / Northern Virginia Community College**. Overlay system (title card, closed
captions, fly-in note panels) layered over a full-frame screen recording.

## Palette

| Token        | Hex       | Use                                                       |
| ------------ | --------- | --------------------------------------------------------- |
| green-bright | `#1c8040` | NVCC primary green — title gradient top, accents          |
| green-mid    | `#15672f` | Gradient mid                                              |
| green-deep   | `#125a29` | Gradient bottom                                           |
| green-hill   | `#0f4d24` | Darker structural panels                                  |
| green-shadow | `#0b3d1c` | Deepest shadow / hill bottom                              |
| gold         | `#cc9900` | NVCC gold — borders, dividers, note titles                |
| gold-bright  | `#e6b800` | Gold highlight (video-scale brightening of gold)          |
| white        | `#ffffff` | Primary text                                              |
| term-green   | `#46d369` | Terminal/mono accent (prompt, syntax/example blocks)      |
| panel-dark   | `#08210f`–`#103a20` | Note-panel background (near-black green for legible gold/mono text) |

The screen recording is the canvas for the body; overlays sit on top.

## Typography

- **Display / titles:** `Roboto, "Helvetica Neue", Arial, sans-serif`, bold (700–800). Roboto is embeddable by the renderer (Arial is not).
- **Body / captions:** same sans, 600 weight.
- **Code / commands / terminal:** `"JetBrains Mono", monospace`.

## Captions (tutorial tone, basic CC)

- Bottom-center area, full-width absolute container; **white text on a semi-opaque black box** (no color), painted on **word by word** as spoken.
- 50px, 600 weight, left-aligned within the box. One line/group at a time, hard `tl.set` kill at end.

## Note panels (floating overlay, top-right)

- ~520px wide, top-right ~64px inset. **Dark terminal-green** background, 3px **gold** left border, 18px radius, layered shadow.
- Unified card — show only the fields a note provides: kicker · title (gold mono if `code`, else white sans bold) · subtitle · summary · Syntax/Example mono blocks · key/value rows · bullets · note.
- Slide+fade in from right (expo.out 0.4s), hold while the topic is discussed, slide+fade out. One panel at a time. Inactive panels are `visibility:hidden` (keeps the WCAG checker honest and out of the way of the video).

## Title card

NVCC green gradient + radial gold glow, oversized ghost watermark, gold padlock mark, title +
subtitle from config, optional mono prompt accent with a blinking cursor, gold divider, corner
registration marks. ~4s, crossfades into the recording.

## Do's and Don'ts

- **Do** keep the screen recording full-resolution and predominant — overlays are accents.
- **Do** use gold for note titles/borders and green for structure.
- **Don't** invent colors outside this palette, or color the captions (basic black & white).
- **Don't** cover the active area of the recording — float notes top-right, captions bottom.
- **Don't** let two notes or two caption groups show at once.
