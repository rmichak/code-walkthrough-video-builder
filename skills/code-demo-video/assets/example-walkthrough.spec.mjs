// Example walkthrough spec — minimal 2-step pause-card pattern (~80s).
// Shows: pause cards, prefill recap, highlight sweep. Full schema: references/spec-format.md
export default {
  id: "walkthrough-mini",
  mode: "walkthrough",
  branding: "neutral",

  course: "PYTHON BASICS",
  module: "ASSIGNMENT 01",
  title: {
    hero: "Build it",
    accent: "with me.",
    sub: "A two-step guided walkthrough — pause when I tell you, then build it yourself.",
    chip: "WALKTHROUGH",
  },
  file: { name: "greeting.py", lang: "python", folder: "assignment-01" },
  statusRight: "Python 3.12.1",
  captionFixes: [["pie thawn", "Python"]],

  beats: [
    {
      id: "title",
      scene: "title",
      narration: "This is a guided walkthrough. I'll show each step — then you pause, and build it yourself.",
    },
    {
      id: "step1",
      scene: "editor",
      narration: "Step one. Create a variable called name, holding your own name as a string, in quotes.",
      actions: [
        {
          do: "type",
          line: 1,
          at: 1.2,
          segs: [
            ["tok-var", "name"],
            ["", " = "],
            ["tok-str", '"Avery Chen"'],
          ],
        },
        { do: "callout", line: 1, at: "prev+0.6", text: "a string — text in quotes" },
      ],
    },
    {
      id: "pause1",
      scene: "editor",
      pauseOverlay: true, // small card over the editor — code stays visible (preferred over full-screen "pause")
      holdAfter: 4, // ~4s of silence so the student can actually reach for the pause button
      step: { n: 1, of: 2 },
      task: "Your turn: create your name variable",
      checklist: ["A variable called name", "Your own name, in quotes"],
      hint: "snake_case, no spaces in variable names",
      narration: "Pause the video now, and create your own name variable. Press play when it's in your file.",
    },
    {
      id: "step2",
      scene: "editor",
      // recap: the student already wrote line 1 — prefill it, never re-type it
      prefill: [
        {
          line: 1,
          segs: [
            ["tok-var", "name"],
            ["", " = "],
            ["tok-str", '"Avery Chen"'],
          ],
        },
      ],
      narration:
        "Welcome back — your file should look like this. Step two: greet yourself with print and an f string.",
      actions: [
        { do: "highlight-line", line: 1, at: 1.0 },
        {
          do: "type",
          line: 2,
          at: "prev+1.2",
          segs: [
            ["tok-fn", "print"],
            ["", "("],
            ["tok-str", 'f"Hello, '],
            ["", "{"],
            ["tok-var", "name"],
            ["", "}"],
            ["tok-str", '!"'],
            ["", ")"],
          ],
        },
      ],
    },
    {
      id: "pause2",
      scene: "pause",
      holdAfter: 4,
      step: { n: 2, of: 2 },
      task: "Your turn: print your greeting",
      checklist: ["print() with an f-string", "Run it: python greeting.py"],
      narration: "Pause the video now. Add your print line, run the file, and check your greeting.",
    },
    {
      id: "outro",
      scene: "outro",
      narration: "That's the pattern: watch a step, pause, build it yourself. See you in the next one.",
      outro: {
        headline: "You built it",
        accent: "yourself.",
        bullets: ["Variables hold your data", "f-strings drop values into text"],
      },
    },
  ],
};
