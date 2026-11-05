import { StateManager } from "../engine/StateManager.js";
import { ActionEngine } from "../engine/ActionEngine.js";
import { ConfigLoader } from "../engine/ConfigLoader.js";
import { MovementEngine } from "../engine/MovementEngine.js";
import { TimeEngine } from "../engine/TimeEngine.js";
import { ActionRequest, ActionResult, ActionConfig } from "../types/index.js";

export class AIDecisionEngine {
  constructor(
    private stateManager: StateManager,
    private actionEngine: ActionEngine,
    private configLoader: ConfigLoader,
    private movementEngine?: MovementEngine,
    private timeEngine?: TimeEngine
  ) {}

  public decideAndExecute(aiCharacterId = "ai_001"): {
    actionName: string;
    result: ActionResult;
    dialogue?: string;
  } | null {
    const ai = this.stateManager.getCharacter(aiCharacterId);
    if (!ai) return null;
    const player = this.stateManager.getCharacter("player_001");

    const available = this.actionEngine.getAvailableActions(aiCharacterId);
    if (available.length === 0) return null;

    const currentRoom = ai.location.roomId;
    const timeOfDay = this.timeEngine?.getTimeOfDay() || "afternoon";
    const simHour = this.stateManager.getTime().hour;

    let chosenActionId: string | null = null;
    let targetObjectId: string | undefined = undefined;

    // Helper: Step towards a target room using BFS pathfinding if available
    const stepTowardsRoom = (targetRoomId: string): string | null => {
      if (currentRoom === targetRoomId) return null;

      // Must be standing to walk
      if (ai.body.posture !== "standing") {
        return ai.body.posture === "lying" ? "get_up" : "stand_up";
      }

      // Check direct connectivity or BFS
      if (this.movementEngine) {
        const path = this.movementEngine.findPathToRoom(currentRoom, targetRoomId);
        if (path && path.length > 0) {
          const nextRoom = path[0];
          return `walk_to_${nextRoom}`;
        }
      }

      // Fallback direct walk attempt
      return `walk_to_${targetRoomId}`;
    };

    // ============================================================
    // 1. Critical Needs Priority (Biological Survival)
    // ============================================================

    // A. Urgent Bladder (> 70)
    if (ai.needs.bladder > 70) {
      if (currentRoom !== "toilet") {
        chosenActionId = stepTowardsRoom("toilet");
      } else {
        const toiletState = this.stateManager.getObjectState("toilet_fixture_001")?.state;
        if (toiletState === "needs_flush") {
          chosenActionId = "flush_toilet";
        } else {
          chosenActionId = "use_toilet";
        }
      }
    }
    // B. Critical Thirst (> 60)
    else if (ai.needs.thirst > 60) {
      if (currentRoom !== "kitchen") {
        chosenActionId = stepTowardsRoom("kitchen");
      } else {
        const glassState = this.stateManager.getObjectState("drinking_glass_001")?.state;
        if (glassState === "filled_water" || glassState === "half") {
          chosenActionId = "drink_water_glass";
          targetObjectId = "drinking_glass_001";
        } else {
          chosenActionId = "fill_glass_water";
          targetObjectId = "drinking_glass_001";
        }
      }
    }
    // C. Critical Hunger (> 60)
    else if (ai.needs.hunger > 60) {
      if (currentRoom !== "kitchen") {
        chosenActionId = stepTowardsRoom("kitchen");
      } else {
        const stoveState = this.stateManager.getObjectState("stove_001")?.state;
        if (stoveState === "cooking") {
          chosenActionId = "eat_meal";
        } else if (stoveState === "on") {
          chosenActionId = "cook_meal";
          targetObjectId = "stove_001";
        } else {
          // Quick snack or ignite stove
          const options = ["get_food_from_fridge", "prepare_snack", "turn_on_stove"];
          chosenActionId = options[Math.floor(Math.random() * options.length)];
          if (chosenActionId === "turn_on_stove") targetObjectId = "stove_001";
        }
      }
    }
    // D. Exhaustion / Sleepiness (> 75 or Energy < 25)
    else if (ai.needs.sleepiness > 75 || ai.needs.energy < 25) {
      if (currentRoom !== "bedroom") {
        chosenActionId = stepTowardsRoom("bedroom");
      } else {
        if (ai.body.posture !== "lying") {
          chosenActionId = ai.body.posture === "sitting" ? "lie_down_bed" : "sit_down_bed";
        } else {
          chosenActionId = (simHour >= 21 || simHour < 6) ? "sleep" : "nap";
        }
      }
    }
    // E. Hygiene Refresh (< 35)
    else if (ai.needs.hygiene < 35) {
      if (currentRoom !== "toilet") {
        chosenActionId = stepTowardsRoom("toilet");
      } else {
        chosenActionId = ai.body.posture === "standing" ? "take_shower" : "wash_face";
      }
    }

    // ============================================================
    // 2. Daily Life Routines & Time-of-Day Rhythms
    // ============================================================
    else {
      switch (timeOfDay) {
        case "morning": // 06:00 - 12:00
          if (currentRoom === "bedroom" && ai.body.posture === "lying") {
            chosenActionId = "get_up";
          } else if (currentRoom === "bedroom" && Math.random() < 0.5) {
            chosenActionId = "make_bed";
          } else if (currentRoom !== "study_room" && currentRoom !== "kitchen") {
            chosenActionId = stepTowardsRoom(Math.random() < 0.6 ? "study_room" : "kitchen");
          } else if (currentRoom === "kitchen") {
            if (player && player.location.roomId === "kitchen" && Math.random() < 0.4) {
              chosenActionId = "offer_chai";
            } else {
              chosenActionId = Math.random() < 0.5 ? "fill_glass_water" : "stretch_body";
            }
          } else {
            // In study room
            if (ai.body.posture !== "sitting") {
              chosenActionId = "sit_down_study_chair";
            } else {
              if (player && player.location.roomId === "study_room" && Math.random() < 0.35) {
                const socialStudy = ["discuss_book", "discuss_code", "ask_about_day", "play_chess"];
                chosenActionId = socialStudy[Math.floor(Math.random() * socialStudy.length)];
              } else {
                const studyRoutines = [
                  "code_project",
                  "use_computer",
                  "read_psychology_book",
                  "read_book",
                  "listen_lofi_music",
                  "journal_notes",
                  "browse_books"
                ];
                chosenActionId = studyRoutines[Math.floor(Math.random() * studyRoutines.length)];
                if (chosenActionId === "use_computer" || chosenActionId === "code_project") targetObjectId = "computer_001";
                if (chosenActionId === "read_psychology_book") targetObjectId = "psychology_book_001";
                if (chosenActionId === "browse_books") targetObjectId = "bookshelf_001";
              }
            }
          }
          break;

        case "afternoon": // 12:00 - 17:00
          if (currentRoom !== "study_room") {
            chosenActionId = stepTowardsRoom("study_room");
          } else {
            if (ai.body.posture !== "sitting") {
              chosenActionId = "sit_down_study_chair";
            } else {
              if (player && player.location.roomId === "study_room" && Math.random() < 0.35) {
                const socialOptions = ["play_chess", "discuss_book", "discuss_code", "ask_about_day"];
                chosenActionId = socialOptions[Math.floor(Math.random() * socialOptions.length)];
              } else {
                const afternoonRoutines = [
                  "code_project",
                  "use_computer",
                  "read_psychology_book",
                  "read_book",
                  "listen_lofi_music",
                  "browse_web",
                  "view_photos",
                  "tidy_desk"
                ];
                chosenActionId = afternoonRoutines[Math.floor(Math.random() * afternoonRoutines.length)];
                if (chosenActionId === "use_computer" || chosenActionId === "code_project" || chosenActionId === "browse_web" || chosenActionId === "view_photos") targetObjectId = "computer_001";
                if (chosenActionId === "read_psychology_book") targetObjectId = "psychology_book_001";
                if (chosenActionId === "browse_books") targetObjectId = "bookshelf_001";
                if (chosenActionId === "tidy_desk") targetObjectId = "desk_001";
              }
            }
          }
          break;

        case "evening": // 17:00 - 21:00
          if (player && player.location.roomId === currentRoom && Math.random() < 0.4) {
            if (currentRoom === "kitchen") {
              chosenActionId = "offer_chai";
            } else if (currentRoom === "study_room") {
              chosenActionId = Math.random() < 0.5 ? "play_chess" : "ask_about_day";
            } else {
              chosenActionId = "ask_about_day";
            }
          } else if (currentRoom === "study_room" && ai.body.posture === "sitting") {
            chosenActionId = "stand_up";
          } else if (currentRoom !== "kitchen" && Math.random() < 0.6) {
            chosenActionId = stepTowardsRoom("kitchen");
          } else if (currentRoom === "kitchen") {
            const eveningKitchen = ["prepare_snack", "wash_hands_kitchen", "tidy_room", "stretch_body"];
            chosenActionId = eveningKitchen[Math.floor(Math.random() * eveningKitchen.length)];
          } else {
            const leisure = ["meditate", "stretch_body", "tidy_room"];
            chosenActionId = leisure[Math.floor(Math.random() * leisure.length)];
          }
          break;

        case "night": // 21:00 - 06:00
          if (currentRoom !== "bedroom") {
            chosenActionId = stepTowardsRoom("bedroom");
          } else {
            if (ai.body.posture !== "lying") {
              chosenActionId = ai.body.posture === "sitting" ? "lie_down_bed" : "sit_down_bed";
            } else {
              chosenActionId = "sleep";
            }
          }
          break;
      }
    }

    // ============================================================
    // 3. Action Validation & Safe Fallback
    // ============================================================
    let actionToRun: ActionConfig | undefined;
    if (chosenActionId) {
      actionToRun = available.find((a) => a.id === chosenActionId);
    }

    if (!actionToRun) {
      // Filter out high-friction or non-ambient actions for fallback
      const safe = available.filter(
        (a) =>
          !a.id.includes("sleep") &&
          a.id !== "turn_left" &&
          a.id !== "turn_right" &&
          a.id !== "use_toilet"
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

    // ============================================================
    // 4. Roommate Proximity & Reactive Dialogue
    // ============================================================
    let dialogue: string | undefined;
    if (player && player.location.roomId === ai.location.roomId) {
      if (actionToRun.id === "cook_meal") {
        dialogue = "Aria smiles softly: 'Making something warm. Want a plate when it's done?'";
      } else if (actionToRun.id === "use_computer") {
        dialogue = "Aria glances over: 'Deep into work today. Hope I'm not clicking the keys too loud.'";
      } else if (actionToRun.id === "code_project") {
        dialogue = "Aria watches the clean code scrolling: 'Nice architectural structure! Building things from scratch always feels rewarding.'";
      } else if (actionToRun.id === "listen_lofi_music") {
        dialogue = "Aria smiles and bobs her head slightly to the beat: 'Love this lo-fi track. Makes the whole study room feel so serene.'";
      } else if (actionToRun.id === "offer_chai") {
        dialogue = "Aria cradles the warm chai cup: 'Ah, this smells heavenly. You make the best masala chai, Mohit!'";
      } else if (actionToRun.id === "ask_about_day") {
        dialogue = "Aria leans back thoughtfully: 'It's been a really nice, grounded day. Peaceful moments and getting lost in good books.'";
      } else if (actionToRun.id === "play_chess") {
        dialogue = "Aria smiles warmly across the board: 'Classic pawn opening! Let's see what tactical tricks you've got up your sleeve.'";
      } else if (actionToRun.id === "discuss_book" || actionToRun.id === "read_psychology_book") {
        dialogue = "Aria leans forward eagerly: 'The psychology chapters on shared emotional resonance are brilliant. What did you think?'";
      } else if (actionToRun.id === "discuss_code") {
        dialogue = "Aria points to the screen: 'If you decouple the state machine from the render loop, your updates will be lightning fast!'";
      } else if (actionToRun.id === "read_math_book") {
        dialogue = "Aria smiles: 'Calculus problem sets? Always satisfying when the derivatives and integrals simplify out.'";
      } else if (actionToRun.id === "read_physics_book") {
        dialogue = "Aria nods: 'Thermodynamics is like life—entropy always increases unless we put conscious energy into it.'";
      } else if (actionToRun.id === "read_mohit_notebook") {
        dialogue = "Aria glances over with a soft smile: 'Sketching out ideas? Keep at it, your creative projects are really cool.'";
      } else if (actionToRun.id === "drink_water_glass" || actionToRun.id === "sip_water_glass") {
        dialogue = "Aria sips her water: 'Remember to drink water, Jabalpur air gets dry.'";
      } else if (actionToRun.id === "walk_to_kitchen") {
        dialogue = "Aria steps into the kitchen: 'Heading to grab something to drink.'";
      } else if (actionToRun.id === "walk_to_study_room") {
        dialogue = "Aria walks into the study: 'Need to get some reading done.'";
      } else if (actionToRun.id === "make_bed") {
        dialogue = "Aria straightens the sheets: 'A tidy room makes a tidy mind, don't you think?'";
      } else if (actionToRun.id === "meditate") {
        dialogue = "Aria takes a slow, deep breath, resting in quiet stillness.";
      } else if (actionToRun.id === "walk_to_living_room") {
        dialogue = "Aria walks into the living room: 'It's nice and open in here.'";
      } else if (actionToRun.id === "walk_to_balcony") {
        dialogue = "Aria steps out onto the balcony: 'The breeze feels wonderful out here.'";
      } else if (actionToRun.id === "sit_on_sofa") {
        dialogue = "Aria settles onto the sofa cushions: 'So comfortable to sit down for a bit.'";
      } else if (actionToRun.id === "water_plants") {
        dialogue = "Aria sprinkles water onto the planters: 'The plants look so vibrant and green.'";
      } else if (actionToRun.id === "play_music_speaker") {
        dialogue = "Aria starts up the soundbar: 'A little music always brightens the room.'";
      } else if (actionToRun.id === "lean_on_balcony_railing") {
        dialogue = "Aria looks out over the street: 'The Jabalpur weather is really peaceful today.'";
      }
    }

    return {
      actionName: actionToRun.name,
      result,
      dialogue,
    };
  }
}
