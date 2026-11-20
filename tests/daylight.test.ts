import test from "node:test";
import assert from "node:assert/strict";
import {
  altitudeColor,
  daylightGradient,
  lightPhase,
  shadowDirection,
} from "../src/daylight";
test("polar night keeps one night color across the ribbon; horizon crossings produce changing light", () => {
  const polar = daylightGradient([-40, -38, -26, -35]);
  assert.equal(
    polar,
    "linear-gradient(90deg,rgb(44 49 90) 0.000%,rgb(44 49 90) 100.000%)",
  );
  const dawn = daylightGradient([-20, -12, -6, 3, 18, 55]);
  assert.notEqual(dawn, polar);
  assert.ok(dawn.includes(altitudeColor(3).join(" ")));
  assert.equal(lightPhase(3), "Golden hour");
  assert.equal(lightPhase(-22), "Night");
  assert.equal(shadowDirection(280), "east");
  assert.equal(shadowDirection(90), "west");
});
