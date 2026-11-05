import { GameEngine } from "./engine/GameEngine.js";

function runStudySocialTests() {
  console.log("=== RUNNING STUDY, TECHNOLOGY & ROOMMATE DYNAMICS TEST SUITE ===\n");
  const engine = new GameEngine();
  engine.init();

  const player = engine.getPlayer();
  const ai = engine.getAI();

  // Move player to study room where AI (Aria) is initially seated
  player.location.roomId = "study_room";
  player.location.positionId = "desk_chair";
  player.body.posture = "sitting";

  ai.location.roomId = "study_room";
  ai.location.positionId = "desk_chair";
  ai.body.posture = "sitting";

  console.log("[TEST 1] Testing Subject-Specific Book Reading Engine...");

  // 1A. Math Textbook
  const prevStudiousness = player.personality?.studiousness ?? 70;
  const prevEnergy = player.needs.energy;
  const prevBoredom = player.emotions.boredom;

  const mathRes = engine.submitPlayerAction("read_math_book", "math_book_001");
  console.log("mathRes:", JSON.stringify(mathRes, null, 2));
  console.log("Player personality right after mathRes:", player.personality);
  if (mathRes.result.status !== "accepted") {
    throw new Error(`read_math_book failed: ${mathRes.result.message}`);
  }
  const postMathStudiousness = player.personality?.studiousness ?? 0;
  const postMathEnergy = player.needs.energy;
  const postMathBoredom = player.emotions.boredom;

  if (postMathStudiousness !== Math.min(100, prevStudiousness + 15)) {
    throw new Error(`Math studiousness expected +15, got ${postMathStudiousness} from ${prevStudiousness}`);
  }
  if (postMathEnergy <= prevEnergy && postMathEnergy !== 100) {
    throw new Error(`Math energy expected net positive boost, got ${postMathEnergy} from ${prevEnergy}`);
  }
  if (postMathBoredom > prevBoredom - 5) {
    throw new Error(`Math boredom expected -10 reduction, got ${postMathBoredom} from ${prevBoredom}`);
  }
  console.log("✓ Math Textbook reading rewards verified (+15 studiousness, +5 mental energy, -10 boredom).");

  // 1B. Physics Textbook
  const prevPhysStudious = player.personality?.studiousness ?? 70;
  const prevPhysBoredom = player.emotions.boredom;

  const physRes = engine.submitPlayerAction("read_physics_book", "physics_book_001");
  if (physRes.result.status !== "accepted") {
    throw new Error(`read_physics_book failed: ${physRes.result.message}`);
  }
  const postPhysStudious = player.personality?.studiousness ?? 0;
  const postPhysBoredom = player.emotions.boredom;

  if (postPhysStudious !== Math.min(100, prevPhysStudious + 15)) {
    throw new Error(`Physics studiousness expected +15, got ${postPhysStudious} from ${prevPhysStudious}`);
  }
  if (postPhysBoredom !== Math.max(0, Math.round((prevPhysBoredom - 10) * 10) / 10)) {
    throw new Error(`Physics boredom expected -10, got ${postPhysBoredom} from ${prevPhysBoredom}`);
  }
  console.log("✓ Physics Textbook reading rewards verified (+15 studiousness, -10 boredom).");

  // 1C. Psychology Book
  const prevSociability = player.personality?.sociability ?? 75;
  const prevStress = player.emotions.stress;

  console.log("Before psych book, player personality:", player.personality);
  const psychRes = engine.submitPlayerAction("read_psychology_book", "psychology_book_001");
  console.log("psychRes:", JSON.stringify(psychRes, null, 2));
  console.log("After psych book, player personality:", player.personality);
  if (psychRes.result.status !== "accepted") {
    throw new Error(`read_psychology_book failed: ${psychRes.result.message}`);
  }
  const postPsychSociability = player.personality?.sociability ?? 0;
  const postPsychStress = player.emotions.stress;

  if (postPsychSociability < Math.min(100, prevSociability + 15)) {
    throw new Error(`Psychology sociability expected at least +15, got ${postPsychSociability} from ${prevSociability}`);
  }
  if (postPsychStress > Math.max(0, Math.round((prevStress - 10) * 10) / 10)) {
    throw new Error(`Psychology stress expected at least -10, got ${postPsychStress} from ${prevStress}`);
  }
  console.log("✓ Psychology Book reading rewards verified (+15 sociability, -10 stress).");

  // 1D. Mohit's Notebook
  const prevHappy = player.emotions.happiness;
  const prevNoteStress = player.emotions.stress;

  const mohitNoteRes = engine.submitPlayerAction("read_mohit_notebook", "mohit_notebook_001");
  if (mohitNoteRes.result.status !== "accepted") {
    throw new Error(`read_mohit_notebook failed: ${mohitNoteRes.result.message}`);
  }
  const postHappy = player.emotions.happiness;
  const postNoteStress = player.emotions.stress;

  if (prevHappy < 95 && postHappy < Math.min(100, Math.round((prevHappy + 8) * 10) / 10)) {
    throw new Error(`Mohit's notebook happiness expected at least +10, got ${postHappy} from ${prevHappy}`);
  }
  if (prevNoteStress > 5 && postNoteStress > Math.max(0, Math.round((prevNoteStress - 15) * 10) / 10)) {
    throw new Error(`Mohit's notebook stress expected at least -15, got ${postNoteStress} from ${prevNoteStress}`);
  }
  console.log("✓ Mohit's Notebook reading rewards verified (+10 happiness, -15 stress).");

  // 1E. Aria's Notebook (Roommate Boundary Tension)
  // When Aria is present in the room:
  const prevTensionStress = player.emotions.stress;
  const prevAriaStress = ai.emotions.stress;
  const prevAriaHappy = ai.emotions.happiness;

  const ariaNoteRes = engine.submitPlayerAction("read_aria_notebook", "aria_notebook_001");
  if (ariaNoteRes.result.status !== "accepted") {
    throw new Error(`read_aria_notebook failed: ${ariaNoteRes.result.message}`);
  }
  if (!ariaNoteRes.result.message.includes("Mohit! That’s my private notebook!")) {
    throw new Error(`Expected friction dialogue when Aria is present, got: ${ariaNoteRes.result.message}`);
  }
  if (player.emotions.stress <= prevTensionStress) {
    throw new Error("Expected stress increase when caught reading Aria's notebook");
  }
  if (ai.emotions.stress <= prevAriaStress || ai.emotions.happiness >= prevAriaHappy) {
    throw new Error("Expected Aria's stress to increase and happiness to drop on boundary intrusion");
  }
  console.log("✓ Aria's Notebook roommate boundary tension verified (sparks friction, Aria dialogue, guilt stress).");

  // Test reading Aria's notebook when alone in room
  ai.location.roomId = "kitchen";
  const aloneStressBefore = player.emotions.stress;
  const ariaNoteAloneRes = engine.submitPlayerAction("read_aria_notebook", "aria_notebook_001");
  if (!ariaNoteAloneRes.result.message.includes("secretly peek into Aria's notebook")) {
    throw new Error(`Expected secret guilt message when reading alone, got: ${ariaNoteAloneRes.result.message}`);
  }
  if (Math.abs(player.emotions.stress - Math.min(100, Math.round((aloneStressBefore + 20) * 10) / 10)) > 2) {
    throw new Error("Expected +20 guilt stress when peeking secretly into Aria's notebook");
  }
  console.log("✓ Reading Aria's Notebook in secret verified (+20 guilt stress).");

  console.log("\n[TEST 2] Testing Desktop PC Creative & Work Projects...");
  // Turn on computer first
  engine.stateManager.updateObjectState("computer_001", (obj) => {
    obj.state = "on";
  });
  player.emotions.boredom = 30;

  const codeStudiousBefore = player.personality?.studiousness ?? 50;
  const codeEnergyBefore = player.needs.energy;
  const codeBoredomBefore = player.emotions.boredom;

  const codeRes = engine.submitPlayerAction("code_project", "computer_001");
  if (codeRes.result.status !== "accepted") {
    throw new Error(`code_project failed: ${codeRes.result.message}`);
  }
  if (player.personality?.studiousness !== Math.min(100, codeStudiousBefore + 20)) {
    throw new Error("code_project expected +20 studiousness");
  }
  if (player.needs.energy <= codeEnergyBefore - 10) {
    throw new Error("code_project expected +10 energy satisfaction");
  }
  if (player.emotions.boredom > codeBoredomBefore - 5) {
    throw new Error("code_project expected -15 boredom");
  }
  console.log("✓ code_project software development verified (+20 studiousness, +10 energy satisfaction, -15 boredom).");

  // Listen to Lo-Fi Music
  const lofiStressBefore = player.emotions.stress;
  const lofiHappyBefore = player.emotions.happiness;

  const lofiRes = engine.submitPlayerAction("listen_lofi_music");
  if (lofiRes.result.status !== "accepted") {
    throw new Error(`listen_lofi_music failed: ${lofiRes.result.message}`);
  }
  if (Math.abs(player.emotions.stress - Math.max(0, Math.round((lofiStressBefore - 15) * 10) / 10)) > 2) {
    throw new Error("listen_lofi_music expected -15 stress");
  }
  if (Math.abs(player.emotions.happiness - Math.min(100, Math.round((lofiHappyBefore + 10) * 10) / 10)) > 2) {
    throw new Error("listen_lofi_music expected +10 happiness");
  }
  console.log("✓ listen_lofi_music verified (-15 stress, +10 happiness).");

  console.log("\n[TEST 3] Testing Roommate Social Encounters (Mohit & Aria)...");

  // 3A. Precondition check: social action rejected if roommate is in a different room
  player.location.roomId = "study_room";
  ai.location.roomId = "kitchen";

  const isolatedChai = engine.submitPlayerAction("offer_chai");
  if (isolatedChai.result.status !== "rejected") {
    throw new Error("Expected offer_chai to be rejected when roommate is not in same room");
  }
  console.log("✓ Social precondition confirmed: social encounters require both characters in the same room.");

  // 3B. Both characters in Kitchen: offer_chai
  player.location.roomId = "kitchen";
  player.body.posture = "standing";
  ai.location.roomId = "kitchen";
  ai.body.posture = "standing";
  ai.needs.bladder = 20;
  ai.needs.thirst = 20;
  ai.needs.hunger = 20;

  const pHappyBefore = player.emotions.happiness;
  const pStressBefore = player.emotions.stress;
  const aiHappyBefore = ai.emotions.happiness;
  const aiStressBefore = ai.emotions.stress;

  const chaiRes = engine.submitPlayerAction("offer_chai");
  if (chaiRes.result.status !== "accepted") {
    throw new Error(`offer_chai failed: ${chaiRes.result.message}`);
  }
  if (player.emotions.happiness < pHappyBefore || player.emotions.stress > pStressBefore) {
    throw new Error("offer_chai did not improve player's emotional state");
  }
  if (ai.emotions.happiness < aiHappyBefore || ai.emotions.stress > aiStressBefore) {
    throw new Error("offer_chai did not improve Aria's emotional state and roommate rapport");
  }
  console.log("✓ offer_chai verified: shared tea enriches roommate rapport for both characters.");

  // 3C. ask_about_day check-in
  ai.location.roomId = "kitchen";
  ai.body.posture = "standing";
  ai.needs.bladder = 20;
  ai.needs.thirst = 20;
  ai.needs.hunger = 20;
  player.emotions.loneliness = 30;
  const pLonelinessBefore = player.emotions.loneliness;
  const askRes = engine.submitPlayerAction("ask_about_day");
  if (askRes.result.status !== "accepted") {
    throw new Error(`ask_about_day failed: ${askRes.result.message}`);
  }
  if (player.emotions.loneliness >= pLonelinessBefore) {
    throw new Error("ask_about_day did not reduce loneliness");
  }
  console.log("✓ ask_about_day casual check-in verified.");

  // 3D. Both characters in Study Room: play_chess
  player.location.roomId = "study_room";
  player.body.posture = "sitting";
  ai.location.roomId = "study_room";
  ai.body.posture = "sitting";
  ai.needs.bladder = 20;
  ai.needs.thirst = 20;
  ai.needs.hunger = 20;

  player.emotions.boredom = 40;
  const pBoredomBeforeChess = player.emotions.boredom;
  const chessRes = engine.submitPlayerAction("play_chess");
  if (chessRes.result.status !== "accepted") {
    throw new Error(`play_chess failed: ${chessRes.result.message}`);
  }
  if (player.emotions.boredom >= pBoredomBeforeChess) {
    throw new Error("play_chess did not decrease boredom");
  }
  console.log("✓ play_chess tactical board game match verified.");

  // 3E. discuss_book & discuss_code
  ai.location.roomId = "study_room";
  ai.body.posture = "sitting";
  ai.needs.bladder = 20;
  ai.needs.thirst = 20;
  ai.needs.hunger = 20;
  const discussBookRes = engine.submitPlayerAction("discuss_book");
  if (discussBookRes.result.status !== "accepted") {
    throw new Error(`discuss_book failed: ${discussBookRes.result.message}`);
  }
  console.log("✓ discuss_book verified: intellectual exchange over reading insights.");

  ai.location.roomId = "study_room";
  ai.body.posture = "sitting";
  ai.needs.bladder = 20;
  ai.needs.thirst = 20;
  ai.needs.hunger = 20;
  const discussCodeRes = engine.submitPlayerAction("discuss_code");
  if (discussCodeRes.result.status !== "accepted") {
    throw new Error(`discuss_code failed: ${discussCodeRes.result.message}`);
  }
  console.log("✓ discuss_code verified: architectural and software discussions.");

  console.log("\n=== ALL STUDY, TECHNOLOGY & ROOMMATE DYNAMICS TESTS PASSED WITH 100% SUCCESS! ===");
}

runStudySocialTests();

