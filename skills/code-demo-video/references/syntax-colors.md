# Syntax highlighting — VS Code Dark+ token tables

Code is hand-tokenized in the spec: each `type` action's `segs` is an array of
`[tokenClass, text]` pairs. No tokenizer dependency, deterministic, works for any language.
The classes live in template.html; these are the exact Dark+ hex values.

| Class | Hex | Python | Bash | JavaScript |
|---|---|---|---|---|
| `tok-kw` | `#C586C0` | `import from if else elif for while return in not and or` | `if then else fi for do done while` | `if else for while return new import export` |
| `tok-decl` | `#569CD6` | `def class lambda True False None` | `function local` + flags (`-r`, `--help`) | `const let var function class true false null` |
| `tok-fn` | `#DCDCAA` | function/method calls: `print`, `len`, `input`, `.upper` | command names: `echo grep curl chmod python` | calls: `log`, `map`, `fetch` |
| `tok-str` | `#CE9178` | `"..."` `'...'` f-string text parts | `"..."` `'...'` | `"..."` `'...'` template literal text |
| `tok-num` | `#B5CEA8` | `42` `7.5` | `42` | `42` `7.5` |
| `tok-comment` | `#6A9955` | `# ...` | `# ...` | `// ...` `/* ... */` |
| `tok-var` | `#9CDCFE` | variable names, parameters | `$VAR` `${VAR}` | identifiers, properties, params |
| `tok-type` | `#4EC9B2` | class names, `int str float list dict type` | — | class names, `console`, built-in objects |
| `""` (empty) | `#D4D4D4` | operators, punctuation, `=` `(` `)` `:` `,` | operators, pipes | operators, braces |

## Tokenizing rules

- **Adjacent same-color runs may merge** into one seg — fewer spans, same look:
  `["", " = "]` not `["", " "], ["", "="], ["", " "]`.
- **Include real spaces in the segs** (white-space is pre): `["tok-var", "name"], ["", " = "], ["tok-str", "\"Avery\""]`.
- **f-strings (Python)**: string parts are `tok-str`, braces are default, the inner expression
  is tokenized normally: `["tok-str", "f\"Hello, "], ["", "{"], ["tok-var", "name"], ["", "}"], ["tok-str", "!\""]`.
- **Indentation**: leading spaces go in the FIRST seg of the line: `["", "    "], ["tok-kw", "return"], ...`
  or fold into it: `["tok-kw", "    return"]` is acceptable (color doesn't render on spaces).
- **Terminal text is never tokenized** — commands and output render in terminal gray (#cccccc);
  the prompt is colored by the template.

## HTML & CSS mapping

HTML (`file.lang: "html"` — orange badge): tag names → `tok-decl`, attribute names → `tok-var`,
attribute values → `tok-str`, comments `<!-- -->` → `tok-comment`, angle brackets and text
content → default. `<!DOCTYPE html>` → one `tok-decl` seg.

CSS (inside a `<style>` block): selectors → `tok-fn`, property names → `tok-var`,
values (including hex colors) → `tok-str`, braces/colons/semicolons → default.

```js
// <h1>Hello, web!</h1>
segs: [["","  <"],["tok-decl","h1"],["",">Hello, web!</"],["tok-decl","h1"],["",">"]]
// body { background: #0f172a; }
segs: [["","    "],["tok-fn","body"],["", " { "],["tok-var","background"],["",": "],["tok-str","#0f172a"],["","; }"]]
```

## Worked examples

Python — `alerts_today = 12  # int`:
```js
segs: [["tok-var","alerts_today"], ["", " = "], ["tok-num","12"], ["", "  "], ["tok-comment","# int"]]
```

Python — `def greet(name):`:
```js
segs: [["tok-decl","def"], ["", " "], ["tok-fn","greet"], ["", "("], ["tok-var","name"], ["", "):"]]
```

Bash — `echo "scan: $HOST"` (in a .sh file; `$` prompt is terminal chrome, not a token):
```js
segs: [["tok-fn","echo"], ["", " "], ["tok-str","\"scan: "], ["tok-var","$HOST"], ["tok-str","\""]]
```

JavaScript — `const total = items.length;`:
```js
segs: [["tok-decl","const"], ["", " "], ["tok-var","total"], ["", " = "], ["tok-var","items"], ["", "."], ["tok-var","length"], ["", ";"]]
```
