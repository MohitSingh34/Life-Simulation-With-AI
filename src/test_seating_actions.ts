import assert from "node:assert/strict";
import { GameEngine } from "./engine/GameEngine.js";

const engine = new GameEngine();
engine.init();
const player = engine.getPlayer();
const aria = engine.getAI();

player.location.roomId = "kitchen";
player.location.positionId = "kitchen_door_area";
player.body.posture = "standing";

const kitchenChair = engine.configLoader.getObject("kitchen_chair_001");
assert.ok(kitchenChair);
const chairResult = engine.actionEngine.executeAction({
  actorId: player.id,
  actionId: "sit_on_seat",
  targetObjectId: kitchenChair.id,
  timestamp: new Date().toISOString(),
});
assert.equal(chairResult.status, "accepted");
assert.equal(player.location.positionId, "dining_chair");
assert.equal(engine.stateManager.getObjectState(kitchenChair.id).occupiedBy, player.id);

const stoodUp = engine.actionEngine.executeAction({
  actorId: player.id,
  actionId: "stand_up",
  timestamp: new Date().toISOString(),
});
assert.equal(stoodUp.status, "accepted");
const defaultKitchenPlacement = engine.houseBuilder
  .getLayout()
  .placedObjects.find((object) => object.templateId === "dining_chair_001" && object.roomId === "kitchen");
assert.ok(defaultKitchenPlacement);
const secondKitchenChair = {
  ...defaultKitchenPlacement,
  id: "test_second_kitchen_chair",
  x: defaultKitchenPlacement.x + 4,
};
engine.houseBuilder.getLayout().placedObjects.push(secondKitchenChair);
engine.stateManager.updateObjectState(secondKitchenChair.id, (state) => {
  state.roomId = secondKitchenChair.roomId;
  state.positionId = secondKitchenChair.id;
});
aria.location.roomId = "kitchen";
aria.location.positionId = "kitchen_door_area";
aria.body.posture = "standing";
const secondChairResult = engine.actionEngine.executeAction({
  actorId: aria.id,
  actionId: "sit_on_seat",
  targetObjectId: secondKitchenChair.id,
  timestamp: new Date().toISOString(),
});
assert.equal(secondChairResult.status, "accepted");
assert.equal(aria.location.positionId, secondKitchenChair.id);

const diningTableTemplate = engine.houseBuilder.getTemplate("dining_table_001");
assert.ok(diningTableTemplate);
const livingRoom = engine.houseBuilder.getLayout().rooms.find((room) => room.id === "living_room");
assert.ok(livingRoom);
const diningTable = {
  id: "test_dining_table",
  templateId: diningTableTemplate.id,
  name: diningTableTemplate.name,
  type: diningTableTemplate.type,
  roomId: livingRoom.id,
  x: livingRoom.x + 1,
  y: livingRoom.y + 1,
  width: diningTableTemplate.width,
  height: diningTableTemplate.height,
  rotation: 0 as const,
  icon: diningTableTemplate.icon,
  color: diningTableTemplate.color,
  state: diningTableTemplate.defaultState,
  isSolid: diningTableTemplate.isSolid,
  interactions: diningTableTemplate.interactions,
  placedBy: "player_001" as const,
  placedAt: new Date().toISOString(),
};
engine.houseBuilder.getLayout().placedObjects.push(diningTable);
engine.stateManager.updateObjectState(diningTable.id, (state) => {
  state.roomId = diningTable.roomId;
  state.positionId = diningTable.id;
});
player.location.roomId = diningTable.roomId;
player.location.positionId = "floor_1_1";
player.body.posture = "standing";
aria.location.roomId = diningTable.roomId;
aria.location.positionId = "floor_1_2";
aria.body.posture = "standing";

for (const character of [player, aria]) {
  const result = engine.actionEngine.executeAction({
    actorId: character.id,
    actionId: "sit_on_seat",
    targetObjectId: diningTable.id,
    timestamp: new Date().toISOString(),
  });
  assert.equal(result.status, "accepted");
}

const tableState = engine.stateManager.getObjectState(diningTable.id);
assert.equal(player.location.positionId, `${diningTable.id}__seat_0`);
assert.equal(aria.location.positionId, `${diningTable.id}__seat_1`);
assert.deepEqual(tableState.occupiedSeats, {
  "0": player.id,
  "1": aria.id,
});
const standResult = engine.actionEngine.executeAction({
  actorId: player.id,
  actionId: "stand_up",
  timestamp: new Date().toISOString(),
});
assert.equal(standResult.status, "accepted");
assert.deepEqual(tableState.occupiedSeats, { "1": aria.id });
tableState.occupiedSeats = {
  "0": player.id,
  "1": aria.id,
  "2": "test_character_003",
};
assert.equal(
  engine.objectInteractionEngine.getAvailableSeatPositionId(diningTable.id, "test_character_004"),
  `${diningTable.id}__seat_3`
);

console.log("Universal seating and multi-seat table tests passed.");
