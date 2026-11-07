import assert from "node:assert/strict";
import { GameEngine } from "./engine/GameEngine.js";

const engine = new GameEngine();
engine.init();
const player = engine.getPlayer();
const aria = engine.getAI();

assert.equal(engine.submitPlayerAction("get_up").result.status, "accepted");
assert.equal(engine.submitPlayerAction("pick_up_item", "phone_001").result.status, "accepted");
assert.equal(engine.getPlayer().holding?.objectId, "phone_001");

assert.equal(engine.submitPlayerAction("walk_to_kitchen").result.status, "accepted");
assert.equal(player.location.roomId, "kitchen");
player.location.positionId = "floor_4_17";
player.location.mapPosition = { roomId: "kitchen", x: 4.5, y: 17.5 };
assert.equal(engine.submitPlayerAction("put_down_item").result.status, "accepted");

let phoneState = engine.stateManager.getObjectState("phone_001");
assert.equal(phoneState.heldBy, null);
assert.equal(phoneState.roomId, "kitchen");
assert.equal(phoneState.positionId, player.location.positionId);
assert.equal(phoneState.x, 4.5);
assert.equal(phoneState.y, 17.5);
assert.equal(player.holding, null);

aria.location.roomId = player.location.roomId;
aria.location.positionId = player.location.positionId;
const pickUpDroppedItem = engine.submitPlayerAction("pick_up_item").result;
assert.equal(pickUpDroppedItem.status, "accepted");
assert.equal(pickUpDroppedItem.actionId, "pick_up_item");
assert.equal(engine.getPlayer().holding?.objectId, "phone_001");
aria.holding = { objectId: "chemistry_book_001", hand: "both" };
engine.stateManager.updateObjectState("chemistry_book_001", (object) => {
  object.heldBy = aria.id;
});
const fullHandsTransfer = engine.submitPlayerAction("give_item_to_aria").result;
assert.equal(fullHandsTransfer.status, "rejected");
assert.equal(fullHandsTransfer.reason, "RECIPIENT_HANDS_FULL");
engine.stateManager.updateObjectState("chemistry_book_001", (object) => {
  object.heldBy = null;
});
aria.holding = null;
assert.equal(engine.submitPlayerAction("give_item_to_aria").result.status, "accepted");
assert.equal(player.holding, null);
assert.equal(engine.getAI().holding?.objectId, "phone_001");
assert.equal(engine.stateManager.getObjectState("phone_001").heldBy, aria.id);

aria.location.roomId = "living_room";
aria.location.positionId = "floor_5_31";
aria.location.mapPosition = { roomId: "living_room", x: 5.5, y: 31.5 };
const dropResult = engine.actionEngine.executeAction({
  actionId: "put_down_item",
  actorId: aria.id,
  timestamp: new Date().toISOString(),
});
assert.equal(dropResult.status, "accepted");
phoneState = engine.stateManager.getObjectState("phone_001");
assert.equal(phoneState.heldBy, null);
assert.equal(phoneState.roomId, "living_room");
assert.equal(phoneState.positionId, "floor_5_31");
assert.equal(phoneState.x, 5.5);
assert.equal(phoneState.y, 31.5);

console.log("Pickup, location-aware drop, and transfer-to-Aria tests passed.");
