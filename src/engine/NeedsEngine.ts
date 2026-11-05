import { StateManager } from "./StateManager.js";
import { ConfigLoader } from "./ConfigLoader.js";
import { CharacterNeeds } from "../types/index.js";

export class NeedsEngine {
  constructor(
    private stateManager: StateManager,
    private configLoader: ConfigLoader
  ) {}

  public tick(minutesPassed: number): string[] {
    if (minutesPassed <= 0) return [];
    const alerts: string[] = [];
    const needConfigs = this.configLoader.getNeedConfigs();

    for (const char of this.stateManager.getAllCharacters()) {
      const isSleeping = char.activity.current === "sleep";
      const isResting = char.body.posture === "lying" || isSleeping;

      for (const nc of needConfigs) {
        let rate = nc.decayPerMinute;
        if (isSleeping) {
          if (nc.id === "energy") rate = 0.4; // Gain energy fast while sleeping
          if (nc.id === "sleepiness") rate = -0.5; // Lose sleepiness fast
          if (nc.id === "hunger") rate = 0.03; // Slower hunger gain
          if (nc.id === "thirst") rate = 0.04;
        } else if (isResting) {
          if (nc.id === "energy") rate = 0.1;
          if (nc.id === "sleepiness") rate = -0.05;
        }

        const delta = rate * minutesPassed;
        this.adjustNeed(char.needs, nc.id, delta);
      }

      if (char.type === "human") {
        alerts.push(...this.checkAlerts(char.needs));
      }
    }

    return alerts;
  }

  private adjustNeed(
    needs: CharacterNeeds,
    needId: keyof CharacterNeeds,
    delta: number
  ): void {
    const current = needs[needId];
    const updated = Math.min(100, Math.max(0, current + delta));
    needs[needId] = Math.round(updated * 10) / 10;
  }

  public applyNeedChanges(
    characterId: string,
    changes?: Partial<Record<string, number>>
  ): void {
    if (!changes) return;
    const char = this.stateManager.getCharacter(characterId);
    if (!char) return;

    for (const [key, delta] of Object.entries(changes)) {
      if (delta !== undefined && key in char.needs) {
        this.adjustNeed(char.needs, key as keyof CharacterNeeds, delta);
      }
    }
  }

  public checkAlerts(needs: CharacterNeeds): string[] {
    const alerts: string[] = [];
    const needConfigs = this.configLoader.getNeedConfigs();

    for (const nc of needConfigs) {
      const val = needs[nc.id];
      if (nc.id === "energy" || nc.id === "hygiene") {
        // Lower is worse
        if (val <= nc.criticalThreshold) {
          alerts.push(`🚨 CRITICAL: ${nc.criticalMessage}`);
        } else if (val <= nc.warningThreshold) {
          alerts.push(`⚠️ WARNING: ${nc.warningMessage}`);
        }
      } else {
        // Higher is worse (hunger, thirst, sleepiness, bladder)
        if (val >= nc.criticalThreshold) {
          alerts.push(`🚨 CRITICAL: ${nc.criticalMessage}`);
        } else if (val >= nc.warningThreshold) {
          alerts.push(`⚠️ WARNING: ${nc.warningMessage}`);
        }
      }
    }

    return alerts;
  }
}

