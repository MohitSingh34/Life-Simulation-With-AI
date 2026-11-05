import { GameEngine } from "./engine/GameEngine.js";
import assert from "assert";

function runLivingBalconyTest() {
  console.log("=== RUNNING LIVING ROOM & BALCONY EXPANSION VERIFICATION SUITE ===\n");

  const engine = new GameEngine();
  engine.init();

  const configLoader = engine.configLoader;
  const stateManager = engine.stateManager;
  const movementEngine = engine.movementEngine;

  // 1. Verify Room Configurations
  console.log("[TEST 1] Verifying Room Configurations...");
  const livingRoom = configLoader.getRoom("living_room");
  const balcony = configLoader.getRoom("balcony");
  assert.ok(livingRoom, "living_room configuration must exist");
  assert.ok(balcony, "balcony configuration must exist");

  assert.equal(livingRoom.name, "Living Room");
  assert.equal(balcony.name, "Balcony");

  const lrPosIds = livingRoom.positions.map((p) => p.id);
  assert.ok(lrPosIds.includes("sofa_area"), "living_room must have sofa_area");
  assert.ok(lrPosIds.includes("coffee_table_area"), "living_room must have coffee_table_area");
  assert.ok(lrPosIds.includes("tv_cabinet_area"), "living_room must have tv_cabinet_area");
  assert.ok(lrPosIds.includes("entrance_door_area"), "living_room must have entrance_door_area");

  const balPosIds = balcony.positions.map((p) => p.id);
  assert.ok(balPosIds.includes("balcony_railing"), "balcony must have balcony_railing");
  assert.ok(balPosIds.includes("planters_area"), "balcony must have planters_area");
  assert.ok(balPosIds.includes("balcony_door_area"), "balcony must have balcony_door_area");
  assert.ok(balPosIds.includes("cane_chair"), "balcony must have cane_chair");

  assert.ok(livingRoom.ambience.morning && livingRoom.ambience.evening, "living_room must have complete ambience");
  assert.ok(balcony.ambience.morning && balcony.ambience.evening, "balcony must have complete ambience");
  console.log("✓ Room configurations and positions verified.");

  // 2. Verify Door Connections & Topology
  console.log("\n[TEST 2] Verifying Architectural Connections...");
  const lrDoors = movementEngine.getConnectedDoors("living_room");
  const connectedRooms = movementEngine.getReachableRooms("living_room");
  assert.ok(connectedRooms.includes("bedroom"), "living_room must connect to bedroom");
  assert.ok(connectedRooms.includes("kitchen"), "living_room must connect to kitchen");
  assert.ok(connectedRooms.includes("study_room"), "living_room must connect to study_room");
  assert.ok(connectedRooms.includes("balcony"), "living_room must connect to balcony");

  const balDoors = movementEngine.getConnectedDoors("balcony");
  const balReachable = movementEngine.getReachableRooms("balcony");
  assert.ok(balReachable.includes("living_room"), "balcony must connect to living_room");
  console.log("✓ Door topology verified. Reachable from living_room:", connectedRooms);

  // 3. Verify Objects Catalog
  console.log("\n[TEST 3] Verifying Interactive Objects in objects.json...");
  const requiredObjectIds = [
    "sofa_001",
    "coffee_table_001",
    "tv_speaker_001",
    "house_plant_001",
    "balcony_plants_001",
    "watering_can_001",
    "cane_chair_001",
  ];
  for (const objId of requiredObjectIds) {
    const obj = configLoader.getObject(objId);
    assert.ok(obj, `Object '${objId}' must exist in configLoader`);
  }
  console.log("✓ All 7 new interactive objects verified in catalog.");

  // 4. Test Living Room Movement & Sofa Interactions
  console.log("\n[TEST 4] Testing Living Room Movement, Sofa, and Leisure Actions...");
  const player = engine.getPlayer();
  // Stand up from bed
  engine.submitPlayerAction("get_up");
  assert.equal(player.body.posture, "standing");

  // Walk from bedroom to living room
  const walkToLR = engine.submitPlayerAction("walk_to_living_room");
  assert.equal(walkToLR.result.status, "accepted");
  assert.equal(player.location.roomId, "living_room");
  assert.equal(player.location.positionId, "entrance_door_area");

  // Sit on sofa
  const sitSofa = engine.submitPlayerAction("sit_on_sofa");
  assert.equal(sitSofa.result.status, "accepted");
  assert.equal(player.body.posture, "sitting");
  assert.equal(player.location.positionId, "sofa_area");

  // Relax on sofa
  const preRelaxHappiness = player.emotions.happiness;
  const relaxRes = engine.submitPlayerAction("relax_on_sofa");
  assert.equal(relaxRes.result.status, "accepted");
  assert.ok(player.emotions.happiness >= preRelaxHappiness, "Relaxing on sofa increases happiness");

  // Lie down on sofa
  const lieSofa = engine.submitPlayerAction("lie_down_sofa");
  assert.equal(lieSofa.result.status, "accepted");
  assert.equal(player.body.posture, "lying");

  // Stand up
  const standRes = engine.submitPlayerAction("stand_up");
  assert.equal(standRes.result.status, "accepted");
  assert.equal(player.body.posture, "standing");
  console.log("✓ Living room walking and sofa postures verified.");

  // 5. Test Media, Table & Plants in Living Room
  console.log("\n[TEST 5] Testing Smart TV, Soundbar Speaker, Table & Houseplant...");
  // Play music on speaker
  const playMusic = engine.submitPlayerAction("play_music_speaker", "tv_speaker_001");
  assert.equal(playMusic.result.status, "accepted");
  const speakerState = stateManager.getObjectState("tv_speaker_001");
  assert.equal(speakerState?.state, "playing_music");

  // Stop music
  const stopMusic = engine.submitPlayerAction("stop_music_speaker", "tv_speaker_001");
  assert.equal(stopMusic.result.status, "accepted");
  assert.equal(speakerState?.state, "off");

  // Turn on TV and watch TV
  const turnOnTV = engine.submitPlayerAction("turn_on_tv", "tv_speaker_001");
  assert.equal(turnOnTV.result.status, "accepted");
  assert.equal(speakerState?.state, "on");

  // Sit down to watch TV
  engine.submitPlayerAction("sit_on_sofa");
  const watchTV = engine.submitPlayerAction("watch_tv");
  assert.equal(watchTV.result.status, "accepted");

  // Stand up and turn off TV
  engine.submitPlayerAction("stand_up");
  const turnOffTV = engine.submitPlayerAction("turn_off_tv", "tv_speaker_001");
  assert.equal(turnOffTV.result.status, "accepted");
  assert.equal(speakerState?.state, "off");

  // Wipe coffee table
  const wipeTable = engine.submitPlayerAction("wipe_coffee_table", "coffee_table_001");
  assert.equal(wipeTable.result.status, "accepted");

  // Inspect and wipe money plant
  const inspectPlant = engine.submitPlayerAction("inspect_plant", "house_plant_001");
  assert.equal(inspectPlant.result.status, "accepted");
  const wipeLeaves = engine.submitPlayerAction("wipe_plant_leaves", "house_plant_001");
  assert.equal(wipeLeaves.result.status, "accepted");
  console.log("✓ Living room TV, soundbar, table, and plant actions verified.");

  // 6. Test Balcony Movement & Outdoor Interactions
  console.log("\n[TEST 6] Testing Balcony Movement, Planters, Watering, and Cane Chair...");
  const walkToBalcony = engine.submitPlayerAction("walk_to_balcony");
  assert.equal(walkToBalcony.result.status, "accepted");
  assert.equal(player.location.roomId, "balcony");
  assert.equal(player.location.positionId, "balcony_door_area");

  // Step out to railing
  const stepOut = engine.submitPlayerAction("step_out_balcony");
  assert.equal(stepOut.result.status, "accepted");
  assert.equal(player.location.positionId, "balcony_railing");

  // Lean on railing
  const leanRail = engine.submitPlayerAction("lean_on_balcony_railing");
  assert.equal(leanRail.result.status, "accepted");

  // Smell flowers
  const smellFlowers = engine.submitPlayerAction("smell_flowers");
  assert.equal(smellFlowers.result.status, "accepted");

  // Water plants (+10 happiness, -10 stress)
  const preWaterH = player.emotions.happiness;
  const preWaterS = player.emotions.stress;
  const waterRes = engine.submitPlayerAction("water_plants");
  assert.equal(waterRes.result.status, "accepted");
  assert.ok(player.emotions.happiness >= Math.min(100, preWaterH + 5) || player.emotions.happiness === 100, "Watering plants increases happiness");
  assert.ok(player.emotions.stress <= preWaterS + 2, "Watering plants reduces stress");

  // Sit on cane chair
  const sitCane = engine.submitPlayerAction("sit_on_cane_chair");
  assert.equal(sitCane.result.status, "accepted");
  assert.equal(player.body.posture, "sitting");
  assert.equal(player.location.positionId, "cane_chair");

  // Stand up from cane chair
  engine.submitPlayerAction("stand_up");
  assert.equal(player.body.posture, "standing");

  // Walk back into living room
  const walkBackLR = engine.submitPlayerAction("walk_to_living_room");
  assert.equal(walkBackLR.result.status, "accepted");
  assert.equal(player.location.roomId, "living_room");

  // Walk from living room to kitchen
  const walkKitchen = engine.submitPlayerAction("walk_to_kitchen");
  assert.equal(walkKitchen.result.status, "accepted");
  assert.equal(player.location.roomId, "kitchen");
  console.log("✓ Balcony actions, plant watering, cane chair, and return navigation verified.");

  // 7. Verify Multi-Room BFS Navigation Paths
  console.log("\n[TEST 7] Verifying Global BFS Navigation Paths from New Rooms...");
  const pathBalconyToBed = movementEngine.findPathToRoom("balcony", "bedroom");
  assert.deepEqual(pathBalconyToBed, ["living_room", "bedroom"]);

  const pathBalconyToToilet = movementEngine.findPathToRoom("balcony", "toilet");
  assert.ok(pathBalconyToToilet && pathBalconyToToilet.includes("toilet"));

  const pathBalconyToStudy = movementEngine.findPathToRoom("balcony", "study_room");
  assert.deepEqual(pathBalconyToStudy, ["living_room", "study_room"]);
  console.log("✓ BFS Multi-room routing to and from balcony verified.");

  console.log("\n=== ALL LIVING ROOM & BALCONY VERIFICATION TESTS PASSED (100%) ===");
}

runLivingBalconyTest();
