import assert from "node:assert/strict";
import { GameEngine } from "./engine/GameEngine.js";
import { PlacedHouseObject } from "./types/house.js";

const engine = new GameEngine();
engine.init();

const player = engine.getPlayer();
const aria = engine.getAI();
assert.equal(engine.stateManager.getObjectState("bed_001").occupiedBy, player.id);

const standUp = engine.actionEngine.executeAction({
  actorId: player.id,
  actionId: "stand_up",
  timestamp: new Date().toISOString(),
});
assert.equal(standUp.status, "accepted");
assert.equal(engine.stateManager.getObjectState("bed_001").occupiedBy, null);
assert.equal(engine.stateManager.getObjectState("bed_001").state, "rumpled");

player.location.roomId = "study_room";
player.location.positionId = "study_door_area";
assert.ok(
  !engine.actionEngine
    .getAvailableActions(player.id)
    .some((action) => action.id === "sit_down_study_chair")
);

const ariaStands = engine.actionEngine.executeAction({
  actorId: aria.id,
  actionId: "stand_up",
  timestamp: new Date().toISOString(),
});
assert.equal(ariaStands.status, "accepted");
assert.equal(engine.stateManager.getObjectState("chair_study").occupiedBy, null);
assert.equal(engine.stateManager.getObjectState("chair_study").state, "available");

const playerSits = engine.actionEngine.executeAction({
  actorId: player.id,
  actionId: "sit_down_study_chair",
  timestamp: new Date().toISOString(),
});
assert.equal(playerSits.status, "accepted");
assert.equal(engine.stateManager.getObjectState("chair_study").occupiedBy, player.id);
assert.equal(engine.stateManager.getObjectState("chair_study").state, "occupied");

const sleepEngine = new GameEngine();
sleepEngine.init();
const sleeper = sleepEngine.getPlayer();
sleeper.needs.energy = 50;

const sleep = sleepEngine.actionEngine.executeAction({
  actorId: sleeper.id,
  actionId: "sleep",
  timestamp: new Date().toISOString(),
});
assert.equal(sleep.status, "accepted");
assert.equal(sleeper.activity.current, "sleep");
assert.equal(sleeper.activity.status, "completed");

sleeper.needs.energy = 50;
sleepEngine.needsEngine.tick(10);
assert.ok(sleeper.needs.energy > 50 && sleeper.needs.energy < 54);

const interactionEngine = new GameEngine();
interactionEngine.init();
const nearbyChair: PlacedHouseObject = {
  id: "test_nearby_armchair",
  templateId: "armchair_001",
  name: "Nearby Armchair",
  type: "furniture",
  roomId: "living_room",
  x: 2,
  y: 33,
  width: 2,
  height: 2,
  rotation: 0,
  icon: "chair",
  color: "#ffffff",
  state: "neat",
  isSolid: true,
  interactions: ["sit_on_sofa", "relax_on_sofa", "stand_from_sofa"],
  placedBy: "player_001",
  placedAt: new Date().toISOString(),
};
interactionEngine.houseBuilder.getLayout().placedObjects.push(nearbyChair);
interactionEngine.houseBuilder.setStateManager(interactionEngine.stateManager);
const targeter = interactionEngine.getPlayer();
targeter.location.roomId = nearbyChair.roomId;
targeter.location.positionId = nearbyChair.id;
targeter.body.posture = "standing";
assert.ok(
  interactionEngine.objectInteractionEngine
    .getObjectsForAction("living_room", "sit_on_sofa")
    .some((object) => object.id === nearbyChair.id)
);
const sitOnNearestChair = interactionEngine.actionEngine.executeAction({
  actorId: targeter.id,
  actionId: "sit_on_sofa",
  timestamp: new Date().toISOString(),
});
assert.equal(sitOnNearestChair.status, "accepted");
assert.equal(targeter.location.positionId, nearbyChair.id);

console.log("Character activities and shared-object occupancy stay synchronized.");
