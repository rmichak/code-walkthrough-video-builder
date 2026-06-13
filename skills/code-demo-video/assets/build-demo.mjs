#!/usr/bin/env node
/**
 * code-demo-video builder: demo.spec.mjs + template.html + audio/*.wav → index.html
 *
 * - ffprobes every narration wav, runs the timing cascade, converts beat-relative
 *   action offsets to absolute timeline times
 * - generates scene HTML (title/editor/pause/outro), audio tags, caption groups
 * - bakes DEMO_DATA consumed by the template's runtime
 * - prints a beat map + pacing warnings
 *
 * Usage: node build-demo.mjs [spec.mjs] [--clip] [--print-map]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const specPath = resolve(args.find((a) => !a.startsWith("--")) || "demo.spec.mjs");
const printOnly = args.includes("--print-map");
const spec = (await import(pathToFileURL(specPath).href)).default;

const warns = [];
const warn = (m) => warns.push(m);
const fail = (m) => {
  console.error("ERROR: " + m);
  process.exit(1);
};

/* ---------- validate ---------- */
const SCENE_KINDS = ["title", "editor", "pause", "outro", "browser", "doc"];
if (!spec.beats?.length) fail("spec.beats is empty");
if (!spec.file?.name) fail("spec.file.name required");
spec.beats.forEach((b, i) => {
  if (!SCENE_KINDS.includes(b.scene)) fail(`beat ${i} (${b.id}): unknown scene "${b.scene}"`);
  if (!b.narration) fail(`beat ${i} (${b.id}): narration required`);
  if (b.scene === "pause" && (!b.step || !b.task || !b.checklist?.length))
    fail(`beat ${i} (${b.id}): pause beats need step:{n,of}, task, checklist[]`);
  if (b.pauseOverlay) {
    if (b.scene !== "editor")
      fail(`beat ${i} (${b.id}): pauseOverlay only works on scene:"editor" beats (so the code stays visible)`);
    if (!b.step || !b.task || !b.checklist?.length)
      fail(`beat ${i} (${b.id}): pauseOverlay beats need step:{n,of}, task, checklist[]`);
  }
  if (b.scene === "outro" && !b.outro) fail(`beat ${i} (${b.id}): outro beats need outro:{headline,bullets}`);
  if (b.scene === "browser" && !b.browser?.pageHTML)
    fail(`beat ${i} (${b.id}): browser beats need browser:{pageHTML} (raw HTML with inline styles)`);
  if (b.scene === "doc" && !b.doc?.body)
    fail(`beat ${i} (${b.id}): doc beats need doc:{title?, body} (body is raw HTML)`);
  (b.actions || []).forEach((a, j) => {
    if (["type", "highlight-line", "callout"].includes(a.do) && !(a.line >= 1))
      fail(`beat ${i} action ${j}: "${a.do}" needs line >= 1`);
    if (a.do === "type" && !a.segs?.length) fail(`beat ${i} action ${j}: type needs segs [[cls,text],...]`);
  });
});

const clipMode = args.includes("--clip") || spec.clipMode === true;
let beats = spec.beats.map((b, i) => ({ ...b, origIndex: i }));
if (clipMode) {
  const dropped = beats.filter((b) => b.scene === "title" || b.scene === "outro");
  if (dropped.length) warn(`clipMode: dropping ${dropped.map((b) => b.id).join(", ")}`);
  beats = beats.filter((b) => b.scene === "editor" || b.scene === "pause");
}

/* ---------- audio probe + transcripts ---------- */
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ffprobe = (f) =>
  parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", f]).toString()
  );

for (const b of beats) {
  const nn = String(b.origIndex + 1).padStart(2, "0");
  b.wav = `audio/vo-${nn}-${b.id}.wav`;
  if (!existsSync(b.wav)) fail(`missing ${b.wav} — run TTS for beat "${b.id}" first`);
  b.audioDur = ffprobe(b.wav);
  const tj = b.wav.replace(/\.wav$/, ".json");
  if (existsSync(tj)) {
    const raw = JSON.parse(readFileSync(tj, "utf8"));
    b.words = Array.isArray(raw) ? raw : raw.words || [];
  } else {
    b.words = null;
    warn(`beat ${b.id}: no transcript ${tj} — captions skipped for this beat`);
  }
}

/* ---------- caption fixes (respelling → correct display text) ---------- */
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, "");
function applyFixes(words, fixes) {
  if (!fixes?.length || !words) return words;
  const out = [...words.map((w) => ({ ...w }))];
  for (const [from, to] of fixes) {
    const keyParts = from.toLowerCase().split(/[\s-]+/).map(norm).filter(Boolean);
    for (let i = 0; i <= out.length - keyParts.length; i++) {
      const slice = out.slice(i, i + keyParts.length);
      if (slice.every((w, k) => norm(w.text) === keyParts[k])) {
        const trailPunct = (slice[slice.length - 1].text.match(/[.,!?;:]+$/) || [""])[0];
        out.splice(i, keyParts.length, {
          text: to + trailPunct,
          start: slice[0].start,
          end: slice[slice.length - 1].end,
        });
      }
    }
  }
  return out;
}

/* ---------- timing cascade ---------- */
// cpsCode simulates a person typing character-by-character — keep it human (~8). Don't raise
// it to "fit" more; split the beat. Never instantly fill a line (no cps above ~14).
const DEF = { cpsCode: 8, cpsTerm: 8, hold: 0.6, voDelayFirst: 0.8, voDelayNext: 0.3 };
const actionDur = (a) => {
  if (a.do === "type") return a.segs.reduce((n, s) => n + s[1].length, 0) / (a.cps || DEF.cpsCode);
  if (a.do === "term-type") return a.text.length / (a.cps || DEF.cpsTerm);
  if (a.do === "term-out") return a.callout ? 1.4 : 0.6;
  if (a.do === "terminal-open") return 0.7;
  return 0.8;
};

let cursor = clipMode ? 0.5 : 0;
let prevScene = null;
for (const b of beats) {
  b.start = cursor;
  b.newScene = b.scene !== "editor" || prevScene !== "editor";
  const voDelay = b.voDelay ?? (b.start === 0 ? 0.5 : b.newScene ? DEF.voDelayFirst : DEF.voDelayNext);
  b.audioAt = b.start + voDelay;
  const audioEnd = b.audioAt + b.audioDur;

  // resolve action times (relative -> absolute)
  let prevEnd = 0;
  b.absActions = (b.actions || []).map((a) => {
    let rel;
    if (typeof a.at === "number") rel = a.at;
    else if (typeof a.at === "string" && a.at.startsWith("prev+")) rel = prevEnd + parseFloat(a.at.slice(5));
    else fail(`beat ${b.id}: bad at "${a.at}" (number or "prev+N")`);
    const start = b.start + rel;
    const end = start + actionDur(a);
    prevEnd = rel + actionDur(a);
    return { ...a, absStart: start, absEnd: end };
  });
  const visualEnd = Math.max(b.start, ...b.absActions.map((a) => a.absEnd));
  if (visualEnd > audioEnd + 0.2 && b.absActions.length)
    warn(
      `beat ${b.id}: visuals run ${(visualEnd - audioEnd).toFixed(1)}s past narration — consider raising cps or trimming actions`
    );
  // Explain each line as you type it: each typed line wants its own spoken explanation.
  const typeCount = (b.actions || []).filter((a) => a.do === "type").length;
  const words = (b.narration || "").trim().split(/\s+/).filter(Boolean).length;
  if (b.scene === "editor" && typeCount >= 2 && words / typeCount < 8)
    warn(
      `beat ${b.id}: only ~${Math.round(words / typeCount)} narration words per typed line — explain each line as you type it (add narration or split the beat)`
    );
  b.end = Math.max(audioEnd + (b.holdAfter ?? DEF.hold), visualEnd + 0.6);
  cursor = b.end;
  prevScene = b.scene;
}
const fadeOut = !clipMode;
const duration = +(cursor + (clipMode ? 0.5 : 1.0)).toFixed(2);

/* ---------- scene grouping ---------- */
const scenes = [];
for (const b of beats) {
  const cur = scenes[scenes.length - 1];
  // A pauseOverlay beat closes its editor scene, so the next step starts a fresh
  // editor window (preserving the recap/prefill pattern). Otherwise consecutive
  // editor beats share one window.
  const lastBeat = cur?.beats[cur.beats.length - 1];
  if (cur && cur.kind === "editor" && b.scene === "editor" && !lastBeat?.pauseOverlay) {
    cur.beats.push(b);
    cur.end = b.end;
  } else {
    scenes.push({ id: `sc${scenes.length + 1}`, kind: b.scene, beats: [b], start: b.start, end: b.end });
  }
  b.sceneId = scenes[scenes.length - 1].id;
}
scenes[scenes.length - 1].end = duration;

const transitions = scenes.slice(1).map((s, i) => {
  const prev = scenes[i];
  const explicit = s.beats[0].transition;
  const type = explicit || (prev.kind === "title" && s.kind === "editor" ? "zoom" : "blur");
  return { at: +s.start.toFixed(2), type, from: prev.id, to: s.id };
});

/* ---------- HTML generators ---------- */
const prompt = spec.terminalPrompt || `student@${spec.file.folder || "demo"} % `;
const langClass = `lang-${spec.file.lang || "plain"}`;

/* Tween CODE GENERATION.
 * hyperframes lint statically analyzes gsap calls; variable selectors become
 * "__unresolved__" and falsely overlap each other. So every tween is emitted as a
 * literal line (literal selector, literal time). Only tl.call typing and tl.set
 * captions stay data-driven. */
const typingData = [];
const J = [];
const emit = (l) => J.push("      " + l);
const n2 = (x) => (+x).toFixed(2);
function genBlink(id, t0, t1) {
  const reps = Math.max(1, Math.ceil((t1 - t0) / 0.38) - 1);
  emit(`tl.set("#${id}", { visibility: "visible" }, ${n2(t0)});`);
  emit(`tl.to("#${id}", { opacity: 0, duration: 0.38, yoyo: true, repeat: ${reps}, ease: "steps(1)" }, ${n2(t0)});`);
  emit(`tl.set("#${id}", { visibility: "hidden" }, ${n2(t1)});`);
}
function genBreathe(sel, t0, t1, sc = 1.07) {
  let reps = Math.max(1, Math.ceil((t1 - t0) / 2.3) - 1);
  if (reps % 2 === 0) reps += 1; // odd → ends at base scale
  emit(`tl.to("${sel}", { scale: ${sc}, duration: 2.3, yoyo: true, repeat: ${reps}, ease: "sine.inOut" }, ${n2(t0)});`);
}

function titleSceneHTML(sc) {
  const t = spec.title || {};
  return `
      <div id="${sc.id}" class="scene"${sc.start > 0 ? ' style="opacity:0"' : ""}>
        <div class="glow glow-a" data-layout-ignore style="top:-350px;left:-250px;width:1300px;height:1300px;"></div>
        <div class="ttl-ghost mono" data-layout-ignore>${esc(t.ghost || spec.file.name)}</div>
        <div class="ttl-corner tl"></div>
        <div class="ttl-corner br"></div>
        <div class="ttl-content">
          <div class="ttl-meta"><div class="ttl-meta-rule"></div><div>${esc(spec.course || "")}${spec.module ? " &middot; " + esc(spec.module) : ""}</div></div>
          <div class="ttl-hero">${esc(t.hero || "")}${t.accent ? ' <span class="accent">' + esc(t.accent) + "</span>" : ""}</div>
          <div class="ttl-bar"></div>
          <div class="ttl-sub">${esc(t.sub || "")}</div>
        </div>
        <div class="ttl-chip mono">${esc(t.chip || spec.module || "LESSON")}</div>
      </div>`;
}

function browserSceneHTML(sc) {
  const b = sc.beats[0];
  const br = b.browser;
  // pageHTML is author-provided raw HTML (inline styles) — intentionally NOT escaped
  return `
      <div id="${sc.id}" class="scene" style="opacity:0">
        <div class="glow glow-a" data-layout-ignore style="top:50%;left:50%;width:1700px;height:1100px;margin:-550px 0 0 -850px;"></div>
        <div class="ed-label mono">${esc(spec.editorLabel || `${spec.course || ""}${spec.module ? " — " + spec.module : ""}`)}</div>
        <div class="ed-label-r mono">${esc(br.engine || "browser")} &middot; live preview</div>
        <div class="brw">
          <div class="brw-chrome">
            <div class="brw-tabs">
              <div class="brw-dots">
                <div class="brw-dot" style="background:#ff5f57"></div><div class="brw-dot" style="background:#febc2e"></div><div class="brw-dot" style="background:#28c840"></div>
              </div>
              <div class="brw-tab">${esc(br.tab || spec.file.name)}</div>
            </div>
            <div class="brw-urlrow">
              <div class="brw-nav">&larr;&nbsp;&nbsp;&rarr;&nbsp;&nbsp;&#8635;</div>
              <div class="brw-url">${esc(br.url || `file:///${spec.file.name}`)}</div>
            </div>
          </div>
          <div class="brw-page" style="${esc(br.pageStyle || "")}">${br.pageHTML}</div>
        </div>
        ${br.callout ? `<div class="brw-note" id="${sc.id}-note" data-layout-allow-overflow>${esc(br.callout.text)}</div>` : ""}
      </div>`;
}

function docSceneHTML(sc) {
  const d = sc.beats[0].doc;
  // d.body is author-provided raw HTML (inline styles / .doc-* classes) — NOT escaped
  return `
      <div id="${sc.id}" class="scene" style="opacity:0">
        <div class="glow glow-a" data-layout-ignore style="top:-300px;left:-250px;width:1300px;height:1300px;"></div>
        <div class="ed-label mono">${esc(spec.course || "")}${spec.module ? " &middot; " + esc(spec.module) : ""} &middot; ASSIGNMENT</div>
        <div class="doc-sheet">
          ${d.tag ? `<div class="doc-tag">${esc(d.tag)}</div>` : ""}
          ${d.title ? `<div class="doc-title">${esc(d.title)}</div>` : ""}
          <div class="doc-body">${d.body}</div>
        </div>
        ${d.callout ? `<div class="brw-note" id="${sc.id}-note" data-layout-allow-overflow>${esc(d.callout.text)}</div>` : ""}
      </div>`;
}

function pauseSceneHTML(sc) {
  const b = sc.beats[0];
  return `
      <div id="${sc.id}" class="scene" style="opacity:0">
        <div class="glow glow-b" data-layout-ignore style="top:-300px;right:-350px;width:1250px;height:1250px;"></div>
        <div class="pc-inner">
          <div class="pc-glyph"><div></div><div></div></div>
          <div class="pc-badge mono">STEP ${b.step.n} OF ${b.step.of}</div>
          <div class="pc-head">${esc(b.task)}</div>
          <div class="pc-list">
            ${b.checklist.map((c) => `<div class="pc-item"><div class="pc-box"></div><div>${esc(c)}</div></div>`).join("\n            ")}
          </div>
          ${b.hint ? `<div class="pc-hint">${esc(b.hint)}</div>` : ""}
        </div>
        <div class="pc-foot">&#9658;&nbsp;&nbsp;PRESS PLAY WHEN YOU&rsquo;RE DONE</div>
      </div>`;
}

function outroSceneHTML(sc) {
  const o = sc.beats[0].outro;
  return `
      <div id="${sc.id}" class="scene" style="opacity:0">
        <div class="glow glow-b" data-layout-ignore style="bottom:-420px;right:-300px;width:1400px;height:1400px;"></div>
        <div class="ot-inner">
          <div class="ot-head">${esc(o.headline)}${o.accent ? ' <span class="accent">' + esc(o.accent) + "</span>" : ""}</div>
          <div class="ot-list">
            ${(o.bullets || []).map((x) => `<div class="ot-item"><div class="ot-tick"></div><div>${esc(x)}</div></div>`).join("\n            ")}
          </div>
        </div>
        <div class="ot-rule"></div>
        <div class="ot-foot">${esc(o.foot || `${spec.course || ""}${spec.module ? " · " + spec.module : ""}`)}</div>
      </div>`;
}

function editorSceneHTML(sc) {
  const f = spec.file;
  // collect lines: prefill + typed (+ callouts)
  const lines = new Map(); // line# -> {prefill?:segs, typeAction?, callouts:[]}
  let hasTerm = false;
  let lastTyped = null;
  for (const b of sc.beats) {
    for (const p of b.prefill || []) {
      lines.set(p.line, { ...(lines.get(p.line) || {}), prefill: p.segs, callouts: lines.get(p.line)?.callouts || [] });
    }
    for (const a of b.absActions) {
      if (a.do === "type") {
        lines.set(a.line, { ...(lines.get(a.line) || {}), typeAction: a, callouts: lines.get(a.line)?.callouts || [] });
        lastTyped = a;
      } else if (a.do === "callout") {
        const e = lines.get(a.line) || { callouts: [] };
        e.callouts = e.callouts || [];
        e.callouts.push(a);
        lines.set(a.line, e);
      } else if (["term-type", "term-out", "terminal-open"].includes(a.do)) hasTerm = true;
    }
  }
  // viewTop = "scrolled" editor: render lines viewTop..end with true line numbers.
  // ~14 lines fit; ~7 above an open terminal.
  const viewTop = sc.beats[0].viewTop || 1;
  const maxLine = Math.max(viewTop + 2, ...lines.keys());
  for (const n of lines.keys())
    if (n < viewTop) fail(`scene ${sc.id}: line ${n} is above viewTop ${viewTop} — it would not be rendered`);
  for (const b of sc.beats)
    for (const a of b.absActions)
      if (a.do === "highlight-line" && a.line < viewTop)
        fail(`scene ${sc.id}: highlight-line ${a.line} is above viewTop ${viewTop}`);
  if (maxLine - viewTop + 1 > 14)
    warn(`scene ${sc.id}: ${maxLine - viewTop + 1} code lines visible — only ~14 fit; raise viewTop on its beat`);
  if (hasTerm && maxLine - viewTop + 1 > 8)
    warn(`scene ${sc.id}: terminal opens but ${maxLine - viewTop + 1} lines are shown — lines below ~${viewTop + 7} will be covered; raise viewTop on its beat`);
  let codeHTML = "";
  let segCounter = 0;
  const focusSpans = []; // { line, start } per typed line — drives the focus border
  for (let n = viewTop; n <= maxLine; n++) {
    const entry = lines.get(n);
    let inner = "";
    if (entry?.prefill) {
      inner = entry.prefill.map(([cls, txt]) => `<span${cls ? ` class="${cls}"` : ""}>${esc(txt)}</span>`).join("");
    } else if (entry?.typeAction) {
      const a = entry.typeAction;
      a.targets = a.segs.map(([cls, txt]) => {
        const id = `${sc.id}-s${segCounter++}`;
        inner += `<span id="${id}"${cls ? ` class="${cls}"` : ""}></span>`;
        return { id, text: txt };
      });
      const curId = `${sc.id}-cur-l${n}`;
      inner += `<span id="${curId}" class="cursor"></span>`;
      typingData.push({
        targets: a.targets.map((t) => ({ id: t.id, text: t.text })),
        start: +a.absStart.toFixed(2),
        cps: a.cps || DEF.cpsCode,
      });
      genBlink(curId, a.absStart - 0.35, a.absEnd + 0.35);
      focusSpans.push({ line: n, start: a.absStart });
    }
    for (const c of entry?.callouts || []) {
      const id = `${sc.id}-co-l${n}-${Math.round(c.absStart * 10)}`;
      inner += `<span class="line-callout mono" id="${id}" data-layout-allow-overflow>${esc(c.text)}</span>`;
      emit(`tl.fromTo("#${id}", { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.45, ease: "back.out(1.6)" }, ${n2(c.absStart)});`);
    }
    codeHTML += `<div class="code-line cl-${n}"><div class="gutter">${n}</div><div class="code-text">${inner}</div></div>\n                `;
  }

  /* focus border: the line being typed/explained gets a blue left-rail + tint, released
     when focus moves to the next typed line (or scene end). "Highlight what we reference."
     Editor emphasis is brand-neutral (#3794ff) — the editor is never rebranded. */
  if (spec.focus !== false && focusSpans.length) {
    const hlLines = new Set();
    for (const bb of sc.beats) for (const a of bb.absActions) if (a.do === "highlight-line") hlLines.add(a.line);
    const fs = focusSpans
      .sort((a, b) => a.start - b.start)
      .filter((f, i, arr) => (i === 0 || f.line !== arr[i - 1].line) && !hlLines.has(f.line));
    fs.forEach((f, i) => {
      const next = fs[i + 1];
      const inAt = +f.start.toFixed(2);
      const outAt = +(next ? next.start : sc.end - 0.2).toFixed(2);
      if (outAt - inAt < 0.3) return;
      emit(
        `tl.fromTo("#${sc.id} .cl-${f.line}", { backgroundColor: "rgba(55,148,255,0)", boxShadow: "inset 0px 0 0 0 #3794ff" }, { backgroundColor: "rgba(55,148,255,0.10)", boxShadow: "inset 4px 0 0 0 #3794ff", duration: 0.3, ease: "sine.out" }, ${inAt});`
      );
      emit(
        `tl.to("#${sc.id} .cl-${f.line}", { backgroundColor: "rgba(55,148,255,0)", boxShadow: "inset 0px 0 0 0 #3794ff", duration: 0.35, ease: "sine.in" }, ${outAt});`
      );
    });
  }

  // other runtime actions for this scene
  let termIdx = 0;
  let termHTML = "";
  let lastOutId = null;
  for (const b of sc.beats) {
    for (const a of b.absActions) {
      if (a.do === "terminal-open") {
        emit(`tl.set("#${sc.id} .vsc-terminal", { visibility: "visible" }, ${n2(a.absStart - 0.05)});`);
        emit(`tl.fromTo("#${sc.id} .vsc-terminal", { y: 320 }, { y: 0, duration: 0.7, ease: "power3.out" }, ${n2(a.absStart)});`);
      } else if (a.do === "highlight-line")
        emit(
          `tl.fromTo("#${sc.id} .cl-${a.line}", { backgroundColor: "rgba(255,200,61,0)" }, { backgroundColor: "rgba(255,200,61,0.16)", duration: 0.4, yoyo: true, repeat: 1, ease: "sine.inOut" }, ${n2(a.absStart)});`
        );
      else if (a.do === "file-activate") {
        emit(`tl.set("#${sc.id} .sb-row.main", { backgroundColor: "#37373d", color: "#ffffff" }, ${n2(a.absStart)});`);
        emit(
          `tl.fromTo("#${sc.id} .sb-row.main", { boxShadow: "inset 4px 0 0 0 rgba(91,184,255,0)" }, { boxShadow: "inset 4px 0 0 0 rgba(91,184,255,1)", duration: 0.35, yoyo: true, repeat: 1, ease: "sine.inOut" }, ${n2(a.absStart)});`
        );
      } else if (a.do === "redbox") {
        // red highlight ring around a UI element to draw the student's eye.
        // target: newfile | runbtn | terminal | tab | sidebarfile, or line: N
        const map = {
          newfile: `#${sc.id}-newfile`,
          runbtn: `#${sc.id} .vsc-runbtn`,
          terminal: `#${sc.id} .vsc-terminal`,
          tab: `#${sc.id} .vsc-tab`,
          sidebarfile: `#${sc.id} .sb-row.main`,
        };
        const sel = a.line ? `#${sc.id} .cl-${a.line}` : map[a.target];
        if (sel) {
          const ins = a.target === "terminal" ? "inset " : "";
          const hold = a.hold ?? 3;
          emit(`tl.fromTo("${sel}", { boxShadow: "${ins}0 0 0 0px rgba(255,59,59,0)" }, { boxShadow: "${ins}0 0 0 4px #ff3b3b", duration: 0.35, ease: "power2.out" }, ${n2(a.absStart)});`);
          emit(`tl.to("${sel}", { boxShadow: "${ins}0 0 0 9px rgba(255,59,59,0.28)", duration: 0.7, yoyo: true, repeat: 3, ease: "sine.inOut" }, ${n2(a.absStart + 0.35)});`);
          emit(`tl.to("${sel}", { boxShadow: "${ins}0 0 0 0px rgba(255,59,59,0)", duration: 0.3, ease: "power2.in" }, ${n2(a.absStart + hold)});`);
        }
      } else if (a.do === "term-type") {
        const cmdId = `${sc.id}-tcmd-${termIdx}`;
        const curId = `${sc.id}-tcur-${termIdx}`;
        termHTML += `<div class="term-line"><span class="t-prompt">${esc(prompt)}</span><span id="${cmdId}"></span><span id="${curId}" class="cursor" style="height:28px"></span></div>\n                  `;
        typingData.push({
          targets: [{ id: cmdId, text: a.text }],
          start: +a.absStart.toFixed(2),
          cps: a.cps || DEF.cpsTerm,
        });
        genBlink(curId, a.absStart - 0.5, a.absEnd + 0.5);
        termIdx++;
      } else if (a.do === "term-out") {
        const outId = `${sc.id}-tout-${termIdx}`;
        const ringId = a.callout ? `${sc.id}-ring-${termIdx}` : null;
        const tagId = a.callout ? `${sc.id}-tag-${termIdx}` : null;
        termHTML += `<div class="term-line"><span class="t-out-block" id="${outId}" data-layout-allow-overflow>${esc(a.lines.join("\n"))}${
          a.callout
            ? `<span class="out-ring" id="${ringId}"></span><span class="out-tag" id="${tagId}">&#10003;&nbsp;${esc(a.callout.toUpperCase())}</span>`
            : ""
        }</span></div>\n                  `;
        emit(
          `tl.fromTo("#${outId}", { visibility: "hidden", opacity: 0 }, { visibility: "visible", opacity: 1, duration: 0.3, ease: "power1.out" }, ${n2(a.absStart)});`
        );
        if (ringId)
          emit(
            `tl.fromTo("#${ringId}", { opacity: 0, scale: 1.22 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, ${n2(a.absStart + 0.35)});`
          );
        if (tagId)
          emit(
            `tl.fromTo("#${tagId}", { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.45, ease: "power2.out" }, ${n2(a.absStart + 0.7)});`
          );
        lastOutId = { afterStart: a.absEnd, idx: termIdx };
        termIdx++;
      }
    }
  }
  if (lastOutId) {
    const pId = `${sc.id}-tprompt-end`;
    const pCur = `${sc.id}-tcur-end`;
    termHTML += `<div class="term-line" id="${pId}" style="visibility:hidden"><span class="t-prompt">${esc(prompt)}</span><span id="${pCur}" class="cursor" style="height:28px"></span></div>\n                  `;
    emit(`tl.set("#${pId}", { visibility: "visible" }, ${n2(lastOutId.afterStart + 1.2)});`);
    genBlink(pCur, lastOutId.afterStart + 1.2, sc.end - 0.15);
  }

  const hasFileActivate = sc.beats.some((b) => b.absActions.some((a) => a.do === "file-activate"));
  const col = lastTyped ? lastTyped.segs.reduce((n, s) => n + s[1].length, 0) + 1 : 1;
  const ln = lastTyped ? lastTyped.line : 1;

  /* overlay pause: a compact "your turn" card laid OVER the editor so the typed
     code stays visible behind/around it. Lives inside this editor scene (no
     separate full-screen pause scene). Appears at the pause beat's start and
     rides out with the scene transition. */
  let overlayHTML = "";
  sc.beats.forEach((b, bi) => {
    if (!b.pauseOverlay) return;
    const id = `${sc.id}-pov-${bi}`;
    overlayHTML += `
        <div class="pause-ov" id="${id}" style="visibility:hidden;opacity:0" data-layout-allow-overflow>
          <div class="pov-card">
            <div class="pov-toprow"><div class="pov-glyph"><span></span><span></span></div><div class="pov-badge mono">STEP ${b.step.n} OF ${b.step.of}</div></div>
            <div class="pov-head">${esc(b.task)}</div>
            <div class="pov-list">
              ${b.checklist.map((c) => `<div class="pov-item"><div class="pov-box"></div><div>${esc(c)}</div></div>`).join("\n              ")}
            </div>
            ${b.hint ? `<div class="pov-hint">${esc(b.hint)}</div>` : ""}
            <div class="pov-foot">&#9658;&nbsp;&nbsp;PRESS PLAY WHEN YOU&rsquo;RE DONE</div>
          </div>
        </div>`;
    const t = b.start;
    // shrink the editor toward its top-left so the card has clear space on the right
    // (never overlaps code). The next scene is a fresh full-size editor.
    emit(`tl.to("#${sc.id} .vsc", { scale: 0.74, duration: 0.55, ease: "power3.out", transformOrigin: "0% 0%" }, ${n2(t + 0.1)});`);
    emit(`tl.fromTo("#${id}", { visibility: "hidden", opacity: 0 }, { visibility: "visible", opacity: 1, duration: 0.4, ease: "power2.out" }, ${n2(t + 0.25)});`);
    emit(`tl.fromTo("#${id} .pov-card", { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)" }, ${n2(t + 0.25)});`);
    emit(`tl.fromTo("#${id} .pov-item", { x: -16, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: "power2.out", stagger: 0.1 }, ${n2(t + 0.6)});`);
  });

  /* steps overlay: a small red-accented card (top-right) listing the literal steps for
     something we can't click-by-click animate (open the terminal, create a file). Fades
     in at `at`, out after `hold`. Beat property: stepsOverlay:{ title, items[], at?, hold? } */
  sc.beats.forEach((b, bi) => {
    const so = b.stepsOverlay;
    if (!so) return;
    const id = `${sc.id}-steps-${bi}`;
    overlayHTML += `
        <div class="steps-ov" id="${id}" style="visibility:hidden;opacity:0" data-layout-allow-overflow>
          <div class="steps-card">
            <div class="steps-title">${esc(so.title || "Steps")}</div>
            ${so.items.map((it, k) => `<div class="steps-item"><span class="steps-num mono">${k + 1}</span><div>${esc(it)}</div></div>`).join("\n            ")}
          </div>
        </div>`;
    const at = b.start + (so.at ?? 1.0);
    const hold = so.hold ?? Math.max(3, b.end - at - 0.6);
    emit(`tl.fromTo("#${id}", { visibility: "hidden", opacity: 0 }, { visibility: "visible", opacity: 1, duration: 0.4, ease: "power2.out" }, ${n2(at)});`);
    emit(`tl.fromTo("#${id} .steps-card", { x: 30, scale: 0.97 }, { x: 0, scale: 1, duration: 0.45, ease: "back.out(1.3)" }, ${n2(at)});`);
    emit(`tl.fromTo("#${id} .steps-item", { x: 14, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: "power2.out", stagger: 0.1 }, ${n2(at + 0.3)});`);
    emit(`tl.to("#${id}", { opacity: 0, duration: 0.4, ease: "power1.in" }, ${n2(at + hold)});`);
    emit(`tl.set("#${id}", { visibility: "hidden" }, ${n2(at + hold + 0.45)});`);
  });

  /* file-create intro: the explorer starts empty, a new file row appears, its name
     types in, then the editor "opens" it (tab + breadcrumb fade in). For absolute
     beginners who don't know how to make/open a file. Enabled by beat.fileCreate. */
  const fc = sc.beats.find((b) => b.fileCreate);
  const fnameId = fc ? `${sc.id}-fname` : null;
  if (fc) {
    // fileCreateAt = seconds into the beat when the filename starts typing (sync to narration
    // "click New File and type the name"); fileOpenAt = when the editor "opens" it (tab appears,
    // sync to "press enter"). Both relative to the beat start.
    const nameStart = fc.start + (fc.fileCreateAt ?? 1.8);
    typingData.push({ targets: [{ id: fnameId, text: f.name }], start: +nameStart.toFixed(2), cps: 13 });
    const nameEnd = nameStart + f.name.length / 13;
    const openAt = fc.fileOpenAt != null ? fc.start + fc.fileOpenAt : nameEnd + 0.45;
    // pulse the New File icon ("click here") just before the row appears
    emit(`tl.fromTo("#${sc.id}-newfile", { backgroundColor: "rgba(88,185,124,0)", borderColor: "#b9b9b9" }, { backgroundColor: "rgba(88,185,124,0.5)", borderColor: "#58b97c", duration: 0.4, yoyo: true, repeat: 3, ease: "sine.inOut" }, ${n2(nameStart - 1.4)});`);
    emit(`tl.fromTo("#${sc.id} .sb-row.main", { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.5, ease: "power2.out" }, ${n2(nameStart - 0.6)});`);
    emit(`tl.set("#${sc.id} .sb-row.main", { backgroundColor: "#37373d", color: "#ffffff" }, ${n2(nameEnd + 0.3)});`);
    emit(`tl.fromTo("#${sc.id} .vsc-tabs", { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, ${n2(openAt)});`);
    emit(`tl.fromTo("#${sc.id} .vsc-breadcrumb", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "sine.out" }, ${n2(openAt + 0.2)});`);
  }
  const sbActive = hasFileActivate || fc ? "" : " active";

  return `
      <div id="${sc.id}" class="scene"${sc.start > 0 ? ' style="opacity:0"' : ""}>
        <div class="glow glow-a" data-layout-ignore style="top:50%;left:50%;width:1750px;height:1100px;margin:-550px 0 0 -875px;"></div>
        <div class="ed-label mono">${esc(spec.editorLabel || `${spec.course || ""}${spec.module ? " — " + spec.module : ""}`)}</div>
        <div class="ed-label-r mono">${esc(spec.file.lang || "code")} &middot; visual studio code</div>
        <div class="vsc">
          <div class="vsc-titlebar">
            <div class="tl-dot" style="background:#ff5f57"></div><div class="tl-dot" style="background:#febc2e"></div><div class="tl-dot" style="background:#28c840"></div>
            <div class="vsc-title">${esc(f.name)} &mdash; ${esc(f.folder || "demo")}</div>
          </div>
          <div class="vsc-menubar">
            <div class="mb-logo"></div>
            <span>File</span><span>Edit</span><span>Selection</span><span>View</span><span>Go</span><span>Run</span><span>Terminal</span><span>Help</span>
          </div>
          <div class="vsc-body">
            <div class="vsc-activity">
              <div class="act-icon active"></div>
              <div class="act-icon"></div>
              <div class="act-icon round"></div>
              <div class="act-icon" style="transform:rotate(45deg);width:26px;height:26px"></div>
              <div class="act-icon" style="border-radius:3px"></div>
              <div class="act-spacer"></div>
              <div class="act-icon round"></div>
              <div class="act-icon"></div>
            </div>
            <div class="vsc-sidebar">
              <div class="sb-head"><span>EXPLORER &middot; ${esc((f.folder || "demo").toUpperCase())}</span><span class="sb-actions"><span class="sb-act newfile" id="${sc.id}-newfile"></span><span class="sb-act"></span></span></div>
              <div class="sb-row main${sbActive}"${fc ? ' style="opacity:0"' : ""}><div class="file-badge ${langClass}"></div>${fc ? `<div id="${fnameId}"></div>` : `<div>${esc(f.name)}</div>`}</div>
              ${(f.siblings || []).map((s2) => `<div class="sb-row"><div class="sb-ico"></div><div>${esc(s2)}</div></div>`).join("\n              ")}
            </div>
            <div class="vsc-editor">
              <div class="vsc-tabs"${fc ? ' style="opacity:0"' : ""}><div class="vsc-tab"><div class="file-badge ${langClass}"></div>${esc(f.name)}<span class="tab-close">&times;</span></div><div class="tab-spacer"></div><div class="vsc-runbtn"><span class="tri" data-layout-ignore></span>Run</div></div>
              <div class="vsc-breadcrumb"${fc ? ' style="opacity:0"' : ""}>${esc(f.folder || "demo")} &rsaquo; ${esc(f.name)}</div>
              <div class="vsc-code">
                ${codeHTML}
              </div>
              <div class="vsc-minimap" data-layout-ignore>
                ${[58, 80, 44, 70, 52, 88, 38, 74, 50, 84, 34, 64, 72, 46, 60, 30].map((w) => `<div class="mm-line" style="width:${w}%"></div>`).join("\n                ")}
              </div>
              ${
                hasTerm
                  ? `<div class="vsc-terminal" data-layout-allow-overflow>
                <div class="term-tabs"><div class="term-tab">PROBLEMS</div><div class="term-tab">OUTPUT</div><div class="term-tab active">TERMINAL</div></div>
                <div class="term-body">
                  ${termHTML}
                </div>
              </div>`
                  : ""
              }
            </div>
          </div>
          <div class="vsc-status">
            <div class="st-left">
              <div class="st-item">&#8917;&nbsp;main</div>
              <div class="st-item">&#10007;&nbsp;0&nbsp;&nbsp;&#9888;&nbsp;0</div>
            </div>
            <div class="st-right">
              <div class="st-item">Ln ${ln}, Col ${col}</div>
              <div class="st-item">Spaces: 4</div>
              <div class="st-item">UTF-8</div>
              <div class="st-item">LF</div>
              <div class="st-item">&#10003;&nbsp;${esc(spec.statusRight || "Python")}</div>
              <div class="st-item">&#128276;</div>
            </div>
          </div>
        </div>${overlayHTML}
      </div>`;
}

const sceneHTML = scenes
  .map((sc) =>
    sc.kind === "title"
      ? titleSceneHTML(sc)
      : sc.kind === "pause"
        ? pauseSceneHTML(sc)
        : sc.kind === "outro"
          ? outroSceneHTML(sc)
          : sc.kind === "browser"
            ? browserSceneHTML(sc)
            : sc.kind === "doc"
              ? docSceneHTML(sc)
              : editorSceneHTML(sc)
  )
  .join("\n");

/* ---------- scene entrances (literal tween code, fromTo only) ---------- */
for (const s of scenes) {
  const P = `#${s.id}`;
  if (s.kind === "title") {
    const t = s.start === 0 ? 0 : s.start + 0.15;
    emit(`tl.fromTo("${P} .ttl-ghost", { opacity: 0, x: -40 }, { opacity: 0.09, x: 0, duration: 1.2, ease: "power1.out" }, ${n2(t + 0.4)});`);
    emit(`tl.fromTo("${P} .ttl-meta", { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, ${n2(t + 0.25)});`);
    emit(`tl.fromTo("${P} .ttl-meta-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power2.inOut" }, ${n2(t + 0.35)});`);
    emit(
      `tl.fromTo("${P} .ttl-hero", { y: 80, opacity: 0, filter: "blur(14px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.9, ease: "expo.out" }, ${n2(t + 0.55)});`
    );
    emit(`tl.fromTo("${P} .ttl-bar", { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: "power3.inOut" }, ${n2(t + 1.05)});`);
    emit(`tl.fromTo("${P} .ttl-sub", { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "sine.out" }, ${n2(t + 1.2)});`);
    emit(`tl.fromTo("${P} .ttl-chip", { x: 70, opacity: 0 }, { x: 0, opacity: 0.9, duration: 0.55, ease: "back.out(1.4)" }, ${n2(t + 1.4)});`);
    emit(`tl.fromTo("${P} .ttl-corner.tl", { scale: 0, opacity: 0 }, { scale: 1, opacity: 0.8, duration: 0.4, ease: "power2.out" }, ${n2(t + 1.55)});`);
    emit(`tl.fromTo("${P} .ttl-corner.br", { scale: 0, opacity: 0 }, { scale: 1, opacity: 0.8, duration: 0.4, ease: "power2.out" }, ${n2(t + 1.65)});`);
    emit(
      `tl.fromTo("${P} .glow", { x: 0, y: 0 }, { x: 60, y: -40, duration: ${n2(Math.min(5, s.end - s.start))}, ease: "sine.inOut" }, ${n2(t)});`
    );
  } else if (s.kind === "editor") {
    const t = s.start;
    emit(`tl.fromTo("${P} .vsc", { y: 26 }, { y: 0, duration: 0.55, ease: "power2.out" }, ${n2(t + 0.3)});`);
    emit(`tl.fromTo("${P} .ed-label", { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "power3.out" }, ${n2(t + 0.7)});`);
    emit(`tl.fromTo("${P} .ed-label-r", { opacity: 0 }, { opacity: 0.75, duration: 0.7, ease: "sine.out" }, ${n2(t + 1.0)});`);
    genBreathe(`${P} .glow`, t + 0.5, s.end);
  } else if (s.kind === "pause") {
    const t = s.start;
    emit(`tl.fromTo("${P} .pc-glyph", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.7)" }, ${n2(t + 0.3)});`);
    emit(`tl.fromTo("${P} .pc-badge", { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${n2(t + 0.5)});`);
    emit(
      `tl.fromTo("${P} .pc-head", { y: 50, opacity: 0, filter: "blur(8px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }, ${n2(t + 0.65)});`
    );
    emit(
      `tl.fromTo("${P} .pc-item", { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power2.out", stagger: 0.13 }, ${n2(t + 1.0)});`
    );
    if (s.beats[0].hint)
      emit(`tl.fromTo("${P} .pc-hint", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "sine.out" }, ${n2(t + 1.5)});`);
    emit(`tl.fromTo("${P} .pc-foot", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)" }, ${n2(t + 1.75)});`);
    genBreathe(`${P} .glow`, t + 0.4, s.end, 1.09);
  } else if (s.kind === "doc") {
    const t = s.start;
    const b = s.beats[0];
    emit(`tl.fromTo("${P} .doc-sheet", { y: 44, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65, ease: "power3.out" }, ${n2(t + 0.3)});`);
    emit(`tl.fromTo("${P} .ed-label", { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "power2.out" }, ${n2(t + 0.6)});`);
    if (b.doc.callout)
      emit(
        `tl.fromTo("#${s.id}-note", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }, ${n2(t + (b.doc.callout.at ?? 2.5))});`
      );
    genBreathe(`${P} .glow`, t + 0.4, s.end);
  } else if (s.kind === "browser") {
    const t = s.start;
    const b = s.beats[0];
    emit(`tl.fromTo("${P} .brw", { y: 34, scale: 0.98, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.65, ease: "power3.out" }, ${n2(t + 0.3)});`);
    emit(`tl.fromTo("${P} .ed-label", { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "power2.out" }, ${n2(t + 0.7)});`);
    emit(`tl.fromTo("${P} .ed-label-r", { opacity: 0 }, { opacity: 0.75, duration: 0.7, ease: "sine.out" }, ${n2(t + 1.0)});`);
    emit(`tl.fromTo("${P} .brw-page", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: "sine.out" }, ${n2(t + 1.0)});`);
    if (b.browser.callout)
      emit(
        `tl.fromTo("#${s.id}-note", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }, ${n2(t + (b.browser.callout.at ?? 2.5))});`
      );
    genBreathe(`${P} .glow`, t + 0.4, s.end);
  } else if (s.kind === "outro") {
    const t = s.start;
    emit(
      `tl.fromTo("${P} .ot-head", { y: 70, opacity: 0, filter: "blur(10px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.8, ease: "expo.out" }, ${n2(t + 0.35)});`
    );
    emit(
      `tl.fromTo("${P} .ot-item", { y: 40, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.5)", stagger: 0.14 }, ${n2(t + 0.9)});`
    );
    emit(`tl.fromTo("${P} .ot-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, ${n2(t + 1.4)});`);
    emit(`tl.fromTo("${P} .ot-foot", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "sine.out" }, ${n2(t + 1.7)});`);
    genBreathe(`${P} .glow`, t + 0.3, s.end, 1.1);
  }
}

/* ---------- transitions (the transition IS the exit + hard visibility kill) ---------- */
for (const tr of transitions) {
  const F = `#${tr.from}`,
    T = `#${tr.to}`;
  if (tr.type === "zoom") {
    emit(`tl.to("${F}", { scale: 2.4, opacity: 0, filter: "blur(8px)", duration: 0.4, ease: "power3.in" }, ${n2(tr.at)});`);
    emit(
      `tl.fromTo("${T}", { scale: 0.55, opacity: 0, filter: "blur(8px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.45, ease: "power3.out" }, ${n2(tr.at + 0.15)});`
    );
    emit(`tl.set("${F}", { visibility: "hidden" }, ${n2(tr.at + 0.7)});`);
  } else if (tr.type === "blur") {
    emit(`tl.to("${F}", { filter: "blur(10px)", scale: 1.03, opacity: 0, duration: 0.5, ease: "power2.inOut" }, ${n2(tr.at)});`);
    emit(
      `tl.fromTo("${T}", { filter: "blur(10px)", scale: 0.97, opacity: 0 }, { filter: "blur(0px)", scale: 1, opacity: 1, duration: 0.5, ease: "power2.inOut" }, ${n2(tr.at + 0.1)});`
    );
    emit(`tl.set("${F}", { visibility: "hidden" }, ${n2(tr.at + 0.8)});`);
  } else {
    emit(`tl.set("${T}", { opacity: 1 }, ${n2(tr.at)});`);
    emit(`tl.set("${F}", { visibility: "hidden" }, ${n2(tr.at + 0.02)});`);
  }
}

/* ---------- final fade (the one allowed exit) ---------- */
if (fadeOut) {
  const last = scenes[scenes.length - 1];
  emit(`tl.to("#${last.id}", { opacity: 0, duration: 0.7, ease: "power1.in" }, ${n2(duration - 0.8)});`);
  emit(`tl.set("#${last.id}", { visibility: "hidden" }, ${n2(duration - 0.05)});`);
}

/* ---------- audio tags ---------- */
const audioHTML = beats
  .map((b, i) => {
    const dur = Math.floor(b.audioDur * 100) / 100;
    return `<audio id="vo${i + 1}" data-start="${b.audioAt.toFixed(2)}" data-duration="${dur.toFixed(2)}" data-track-index="2" src="${b.wav}"></audio>`;
  })
  .join("\n      ");

/* ---------- captions ---------- */
const capHTML = [];
const capData = [];
if (spec.captions !== false) {
  beats.forEach((b, bi) => {
    if (!b.words?.length) return;
    const words = applyFixes(b.words, spec.captionFixes);
    const groups = [];
    let g = [];
    let chars = 0;
    for (const w of words) {
      g.push(w);
      chars += w.text.length + 1;
      const punct = /[.!?]$/.test(w.text);
      if (chars > 38 || g.length >= 7 || punct) {
        groups.push(g);
        g = [];
        chars = 0;
      }
    }
    if (g.length) groups.push(g);
    groups.forEach((grp, gi) => {
      const gid = `cap-${bi}-${gi}`;
      const spans = grp
        .map((w, wi) => `<span id="${gid}-w${wi}">${esc(w.text)}</span>`)
        .join(" ");
      capHTML.push(`<div class="cap-g" id="${gid}">${spans}</div>`);
      const next = groups[gi + 1];
      const start = +(b.audioAt + grp[0].start - 0.05).toFixed(2);
      // hide STRICTLY before the next group shows (next shows at next.start-0.05) —
      // and keep the final group short of the next beat's first caption
      const end = next
        ? +(b.audioAt + next[0].start - 0.08).toFixed(2)
        : Math.min(+(b.audioAt + grp[grp.length - 1].end + 0.7).toFixed(2), duration - 0.1);
      capData.push({
        id: gid,
        start: Math.max(0, start),
        end,
        words: grp.map((w, wi) => ({ id: `${gid}-w${wi}`, t: +(b.audioAt + w.start).toFixed(2) })),
      });
    });
  });
}

/* ---------- DEMO_DATA + injection ---------- */
const DEMO_DATA = { typing: typingData, captions: capData };

if (!printOnly) {
  // .src extension keeps hyperframes lint/inspect from discovering it as a second root composition
  const tplPath = existsSync(resolve("template.html.src")) ? resolve("template.html.src") : resolve("template.html");
  if (!existsSync(tplPath)) fail("template.html.src not found in project root — copy it from the skill's assets/");
  let html = readFileSync(tplPath, "utf8");
  // replaceAll + function-replacements: plain .replace() only hits the FIRST occurrence
  // and treats $-patterns in the replacement string specially
  html = html.replaceAll("__DURATION__", duration.toFixed(2));
  html = html.replaceAll('class="__BRAND__"', spec.branding === "nvcc" ? 'class="brand-nvcc"' : 'class=""');
  html = html.replace("<!--__AUDIO__-->", () => audioHTML);
  html = html.replace("<!--__SCENES__-->", () => sceneHTML);
  html = html.replace("<!--__CAPTIONS__-->", () => capHTML.join("\n        "));
  html = html.replace("/*__DEMO_DATA__*/ null", () => JSON.stringify(DEMO_DATA));
  html = html.replace("/*__TIMELINE__*/", () => J.join("\n").trimStart());
  writeFileSync("index.html", html);
}

/* ---------- beat map ---------- */
console.log(`\n${spec.id || "demo"} — ${duration.toFixed(1)}s total, ${beats.length} beats, ${scenes.length} scenes${clipMode ? " (clipMode)" : ""}\n`);
console.log("idx  beat            scene    start   audio   end     mid(inspect)");
beats.forEach((b, i) => {
  console.log(
    `${String(i + 1).padEnd(4)} ${b.id.padEnd(15)} ${b.scene.padEnd(8)} ${b.start.toFixed(1).padStart(6)} ${b.audioDur
      .toFixed(1)
      .padStart(6)} ${b.end.toFixed(1).padStart(6)}  ${((b.start + b.end) / 2).toFixed(1)}`
  );
});
const inspectTimes = beats.map((b) => ((b.start + b.end) / 2).toFixed(1)).join(",");
console.log(`\ninspect: npx hyperframes inspect --at ${inspectTimes}`);
console.log(`frames:  for t in ${beats.map((b) => ((b.start + b.end) / 2).toFixed(1)).join(" ")}; do ffmpeg -y -v error -ss $t -i renders/OUT.mp4 -frames:v 1 /tmp/f$t.png; done`);
if (warns.length) {
  console.log("\nWARNINGS:");
  warns.forEach((w) => console.log("  ⚠ " + w));
}
if (!printOnly) console.log("\n✓ index.html written");
