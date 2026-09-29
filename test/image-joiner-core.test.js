import test from "node:test";
import assert from "node:assert/strict";
import { joinLayout, joinedName } from "../assets/js/image-joiner-core.js";

const images = [{ width: 100, height: 50 }, { width: 60, height: 80 }, { width: 40, height: 40 }, { width: 20, height: 30 }];

test("lays images out horizontally with centered cross-axis alignment", () => {
  const result = joinLayout(images.slice(0, 2), { mode: "horizontal", gap: 10, padding: 5 });
  assert.deepEqual([result.width, result.height], [180, 90]);
  assert.deepEqual(result.placements.map(item => [item.x, item.y]), [[5, 20], [115, 5]]);
});

test("lays images out vertically", () => {
  const result = joinLayout(images.slice(0, 2), { mode: "vertical", gap: 4, padding: 2 });
  assert.deepEqual([result.width, result.height], [104, 138]);
  assert.deepEqual(result.placements.map(item => [item.x, item.y]), [[2, 2], [22, 56]]);
});

test("creates a two by two grid", () => {
  const result = joinLayout(images, { mode: "grid", columns: 2, gap: 8, padding: 4 });
  assert.deepEqual([result.width, result.height], [216, 176]);
  assert.deepEqual(result.placements.map(item => [item.x, item.y]), [[4, 19], [132, 4], [34, 112], [152, 117]]);
});

test("creates predictable output names", () => {
  assert.equal(joinedName("jpeg"), "shiagent-joined-image.jpg");
  assert.equal(joinedName("png"), "shiagent-joined-image.png");
});
