import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { GeminiChatSummary } from "./GeminiWebProvider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_DIR = path.resolve(__dirname, "../../state");
const CONV_FILE = path.join(STATE_DIR, "conversations.json");

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

  constructor() {
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
    try {
      if (fs.existsSync(CONV_FILE)) {
        const raw = fs.readFileSync(CONV_FILE, "utf-8");
        const data: StoredConversations = JSON.parse(raw);
        this.activeId = data.activeId || "";
        this.sessions.clear();
        for (const s of data.conversations || []) {
          this.sessions.set(s.id, s);
        }
      }
    } catch (err) {
      console.warn("Could not load conversations.json, creating new store:", err);
    }

    if (this.sessions.size === 0) {
      this.createConversation("Morning in Jabalpur");
    }
  }

  private save(): void {
    try {
      if (!fs.existsSync(STATE_DIR)) {
        fs.mkdirSync(STATE_DIR, { recursive: true });
      }
      const data: StoredConversations = {
        activeId: this.activeId,
        conversations: Array.from(this.sessions.values()),
      };
      fs.writeFileSync(CONV_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.warn("Could not save conversations.json:", err);
    }
  }
}

