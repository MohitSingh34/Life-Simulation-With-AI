import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConversationManager } from "./ai/ConversationManager.js";
import { buildAriaTurnPrompt } from "./ai/AriaPromptBuilder.js";
import { GameEngine } from "./engine/GameEngine.js";

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "life-simulation-aria-prompt-"));

try {
  const conversations = new ConversationManager(temporaryDirectory);
  const conversationId = conversations.getActiveConversation().id;
  const engine = new GameEngine();
  engine.init();

  const firstPrompt = buildAriaTurnPrompt(
    engine,
    conversations,
    conversationId,
    1,
    "The player says: hello."
  );
  assert.match(firstPrompt, /If u want to use any tool, first call how to use it using help tool call/);
  assert.match(firstPrompt, /"helpKeywords":/);
  assert.match(firstPrompt, /"availableActions":\{"aria":/);
  assert.match(firstPrompt, /"player":\{/);

  engine.getPlayer().needs.hunger = 88;
  engine.stateManager.updateObjectState("stove_001", (object) => {
    object.state = "cooking";
  });
  const nextPrompt = buildAriaTurnPrompt(
    engine,
    conversations,
    conversationId,
    2,
    "The player says: what changed?"
  );
  assert.doesNotMatch(nextPrompt, /Full game configuration and capabilities/);
  assert.match(nextPrompt, /stateChangesSincePreviousPrompt/);
  assert.match(nextPrompt, /stove_001/);
  assert.match(nextPrompt, /"hunger":88/);
  assert.match(nextPrompt, /"availableActions":\{"aria":/);

  const tenthPrompt = buildAriaTurnPrompt(
    engine,
    conversations,
    conversationId,
    10,
    "The player says: check in."
  );
  assert.match(tenthPrompt, /helpKeywords/);
  assert.doesNotMatch(tenthPrompt, /Full game configuration and capabilities/);
  const tenthTurnFollowup = buildAriaTurnPrompt(
    engine,
    conversations,
    conversationId,
    10,
    "Continue after the action result.",
    ["The action succeeded."]
  );
  assert.doesNotMatch(tenthTurnFollowup, /Full game configuration and capabilities/);

  const legacySession = conversations.createConversation("Legacy session");
  const legacyPrompt = buildAriaTurnPrompt(
    engine,
    conversations,
    legacySession.id,
    7,
    "Continue this older session."
  );
  assert.match(legacyPrompt, /helpKeywords/);
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log("Aria prompt cadence, actions, and state-delta tests passed.");
