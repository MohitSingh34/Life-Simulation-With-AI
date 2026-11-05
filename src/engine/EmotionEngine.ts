import { StateManager } from "./StateManager.js";

export class EmotionEngine {
  constructor(private stateManager: StateManager) {}

  public evaluateEmotions(characterId: string): void {
    const char = this.stateManager.getCharacter(characterId);
    if (!char) return;

    const needs = char.needs;
    let stressDelta = 0;
    let happyDelta = 0;

    // Bad needs cause stress and lower happiness
    if (needs.hunger > 70) {
      stressDelta += 10;
      happyDelta -= 10;
    }
    if (needs.energy < 25) {
      stressDelta += 15;
      happyDelta -= 15;
    }
    if (needs.bladder > 75) {
      stressDelta += 20;
    }

    // Good hygiene and well-fed gives contentment
    if (needs.hunger < 30 && needs.energy > 60 && needs.hygiene > 70) {
      happyDelta += 10;
      stressDelta -= 10;
    }

    char.emotions.stress = Math.min(
      100,
      Math.max(0, char.emotions.stress + stressDelta * 0.1)
    );
    char.emotions.happiness = Math.min(
      100,
      Math.max(0, char.emotions.happiness + happyDelta * 0.1)
    );
  }

  public getMoodSummary(characterId: string): string {
    const char = this.stateManager.getCharacter(characterId);
    if (!char) return "Neutral";

    const { happiness, stress } = char.emotions;
    if (stress > 70) return "😫 Overwhelmed & Stressed";
    if (happiness > 80 && stress < 30) return "😊 Cheerful & Content";
    if (happiness > 60) return "😌 Calm & Relaxed";
    if (stress > 50) return "😐 Mildly Anxious";
    return "🙂 Neutral & Steady";
  }
}

