import assert from "node:assert/strict";
import { GameEngine } from "./engine/GameEngine.js";

function runCulinaryEngineTests() {
  console.log("=== RUNNING CULINARY & KITCHEN LIFE ENGINE VERIFICATION SUITE ===\n");
  const engine = new GameEngine();
  engine.init();

  const player = engine.getPlayer();
  const ai = engine.getAI();

  // Step 1: Initial setup - Player gets up and walks to kitchen
  console.log("[TEST 1] Setup: Player getting up and walking to kitchen...");
  const getUpRes = engine.submitPlayerAction("get_up");
  assert.equal(getUpRes.result.status, "accepted", "Player must get up");

  const walkKitchenRes = engine.submitPlayerAction("walk_to_kitchen");
  assert.equal(walkKitchenRes.result.status, "accepted", "Player must walk to kitchen");
  assert.equal(player.location.roomId, "kitchen");
  console.log("✓ Player arrived in kitchen (posture: standing).\n");

  // Step 2: Test Brass Masala Dabba (spice_box_001)
  console.log("[TEST 2] Testing Brass Masala Dabba interactions...");
  const inspectSpiceRes = engine.submitPlayerAction("inspect_spices", "spice_box_001");
  assert.equal(inspectSpiceRes.result.status, "accepted", "inspect_spices must succeed");

  const openSpiceRes = engine.submitPlayerAction("open_spice_box", "spice_box_001");
  assert.equal(openSpiceRes.result.status, "accepted", "open_spice_box must succeed");
  assert.equal(engine.stateManager.getObjectState("spice_box_001").state, "open");

  const pinchRes = engine.submitPlayerAction("pinch_spices", "spice_box_001");
  assert.equal(pinchRes.result.status, "accepted", "pinch_spices must succeed");

  const closeSpiceRes = engine.submitPlayerAction("close_spice_box", "spice_box_001");
  assert.equal(closeSpiceRes.result.status, "accepted", "close_spice_box must succeed");
  assert.equal(engine.stateManager.getObjectState("spice_box_001").state, "closed");
  console.log("✓ Brass Masala Dabba inspected, opened, pinched, and closed.\n");

  // Step 3: Test Countertop Wiping (wipe_counter on counter_001)
  console.log("[TEST 3] Testing Countertop Wiping on counter_001...");
  const wipeRes = engine.submitPlayerAction("wipe_counter", "counter_001");
  assert.equal(wipeRes.result.status, "accepted", "wipe_counter must succeed");
  console.log("✓ Countertop wiping verified successfully.\n");

  // Step 4: Test Brewing Normal Fresh Hot Tea (make_masala_chai and brew_tea)
  console.log("[TEST 4] Testing Tea Brewing (make_masala_chai & brew_tea)...");
  const thirstBeforeTea = player.needs.thirst;
  const energyBeforeTea = player.needs.energy;

  const teaRes = engine.submitPlayerAction("make_masala_chai", "stove_001");
  assert.equal(teaRes.result.status, "accepted", "make_masala_chai must succeed");
  assert(player.needs.thirst < thirstBeforeTea, "Thirst should decrease after tea");
  assert(player.needs.energy >= energyBeforeTea, "Energy should increase or stay high after tea");

  const normalTeaRes = engine.submitPlayerAction("brew_tea", "stove_001");
  assert.equal(normalTeaRes.result.status, "accepted", "brew_tea must succeed");
  console.log("✓ Fresh tea brewing succeeded and deterministically altered needs.\n");

  // Step 5: Test Cooking Breakfast (cook_breakfast)
  console.log("[TEST 5] Testing Breakfast Cooking (Poha & Aloo Paratha)...");
  const breakfastRes = engine.submitPlayerAction("cook_breakfast", "stove_001");
  assert.equal(breakfastRes.result.status, "accepted", "cook_breakfast must succeed");
  assert.equal(engine.stateManager.getObjectState("stove_001").state, "cooking");
  console.log("✓ Cook breakfast succeeded. Stove is now in 'cooking' state.\n");

  // Step 6: Test Meal Serving and Dining Loop (cook_meal -> serve_meal -> eat_meal_from_plate -> wash_dishes)
  console.log("[TEST 6] Testing Complete Meal Serving & Dining Loop...");
  
  // A. Cook meal
  const cookMealRes = engine.submitPlayerAction("cook_meal", "stove_001");
  assert.equal(cookMealRes.result.status, "accepted", "cook_meal must succeed");
  assert.equal(engine.stateManager.getObjectState("stove_001").state, "cooking");

  // B. Pick up plate_001
  const pickPlateRes = engine.submitPlayerAction("pick_up_item", "plate_001");
  assert.equal(pickPlateRes.result.status, "accepted", "pick_up_item for plate_001 must succeed");
  assert.equal(player.holding?.objectId, "plate_001");

  // C. Serve meal
  const serveMealRes = engine.submitPlayerAction("serve_meal", "plate_001");
  assert.equal(serveMealRes.result.status, "accepted", "serve_meal must succeed");
  assert.equal(engine.stateManager.getObjectState("plate_001").state, "with_food");
  assert.equal(engine.stateManager.getObjectState("stove_001").state, "idle");
  console.log("  → Meal served onto plate_001 (state: with_food). Stove reset to idle.");

  // D. Sit down on dining stool
  const sitStoolRes = engine.submitPlayerAction("sit_down_kitchen_stool");
  assert.equal(sitStoolRes.result.status, "accepted", "sit_down_kitchen_stool must succeed");
  assert.equal(player.body.posture, "sitting");
  assert.equal(player.location.positionId, "dining_chair");
  console.log("  → Player seated at dining stool.");

  // E. Eat meal from plate
  const hungerBeforeEat = player.needs.hunger;
  const energyBeforeEat = player.needs.energy;
  const happinessBeforeEat = player.emotions.happiness;

  const eatRes = engine.submitPlayerAction("eat_meal_from_plate", "plate_001");
  assert.equal(eatRes.result.status, "accepted", "eat_meal_from_plate must succeed");
  assert.equal(engine.stateManager.getObjectState("plate_001").state, "dirty");
  assert(player.needs.hunger < hungerBeforeEat, "Hunger should decrease after eating");
  assert(player.needs.hunger <= 10, "Hunger should be satisfied after eating full meal");
  assert(player.needs.energy > energyBeforeEat, "Energy should increase after eating");
  assert(player.emotions.happiness >= happinessBeforeEat, "Happiness should increase after eating");
  console.log(`  → Meal eaten! Hunger: ${hungerBeforeEat} -> ${player.needs.hunger}, Energy: ${energyBeforeEat} -> ${player.needs.energy}, Happiness: ${happinessBeforeEat} -> ${player.emotions.happiness}. Plate is now 'dirty'.`);

  // F. Stand up and wash dishes
  const standUpRes = engine.submitPlayerAction("stand_up");
  assert.equal(standUpRes.result.status, "accepted", "stand_up must succeed");

  const washDishesRes = engine.submitPlayerAction("wash_dishes", "sink_001");
  assert.equal(washDishesRes.result.status, "accepted", "wash_dishes must succeed");
  assert.equal(engine.stateManager.getObjectState("plate_001").state, "empty");
  console.log("  → Dirty plate washed at sink_001. Plate state returned to 'empty'.\n");

  // Step 7: Test Washing at alias sink_kitchen_001
  console.log("[TEST 7] Testing Sink Aliasing with sink_kitchen_001...");
  engine.stateManager.updateObjectState("plate_001", (obj) => { obj.state = "dirty"; });
  const washDishesAliasRes = engine.submitPlayerAction("wash_dishes", "sink_kitchen_001");
  assert.equal(washDishesAliasRes.result.status, "accepted", "wash_dishes at sink_kitchen_001 alias must succeed");
  assert.equal(engine.stateManager.getObjectState("plate_001").state, "empty");
  console.log("✓ sink_kitchen_001 successfully aliased and cleaned dirty plate to 'empty'.\n");

  // Step 8: Test Brewing Tea for Two (brew_chai_duo with companion boost)
  console.log("[TEST 8] Testing Brewing Tea for Two (brew_chai_duo)...");
  ai.location.roomId = "kitchen";
  const ariaThirstBefore = ai.needs.thirst;
  const ariaHappinessBefore = ai.emotions.happiness;

  const chaiDuoRes = engine.submitPlayerAction("brew_chai_duo", "stove_001");
  assert.equal(chaiDuoRes.result.status, "accepted", "brew_chai_duo must succeed");
  assert(ai.needs.thirst < ariaThirstBefore, "Aria thirst should decrease from shared chai");
  assert(ai.emotions.happiness >= ariaHappinessBefore, "Aria happiness should increase from shared chai");
  console.log(`✓ brew_chai_duo gave mutual mood & need boosts to both Mohit and Aria (Aria thirst: ${ariaThirstBefore} -> ${ai.needs.thirst}, happiness: ${ariaHappinessBefore} -> ${ai.emotions.happiness}).\n`);

  console.log("=== ALL CULINARY & KITCHEN LIFE ENGINE TESTS PASSED (100%) ===");
}

runCulinaryEngineTests();
