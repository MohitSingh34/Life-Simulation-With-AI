import assert from "node:assert";
import { GameEngine } from "./engine/GameEngine.js";
import type { CharacterState } from "./types/character.js";

export function runBedroomWardrobeTests() {
  console.log("=== RUNNING BEDROOM, WARDROBE & DRESSING VERIFICATION SUITE ===\n");
  const engine = new GameEngine();
  engine.init();

  const player = engine.getPlayer();
  const stateManager = engine.stateManager;
  const configLoader = engine.configLoader;

  // -------------------------------------------------------------
  // TEST 1: Direct Bed Posture Transitions (Fluid Waking)
  // -------------------------------------------------------------
  console.log("[TEST 1] Testing Direct Bed Posture Transitions...");
  assert.equal(player.location.roomId, "bedroom");
  assert.equal(player.location.positionId, "bed_center");
  assert.equal(player.body.posture, "lying");

  // Verify 'sit_up_in_bed' is available when lying in bed
  const initialActions = engine.getAvailablePlayerActions();
  const sitUpAction = initialActions.find((a) => a.id === "sit_up_in_bed");
  assert.ok(sitUpAction, "sit_up_in_bed should be in available actions when lying in bed");

  // Execute 'sit_up_in_bed'
  const sitUpRes = engine.submitPlayerAction("sit_up_in_bed");
  assert.equal(sitUpRes.result.status, "accepted");
  assert.equal(player.body.posture, "sitting");
  assert.equal(player.location.positionId, "bed_center");
  console.log("✓ Player sat up directly in bed without standing first.");

  // Recline back onto the bed
  const reclineRes = engine.submitPlayerAction("lie_down_bed");
  assert.equal(reclineRes.result.status, "accepted");
  assert.equal(player.body.posture, "lying");
  assert.equal(player.location.positionId, "bed_center");
  console.log("✓ Player reclined back flat on the bed.");

  // Sit up again and then get up to bedside
  engine.submitPlayerAction("sit_up_in_bed");
  assert.equal(player.body.posture, "sitting");
  const getUpRes = engine.submitPlayerAction("get_up");
  assert.equal(getUpRes.result.status, "accepted");
  assert.equal(player.body.posture, "standing");
  assert.equal(player.location.positionId, "bedside");
  console.log("✓ Transition from sitting in bed to standing bedside verified.");

  // -------------------------------------------------------------
  // TEST 2: Phone Portability & Bedside Table Discrepancy Fixes
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Testing Phone Portability & Bedside Table Fixes...");
  // Bedside table should no longer list 'check_phone'
  const bedsideTable = configLoader.getObject("bedside_table_001");
  assert.ok(bedsideTable, "Bedside table must exist");
  assert.ok(
    !bedsideTable.interactions.includes("check_phone"),
    "bedside_table_001 must NOT have check_phone in interactions"
  );
  console.log("✓ Bedside table interactions verified (check_phone removed).");

  // Phone should be portable and pick-up-able
  const phoneObj = configLoader.getObject("phone_001");
  assert.ok(phoneObj, "phone_001 must exist");
  assert.ok(phoneObj.portable, "phone_001 must be portable");
  assert.ok(
    phoneObj.interactions.includes("pick_up_item"),
    "phone_001 must have pick_up_item in interactions"
  );

  // Pick up phone
  const pickPhoneRes = engine.submitPlayerAction("pick_up_item", "phone_001");
  assert.equal(pickPhoneRes.result.status, "accepted");
  assert.equal(player.holding?.objectId, "phone_001");
  console.log("✓ Mohit picked up his phone from the bedside nightstand.");

  // Walk with the phone into the study room
  const walkStudyRes = engine.submitPlayerAction("walk_to_study_room");
  assert.equal(walkStudyRes.result.status, "accepted");
  assert.equal(player.location.roomId, "study_room");
  assert.equal(player.holding?.objectId, "phone_001");
  console.log("✓ Mohit carried his phone into the study room.");

  // Interactivity in another room while holding phone
  const checkPhoneRes = engine.submitPlayerAction("check_phone", "phone_001");
  assert.equal(checkPhoneRes.result.status, "accepted");

  const checkMsgRes = engine.submitPlayerAction("check_messages", "phone_001");
  assert.equal(checkMsgRes.result.status, "accepted");

  const playAlarmRes = engine.submitPlayerAction("play_alarm", "phone_001");
  assert.equal(playAlarmRes.result.status, "accepted");

  const listenMusicRes = engine.submitPlayerAction("listen_music_phone", "phone_001");
  assert.equal(listenMusicRes.result.status, "accepted");
  console.log("✓ Mobile phone actions (check_messages, play_alarm, listen_music_phone) verified across rooms.");

  // Put down phone in study room and walk back to bedroom
  const putDownRes = engine.submitPlayerAction("put_down_item");
  assert.equal(putDownRes.result.status, "accepted");
  assert.equal(player.holding, null);

  const walkBackRes = engine.submitPlayerAction("walk_to_bedroom");
  assert.equal(walkBackRes.result.status, "accepted");
  assert.equal(player.location.roomId, "bedroom");

  // -------------------------------------------------------------
  // TEST 3: Wardrobe Outfit Changing System
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Testing Wardrobe Outfit Changing System...");
  // Move to wardrobe_area
  player.location.positionId = "wardrobe_area";

  // Wardrobe is initially closed
  const wardrobeState = stateManager.getObjectState("wardrobe_001");
  assert.equal(wardrobeState.state, "closed");

  // Attempting to change clothes while wardrobe is closed should fail
  const failedChange = engine.submitPlayerAction("change_clothes");
  assert.equal(failedChange.result.status, "rejected");
  console.log("✓ Changing clothes blocked when wardrobe is closed.");

  // Open the wardrobe
  const openWardrobeRes = engine.submitPlayerAction("open_wardrobe", "wardrobe_001");
  assert.equal(openWardrobeRes.result.status, "accepted");
  assert.equal(wardrobeState.state, "open");
  console.log("✓ Teakwood wardrobe opened successfully.");

  // Test change_clothes action: updates clothing, +10 confidence, -5 stress
  const preConfidence = player.emotions.confidence ?? 60;
  const preStress = player.emotions.stress;
  const changeRes = engine.submitPlayerAction("change_clothes");
  assert.equal(changeRes.result.status, "accepted");
  assert.ok(player.clothing.upper.length > 0);
  assert.ok(player.clothing.lower.length > 0);
  assert.equal(player.appearance.torso_inner, player.clothing.upper);
  assert.equal(player.appearance.legs, player.clothing.lower);
  assert.equal(player.appearance.feet, player.clothing.footwear);
  assert.equal(player.emotions.confidence, Math.min(100, preConfidence + 10));
  assert.ok(Math.abs(player.emotions.stress - Math.max(0, preStress - 5)) <= 1);
  console.log(`✓ change_clothes applied: confidence -> ${player.emotions.confidence}, stress -> ${player.emotions.stress}`);

  // Test Wear Sleepwear
  const wearSleepRes = engine.submitPlayerAction("wear_sleepwear");
  assert.equal(wearSleepRes.result.status, "accepted");
  assert.equal(player.clothing.upper, "Soft Cotton Kurta");
  assert.equal(player.clothing.lower, "Soft Cotton Pyjama");
  assert.equal(player.clothing.footwear, "Barefoot");
  assert.equal(player.appearance.torso_inner, player.clothing.upper);
  assert.equal(player.appearance.legs, player.clothing.lower);
  assert.equal(player.appearance.feet, player.clothing.footwear);
  console.log("✓ Sleepwear outfit (Kurta-Pyjama) verified.");

  // Test Wear Casual Loungewear
  const wearCasualRes = engine.submitPlayerAction("wear_casual");
  assert.equal(wearCasualRes.result.status, "accepted");
  assert.equal(player.clothing.upper, "Comfortable T-Shirt");
  assert.equal(player.clothing.lower, "Grey Track Pants");
  assert.equal(player.clothing.footwear, "Slip-on Sandals");
  assert.equal(player.appearance.torso_inner, player.clothing.upper);
  assert.equal(player.appearance.legs, player.clothing.lower);
  assert.equal(player.appearance.feet, player.clothing.footwear);
  console.log("✓ Casual Loungewear outfit (T-Shirt & Track Pants) verified.");

  // Test Wear Outdoor / Work Wear
  const wearWorkRes = engine.submitPlayerAction("wear_work_wear");
  assert.equal(wearWorkRes.result.status, "accepted");
  assert.equal(player.clothing.upper, "Crisp Linen Shirt");
  assert.equal(player.clothing.lower, "Tailored Trousers");
  assert.equal(player.clothing.footwear, "Leather Loafers");
  assert.equal(player.appearance.torso_inner, player.clothing.upper);
  assert.equal(player.appearance.legs, player.clothing.lower);
  assert.equal(player.appearance.feet, player.clothing.footwear);
  console.log("✓ Outdoor / Work Wear outfit (Crisp Linen Shirt & Tailored Trousers) verified.");

  // Close the wardrobe
  const closeWardrobeRes = engine.submitPlayerAction("close_wardrobe", "wardrobe_001");
  assert.equal(closeWardrobeRes.result.status, "accepted");
  assert.equal(wardrobeState.state, "closed");
  console.log("✓ Wardrobe closed.");

  // -------------------------------------------------------------
  // TEST 4: Bedside Lamp Ambiance & Bedtime Reading
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Testing Bedside Lamp Ambiance & Bedtime Reading...");
  // Give player a book to carry
  player.holding = { objectId: "math_book_001", hand: "both" };

  // Move to bed_center, lying down
  player.location.positionId = "bed_center";
  player.body.posture = "lying";

  // Lamp is initially off
  const lampState = stateManager.getObjectState("lamp_001");
  lampState.state = "off";

  // Bedtime reading with lamp off must be rejected
  const darkReadRes = engine.submitPlayerAction("bedtime_reading");
  assert.equal(darkReadRes.result.status, "rejected");
  assert.equal(darkReadRes.result.reason, "BEDSIDE_LAMP_OFF");
  console.log("✓ Reading in bed blocked when bedside lamp is off.");

  // Turn on bedside lamp
  const turnOnLampRes = engine.submitPlayerAction("turn_on_lamp", "lamp_001");
  assert.equal(turnOnLampRes.result.status, "accepted");
  assert.equal(lampState.state, "on");
  console.log("✓ Bedside brass lamp turned on (state: on).");

  // Bedtime reading with lamp on must be accepted
  const litReadRes = engine.submitPlayerAction("bedtime_reading");
  assert.equal(litReadRes.result.status, "accepted");
  console.log("✓ Bedtime reading accepted while propped in bed under warm bedside lamp.");

  // read_book also works in bedroom when lamp is on and holding book
  const readBookBedRes = engine.submitPlayerAction("read_book");
  assert.equal(readBookBedRes.result.status, "accepted");
  console.log("✓ Generic read_book verified in bedroom bed under the bedside lamp.");

  // Turn off lamp
  const turnOffLampRes = engine.submitPlayerAction("turn_off_lamp", "lamp_001");
  assert.equal(turnOffLampRes.result.status, "accepted");
  assert.equal(lampState.state, "off");

  const legacySnapshot = stateManager.getSnapshot();
  delete (legacySnapshot.characters["player_001"] as Partial<CharacterState>).appearance;
  delete (legacySnapshot.characters["ai_001"] as Partial<CharacterState>).appearance;
  stateManager.loadSnapshot(legacySnapshot);
  const restoredPlayer = stateManager.getCharacter("player_001");
  const restoredAria = stateManager.getCharacter("ai_001");
  assert.equal(restoredPlayer?.appearance.eyes, "goggles");
  assert.equal(restoredAria?.appearance.neck, "soft silver necklace");
  assert.equal(restoredPlayer?.appearance.torso_inner, restoredPlayer?.clothing.upper);
  assert.equal(restoredPlayer?.appearance.legs, restoredPlayer?.clothing.lower);
  assert.equal(restoredPlayer?.appearance.feet, restoredPlayer?.clothing.footwear);
  console.log("✓ Appearance defaults restored for saved characters without appearance data.");

  console.log("\n=== ALL BEDROOM, WARDROBE & DRESSING TESTS PASSED WITH 100% SUCCESS! ===");
}

runBedroomWardrobeTests();
