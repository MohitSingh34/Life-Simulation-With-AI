import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConversationManager } from "./ai/ConversationManager.js";

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "life-simulation-conversations-"));
const conversationFile = path.join(stateDir, "conversations.json");
const invalidContents = "";

try {
  fs.writeFileSync(conversationFile, invalidContents);
  const recovered = new ConversationManager(stateDir);
  const backupFiles = fs.readdirSync(stateDir).filter((name) => name.endsWith(".bak"));

  assert.equal(backupFiles.length, 1);
  assert.equal(
    fs.readFileSync(path.join(stateDir, backupFiles[0]), "utf-8"),
    invalidContents
  );
  assert.equal(recovered.getActiveConversation().title, "Morning in Jabalpur");
  assert.equal(JSON.parse(fs.readFileSync(conversationFile, "utf-8")).conversations.length, 1);

  const storedConversation = recovered.getActiveConversation();
  const restored = new ConversationManager(stateDir);
  assert.equal(restored.getActiveConversation().id, storedConversation.id);
  assert.equal(fs.readdirSync(stateDir).filter((name) => name.endsWith(".bak")).length, 1);
} finally {
  fs.rmSync(stateDir, { recursive: true, force: true });
}

console.log("Invalid conversation files are backed up before a fresh store is written.");
