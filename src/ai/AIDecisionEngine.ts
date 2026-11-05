import { StateManager } from "../engine/StateManager.js";
import { ActionEngine } from "../engine/ActionEngine.js";
import { ConfigLoader } from "../engine/ConfigLoader.js";
import { ActionRequest, ActionResult } from "../types/index.js";

export class AIDecisionEngine {
  constructor(
    private stateManager: StateManager,
    private actionEngine: ActionEngine,
    private configLoader: ConfigLoader
  ) {}

  public decideAndExecute(aiCharacterId = "ai_001"): {
    actionName: string;
    result: ActionResult;
    dialogue?: string;
  } | null {
    const ai = this.stateManager.getCharacter(aiCharacterId);
    if (!ai) return null;

    const available = this.actionEngine.getAvailableActions(aiCharacterId);
    if (available.length === 0) return null;

    // Evaluate priorities based on needs
    let chosenActionId: string | null = null;
    let targetObjectId: string | undefined = undefined;

    // 1. Critical Bladder
    if (ai.needs.bladder > 75) {
      if (ai.location.roomId !== "toilet") {
        if (ai.body.posture !== "standing") {
          chosenActionId = "stand_up";
        } else {
          chosenActionId = "walk_to_toilet";
        }
      } else {
        chosenActionId = "use_toilet";
      }
    }
    // 2. Critical Thirst
    else if (ai.needs.thirst > 65) {
      if (ai.location.roomId !== "kitchen") {
        if (ai.body.posture !== "standing") {
          chosenActionId = "stand_up";
        } else {
          chosenActionId = "walk_to_kitchen";
        }
      } else {
        chosenActionId = "fill_glass_water";
        targetObjectId = "drinking_glass_001";
      }
    }
    // 3. Critical Hunger
    else if (ai.needs.hunger > 65) {
      if (ai.location.roomId !== "kitchen") {
        if (ai.body.posture !== "standing") {
          chosenActionId = "stand_up";
        } else {
          chosenActionId = "walk_to_kitchen";
        }
      } else {
        chosenActionId = "cook_meal";
        targetObjectId = "stove_001";
      }
    }
    // 4. Exhausted / Sleepy
    else if (ai.needs.sleepiness > 75 || ai.needs.energy < 25) {
      if (ai.location.roomId !== "bedroom") {
        if (ai.body.posture !== "standing") {
          chosenActionId = "stand_up";
        } else {
          chosenActionId = "walk_to_bedroom";
        }
      } else {
        if (ai.body.posture !== "lying") {
          chosenActionId = "lie_down_bed";
        } else {
          chosenActionId = "sleep";
        }
      }
    }
    // 5. Daily Routine: Study / Work on Computer / Read
    else {
      if (ai.location.roomId === "study_room") {
        if (ai.body.posture === "sitting") {
          const activities = ["use_computer", "read_book"];
          chosenActionId =
            activities[Math.floor(Math.random() * activities.length)];
          if (chosenActionId === "use_computer") {
            targetObjectId = "computer_001";
          }
        } else {
          chosenActionId = "sit_down_study_chair";
        }
      } else if (ai.location.roomId === "bedroom" && ai.body.posture === "lying") {
        chosenActionId = "get_up";
      } else {
        // Walk to study room or explore
        if (ai.body.posture !== "standing") {
          chosenActionId = "stand_up";
        } else {
          chosenActionId = "walk_to_study_room";
        }
      }
    }

    // Verify chosen action is available
    let actionToRun = available.find((a) => a.id === chosenActionId);
    if (!actionToRun) {
      // Fallback: pick any safe available action
      const safe = available.filter(
        (a) => !a.id.includes("sleep") && a.id !== "turn_left" && a.id !== "turn_right"
      );
      actionToRun = safe[Math.floor(Math.random() * safe.length)] || available[0];
    }

    if (!actionToRun) return null;

    const request: ActionRequest = {
      actorId: aiCharacterId,
      actionId: actionToRun.id,
      targetObjectId,
      timestamp: new Date().toISOString(),
    };

    const result = this.actionEngine.executeAction(request);

    // Contextual dialogue if player is in the same room
    let dialogue: string | undefined;
    const player = this.stateManager.getCharacter("player_001");
    if (player && player.location.roomId === ai.location.roomId) {
      if (actionToRun.id === "cook_meal") {
        dialogue = "Aria smiles: 'I'm making fresh lunch! You should have some too.'";
      } else if (actionToRun.id === "use_computer") {
        dialogue = "Aria glances up from the monitors: 'Hey! Found some really cool stuff today.'";
      } else if (actionToRun.id === "drink_water_glass") {
        dialogue = "Aria takes a sip of water: 'Stay hydrated, Jabalpur heat is no joke!'";
      } else if (actionToRun.id === "walk_to_kitchen") {
        dialogue = "Aria walks into the kitchen: 'Heading to grab a bite!'";
      }
    }

    return {
      actionName: actionToRun.name,
      result,
      dialogue,
    };
  }
}

