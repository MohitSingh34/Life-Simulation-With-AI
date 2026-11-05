import { SimulationTime } from "../types/index.js";
import { StateManager } from "./StateManager.js";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const GAME_TIME_ZONE = "Asia/Kolkata";
const WALL_CLOCK_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: GAME_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: GAME_TIME_ZONE,
  weekday: "long",
});

export class TimeEngine {
  private wallClockMode = false;

  constructor(private stateManager: StateManager) {}

  public enableWallClockMode(): void {
    this.wallClockMode = true;
  }

  public usesWallClock(): boolean {
    return this.wallClockMode;
  }

  public syncToWallClock(now: Date, daysPassed = 0): void {
    const parts = Object.fromEntries(
      WALL_CLOCK_FORMATTER.formatToParts(now).map(({ type, value }) => [type, value])
    );
    const weekday = WEEKDAY_FORMATTER.format(now);

    this.stateManager.setTime({
      day: this.stateManager.getTime().day + daysPassed,
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second),
      dayOfWeek: DAYS_OF_WEEK.indexOf(weekday),
    });
  }

  public getLocalDateKey(now: Date): string {
    const parts = Object.fromEntries(
      WALL_CLOCK_FORMATTER.formatToParts(now).map(({ type, value }) => [type, value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  public advanceTime(seconds: number): {
    minutesPassed: number;
    hoursPassed: number;
    daysPassed: number;
  } {
    const t = this.stateManager.getTime();
    if (t.paused) return { minutesPassed: 0, hoursPassed: 0, daysPassed: 0 };

    let totalSeconds = t.second + Math.round(seconds * t.speed);
    const addedMinutes = Math.floor(totalSeconds / 60);
    t.second = totalSeconds % 60;

    let totalMinutes = t.minute + addedMinutes;
    const addedHours = Math.floor(totalMinutes / 60);
    t.minute = totalMinutes % 60;

    let totalHours = t.hour + addedHours;
    const addedDays = Math.floor(totalHours / 24);
    t.hour = totalHours % 24;

    t.day += addedDays;
    t.dayOfWeek = (t.dayOfWeek + addedDays) % 7;

    return {
      minutesPassed: addedMinutes,
      hoursPassed: addedHours,
      daysPassed: addedDays,
    };
  }

  public getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
    const t = this.stateManager.getTime();
    if (t.hour >= 5 && t.hour < 12) return "morning";
    if (t.hour >= 12 && t.hour < 17) return "afternoon";
    if (t.hour >= 17 && t.hour < 22) return "evening";
    return "night";
  }

  public getFormattedClock(): string {
    const t = this.stateManager.getTime();
    const hh = String(t.hour).padStart(2, "0");
    const mm = String(t.minute).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  public getFormattedFull(): string {
    const t = this.stateManager.getTime();
    const dayName = DAYS_OF_WEEK[t.dayOfWeek];
    return `Day ${t.day}, ${this.getFormattedClock()} (${dayName}) [${this.getTimeOfDay()}]`;
  }

  public setSpeed(multiplier: number): void {
    const t = this.stateManager.getTime();
    t.speed = Math.max(0.1, multiplier);
  }

  public togglePause(): boolean {
    const t = this.stateManager.getTime();
    t.paused = !t.paused;
    return t.paused;
  }
}
