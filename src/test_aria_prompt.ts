import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConversationManager } from "./ai/ConversationManager.js";
import { executeAutomaticMessageLoopCommands } from "./ai/AutomaticMessageLoopProcessor.js";
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
  assert.match(firstPrompt, /Initial game setup/);
  assert.match(firstPrompt, /"commandGuide":/);
  assert.match(firstPrompt, /The regular 10-minute idle check-in always runs/);
  assert.match(firstPrompt, /When you issue an action\/tool command, the game immediately sends you its result/);
  assert.match(firstPrompt, /Optional self-directed loop: use &&start_automatic_message_loop&&/);
  assert.match(firstPrompt, /"actions":/);
  assert.match(firstPrompt, /"homeConfiguration":/);
  assert.match(firstPrompt, /"player":\{/);
  assert.match(firstPrompt, /timestampUtc/);
  assert.match(firstPrompt, /localTime/);
  assert.doesNotMatch(firstPrompt, /Day 1,/);

  engine.getPlayer().needs.hunger = 88;
  engine.stateManager.updateObjectState("stove_001", (object) => {
    object.state = "cooking";
  });
  engine.houseBuilder.getLayout().rooms[0].description += " Prompt delta test.";
  const nextPrompt = buildAriaTurnPrompt(
    engine,
    conversations,
    conversationId,
    2,
    "The player says: what changed?"
  );
  assert.doesNotMatch(nextPrompt, /Initial game setup/);
  assert.doesNotMatch(nextPrompt, /commandGuide/);
  assert.doesNotMatch(nextPrompt, /If u want to use any tool/);
  assert.match(nextPrompt, /Optional self-directed loop: use &&start_automatic_message_loop&&/);
  assert.doesNotMatch(nextPrompt, /The regular 10-minute idle check-in always runs/);
  assert.doesNotMatch(nextPrompt, /When you issue an action\/tool command, the game immediately sends you its result/);
  assert.doesNotMatch(nextPrompt, /availableActions/);
  assert.match(nextPrompt, /updatedGameState/);
  assert.match(nextPrompt, /stove_001/);
  assert.match(nextPrompt, /"hunger":88/);
  assert.match(nextPrompt, /homeConfiguration/);
  assert.match(nextPrompt, /Prompt delta test/);
  assert.ok(nextPrompt.length < firstPrompt.length);

  const tenthPrompt = buildAriaTurnPrompt(
    engine,
    conversations,
    conversationId,
    10,
    "The player says: check in."
  );
  assert.doesNotMatch(tenthPrompt, /Initial game setup/);
  assert.doesNotMatch(tenthPrompt, /commandGuide/);
  const tenthTurnFollowup = buildAriaTurnPrompt(
    engine,
    conversations,
    conversationId,
    10,
    "Continue after the action result.",
    ["The action succeeded."]
  );
  assert.doesNotMatch(tenthTurnFollowup, /commandGuide/);

  const legacySession = conversations.createConversation("Legacy session");
  const legacyPrompt = buildAriaTurnPrompt(
    engine,
    conversations,
    legacySession.id,
    7,
    "Continue this older session."
  );
  assert.match(legacyPrompt, /Initial game setup/);

  conversations.setAutomaticMessageLoopEnabled(conversationId, true);
  const automaticPrompt = buildAriaTurnPrompt(
    engine,
    conversations,
    conversationId,
    11,
    "Scheduled automatic turn."
  );
  assert.match(automaticPrompt, /&&stop_automatic_message_loop&&/);
  assert.match(automaticPrompt, /Optional self-directed loop: use &&start_automatic_message_loop&&/);
  assert.equal(automaticPrompt.split("\n").filter((line) => line.startsWith("Optional self-directed loop:")).length, 1);
  assert.doesNotMatch(automaticPrompt, /commandGuide/);

  const queuedMessage = conversations.enqueuePlayerMessage(
    conversationId,
    "I am sending this during your loop.",
    "09:30"
  );
  const resumedConversations = new ConversationManager(temporaryDirectory);
  assert.equal(resumedConversations.isAutomaticMessageLoopEnabled(conversationId), true);
  assert.equal(resumedConversations.getQueuedPlayerMessages(conversationId).length, 1);
  assert.equal(conversations.getQueuedPlayerMessages(conversationId).length, 1);
  conversations.clearQueuedPlayerMessages(conversationId, [queuedMessage.id]);
  assert.equal(conversations.getQueuedPlayerMessages(conversationId).length, 0);

  const stopped = executeAutomaticMessageLoopCommands(
    "I am done for now. &&stop_automatic_message_loop&&",
    conversations,
    conversationId
  );
  assert.equal(stopped.hasCommands, true);
  assert.equal(stopped.enabled, false);
  assert.match(stopped.response, /I am done for now/);
  const started = executeAutomaticMessageLoopCommands(
    "&&start_automatic_message_loop&& I will check on things.",
    conversations,
    conversationId
  );
  assert.equal(started.enabled, true);
  assert.match(started.response, /I will check on things/);
  conversations.setAutomaticMessageLoopEnabled(conversationId, false);
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log("Aria prompt cadence, actions, and state-delta tests passed.");
