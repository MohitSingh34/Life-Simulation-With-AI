import assert from "node:assert/strict";
import { GameEngine } from "./engine/GameEngine.js";

function runGroomingChoresTests() {
  console.log("=== RUNNING BATHROOM, GROOMING & CHORES VERIFICATION TESTS ===\n");

  const engine = new GameEngine();
  engine.init();

  const player = engine.getPlayer();

  // 1. Initial posture setup: player gets up and walks to toilet
  engine.submitPlayerAction("get_up");
  const walkRes = engine.submitPlayerAction("walk_to_toilet");
  assert.equal(walkRes.result.status, "accepted", "Player should be able to walk to toilet");
  assert.equal(player.location.roomId, "toilet", "Player should be in the toilet");

  console.log("[TEST 1] Testing Mirror Fogging & Wiping Loop...");
  const mirrorInitial = engine.stateManager.getObjectState("mirror_001");
  assert.equal(mirrorInitial.state, "clear", "Mirror should initially be clear");

  // Attempt wiping mirror while clear -> should be rejected
  player.location.positionId = "washbasin_area";
  const wipeWhenClear = engine.submitPlayerAction("wipe_mirror");
  assert.equal(wipeWhenClear.result.status, "rejected", "Wiping mirror when clear should be rejected");

  // Take a hot shower -> mirror should become foggy
  const showerRes = engine.submitPlayerAction("take_shower");
  assert.equal(showerRes.result.status, "accepted", "Taking shower should be accepted");
  const mirrorAfterShower = engine.stateManager.getObjectState("mirror_001");
  assert.equal(mirrorAfterShower.state, "foggy", "Mirror should transition to foggy after hot shower");

  // Check alias mirror_bathroom_001 if queried
  const mirrorAlias = engine.stateManager.getObjectState("mirror_bathroom_001");
  assert.equal(mirrorAlias.state, "foggy", "mirror_bathroom_001 alias should also be foggy");

  // Wipe mirror from washbasin
  player.location.positionId = "washbasin_area";
  const happyBeforeWipe = player.emotions.happiness;
  const wipeRes = engine.submitPlayerAction("wipe_mirror");
  console.log("wipeRes after washbasin_area:", JSON.stringify(wipeRes, null, 2));
  assert.equal(wipeRes.result.status, "accepted", "Wiping foggy mirror from washbasin should succeed");
  const mirrorAfterWipe = engine.stateManager.getObjectState("mirror_001");
  assert.equal(mirrorAfterWipe.state, "clear", "Mirror should be restored to clear after wiping");
  assert.equal(player.emotions.happiness, happyBeforeWipe + 5, "Wiping mirror should grant +5 happiness");
  console.log("✓ Mirror fogging and wiping loop verified successfully.\n");

  // 2. Towel Drying
  console.log("[TEST 2] Testing Towel Rack & Drying Off...");
  const dryRes = engine.submitPlayerAction("dry_with_towel");
  console.log("Hygiene after dry:", player.needs.hygiene, "dryRes:", dryRes.result);
  assert.equal(dryRes.result.status, "accepted", "Drying with towel should succeed");
  assert.ok(
    dryRes.result.changes?.needs?.hygiene === 100 || player.needs.hygiene >= 95,
    "Hygiene should be restored to peak/high level after towel drying"
  );
  console.log("✓ Towel rack drying verified successfully.\n");

  // 3. Oral Care & Skincare
  console.log("[TEST 3] Testing Oral Care & Skincare (brush_teeth, apply_moisturizer, wash_hair)...");
  player.location.positionId = "washbasin_area";
  const brushRes = engine.submitPlayerAction("brush_teeth");
  assert.equal(brushRes.result.status, "accepted", "Brush teeth should succeed");

  const moistRes = engine.submitPlayerAction("apply_moisturizer");
  assert.equal(moistRes.result.status, "accepted", "Apply moisturizer should succeed");

  const hairRes = engine.submitPlayerAction("wash_hair");
  assert.equal(hairRes.result.status, "accepted", "Wash hair should succeed");
  console.log("✓ Oral care and skincare actions verified successfully.\n");

  // 4. Housekeeping & Chores: Laundry
  console.log("[TEST 4] Testing Laundry Basket...");
  const laundryBasket = engine.stateManager.getObjectState("laundry_basket_001");
  assert.equal(laundryBasket.state, "empty", "Laundry basket should initially be empty");

  const laundryRes = engine.submitPlayerAction("put_clothes_in_laundry");
  assert.equal(laundryRes.result.status, "accepted", "Putting clothes in laundry should succeed");
  assert.equal(
    engine.stateManager.getObjectState("laundry_basket_001").state,
    "has_clothes",
    "Laundry basket state should be 'has_clothes'"
  );

  const emptyLaundryRes = engine.submitPlayerAction("empty_laundry");
  assert.equal(emptyLaundryRes.result.status, "accepted", "Emptying laundry should succeed");
  assert.equal(
    engine.stateManager.getObjectState("laundry_basket_001").state,
    "empty",
    "Laundry basket state should be reset to 'empty'"
  );
  console.log("✓ Laundry basket loop verified successfully.\n");

  // 5. Housekeeping & Chores: Waste Disposal
  console.log("[TEST 5] Testing Trash Bins in Bathroom and Kitchen...");
  const throwBathroomTrash = engine.submitPlayerAction("throw_trash");
  assert.equal(throwBathroomTrash.result.status, "accepted", "Throwing trash in bathroom bin should succeed");
  assert.equal(
    engine.stateManager.getObjectState("trash_bin_toilet_001").state,
    "has_trash",
    "Bathroom bin should be 'has_trash'"
  );

  const emptyBathroomBin = engine.submitPlayerAction("empty_bin");
  assert.equal(emptyBathroomBin.result.status, "accepted", "Emptying bathroom bin should succeed");
  assert.equal(
    engine.stateManager.getObjectState("trash_bin_toilet_001").state,
    "empty",
    "Bathroom bin should be 'empty'"
  );

  // Move to kitchen and test kitchen trash bin
  engine.submitPlayerAction("walk_to_kitchen");
  assert.equal(player.location.roomId, "kitchen");
  const throwKitchenTrash = engine.submitPlayerAction("throw_trash");
  assert.equal(throwKitchenTrash.result.status, "accepted", "Throwing trash in kitchen bin should succeed");
  assert.equal(
    engine.stateManager.getObjectState("trash_bin_001").state,
    "has_trash",
    "Kitchen bin should be 'has_trash'"
  );

  const emptyKitchenBin = engine.submitPlayerAction("empty_bin");
  assert.equal(emptyKitchenBin.result.status, "accepted", "Emptying kitchen bin should succeed");
  assert.equal(
    engine.stateManager.getObjectState("trash_bin_001").state,
    "empty",
    "Kitchen bin should be 'empty'"
  );
  console.log("✓ Waste disposal in both bathroom and kitchen verified successfully.\n");

  // 6. Housekeeping & Chores: Broom & Sweeping in multiple rooms
  console.log("[TEST 6] Testing Broom & Floor Sweeping...");
  // Walk back to toilet where broom_001 is kept
  engine.submitPlayerAction("walk_to_toilet");
  assert.equal(player.location.roomId, "toilet");

  // Sweeping near the broom in toilet
  const sweepNearBroom = engine.submitPlayerAction("sweep_floor");
  assert.equal(sweepNearBroom.result.status, "accepted", "Sweeping near broom in toilet should succeed");

  // Pick up the broom
  const pickBroom = engine.submitPlayerAction("pick_up_item", "broom_001");
  assert.equal(pickBroom.result.status, "accepted", "Picking up broom should succeed");
  assert.equal(player.holding?.objectId, "broom_001", "Player should be holding the broom");

  // Walk to bedroom while carrying the broom
  engine.submitPlayerAction("walk_to_bedroom");
  assert.equal(player.location.roomId, "bedroom");

  // Sweep floor in bedroom while holding the broom
  const sweepInBedroom = engine.submitPlayerAction("sweep_floor");
  assert.equal(sweepInBedroom.result.status, "accepted", "Sweeping bedroom floor while holding broom should succeed");

  // Put down broom in bedroom
  const putDownBroom = engine.submitPlayerAction("put_down_item");
  assert.equal(putDownBroom.result.status, "accepted", "Putting down broom should succeed");
  assert.equal(player.holding, null, "Player should no longer be holding the broom");
  assert.equal(
    engine.stateManager.getObjectState("broom_001").roomId,
    "bedroom",
    "Broom roomId should now be bedroom"
  );

  // Walk to study room without broom
  engine.submitPlayerAction("walk_to_study_room");
  assert.equal(player.location.roomId, "study_room");

  // Attempt sweeping in study room without broom -> should be rejected
  const sweepWithoutBroom = engine.submitPlayerAction("sweep_floor");
  assert.equal(sweepWithoutBroom.result.status, "rejected", "Sweeping without broom in room should be rejected");
  console.log("✓ Broom carrying and floor sweeping verified across multiple rooms.\n");

  console.log("=== ALL BATHROOM, GROOMING & HOUSEKEEPING TESTS PASSED (100%) ===\n");
}

runGroomingChoresTests();

