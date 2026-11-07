import assert from "node:assert/strict";
import { GameEngine } from "./engine/GameEngine.js";
import {
  executeAiActionCommands,
  getAiActionOptions,
} from "./ai/AiActionCommandProcessor.js";

const engine = new GameEngine();
engine.init();

const aria = engine.getAI();
const initialOptions = getAiActionOptions(engine);
const powerOnComputer = initialOptions.find((option) => option.actionId === "turn_on_computer");
assert.ok(powerOnComputer);
assert.ok(powerOnComputer.targets?.some((target) => target.id === "computer_001"));
assert.ok(powerOnComputer.duration >= 0);
assert.ok(powerOnComputer.category);
assert.ok(powerOnComputer.icon);
assert.ok(initialOptions.some((option) => option.actionId === "stand_up"));
assert.ok(!initialOptions.some((option) => option.actionId === "walk_to_kitchen"));

const movement = executeAiActionCommands(
  "I'll get up and head to the kitchen. &&action:stand_up&& &&action:walk_to_kitchen&&",
  engine
);
assert.equal(movement.hasCommands, true);
assert.equal(movement.response, "I'll get up and head to the kitchen.");
assert.equal(aria.location.roomId, "kitchen");
assert.equal(aria.body.posture, "standing");
assert.equal(movement.outcomes.length, 2);
assert.ok(movement.outcomes.every((outcome) => outcome.includes("accepted")));
assert.ok(!getAiActionOptions(engine).some((option) => option.actionId === "turn_on_computer"));

const returnToStudyAndUseComputer = executeAiActionCommands(
  "&&action:walk_to_study_room&& &&action:turn_on_computer;target:computer_001&&",
  engine
);
assert.equal(aria.location.roomId, "study_room");
assert.equal(engine.stateManager.getObjectState("computer_001").state, "on");
assert.ok(returnToStudyAndUseComputer.outcomes.every((outcome) => outcome.includes("accepted")));

const invalidTarget = executeAiActionCommands(
  "&&action:turn_on_computer;target:phone_001&&",
  engine
);
assert.equal(engine.stateManager.getObjectState("computer_001").state, "on");
assert.ok(invalidTarget.outcomes[0].includes("rejected"));
assert.ok(!invalidTarget.response.includes("&&action:"));

console.log("Aria action commands execute validated configured actions as Aria only.");
