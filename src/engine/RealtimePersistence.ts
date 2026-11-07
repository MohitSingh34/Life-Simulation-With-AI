import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SimulationSnapshot } from "../types/index.js";
import { GameEngine } from "./GameEngine.js";

interface PersistedGame {
  version: 1;
  lastNeedsCheckpoint: string;
  lastLocalDate: string;
  lastAiPingCheckpoint?: string;
  snapshot: SimulationSnapshot;
}

const MINUTE_MS = 60_000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class RealtimePersistence {
  private readonly dataDirectory: string;
  private readonly statePath: string;
  private readonly timingsPath: string;
  private lastNeedsCheckpointMs = 0;
  private lastAiPingCheckpointMs = 0;
  private lastLocalDate = "";
  private lastLoggedMinuteMs: number | null = null;
  private ariaPingHandler?: () => Promise<boolean | void>;
  private ariaPingInProgress = false;
  private ariaPingRetryAfterMs = 0;

  constructor(
    private readonly engine: GameEngine,
    dataDirectory = path.resolve(__dirname, "../../state")
  ) {
    this.dataDirectory = dataDirectory;
    this.statePath = path.join(dataDirectory, "game-state.json");
    this.timingsPath = path.join(dataDirectory, "timings.txt");
  }

  public setAriaPingHandler(handler: () => Promise<boolean | void>): void {
    this.ariaPingHandler = handler;
  }

  public start(now = new Date()): void {
    fs.mkdirSync(this.dataDirectory, { recursive: true });
    this.engine.timeEngine.enableWallClockMode();
    this.lastLoggedMinuteMs = this.readLastLoggedMinute();

    if (fs.existsSync(this.statePath)) {
      const saved = this.readPersistedGame();
      this.engine.stateManager.loadSnapshot(saved.snapshot);
      this.lastNeedsCheckpointMs = Date.parse(saved.lastNeedsCheckpoint);
      this.lastLocalDate = saved.lastLocalDate;
      this.lastAiPingCheckpointMs = saved.lastAiPingCheckpoint
        ? Date.parse(saved.lastAiPingCheckpoint)
        : this.lastNeedsCheckpointMs;
      this.update(now);
      return;
    }

    this.lastNeedsCheckpointMs = this.floorToMinute(now.getTime());
    this.lastAiPingCheckpointMs = this.lastNeedsCheckpointMs;
    this.lastLocalDate = this.engine.timeEngine.getLocalDateKey(now);
    this.engine.timeEngine.syncToWallClock(now);
    this.writeSnapshot();
    this.writeTimingLogThroughCheckpoint();
  }

  public update(now = new Date()): void {
    if (!this.lastNeedsCheckpointMs) {
      throw new Error("Realtime persistence has not been started.");
    }

    const elapsedMinutes = Math.max(
      0,
      Math.floor((now.getTime() - this.lastNeedsCheckpointMs) / MINUTE_MS)
    );
    const localDate = this.engine.timeEngine.getLocalDateKey(now);
    const daysPassed = Math.max(0, this.calendarDaysBetween(this.lastLocalDate, localDate));
    const checkpointChanged = elapsedMinutes > 0 || daysPassed > 0;

    // Check if autonomous AI heartbeat (Aria ping) is due
    const pingInterval = this.engine.getAriaPingIntervalMinutes();
    const elapsedSinceAiPing = Math.max(
      0,
      Math.floor((now.getTime() - this.lastAiPingCheckpointMs) / MINUTE_MS)
    );

    let aiPingTriggered = false;
    if (elapsedSinceAiPing >= pingInterval) {
      if (this.ariaPingHandler) {
        if (!this.ariaPingInProgress && now.getTime() >= this.ariaPingRetryAfterMs) {
          this.ariaPingInProgress = true;
          const handledCheckpoint = now.getTime();
          void this.ariaPingHandler()
            .then((handled) => {
              if (handled === false) {
                this.ariaPingRetryAfterMs = now.getTime() + MINUTE_MS;
                return;
              }
              this.lastAiPingCheckpointMs = handledCheckpoint;
              this.ariaPingRetryAfterMs = 0;
              this.writeSnapshot();
            })
            .catch((error) => {
              console.error("Autonomous Aria check-in failed:", error);
              this.ariaPingRetryAfterMs = now.getTime() + MINUTE_MS;
            })
            .finally(() => {
              this.ariaPingInProgress = false;
            });
        }
      } else {
        this.lastAiPingCheckpointMs +=
          Math.floor(elapsedSinceAiPing / pingInterval) * pingInterval * MINUTE_MS;
        try {
          this.engine.tickAutonomousAI();
          aiPingTriggered = true;
        } catch (error) {
          console.warn("Autonomous AI tick failed:", error);
        }
      }
    }

    if (checkpointChanged) {
      const previousSnapshot = this.engine.stateManager.getSnapshot();
      const previousCheckpoint = this.lastNeedsCheckpointMs;
      const previousDate = this.lastLocalDate;

      if (elapsedMinutes > 0) {
        this.engine.needsEngine.tick(elapsedMinutes);
      }
      this.lastNeedsCheckpointMs += elapsedMinutes * MINUTE_MS;
      this.lastLocalDate = localDate;
      this.engine.timeEngine.syncToWallClock(now, daysPassed);

      try {
        this.writeSnapshot();
      } catch (error) {
        this.engine.stateManager.loadSnapshot(previousSnapshot);
        this.lastNeedsCheckpointMs = previousCheckpoint;
        this.lastLocalDate = previousDate;
        throw error;
      }
    } else {
      this.engine.timeEngine.syncToWallClock(now);
      if (aiPingTriggered) {
        this.writeSnapshot();
      }
    }

    this.writeTimingLogThroughCheckpoint();
  }

  public persist(now = new Date()): void {
    this.update(now);
    this.writeSnapshot();
  }

  private readPersistedGame(): PersistedGame {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.statePath, "utf8"));
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !("snapshot" in parsed) ||
        !("lastNeedsCheckpoint" in parsed) ||
        !("lastLocalDate" in parsed)
      ) {
        throw new Error("missing persisted game fields");
      }

      const saved = parsed as PersistedGame;
      if (
        saved.version !== 1 ||
        !saved.snapshot?.time ||
        !saved.snapshot.characters ||
        !saved.snapshot.objects ||
        typeof saved.lastNeedsCheckpoint !== "string" ||
        !Number.isFinite(Date.parse(saved.lastNeedsCheckpoint)) ||
        typeof saved.lastLocalDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(saved.lastLocalDate)
      ) {
        throw new Error("invalid persisted game data");
      }
      return saved;
    } catch (error) {
      throw new Error(
        `Could not restore saved game at ${this.statePath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private writeSnapshot(): void {
    const persisted: PersistedGame = {
      version: 1,
      lastNeedsCheckpoint: new Date(this.lastNeedsCheckpointMs).toISOString(),
      lastLocalDate: this.lastLocalDate,
      lastAiPingCheckpoint: new Date(this.lastAiPingCheckpointMs).toISOString(),
      snapshot: this.engine.stateManager.getSnapshot(),
    };
    const temporaryPath = `${this.statePath}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryPath, this.statePath);
  }

  private readLastLoggedMinute(): number | null {
    if (!fs.existsSync(this.timingsPath)) return null;
    const lines = fs.readFileSync(this.timingsPath, "utf8").split(/\r?\n/);
    const lastLine = lines.reverse().find((line) => line.trim().length > 0);
    if (!lastLine) return null;

    const timestamp = Date.parse(lastLine);
    if (!Number.isFinite(timestamp)) {
      throw new Error(`Invalid final timestamp in ${this.timingsPath}.`);
    }
    return timestamp;
  }

  private writeTimingLogThroughCheckpoint(): void {
    if (
      this.lastLoggedMinuteMs !== null &&
      this.lastLoggedMinuteMs > this.lastNeedsCheckpointMs
    ) {
      throw new Error(`${this.timingsPath} is ahead of the saved game checkpoint.`);
    }

    const timestamps: string[] = [];
    if (this.lastLoggedMinuteMs === null) {
      timestamps.push(new Date(this.lastNeedsCheckpointMs).toISOString());
    } else {
      for (
        let minute = this.lastLoggedMinuteMs + MINUTE_MS;
        minute <= this.lastNeedsCheckpointMs;
        minute += MINUTE_MS
      ) {
        timestamps.push(new Date(minute).toISOString());
      }
    }

    if (timestamps.length === 0) return;
    fs.appendFileSync(this.timingsPath, `${timestamps.join("\n")}\n`, "utf8");
    this.lastLoggedMinuteMs = Date.parse(timestamps[timestamps.length - 1]);
  }

  private calendarDaysBetween(from: string, to: string): number {
    const fromDate = new Date(`${from}T00:00:00Z`);
    const toDate = new Date(`${to}T00:00:00Z`);
    return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
  }

  private floorToMinute(timestamp: number): number {
    return Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;
  }
}
