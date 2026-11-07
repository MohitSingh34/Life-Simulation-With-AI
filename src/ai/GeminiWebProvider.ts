import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { createInterface } from "readline";
import { fileURLToPath } from "url";

type PendingResponse = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type WorkerMessage = {
  type?: unknown;
  ok?: unknown;
  error?: unknown;
  id?: unknown;
  text?: unknown;
  chats?: unknown;
  turns?: unknown;
  cid?: unknown;
  metadata?: unknown;
};

export interface GeminiChatSummary {
  cid: string;
  title: string;
  timestamp?: number;
}

export interface GeminiChatTurn {
  role: string;
  text: string;
}

export interface GeminiReplyResult {
  text: string;
  cid?: string;
  metadata?: unknown;
}

export class GeminiWebProvider {
  private child?: ChildProcessWithoutNullStreams;
  private startupPromise?: Promise<void>;
  private startup?: { resolve: () => void; reject: (error: Error) => void };
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingResponse>();
  private queue: Promise<void> = Promise.resolve();

  public get isConfigured(): boolean {
    return Boolean(
      process.env.GEMINI_API_URL?.trim() || process.env.GEMINI_COOKIE_1PSID?.trim()
    );
  }

  public generateReply(prompt: string): Promise<string> {
    return this.generateReplyForSession(prompt, "life-simulation");
  }

  public generateReplyForSession(prompt: string, sessionId: string): Promise<string> {
    const request = this.queue.then(() => this.sendApiCompletion(prompt, sessionId));
    this.queue = request.then(
      () => undefined,
      () => undefined
    );
    return request;
  }

  public listChats(): Promise<GeminiChatSummary[]> {
    const request = this.queue.then(() => this.sendOne({ action: "list_chats" }));
    this.queue = request.then(
      () => undefined,
      () => undefined
    );
    return request.then((res: WorkerMessage) => (res.chats as GeminiChatSummary[]) || []);
  }

  public selectChat(cid: string, metadata?: unknown): Promise<boolean> {
    const request = this.queue.then(() => this.sendOne({ action: "select_chat", cid, metadata }));
    this.queue = request.then(
      () => undefined,
      () => undefined
    );
    return request.then((res: WorkerMessage) => Boolean(res.ok));
  }

  public newChat(): Promise<boolean> {
    const request = this.queue.then(() => this.sendOne({ action: "new_chat" }));
    this.queue = request.then(
      () => undefined,
      () => undefined
    );
    return request.then((res: WorkerMessage) => Boolean(res.ok));
  }

  public readChat(cid: string): Promise<GeminiChatTurn[]> {
    const request = this.queue.then(() => this.sendOne({ action: "read_chat", cid }));
    this.queue = request.then(
      () => undefined,
      () => undefined
    );
    return request.then((res: WorkerMessage) => (res.turns as GeminiChatTurn[]) || []);
  }

  public close(): void {
    this.child?.stdin.end();
  }

  private async sendApiCompletion(prompt: string, sessionId: string): Promise<string> {
    if (!this.isConfigured) {
      throw new Error("Set GEMINI_API_URL or GEMINI_COOKIE_1PSID to enable Gemini.");
    }

    const endpoint =
      process.env.GEMINI_API_URL?.trim() ||
      "http://127.0.0.1:8001/v1/chat/completions";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Gemini-Client": "life-simulation",
      "X-Gemini-Session-ID": `life-simulation:${sessionId}`,
    };
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        session_id: `life-simulation:${sessionId}`,
        user: "life-simulation",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Gemini API returned invalid JSON (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      const detail =
        data && typeof data === "object" && "detail" in data
          ? String(data.detail)
          : `HTTP ${response.status}`;
      throw new Error(`Gemini API request failed: ${detail}`);
    }
    if (
      !data ||
      typeof data !== "object" ||
      !("choices" in data) ||
      !Array.isArray(data.choices)
    ) {
      throw new Error("Gemini API returned an invalid chat completion.");
    }

    const message = data.choices[0]?.message;
    if (
      !message ||
      typeof message !== "object" ||
      !("content" in message) ||
      typeof message.content !== "string"
    ) {
      throw new Error("Gemini API returned an empty or invalid response.");
    }
    return message.content;
  }

  private async sendOne(payload: Record<string, unknown>): Promise<WorkerMessage> {
    if (!this.isConfigured) {
      throw new Error("Gemini web authentication is not configured.");
    }

    await this.startWorker();
    const child = this.child;
    if (!child || child.exitCode !== null) {
      throw new Error("Gemini worker is not running.");
    }

    const id = this.nextRequestId++;
    return new Promise<WorkerMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Gemini request timed out."));
        child.kill();
      }, 90_000);

      this.pending.set(id, { resolve, reject, timeout });
      child.stdin.write(`${JSON.stringify({ ...payload, id })}\n`, (error?: Error | null) => {
        if (error) {
          this.rejectRequest(id, new Error("Could not send request to Gemini worker."));
        }
      });
    });
  }

  private startWorker(): Promise<void> {
    if (this.child && this.startupPromise) {
      return this.startupPromise;
    }

    const workerPath = fileURLToPath(new URL("./gemini_web_worker.py", import.meta.url));
    const executable = process.env.GEMINI_PYTHON?.trim() || "python3";
    const child = spawn(executable, [workerPath], { stdio: ["pipe", "pipe", "pipe"] });
    this.child = child;

    this.startupPromise = new Promise<void>((resolve, reject) => {
      this.startup = { resolve, reject };
    });

    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line: string) => this.handleWorkerLine(child, line));
    child.stderr.resume();
    child.on("error", () => {
      this.failWorker(child, new Error("Could not start the Gemini Python worker."));
    });
    child.on("close", (code: number | null) => {
      this.failWorker(
        child,
        new Error(`Gemini Python worker exited unexpectedly (code ${code ?? "unknown"}).`)
      );
    });

    return this.startupPromise;
  }

  private handleWorkerLine(child: ChildProcessWithoutNullStreams, line: string): void {
    let message: WorkerMessage;
    try {
      message = JSON.parse(line) as WorkerMessage;
    } catch {
      this.failWorker(child, new Error("Gemini worker returned an invalid response."));
      child.kill();
      return;
    }

    if (message.type === "ready") {
      const startup = this.startup;
      this.startup = undefined;
      if (message.ok === true) {
        startup?.resolve();
      } else {
        startup?.reject(
          new Error(typeof message.error === "string" ? message.error : "Gemini initialization failed.")
        );
        child.kill();
      }
      return;
    }

    if (typeof message.id !== "number") {
      this.failWorker(child, new Error("Gemini worker returned an invalid response."));
      child.kill();
      return;
    }

    if (typeof message.error === "string") {
      this.rejectRequest(message.id, new Error(message.error));
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(message.id);
    pending.resolve(message);
  }

  private rejectRequest(id: number, error: Error): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(id);
    pending.reject(error);
  }

  private failWorker(child: ChildProcessWithoutNullStreams, error: Error): void {
    if (this.child !== child) return;

    this.child = undefined;
    this.startupPromise = undefined;
    this.startup?.reject(error);
    this.startup = undefined;

    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}
