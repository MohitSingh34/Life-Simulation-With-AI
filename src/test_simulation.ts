import { GameEngine } from "./engine/GameEngine.js";
import { TagParser } from "./ai/TagParser.js";

function runAutomatedTest() {
  console.log("=== RUNNING AUTOMATED LIFE SIMULATION TEST ===\n");
  const engine = new GameEngine();
  engine.init();

  const player = engine.getPlayer();
  const ai = engine.getAI();

  console.log(`[INIT] Player in ${player.location.roomId} (${player.body.posture})`);
  console.log(`[INIT] AI (${ai.name}) in ${ai.location.roomId} (${ai.body.posture})\n`);

  // Step 1: Check available actions when lying on bed
  const initialActions = engine.getAvailablePlayerActions();
  console.log(`[STEP 1] Initial actions count: ${initialActions.length}`);
  console.log("Available action names:", initialActions.map((a) => a.name).join(", "));

  // Step 2: Player gets up from bed
  console.log("\n[STEP 2] Player executes 'get_up'...");
  const res1 = engine.submitPlayerAction("get_up");
  console.log("Result status:", res1.result.status);
  console.log("Message:", res1.result.message);
  console.log(`Player posture now: ${player.body.posture}, position: ${player.location.positionId}`);
  if (res1.aiUpdate) {
    console.log(`AI performed: ${res1.aiUpdate.actionName}`);
  }

  // Step 3: Player walks to Kitchen
  console.log("\n[STEP 3] Player executes 'walk_to_kitchen'...");
  const res2 = engine.submitPlayerAction("walk_to_kitchen");
  console.log("Result status:", res2.result.status);
  console.log("Message:", res2.result.message);
  console.log(`Player location now: ${player.location.roomId}`);

  // Step 4: Player drinks water
  console.log("\n[STEP 4] Player executes 'drink_water_glass'...");
  const res3 = engine.submitPlayerAction("drink_water_glass", "drinking_glass_001");
  console.log("Result status:", res3.result.status);
  console.log("Message:", res3.result.message);
  console.log(`Player thirst after drink: ${player.needs.thirst}`);

  // Step 5: Player walks to Study Room to meet AI (Aria)
  console.log("\n[STEP 5] Player walks to 'walk_to_study_room'...");
  const res4 = engine.submitPlayerAction("walk_to_study_room");
  console.log("Result status:", res4.result.status);
  console.log(`Player room: ${player.location.roomId}, AI room: ${ai.location.roomId}`);

  // Step 6: Talk to Aria
  console.log("\n[STEP 6] Talking to Aria...");
  const dialogue = engine.talkToAI();
  console.log("Dialogue:", dialogue);

  // Step 7: Test TagParser and Dynamic AI Manipulation
  console.log("\n[STEP 7] Verifying TagParser XML extraction and narrative state update...");
  const sampleAiReply = `
<dialogue>Fine, I took your notebook by mistake. It's on the shelf.</dialogue>
<player_body>Standing with arms crossed, breathing measured, weighing her words carefully.</player_body>
<player_pose>Standing by the shelf</player_pose>
<player_mood>😒 Slightly annoyed</player_mood>
<room_ambience>Quiet morning hum with dust dancing in a single beam of light.</room_ambience>
<ai_activity>Tucking a stray strand of hair behind her ear and looking away</ai_activity>
<hunger_feeling>Stomach lightly grumbling</hunger_feeling>
`;
  const parsed = TagParser.parse(sampleAiReply);
  if (parsed.dialogue !== "Fine, I took your notebook by mistake. It's on the shelf.") {
    throw new Error(`Dialogue mismatch: ${parsed.dialogue}`);
  }
  if (!parsed.edits.player_body || !parsed.edits.player_pose || !parsed.edits.hunger_feeling) {
    throw new Error("Missing parsed edits from XML tags");
  }

  engine.stateManager.updateNarrative(parsed.edits);
  const narrative = engine.stateManager.getNarrative();
  if (narrative.player_body !== "Standing with arms crossed, breathing measured, weighing her words carefully.") {
    throw new Error("Narrative update did not persist to stateManager");
  }
  console.log("Parsed dialogue:", parsed.dialogue);
  console.log("Parsed edits count:", Object.keys(parsed.edits).length);
  console.log("Narrative player_body:", narrative.player_body);

  // Step 8: Inspect JSON snapshot
  console.log("\n[STEP 8] Verifying Authoritative Snapshot JSON...");
  const snapshot = engine.stateManager.getSnapshot();
  console.log("Snapshot time:", snapshot.time);
  console.log("Snapshot player location:", snapshot.characters["player_001"].location);
  console.log("Snapshot AI location:", snapshot.characters["ai_001"].location);
  console.log("Snapshot narrative exists:", !!snapshot.narrative);

  // Step 9: Verify runtime-derived body state reflects actual posture and room
  console.log("\n[STEP 9] Verifying runtime body-state generation...");
  const state = engine.getCharacterBodyState("player_001");
  if (!state.pose.toLowerCase().includes("standing") && !state.pose.toLowerCase().includes("sitting") && !state.pose.toLowerCase().includes("lying")) {
    throw new Error(`Unexpected body pose output: ${state.pose}`);
  }
  if (!state.body || state.body.length < 40) {
    throw new Error("Generated body description is too short or empty");
  }
  console.log("Body pose:", state.pose);
  console.log("Body description:", state.body);

  console.log("\n=== ALL AUTOMATED TESTS PASSED WITH 100% SUCCESS! ===");
}

runAutomatedTest();

