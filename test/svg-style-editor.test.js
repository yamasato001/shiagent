import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { clampStyleValue, safePaint, splitAbsoluteCompoundPath } from "../assets/js/svg-style-core.js";
import { TOOL_CATALOG } from "../assets/js/custom-workflow-core.js";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("SVG style values are normalized before being written", () => {
  assert.equal(safePaint("#abc"), "#aabbcc");
  assert.equal(safePaint("#12ABef"), "#12abef");
  assert.equal(safePaint("none"), "none");
  assert.equal(safePaint("url(https://example.com/a)"), "#000000");
  assert.equal(clampStyleValue(140, 0, 100, 1), 100);
  assert.equal(clampStyleValue(-2, 0, 1, 1), 0);
});

test("absolute compound paths can be separated into individual visible objects", () => {
  assert.deepEqual(splitAbsoluteCompoundPath("M0 0L10 0Z M20 20C21 21 22 22 23 23Z"), ["M0 0L10 0Z", "M20 20C21 21 22 22 23 23Z"]);
  assert.deepEqual(splitAbsoluteCompoundPath("M0 0l10 0zm20 20l2 2z"), ["M0 0l10 0zm20 20l2 2z"]);
  assert.deepEqual(splitAbsoluteCompoundPath(""), []);
});

test("SVG style editor exposes selection, paint, stroke, history and export controls", async () => {
  for (const page of ["svg-style-editor/index.html", "ja/svg-style-editor/index.html"]) {
    const html = await read(page);
    for (const id of ["fileInput", "svgStage", "selectionBox", "objectSelectMode", "colorSelectMode", "selectBlackButton", "selectWhiteButton", "matchedColor", "fillColor", "fillNone", "strokeColor", "strokeNone", "strokeWidth", "strokeWidthNumber", "elementOpacity", "applyAllButton", "undoButton", "redoButton", "resetButton", "clearAllButton", "downloadButton", "downloadAllButton"]) {
      assert.match(html, new RegExp(`id="${id}"`), `${page} needs #${id}`);
    }
    assert.match(html, /svg-style-editor\.js/);
    assert.match(html, /workflow-handoff\.js/);
    assert.match(html, /class="content-section faq-section"/);
  }
});

test("SVG style editor sanitizes active content and joins shared workflows", async () => {
  const [core, editor, handoff, catalog] = await Promise.all([
    read("assets/js/svg-style-core.js"),
    read("assets/js/svg-style-editor.js"),
    read("assets/js/workflow-handoff.js"),
    read("tools/index.html"),
  ]);
  assert.match(core, /script,foreignObject,iframe,object,embed,audio,video,canvas/);
  assert.match(core, /name\.startsWith\("on"\)/);
  assert.match(core, /javascript\\s\*:/);
  assert.match(editor, /shiagent:outputs/);
  assert.match(handoff, /\/svg-style-editor\//);
  assert.match(catalog, /href="\/svg-style-editor\//);
  assert.deepEqual(TOOL_CATALOG.find(tool => tool.id === "svg-style-editor"), {
    id: "svg-style-editor", category: "vector", path: "/svg-style-editor/", accepts: ["svg"], output: ["svg"]
  });
});

test("SVG style editor supports multi-selection, live paint, pan and wheel zoom", async () => {
  const [editor, css, japanese, english] = await Promise.all([
    read("assets/js/svg-style-editor.js"),
    read("assets/css/svg-style-editor.css"),
    read("ja/svg-style-editor/index.html"),
    read("svg-style-editor/index.html"),
  ]);
  assert.match(editor, /selected: new Set\(\)/);
  assert.match(editor, /event\.ctrlKey \|\| event\.metaKey \|\| event\.shiftKey/);
  assert.match(editor, /previewSelected\(\)/);
  assert.match(editor, /addEventListener\("pointermove"/);
  assert.match(editor, /addEventListener\("wheel"/);
  assert.match(editor, /event\.button === 1/);
  assert.match(editor, /key\.toLowerCase\(\) === "a"/);
  assert.match(editor, /getBBox\(\)/);
  assert.match(editor, /fitViewToContent/);
  assert.match(editor, /getBoundingClientRect\(\)/);
  assert.match(editor, /selectionMode: "object"/);
  assert.match(editor, /completed: false/);
  assert.match(editor, /state\.completed = true; renderSession\(\)/);
  assert.match(editor, /state\.completed = false; state\.index = 0; renderSession\(\)/);
  assert.match(editor, /function clearAll\(\)/);
  assert.match(editor, /sampledPaintAtPoint/);
  assert.match(editor, /splitCompoundPaths\(root\)/);
  assert.match(editor, /containsBox/);
  assert.match(editor, /colorChannels: new Map\(\)/);
  assert.match(editor, /selectColor\("#000000"\)/);
  assert.match(editor, /selectColor\("#ffffff"\)/);
  assert.match(editor, /event\.preventDefault\(\)/);
  assert.match(css, /left: 50%; top: 50%/);
  assert.match(css, /cursor: grabbing/);
  assert.match(css, /pointer-events: visiblePainted !important/);
  assert.match(css, /scrollbar-gutter: stable/);
  assert.match(css, /stroke: #ff2b18 !important/);
  assert.match(css, /style-editor-fields\[hidden\].*display: none/);
  assert.match(japanese, /style-editor-mode-panel/);
  assert.match(japanese, /オブジェクト選択/);
  assert.match(japanese, /同じ色を選択/);
  assert.match(japanese, /黒い部分/);
  assert.match(japanese, /白い部分/);
  assert.match(japanese, />全選択</);
  assert.match(japanese, /背景ドラッグ: 矩形選択/);
  assert.match(japanese, /ホイールボタンドラッグ: 移動/);
  assert.match(japanese, /id="clearAllButton"[^>]*>すべてをクリア</);
  assert.match(japanese, /id="clearAllButton"[\s\S]*id="downloadButton"/);
  assert.match(japanese, /Ctrl＋ホイール/);
  assert.match(english, />Select all</);
  assert.match(english, /Drag background: box select/);
  assert.match(english, /Ctrl\+wheel/);
});
