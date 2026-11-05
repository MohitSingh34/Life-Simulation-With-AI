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

  // Step 10: Verify Autonomous AI Pathfinding & Configurable Heartbeat Ping
  console.log("\n[STEP 10] Verifying Autonomous AI Navigation & 10-Minute Ping System...");
  const path = engine.movementEngine.findPathToRoom("study_room", "toilet");
  if (!path || path.length !== 2 || path[1] !== "toilet") {
    throw new Error(`Expected BFS path from study_room to toilet, got: ${JSON.stringify(path)}`);
  }
  console.log("BFS Multi-room path (study_room -> toilet):", path);

  const pingInterval = engine.getAriaPingIntervalMinutes();
  if (pingInterval !== 10) {
    throw new Error(`Expected default Aria ping interval of 10 minutes, got: ${pingInterval}`);
  }
  console.log("Configured Aria idle ping interval:", `${pingInterval} minutes`);

  const autonomousStep = engine.tickAutonomousAI();
  if (!autonomousStep) {
    throw new Error("Autonomous AI tick returned null");
  }
  console.log("Autonomous tick performed action:", autonomousStep.actionName, `(${autonomousStep.result.status})`);

  const recentEvents = engine.eventManager.getRecentEvents(5);
  const aiEvent = recentEvents.find((e) => e.actorId === "ai_001" && e.type === "ai_decision");
  if (!aiEvent) {
    throw new Error("Autonomous AI tick was not logged to EventManager");
  }
  console.log("Verified autonomous EventManager log for Aria:", (aiEvent.data as any).actionId);

  // Step 11: Verify Living Room & Balcony Expansion (Agent 2)
  console.log("\n[STEP 11] Verifying Living Room & Balcony Expansion (Agent 2)...");
  
  // Player is standing in study_room, walks to living_room
  const walkLiving = engine.submitPlayerAction("walk_to_living_room");
  if (walkLiving.result.status !== "accepted") {
    throw new Error(`Failed to walk to living_room: ${walkLiving.result.message}`);
  }
  if (player.location.roomId !== "living_room") {
    throw new Error(`Expected player in living_room, but got ${player.location.roomId}`);
  }
  console.log("✓ Walked to living_room successfully.");

  // Sit on sofa
  const sitSofa = engine.submitPlayerAction("sit_on_sofa");
  if (sitSofa.result.status !== "accepted" || player.body.posture !== "sitting" || player.location.positionId !== "sofa_area") {
    throw new Error(`Failed to sit on sofa: ${JSON.stringify(sitSofa)}`);
  }
  console.log("✓ Sat down on comfortable sofa.");

  // Relax on sofa
  const preRelaxStress = player.emotions.stress;
  const preRelaxHappiness = player.emotions.happiness;
  const relaxSofa = engine.submitPlayerAction("relax_on_sofa");
  if (relaxSofa.result.status !== "accepted") {
    throw new Error(`Failed to relax on sofa: ${relaxSofa.result.message}`);
  }
  if (player.emotions.stress > preRelaxStress || player.emotions.happiness < preRelaxHappiness) {
    throw new Error(`Expected stress reduction & happiness boost, got stress: ${player.emotions.stress}, happiness: ${player.emotions.happiness}`);
  }
  console.log(`✓ Relaxed on sofa. Stress: ${preRelaxStress} -> ${player.emotions.stress}, Happiness: ${preRelaxHappiness} -> ${player.emotions.happiness}`);

  // Stand up from sofa
  const standUp = engine.submitPlayerAction("stand_up");
  if (standUp.result.status !== "accepted" || (player.body.posture as string) !== "standing") {
    throw new Error(`Failed to stand up from sofa: ${JSON.stringify(standUp)}`);
  }
  console.log("✓ Stood up from sofa.");

  // Walk to balcony
  const walkBalcony = engine.submitPlayerAction("walk_to_balcony");
  if (walkBalcony.result.status !== "accepted" || (player.location.roomId as string) !== "balcony") {
    throw new Error(`Failed to walk to balcony: ${walkBalcony.result.message}`);
  }
  console.log("✓ Stepped out onto the balcony.");

  // Water plants (+10 happiness, -10 stress)
  const preWaterHappiness = player.emotions.happiness;
  const preWaterStress = player.emotions.stress;
  const waterAction = engine.submitPlayerAction("water_plants");
  if (waterAction.result.status !== "accepted") {
    throw new Error(`Failed to water plants: ${waterAction.result.message}`);
  }
  if (player.emotions.happiness < preWaterHappiness || player.emotions.stress > preWaterStress) {
    throw new Error(`Water plants emotion changes mismatch. Expected happiness boost & stress reduction. Got happiness: ${player.emotions.happiness}, stress: ${player.emotions.stress}`);
  }
  console.log(`✓ Watered plants. Happiness: ${preWaterHappiness} -> ${player.emotions.happiness}, Stress: ${preWaterStress} -> ${player.emotions.stress}`);

  // Lean on railing
  const leanRailing = engine.submitPlayerAction("lean_on_balcony_railing");
  if (leanRailing.result.status !== "accepted" || (player.location.positionId as string) !== "balcony_railing") {
    throw new Error(`Failed to lean on balcony railing: ${JSON.stringify(leanRailing)}`);
  }
  console.log("✓ Leaned on balcony railing looking over Jabalpur street.");

  // Sit on cane chair
  const sitCane = engine.submitPlayerAction("sit_on_cane_chair");
  if (sitCane.result.status !== "accepted" || (player.body.posture as string) !== "sitting" || (player.location.positionId as string) !== "cane_chair") {
    throw new Error(`Failed to sit on cane chair: ${JSON.stringify(sitCane)}`);
  }
  console.log("✓ Sat comfortably on balcony cane chair.");

  // Stand up and walk back to living room
  engine.submitPlayerAction("stand_up");
  const returnLiving = engine.submitPlayerAction("walk_to_living_room");
  if (returnLiving.result.status !== "accepted" || (player.location.roomId as string) !== "living_room") {
    throw new Error("Failed to walk back to living room from balcony");
  }
  console.log("✓ Walked back into living room.");

  // Verify BFS pathfinding from balcony to bedroom
  const balconyToBedroom = engine.movementEngine.findPathToRoom("balcony", "bedroom");
  if (!balconyToBedroom || balconyToBedroom[0] !== "living_room" || balconyToBedroom[1] !== "bedroom") {
    throw new Error(`Unexpected path from balcony to bedroom: ${JSON.stringify(balconyToBedroom)}`);
  }
  console.log("✓ BFS Path from balcony to bedroom:", balconyToBedroom);

  console.log("\n=== ALL AUTOMATED TESTS PASSED WITH 100% SUCCESS! ===");
}

runAutomatedTest();

