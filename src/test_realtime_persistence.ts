import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GameEngine } from "./engine/GameEngine.js";
import { RealtimePersistence } from "./engine/RealtimePersistence.js";

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "life-simulation-time-"));

try {
  const start = new Date("2026-11-04T11:34:30.000Z");
  const firstEngine = new GameEngine();
  firstEngine.init();
  const firstPersistence = new RealtimePersistence(firstEngine, temporaryDirectory);
  firstPersistence.start(start);

  assert.equal(firstEngine.timeEngine.getFormattedClock(), "17:04");
  assert.equal(firstEngine.timeEngine.getTimeOfDay(), "evening");
  assert.equal(firstEngine.stateManager.getTime().dayOfWeek, 2);

  firstEngine.submitPlayerAction("get_up");
  assert.equal(firstEngine.timeEngine.getFormattedClock(), "17:04");

  const threeMinutesLater = new Date("2026-11-04T11:37:30.000Z");
  firstPersistence.update(threeMinutesLater);
  assert.equal(firstEngine.getPlayer().needs.hunger, 45.6);
  assert.equal(firstEngine.getAI().needs.hunger, 30.6);
  assert.equal(fs.readFileSync(path.join(temporaryDirectory, "timings.txt"), "utf8").trim().split("\n").length, 4);

  firstEngine.getPlayer().location.roomId = "study_room";
  firstPersistence.persist(threeMinutesLater);

  const resumedEngine = new GameEngine();
  resumedEngine.init();
  const resumedPersistence = new RealtimePersistence(resumedEngine, temporaryDirectory);
  resumedPersistence.start(new Date("2026-11-04T11:40:30.000Z"));

  assert.equal(resumedEngine.getPlayer().location.roomId, "study_room");
  assert.equal(resumedEngine.getPlayer().needs.hunger, 46.2);
  assert.equal(resumedEngine.getAI().needs.hunger, 31.2);
  assert.equal(resumedEngine.timeEngine.getFormattedClock(), "17:10");
  assert.equal(fs.readFileSync(path.join(temporaryDirectory, "timings.txt"), "utf8").trim().split("\n").length, 7);

  const pingEngine = new GameEngine();
  pingEngine.init();
  const pingPersistence = new RealtimePersistence(
    pingEngine,
    path.join(temporaryDirectory, "scheduled-ping")
  );
  pingPersistence.start(start);
  let pingCount = 0;
  pingPersistence.setAriaPingHandler(async () => {
    pingCount++;
  });
  pingPersistence.update(new Date(start.getTime() + 10 * 60_000));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(pingCount, 1);

  const deferredEngine = new GameEngine();
  deferredEngine.init();
  const deferredPersistence = new RealtimePersistence(
    deferredEngine,
    path.join(temporaryDirectory, "deferred-ping")
  );
  deferredPersistence.start(start);
  let deferredPingCount = 0;
  deferredPersistence.setAriaPingHandler(async () => {
    deferredPingCount++;
    return deferredPingCount > 1;
  });
  deferredPersistence.update(new Date(start.getTime() + 10 * 60_000));
  await new Promise((resolve) => setTimeout(resolve, 0));
  deferredPersistence.update(new Date(start.getTime() + 10 * 60_000 + 30_000));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(deferredPingCount, 1);
  deferredPersistence.update(new Date(start.getTime() + 11 * 60_000));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(deferredPingCount, 2);
  deferredPersistence.update(new Date(start.getTime() + 20 * 60_000 + 59_000));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(deferredPingCount, 2);
  deferredPersistence.update(new Date(start.getTime() + 21 * 60_000));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(deferredPingCount, 3);
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log("Real-time clock and offline needs persistence tests passed.");
