// Example explainer spec — recreates the proven "Hello, World!" demo (~35s).
// This file doubles as living documentation of the spec format.
// Full schema: references/spec-format.md
export default {
  id: "hello-world",
  mode: "explainer", // "explainer" | "walkthrough"
  branding: "neutral", // "neutral" | "nvcc"
  clipMode: false, // true → drop title/outro, add hold frames (for splicing into a bigger video)

  course: "PYTHON BASICS",
  module: "MODULE 01",
  title: {
    hero: "Hello,",
    accent: "World!", // rendered in the accent color after hero
    sub: "Your first Python program — written, run, and narrated for you.",
    chip: "LESSON 01",
    ghost: 'print("Hello, World!")', // oversized faded background text
  },
  file: {
    name: "hello.py",
    lang: "python", // python | bash | javascript | plain (drives the file badge color)
    folder: "course-demo",
    siblings: ["README.md"], // extra explorer rows
  },
  statusRight: "Python 3.12.1",

  // TTS respellings that must display correctly in captions:
  captionFixes: [
    ["pie thawn", "Python"],
    ["P Y", "py"],
  ],

  beats: [
    {
      id: "title",
      scene: "title",
      holdAfter: 0.3,
      narration: "Let's write your first pie-thawn program — and watch this video build itself.",
    },
    {
      id: "typing",
      scene: "editor",
      narration:
        "Here in V S Code, we create a file called hello dot P Y, and type a single line: print, hello world.",
      actions: [
        { do: "file-activate", at: 1.8 },
        { do: "type", line: 1, at: 1.0, cps: 13, segs: [["tok-comment", "# my first program"]] },
        {
          do: "type",
          line: 3,
          at: "prev+1.6",
          cps: 8.5,
          segs: [
            ["tok-fn", "print"],
            ["", "("],
            ["tok-str", '"Hello, World!"'],
            ["", ")"],
          ],
        },
      ],
    },
    {
      id: "run",
      scene: "editor",
      narration:
        "Now we open the integrated terminal, and run it: pie-thawn hello dot P Y. And there's our output. Hello, World. Your first program.",
      actions: [
        { do: "terminal-open", at: 0.2 },
        { do: "term-type", at: 2.0, cps: 10, text: "python hello.py" },
        { do: "term-out", at: "prev+1.0", lines: ["Hello, World!"], callout: "your first output" },
      ],
    },
    {
      id: "outro",
      scene: "outro",
      holdAfter: 0.6,
      narration:
        "No screen recording, no editing. The code, the typing, even this voice — generated from one script.",
      outro: {
        headline: "Built from",
        accent: "one script.",
        bullets: ["The code typed itself", "The terminal ran for real", "The voice is generated"],
        foot: "AI-GENERATED LESSON · DEMO",
      },
    },
  ],
};
