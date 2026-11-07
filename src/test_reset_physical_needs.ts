import assert from "node:assert/strict";
import { GameEngine } from "./engine/GameEngine.js";

const engine = new GameEngine();
engine.init();

const player = engine.getPlayer();
const aria = engine.getAI();
const initialPlayerNeeds = { ...player.needs };
const initialAriaNeeds = { ...aria.needs };
const initialLayout = JSON.stringify(engine.houseBuilder.getLayout());

player.needs.hunger = 99;
player.needs.thirst = 98;
player.needs.energy = 2;
player.needs.sleepiness = 97;
player.needs.hygiene = 3;
player.needs.bladder = 96;
aria.needs.hunger = 91;
aria.needs.thirst = 92;
aria.needs.energy = 4;
aria.needs.sleepiness = 93;
aria.needs.hygiene = 5;
aria.needs.bladder = 94;

player.location.roomId = "kitchen";
player.body.posture = "standing";
player.emotions.stress = 80;
engine.stateManager.updateObjectState("lamp_001", (object) => {
  object.state = "on";
});
engine.stateManager.setTime({ day: 8, hour: 14, minute: 25 });
engine.stateManager.updateNarrative({ player_mood: "Still stressed" });

engine.stateManager.resetPhysicalNeeds();

assert.deepEqual(player.needs, initialPlayerNeeds);
assert.deepEqual(aria.needs, initialAriaNeeds);
assert.equal(player.location.roomId, "kitchen");
assert.equal(player.body.posture, "standing");
assert.equal(player.emotions.stress, 80);
assert.equal(engine.stateManager.getObjectState("lamp_001").state, "on");
assert.equal(engine.stateManager.getTime().day, 8);
assert.equal(engine.stateManager.getTime().hour, 14);
assert.equal(engine.stateManager.getTime().minute, 25);
assert.equal(engine.stateManager.getNarrative().player_mood, "Still stressed");
assert.equal(JSON.stringify(engine.houseBuilder.getLayout()), initialLayout);

console.log("Physical-needs reset restores only initialized needs and preserves other game state.");
