# Examples

Finished videos and the spec/config that produced them go here.

## Available

- **[hello-world/](hello-world/)** — a ~32s Python "Hello, World!" explainer built end-to-end by
  the `code-demo-video` skill. Includes the rendered MP4 and its single source spec, plus the exact
  build commands. This is the canonical starting template.

## Suggested layout for an example

```
examples/
└── <name>/
    ├── README.md          ← what this video is, which skill built it, how long it took
    ├── demo.spec.mjs       ← (code-demo-video) the spec that generated it
    │   └── or build-data.mjs / voiceover-source.md  (nvcc-video)
    └── <name>.mp4          ← the rendered result (committed so people can watch without building)
```

`.mp4` files are normally git-ignored, but anything under `examples/` is allow-listed in
`.gitignore` so curated sample renders are tracked.
