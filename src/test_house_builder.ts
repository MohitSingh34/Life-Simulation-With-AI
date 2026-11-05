import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HouseBuilderEngine } from "./engine/HouseBuilderEngine.js";
import { AriaBuildPlanner } from "./ai/AriaBuildPlanner.js";
import { StateManager } from "./engine/StateManager.js";

console.log("=== RUNNING HOUSE BUILDER & 2D NAVIGATION TEST SUITE ===");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "house-builder-test-"));
const tempStateFile = path.join(tempDir, "house-layout.json");

try {
  // 1. Initialization & Default Jabalpur Floorplan
  console.log("\n[TEST 1] Testing House Builder Engine Initialization...");
  const stateManager = new StateManager();
  const builder = new HouseBuilderEngine(stateManager, tempStateFile);
  const layout = builder.getLayout();

  assert.equal(layout.rooms.length, 6, "Must initialize with 6 rooms");
  assert.ok(layout.placedObjects.length >= 20, "Must initialize with placed objects");
  assert.ok(layout.doors.length >= 6, "Must initialize with connecting doors");
  assert.equal(layout.grid.cols, 40, "Grid columns must be 40");
  assert.equal(layout.grid.rows, 38, "Grid rows must be 38");
  console.log(`✓ Loaded default Jabalpur layout with ${layout.rooms.length} rooms and ${layout.placedObjects.length} objects.`);

  // 2. Catalog Lookup
  console.log("\n[TEST 2] Testing Build Item Catalog...");
  const catalog = builder.getCatalog();
  assert.ok(catalog.length >= 25, "Catalog should have at least 25 placeable items");
  const monstera = builder.getTemplate("monstera_001");
  assert.ok(monstera, "Monstera plant template must exist");
  assert.equal(monstera?.category, "plants");
  console.log(`✓ Catalog verified with ${catalog.length} items across all furniture and decor categories.`);

  // 3. Structured Command: place_object
  console.log("\n[TEST 3] Testing Structured Command: place_object...");
  const initialObjCount = layout.placedObjects.length;
  const placeRes = builder.executeCommand({
    action: "place_object",
    params: {
      templateId: "monstera_001",
      roomId: "living_room",
      x: 3,
      y: 33,
      rotation: 0,
    },
    issuedBy: "player_001",
  });

  assert.equal(placeRes.success, true, "place_object should succeed");
  assert.equal(layout.placedObjects.length, initialObjCount + 1);
  const placedPlant = layout.placedObjects.find(o => o.id === placeRes.affectedObjectId);
  assert.ok(placedPlant);
  assert.equal(placedPlant?.roomId, "living_room");
  console.log(`✓ place_object succeeded: Placed "${placedPlant?.name}" at (${placedPlant?.x}, ${placedPlant?.y}) in living_room.`);

  // 4. Collision Detection & Boundary Validation
  console.log("\n[TEST 4] Testing Collision Detection & Boundary Limits...");
  // Out of bounds test
  const outOfBoundsRes = builder.executeCommand({
    action: "place_object",
    params: {
      templateId: "double_bed_001",
      roomId: "living_room",
      x: 35, // Living room is x: 1 to 20
      y: 30,
    },
    issuedBy: "player_001",
  });
  assert.equal(outOfBoundsRes.success, false, "Out of bounds placement must be rejected");
  console.log("✓ Out of bounds placement correctly blocked.");

  // Solid overlap test
  const overlapRes = builder.executeCommand({
    action: "place_object",
    params: {
      templateId: "double_bed_001",
      roomId: "bedroom",
      x: 2, // Bed 001 is already here at (2, 2)
      y: 2,
    },
    issuedBy: "player_001",
  });
  assert.equal(overlapRes.success, false, "Overlapping solid furniture must be rejected");
  assert.ok(overlapRes.message.includes("overlaps"), "Message should mention overlap");
  console.log("✓ Solid furniture collision overlap correctly rejected.");

  // 5. Structured Commands: move_object & rotate_object
  console.log("\n[TEST 5] Testing move_object and rotate_object...");
  const plantId = placedPlant!.id;
  const moveRes = builder.executeCommand({
    action: "move_object",
    params: {
      objectId: plantId,
      newX: 4,
      newY: 34,
    },
    issuedBy: "player_001",
  });
  assert.equal(moveRes.success, true);
  assert.equal(placedPlant?.x, 4);
  assert.equal(placedPlant?.y, 34);
  console.log("✓ move_object successfully moved item.");

  const rotateRes = builder.executeCommand({
    action: "rotate_object",
    params: {
      objectId: plantId,
    },
    issuedBy: "player_001",
  });
  assert.equal(rotateRes.success, true);
  assert.equal(placedPlant?.rotation, 90);
  console.log("✓ rotate_object rotated item to 90 degrees.");

  // 6. Structured Command: remove_object
  console.log("\n[TEST 6] Testing remove_object...");
  const removeRes = builder.executeCommand({
    action: "remove_object",
    params: { objectId: plantId },
    issuedBy: "player_001",
  });
  assert.equal(removeRes.success, true);
  assert.equal(layout.placedObjects.length, initialObjCount);
  console.log("✓ remove_object successfully removed item.");

  // 7. Room Customization (Floor & Wall)
  console.log("\n[TEST 7] Testing Room Customization (Floors & Walls)...");
  const floorRes = builder.executeCommand({
    action: "customize_floor",
    params: { roomId: "living_room", floorType: "marble" },
    issuedBy: "player_001",
  });
  assert.equal(floorRes.success, true);
  assert.equal(layout.rooms.find(r => r.id === "living_room")?.floorType, "marble");
  console.log("✓ customize_floor updated living room to marble.");

  const wallRes = builder.executeCommand({
    action: "customize_wall",
    params: { roomId: "bedroom", wallColor: "#fde68a" },
    issuedBy: "player_001",
  });
  assert.equal(wallRes.success, true);
  assert.equal(layout.rooms.find(r => r.id === "bedroom")?.wallColor, "#fde68a");
  console.log("✓ customize_wall updated bedroom wall color.");

  // 8. A* Pathfinding Engine
  console.log("\n[TEST 8] Testing A* Pathfinding Engine...");
  const pathfinder = builder.pathfindingEngine;
  // Path across bedroom (from bed bedside to bedroom doorway)
  const path = pathfinder.findPath(8, 5, 18, 6);
  assert.ok(path.length > 0, "A* must find a valid path");
  assert.equal(path[0].gridX, 8);
  assert.equal(path[0].gridY, 5);
  assert.equal(path[path.length - 1].gridX, 18);
  assert.equal(path[path.length - 1].gridY, 6);
  console.log(`✓ A* computed path of ${path.length} waypoints across the room.`);

  // Path through door from bedroom to study room
  const multiRoomPath = pathfinder.findPath(8, 5, 25, 5);
  assert.ok(multiRoomPath.length > 0, "A* must find path through door into study room");
  console.log(`✓ A* traversed doorway into study room (${multiRoomPath.length} waypoints).`);

  // Target on solid obstacle automatically targets nearest walkable neighbor
  const solidTarget = pathfinder.findPath(12, 5, 2, 2); // (2, 2) is inside the solid bed!
  assert.ok(solidTarget.length > 0, "A* must resolve to adjacent walkable neighbor of solid target");
  assert.ok(pathfinder.isWalkable(solidTarget[solidTarget.length - 1].gridX, solidTarget[solidTarget.length - 1].gridY));
  console.log("✓ A* auto-targeted walkable space adjacent to solid bed.");

  // 9. Aria AI Construction & Collaborative Building
  console.log("\n[TEST 9] Testing Aria AI Construction Planning...");
  const planner = new AriaBuildPlanner(builder);
  const proposal = planner.proposeEnhancement("balcony");
  assert.ok(proposal, "Aria must produce a valid build proposal");
  assert.ok(proposal?.dialogue.length > 0, "Proposal must have dialogue");
  assert.equal(proposal?.command.issuedBy, "ai_001");
  console.log(`✓ Aria proposal: "${proposal?.itemName}" for ${proposal?.roomName}`);
  console.log(`  Aria says: "${proposal?.dialogue}"`);

  // Execute Aria's proposal
  const ariaBuildRes = builder.executeCommand(proposal!.command);
  assert.equal(ariaBuildRes.success, true, "Aria's build command must execute cleanly");
  console.log("✓ Aria's build command successfully executed and persisted.");

  // Natural language request parsing
  console.log("\n[TEST 10] Testing Natural Language Building Requests...");
  const nlProposal = planner.parseNaturalLanguageRequest("Aria, can you put some plants on the balcony?");
  assert.ok(nlProposal, "Must parse plant request for balcony");
  assert.equal(nlProposal?.roomName, "Balcony");
  console.log(`✓ Natural language parsed: "${nlProposal?.itemName}" in ${nlProposal?.roomName}`);

  console.log("\n=== ALL HOUSE BUILDER & NAVIGATION TESTS PASSED (100%) ===");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
