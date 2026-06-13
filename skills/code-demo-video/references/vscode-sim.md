# Simulated VS Code window — anatomy & rules

The editor scene is an authentic VS Code Dark+ mock built entirely in CSS (template.html).
The build script generates one window instance per editor scene from the spec — you should
never hand-edit the chrome. This doc is for understanding what's there and what's safe to vary.

## Anatomy (CSS classes in template.html)

```
.vsc                       1700×872 window, top:62 left:110, #1e1e1e, 14px radius, drop shadow
├── .vsc-titlebar          #323233 · .tl-dot traffic lights (#ff5f57 #febc2e #28c840) · .vsc-title "file — folder"
├── .vsc-body
│   ├── .vsc-activity      64px #333 icon rail; first .act-icon has .active (white + accent pip)
│   ├── .vsc-sidebar       272px #252526 · .sb-head "EXPLORER · FOLDER" · .sb-row(.main/.active) file rows
│   └── .vsc-editor
│       ├── .vsc-tabs      #252526 · .vsc-tab (active: #1e1e1e bg + accent top border + .file-badge)
│       ├── .vsc-breadcrumb  "folder › file"
│       ├── .vsc-code      29px JetBrains Mono, 1.6 line-height
│       │   └── .code-line.cl-N   .gutter (line number #6e7681) + .code-text (white-space:pre)
│       │        └── token spans (.tok-*), typed spans (empty, filled by tl.call), .cursor, .line-callout
│       └── .vsc-terminal  300px #181818, hidden until terminal-open; .term-tabs · .term-body
│            └── .term-line  .t-prompt (#4ec9b0) · typed cmd span · .t-out-block (+ .out-ring/.out-tag)
└── .vsc-status            #007acc bar: branch/interpreter left, "Ln N, Col N · UTF-8 · Spaces: 4" right
```

The window leaves a ~140px strip at the bottom of the 1080p frame for the caption layer
(`.cap-layer`) — don't enlarge the window or captions will overlap the status bar.

## What the build script derives for you

- **Filename consistency**: explorer row, tab, title bar, and breadcrumb all show `file.name` —
  driven by one spec field, impossible to desync.
- **File badge color** from `file.lang`: python = blue/yellow diagonal, bash = green,
  javascript = yellow, plain = gray.
- **Status bar Ln/Col** from the last typed action's line and length.
- **Sidebar active state**: if a `file-activate` action exists, the row starts inactive and
  lights up at that moment (the "we just created the file" beat); otherwise it's active from the start.
- **Terminal**: only rendered if the scene has term actions; stays hidden until `terminal-open`.

## Rules

1. **The editor is NEVER rebranded.** `branding: nvcc` touches title/outro/pause cards only.
   Authentic Dark+ is the point — students should see exactly what their VS Code looks like.
2. **Cursor**: 14×34px `#aeafad` block, `visibility:hidden` at rest. Blink is finite-repeat
   `steps(1)` opacity — handled by the runtime `blink()` helper, never hand-rolled.
3. **`white-space: pre`** on `.code-text` and `.term-line` — indentation in `segs` text is
   preserved exactly; write real leading spaces in the spec.
4. **Long lines**: ~58 chars fit at 29px in the code area. Longer → shrink is NOT automatic;
   split the line in the real code style (or it will overflow and `inspect` will flag it).
5. **Line callouts** extend to the right of code — keep chip text under ~30 chars so
   line + chip stays inside the window.
6. **Multi-line terminal output** is one `term-out` action (`lines: [...]`) — it appears as a
   block, which is how real terminals behave (output is instant; only humans type).
