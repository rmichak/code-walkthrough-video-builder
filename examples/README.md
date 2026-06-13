# Examples

Finished videos and the spec/config that produced them go here.

A real-world example (one of Randy's existing videos, plus its source spec) will be added later
so you can see a complete input → output pair and reuse it as a starting template.

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
