import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { GeminiChatSummary } from "./GeminiWebProvider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_DIR = path.resolve(__dirname, "../../state");

function isStoredConversations(value: unknown): value is StoredConversations {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<StoredConversations>;
  if (typeof data.activeId !== "string" || !Array.isArray(data.conversations)) {
    return false;
  }

  return data.conversations.every((conversation) => {
    if (!conversation || typeof conversation !== "object") return false;
    const session = conversation as Partial<ConversationSession>;
    if (
      typeof session.id !== "string" ||
      typeof session.title !== "string" ||
      typeof session.createdAt !== "string" ||
      typeof session.lastActiveAt !== "string" ||
      !Array.isArray(session.messages)
    ) {
      return false;
    }

    return session.messages.every((message) => {
      if (!message || typeof message !== "object") return false;
      const chatMessage = message as Partial<ChatMessage>;
      return (
        typeof chatMessage.id === "string" &&
        (chatMessage.sender === "player" || chatMessage.sender === "aria") &&
        typeof chatMessage.text === "string" &&
        typeof chatMessage.time === "string" &&
        typeof chatMessage.timestamp === "number"
      );
    });
  });
}

export interface ChatMessage {
  id: string;
  sender: "player" | "aria";
  text: string;
  time: string;
  timestamp: number;
}

export interface ConversationSession {
  id: string;
  cid?: string;
  title: string;
  createdAt: string;
  lastActiveAt: string;
  metadata?: unknown;
  messages: ChatMessage[];
}

interface StoredConversations {
  activeId: string;
  conversations: ConversationSession[];
}

export class ConversationManager {
  private activeId: string = "";
  private sessions: Map<string, ConversationSession> = new Map();
  private readonly conversationFile: string;

  constructor(stateDir = STATE_DIR) {
    this.conversationFile = path.join(stateDir, "conversations.json");
    this.load();
  }

  public getActiveConversation(): ConversationSession {
    let active = this.sessions.get(this.activeId);
    if (!active) {
      if (this.sessions.size > 0) {
        active = Array.from(this.sessions.values())[0];
        this.activeId = active.id;
      } else {
        active = this.createConversation("Morning in Jabalpur");
      }
    }
    return active;
  }

  public listConversations(): ConversationSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
  }

  public getConversation(id: string): ConversationSession | null {
    return this.sessions.get(id) ?? null;
  }

  public incrementPromptTurnCount(id: string): number {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Conversation "${id}" not found.`);
    const metadata =
      session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
        ? session.metadata as Record<string, unknown>
        : {};
    const savedCount = metadata.ariaPromptTurnCount;
    const previousCount = typeof savedCount === "number" && Number.isInteger(savedCount) && savedCount >= 0
      ? savedCount
      : session.messages.filter((message) => message.sender === "player").length;
    const nextCount = previousCount + 1;
    session.metadata = { ...metadata, ariaPromptTurnCount: nextCount };
    this.save();
    return nextCount;
  }

  public setConversationMetadata(id: string, updates: Record<string, unknown>): void {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Conversation "${id}" not found.`);
    const metadata =
      session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
        ? session.metadata as Record<string, unknown>
        : {};
    session.metadata = { ...metadata, ...updates };
    this.save();
  }

  public selectConversation(id: string): ConversationSession | null {
    const session = this.sessions.get(id);
    if (session) {
      this.activeId = session.id;
      session.lastActiveAt = new Date().toISOString();
      this.save();
      return session;
    }
    return null;
  }

  public createConversation(title?: string, cid?: string): ConversationSession {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const session: ConversationSession = {
      id,
      cid,
      title: title || `Conversation ${this.sessions.size + 1}`,
      createdAt: now,
      lastActiveAt: now,
      messages: [
        {
          id: `msg_init_${Date.now()}`,
          sender: "aria",
          text: "Good morning! Jabalpur mornings are so peaceful, aren't they?",
          time: "07:30 AM",
          timestamp: Date.now(),
        },
      ],
    };
    this.sessions.set(id, session);
    this.activeId = id;
    this.save();
    return session;
  }

  public reset(): void {
    this.sessions.clear();
    this.createConversation("Morning in Jabalpur");
    this.save();
  }

  public addMessage(
    sender: "player" | "aria",
    text: string,
    timeStr: string = "07:30 AM"
  ): ChatMessage {
    const active = this.getActiveConversation();
    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender,
      text,
      time: timeStr,
      timestamp: Date.now(),
    };
    active.messages.push(msg);
    active.lastActiveAt = new Date().toISOString();

    // Auto-update conversation title if it's default and this is early dialogue
    if (active.title.startsWith("Conversation ") || active.title === "Morning in Jabalpur") {
      if (sender === "player" && text.length > 3) {
        const words = text.split(/\s+/).slice(0, 5).join(" ");
        active.title = words.length > 25 ? words.slice(0, 25) + "..." : words;
      }
    }

    this.save();
    return msg;
  }

  public updateActiveCid(cid?: string, metadata?: unknown): void {
    const active = this.getActiveConversation();
    if (cid) active.cid = cid;
    if (metadata) active.metadata = metadata;
    this.save();
  }

  public syncRemoteChats(remoteChats: GeminiChatSummary[]): void {
    if (!remoteChats || remoteChats.length === 0) return;
    let changed = false;
    for (const rc of remoteChats) {
      const exists = Array.from(this.sessions.values()).find((s) => s.cid === rc.cid);
      if (!exists) {
        const id = `gemini_${rc.cid}`;
        const timestamp = rc.timestamp ? new Date(rc.timestamp * 1000).toISOString() : new Date().toISOString();
        this.sessions.set(id, {
          id,
          cid: rc.cid,
          title: rc.title || "Gemini Web Chat",
          createdAt: timestamp,
          lastActiveAt: timestamp,
          messages: [],
        });
        changed = true;
      }
    }
    if (changed) {
      this.save();
    }
  }

  private load(): void {
    if (fs.existsSync(this.conversationFile)) {
      try {
        const raw = fs.readFileSync(this.conversationFile, "utf-8");
        const parsed: unknown = JSON.parse(raw);
        if (!isStoredConversations(parsed)) {
          throw new Error("Conversation file has an invalid data structure.");
        }
        const data = parsed;
        this.activeId = data.activeId || "";
        this.sessions.clear();
        for (const s of data.conversations || []) {
          this.sessions.set(s.id, s);
        }
      } catch (error) {
        const backupFile = `${this.conversationFile}.corrupt-${Date.now()}-${process.pid}.bak`;
        try {
          fs.copyFileSync(this.conversationFile, backupFile, fs.constants.COPYFILE_EXCL);
        } catch (backupError) {
          throw new Error(
            `Could not preserve invalid conversation data at ${this.conversationFile}; ` +
              `refusing to replace it.`,
            { cause: backupError }
          );
        }
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(
          `Could not load conversations.json (${reason}). Original data was preserved at ${backupFile}; creating a new store.`
        );
      }
    }

    if (this.sessions.size === 0) {
      this.createConversation("Morning in Jabalpur");
    }
  }

  private save(): void {
    try {
      const stateDir = path.dirname(this.conversationFile);
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }
      const data: StoredConversations = {
        activeId: this.activeId,
        conversations: Array.from(this.sessions.values()),
      };
      fs.writeFileSync(this.conversationFile, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.warn("Could not save conversations.json:", err);
    }
  }
}
