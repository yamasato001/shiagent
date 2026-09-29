import test from "node:test";
import assert from "node:assert/strict";
import { createIco, createManifest, faviconLinks, iconPlacement, ICON_SPECS } from "../assets/js/favicon-generator-core.js";

test("places a wide source using cover or contain", () => {
  assert.deepEqual(iconPlacement(400, 200, 100, { fit: "cover" }), { sx: 100, sy: 0, sw: 200, sh: 200, dx: 0, dy: 0, dw: 100, dh: 100 });
  assert.deepEqual(iconPlacement(400, 200, 100, { fit: "contain" }), { sx: 0, sy: 0, sw: 400, sh: 200, dx: 0, dy: 25, dw: 100, dh: 50 });
});

test("keeps maskable art inside the central safe zone", () => {
  const placement = iconPlacement(100, 100, 512, { fit: "contain", padding: 10 });
  assert.equal(Math.round(placement.dx), 51);
  assert.equal(Math.round(placement.dw), 410);
});

test("creates an ICO directory with embedded PNG payloads", () => {
  const png = Uint8Array.from([137, 80, 78, 71]);
  const ico = createIco([{ size: 32, data: png }, { size: 16, data: png }]);
  const view = new DataView(ico.buffer);
  assert.equal(view.getUint16(2, true), 1);
  assert.equal(view.getUint16(4, true), 2);
  assert.equal(ico[6], 16);
  assert.equal(ico[22], 32);
  assert.deepEqual([...ico.slice(-4)], [...png]);
});

test("publishes standard PWA icons and link tags", () => {
  assert.ok(ICON_SPECS.some(icon => icon.name === "apple-touch-icon.png" && icon.size === 180));
  const manifest = JSON.parse(createManifest({ name: "Demo", themeColor: "#112233" }));
  assert.equal(manifest.name, "Demo");
  assert.ok(manifest.icons.some(icon => icon.purpose === "maskable"));
  assert.match(faviconLinks(), /favicon\.ico/);
  assert.match(faviconLinks(), /site\.webmanifest/);
});
