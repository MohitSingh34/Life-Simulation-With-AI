import { StateManager } from "../engine/StateManager.js";
import { ActionEngine } from "../engine/ActionEngine.js";
import { ConfigLoader } from "../engine/ConfigLoader.js";
import { MovementEngine } from "../engine/MovementEngine.js";
import { TimeEngine } from "../engine/TimeEngine.js";
import { ActionRequest, ActionResult, ActionConfig } from "../types/index.js";

export class AIDecisionEngine {
  private recentActions: string[] = [];

  constructor(
    private stateManager: StateManager,
    private actionEngine: ActionEngine,
    private configLoader: ConfigLoader,
    private movementEngine?: MovementEngine,
    private timeEngine?: TimeEngine
  ) {}

  public decideAndExecute(aiCharacterId = "ai_001"): {
    actionName: string;
    actionId: string;
    result: ActionResult;
    dialogue?: string;
    reasoning?: string;
  } | null {
    const ai = this.stateManager.getCharacter(aiCharacterId);
    if (!ai) return null;
    const player = this.stateManager.getCharacter("player_001");

    // Retrieve live, dynamically validated available actions
    const available = this.actionEngine.getAvailableActions(aiCharacterId);
    if (available.length === 0) return null;

    const currentRoom = ai.location.roomId;
    let chosenActionId: string | null = null;
    let targetObjectId: string | undefined = undefined;
    let reasoning = "Daily life autonomous initiative";

    // Helper: Step towards a target room using BFS pathfinding if available
    const stepTowardsRoom = (targetRoomId: string): string | null => {
      if (currentRoom === targetRoomId) return null;

      // Must be standing to walk
      if (ai.body.posture !== "standing") {
        return ai.body.posture === "lying" ? "get_up" : "stand_up";
      }

      // Check BFS path
      if (this.movementEngine) {
        const path = this.movementEngine.findPathToRoom(currentRoom, targetRoomId);
        if (path && path.length > 0) {
          const nextRoom = path[0];
          return `walk_to_${nextRoom}`;
        }
      }

      return `walk_to_${targetRoomId}`;
    };

    // ============================================================
    // 1. Biological Priority Checks (Vital Needs)
    // ============================================================

    // A. Urgent Bladder (> 65)
    if (ai.needs.bladder > 65) {
      reasoning = "Relieving bladder pressure";
      if (currentRoom !== "toilet") {
        chosenActionId = stepTowardsRoom("toilet");
      } else {
        const toiletState = this.stateManager.getObjectState("toilet_fixture_001")?.state;
        chosenActionId = toiletState === "needs_flush" ? "flush_toilet" : "use_toilet";
      }
    }
    // B. Critical Thirst (> 55)
    else if (ai.needs.thirst > 55) {
      reasoning = "Satisfying thirst";
      if (currentRoom !== "kitchen") {
        chosenActionId = stepTowardsRoom("kitchen");
      } else {
        const glassState = this.stateManager.getObjectState("drinking_glass_001")?.state;
        const chaiState = this.stateManager.getObjectState("chai_cup_001")?.state;
        if (chaiState === "steaming_chai") {
          chosenActionId = "drink_hot_chai";
          targetObjectId = "chai_cup_001";
        } else if (glassState === "filled_water" || glassState === "half") {
          chosenActionId = "drink_water_glass";
          targetObjectId = "drinking_glass_001";
        } else {
          chosenActionId = "fill_glass_water";
          targetObjectId = "drinking_glass_001";
        }
      }
    }
    // C. Critical Hunger (> 55)
    else if (ai.needs.hunger > 55) {
      reasoning = "Satisfying hunger with food";
      if (currentRoom !== "kitchen") {
        chosenActionId = stepTowardsRoom("kitchen");
      } else {
        const plateState = this.stateManager.getObjectState("plate_001")?.state;
        const stoveState = this.stateManager.getObjectState("stove_001")?.state;
        if (plateState === "with_food") {
          chosenActionId = "eat_meal_from_plate";
          targetObjectId = "plate_001";
        } else if (stoveState === "cooking") {
          chosenActionId = "serve_meal";
          targetObjectId = "plate_001";
        } else {
          // Choose between breakfast or meal or snack
          const cookingOptions = ["cook_breakfast", "cook_meal", "prepare_snack"];
          const availableCooking = cookingOptions.filter((id) => available.some((a) => a.id === id));
          if (availableCooking.length > 0) {
            chosenActionId = availableCooking[Math.floor(Math.random() * availableCooking.length)];
            targetObjectId = "stove_001";
          }
        }
      }
    }
    // D. Exhaustion / Sleepiness (> 75 or Energy < 25)
    else if (ai.needs.sleepiness > 75 || ai.needs.energy < 25) {
      reasoning = "Resting tired body";
      if (currentRoom !== "bedroom") {
        chosenActionId = stepTowardsRoom("bedroom");
      } else {
        if (ai.body.posture !== "lying") {
          chosenActionId = ai.body.posture === "sitting" ? "lie_down_bed" : "sit_down_bed";
        } else {
          const simHour = this.stateManager.getTime().hour;
          chosenActionId = (simHour >= 21 || simHour < 6) ? "sleep" : "nap";
        }
      }
    }
    // E. Hygiene (< 35)
    else if (ai.needs.hygiene < 35) {
      reasoning = "Refreshing hygiene";
      if (currentRoom !== "toilet") {
        chosenActionId = stepTowardsRoom("toilet");
      } else {
        chosenActionId = ai.body.posture === "standing" ? "take_shower" : "wash_face";
      }
    }

    // ============================================================
    // 2. Dynamic Goal-Utility Engine (No Preconfigured Schedule!)
    // ============================================================
    if (!chosenActionId) {
      const inSameRoomAsPlayer = player && player.location.roomId === currentRoom;
      const personality = ai.personality || {
        studiousness: 70,
        sociability: 60,
        tidiness: 65,
        laziness: 35,
        foodLove: 50,
      };

      // Score all currently valid and available actions
      const scoredActions: { action: ActionConfig; score: number }[] = [];

      for (const act of available) {
        // Skip repetitive low-value mechanical turns
        if (act.id === "turn_left" || act.id === "turn_right") continue;

        let score = 20; // Base score

        // 1. Need improvement utility
        const needs = act.effects?.needChanges || {};
        if (needs.hunger && needs.hunger < 0) score += Math.abs(needs.hunger) * (ai.needs.hunger / 40);
        if (needs.thirst && needs.thirst < 0) score += Math.abs(needs.thirst) * (ai.needs.thirst / 40);
        if (needs.energy && needs.energy > 0) score += needs.energy * ((100 - ai.needs.energy) / 40);
        if (needs.sleepiness && needs.sleepiness < 0) score += Math.abs(needs.sleepiness) * (ai.needs.sleepiness / 40);
        if (needs.hygiene && needs.hygiene > 0) score += needs.hygiene * ((100 - ai.needs.hygiene) / 40);
        if (needs.stress && needs.stress < 0) score += Math.abs(needs.stress) * (ai.emotions.stress / 25);
        if (needs.happiness && needs.happiness > 0) score += needs.happiness * 1.5;

        // 2. Personality-driven alignment
        // Studiousness: books, code, computer, study
        if (
          act.id.includes("book") ||
          act.id.includes("code") ||
          act.id.includes("computer") ||
          act.id.includes("journal") ||
          act.id === "tidy_desk"
        ) {
          score += (personality.studiousness / 100) * 45;
        }

        // Sociability: roommate social actions
        if (
          act.id === "discuss_book" ||
          act.id === "discuss_code" ||
          act.id === "offer_chai" ||
          act.id === "ask_about_day" ||
          act.id === "play_chess"
        ) {
          if (inSameRoomAsPlayer) {
            score += (personality.sociability / 100) * 55;
          } else {
            score -= 100; // Cannot socialize in different rooms
          }
        }

        // Tidiness: chores and cleaning
        if (
          act.id === "make_bed" ||
          act.id === "wipe_counter" ||
          act.id === "wipe_mirror" ||
          act.id === "wash_dishes" ||
          act.id === "tidy_room" ||
          act.id === "sweep_floor"
        ) {
          score += (personality.tidiness / 100) * 35;
        }

        // Laziness / Relaxation: sofa, balcony, tea
        if (
          act.id === "sit_on_sofa" ||
          act.id === "relax_on_sofa" ||
          act.id === "sit_on_cane_chair" ||
          act.id === "lean_on_balcony_railing" ||
          act.id === "meditate" ||
          act.id === "watch_tv"
        ) {
          score += (personality.laziness / 100) * 35;
        }

        // Food & Chai love
        if (
          act.id.includes("chai") ||
          act.id.includes("tea") ||
          act.id.includes("snack") ||
          act.id.includes("cook") ||
          act.id === "pinch_spices"
        ) {
          score += (personality.foodLove / 100) * 40;
        }

        // Room wandering & exploration
        if (act.id.startsWith("walk_to_")) {
          // Moderate score to encourage moving around rooms naturally
          score += 15;
        }

        // Recency penalty: avoid immediately repeating recent actions
        const recencyIndex = this.recentActions.indexOf(act.id);
        if (recencyIndex !== -1) {
          score -= 50 / (recencyIndex + 1);
        }

        // Add small human spontaneity jitter
        score += (Math.random() * 10 - 5);

        scoredActions.push({ action: act, score });
      }

      scoredActions.sort((a, b) => b.score - a.score);
      if (scoredActions.length > 0) {
        chosenActionId = scoredActions[0].action.id;
        reasoning = `Autonomous decision (Utility Score: ${Math.round(scoredActions[0].score)})`;
      }
    }

    // ============================================================
    // 3. Execution & Validation
    // ============================================================
    let actionToRun: ActionConfig | undefined;
    if (chosenActionId) {
      actionToRun = available.find((a) => a.id === chosenActionId);
    }

    if (!actionToRun) {
      // Safe fallback from available
      const safe = available.filter((a) => !a.id.includes("sleep") && a.id !== "turn_left" && a.id !== "turn_right");
      actionToRun = safe[Math.floor(Math.random() * safe.length)] || available[0];
    }

    if (!actionToRun) return null;

    // Track in recent actions queue (last 5 actions)
    this.recentActions.unshift(actionToRun.id);
    if (this.recentActions.length > 5) this.recentActions.pop();

    const request: ActionRequest = {
      actorId: aiCharacterId,
      actionId: actionToRun.id,
      targetObjectId,
      timestamp: new Date().toISOString(),
    };

    const result = this.actionEngine.executeAction(request);

    // ============================================================
    // 4. Roommate Proximity & Reactive Dialogue
    // ============================================================
    let dialogue: string | undefined;
    if (player && player.location.roomId === ai.location.roomId) {
      if (actionToRun.id === "cook_meal" || actionToRun.id === "cook_breakfast") {
        dialogue = "Aria smiles softly: 'Making something warm. Want a plate when it's done?'";
      } else if (actionToRun.id === "use_computer") {
        dialogue = "Aria glances over: 'Deep into work today. Hope I'm not clicking the keys too loud.'";
      } else if (actionToRun.id === "code_project") {
        dialogue = "Aria watches the clean code scrolling: 'Nice architectural structure! Building things from scratch always feels rewarding.'";
      } else if (actionToRun.id === "listen_lofi_music") {
        dialogue = "Aria smiles and bobs her head slightly to the beat: 'Love this lo-fi track. Makes the study room feel so serene.'";
      } else if (actionToRun.id === "offer_chai" || actionToRun.id === "brew_chai_duo") {
        dialogue = "Aria cradles the warm chai cup: 'Ah, this smells heavenly. Nothing beats fresh hot chai!'";
      } else if (actionToRun.id === "ask_about_day") {
        dialogue = "Aria leans back thoughtfully: 'It's been a really nice, grounded day. Peaceful moments and getting lost in good books.'";
      } else if (actionToRun.id === "play_chess") {
        dialogue = "Aria smiles warmly across the board: 'Classic pawn opening! Let's see what tactical tricks you've got up your sleeve.'";
      } else if (actionToRun.id === "discuss_book" || actionToRun.id === "read_psychology_book") {
        dialogue = "Aria leans forward eagerly: 'The psychology chapters on shared emotional resonance are brilliant. What did you think?'";
      } else if (actionToRun.id === "discuss_code") {
        dialogue = "Aria points to the screen: 'If you decouple the state machine from the render loop, your updates will be lightning fast!'";
      } else if (actionToRun.id === "drink_water_glass" || actionToRun.id === "drink_hot_chai") {
        dialogue = "Aria takes a comforting sip: 'Remember to stay hydrated, Jabalpur air gets dry.'";
      } else if (actionToRun.id === "walk_to_kitchen") {
        dialogue = "Aria steps into the kitchen: 'Heading to grab something from the kitchen.'";
      } else if (actionToRun.id === "walk_to_study_room") {
        dialogue = "Aria walks into the study: 'Need to get some reading done.'";
      } else if (actionToRun.id === "make_bed") {
        dialogue = "Aria straightens the sheets: 'A tidy room makes a tidy mind, don't you think?'";
      } else if (actionToRun.id === "walk_to_living_room") {
        dialogue = "Aria walks into the living room: 'It's nice and open in here.'";
      } else if (actionToRun.id === "walk_to_balcony") {
        dialogue = "Aria steps out onto the balcony: 'The breeze feels wonderful out here.'";
      } else if (actionToRun.id === "sit_on_sofa") {
        dialogue = "Aria settles onto the sofa cushions: 'So comfortable to sit down for a bit.'";
      } else if (actionToRun.id === "water_plants") {
        dialogue = "Aria sprinkles water onto the planters: 'The plants look so vibrant and green.'";
      }
    }

    return {
      actionName: actionToRun.name,
      actionId: actionToRun.id,
      result,
      dialogue,
      reasoning,
    };
  }
}
