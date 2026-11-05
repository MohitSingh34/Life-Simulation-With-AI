import {
  ActionRequest,
  ActionResult,
  ActionConfig,
  ActionPrecondition,
} from "../types/index.js";
import { StateManager } from "./StateManager.js";
import { ConfigLoader } from "./ConfigLoader.js";
import { EventManager } from "./EventManager.js";
import { MovementEngine } from "./MovementEngine.js";
import { NeedsEngine } from "./NeedsEngine.js";
import { TimeEngine } from "./TimeEngine.js";

export class ActionEngine {
  constructor(
    private stateManager: StateManager,
    private configLoader: ConfigLoader,
    private eventManager: EventManager,
    private movementEngine: MovementEngine,
    private needsEngine: NeedsEngine,
    private timeEngine: TimeEngine
  ) {}

  public getAvailableActions(characterId: string): ActionConfig[] {
    const char = this.stateManager.getCharacter(characterId);
    if (!char) return [];

    const allActions = this.configLoader.getAllActions();
    const available: ActionConfig[] = [];

    for (const action of allActions) {
      if (this.checkPreconditions(char, action.preconditions, action.id)) {
        available.push(action);
      }
    }

    return available;
  }

  private checkPreconditions(
    char: ReturnType<StateManager["getCharacter"]>,
    pre: ActionPrecondition,
    actionId: string,
    targetObjectId?: string
  ): boolean {
    if (!char) return false;

    // Room match
    if (pre.roomId) {
      const allowedRooms = Array.isArray(pre.roomId) ? pre.roomId : [pre.roomId];
      if (!allowedRooms.includes(char.location.roomId)) {
        return false;
      }
    }

    // Position match
    if (pre.positionId) {
      const allowedPositions = Array.isArray(pre.positionId) ? pre.positionId : [pre.positionId];
      if (!allowedPositions.includes(char.location.positionId)) {
        return false;
      }
    }

    // Posture match
    if (pre.posture) {
      const allowed = Array.isArray(pre.posture) ? pre.posture : [pre.posture];
      if (!allowed.includes(char.body.posture)) {
        return false;
      }
    }

    if (pre.holding !== undefined) {
      if (pre.holding === "any" && !char.holding) return false;
      if (pre.holding === "none" && char.holding) return false;
      if (
        typeof pre.holding === "string" &&
        pre.holding !== "any" &&
        pre.holding !== "none" &&
        char.holding?.objectId !== pre.holding
      ) return false;
    }

    // Special chore & grooming precondition checks
    if (actionId === "wipe_mirror") {
      const mirrorState = this.stateManager.getObjectState(targetObjectId || "mirror_001").state;
      if (mirrorState !== "foggy") {
        return false;
      }
    }

    if (actionId === "sweep_floor") {
      const isHoldingBroom = char.holding?.objectId === "broom_001";
      const broomState = this.stateManager.getObjectState("broom_001");
      const isNearBroom = broomState.roomId === char.location.roomId && !broomState.heldBy;
      if (!isHoldingBroom && !isNearBroom) {
        return false;
      }
    }

    if (actionId === "throw_trash" || actionId === "empty_bin") {
      const currentRoom = char.location.roomId;
      const roomObjects = this.configLoader.getObjectsInRoom(currentRoom);
      const hasBin = roomObjects.some(
        (o) => o.interactions.includes(actionId) || o.id.startsWith("trash_bin")
      );
      if (!hasBin) {
        return false;
      }
    }

    // Bedtime reading check (bedtime_reading or read_book in bedroom)
    if (actionId === "bedtime_reading" || (actionId === "read_book" && char.location.roomId === "bedroom")) {
      if (char.location.positionId !== "bed_center") return false;
      if (char.body.posture !== "lying" && char.body.posture !== "sitting") return false;
      if (!char.holding) return false;
      const heldObj = this.configLoader.getObject(char.holding.objectId);
      const isBook =
        heldObj &&
        (heldObj.interactions.includes("read_book") ||
          heldObj.id.includes("book") ||
          heldObj.id.includes("notebook"));
      if (!isBook) return false;
      const lampState = this.stateManager.getObjectState("lamp_001").state;
      if (lampState !== "on") return false;
    }

    const effectiveTargetId =
      targetObjectId ||
      (actionId === "wipe_mirror" ? "mirror_001" : undefined) ||
      (() => {
        const room = this.configLoader.getRoom(char.location.roomId);
        const pos = room?.positions.find((p) => p.id === char.location.positionId);
        return pos?.objectId ?? undefined;
      })();

    if ((pre.objectState || pre.objectStateNot) && effectiveTargetId) {
      const state = this.stateManager.getObjectState(effectiveTargetId).state;
      if (pre.objectState) {
        const allowedStates = Array.isArray(pre.objectState) ? pre.objectState : [pre.objectState];
        if (!allowedStates.includes(state)) return false;
      }
      if (pre.objectStateNot) {
        const blockedStates = Array.isArray(pre.objectStateNot) ? pre.objectStateNot : [pre.objectStateNot];
        if (blockedStates.includes(state)) return false;
      }
    }

    if (pre.requiredObjectStates) {
      for (const [objId, allowed] of Object.entries(pre.requiredObjectStates)) {
        const state = this.stateManager.getObjectState(objId).state;
        const allowedStates = Array.isArray(allowed) ? allowed : [allowed];
        if (!allowedStates.includes(state)) return false;
      }
    }

    // Movement action check
    if (actionId.startsWith("walk_to_")) {
      const targetRoom = actionId.replace("walk_to_", "");
      const canMove = this.movementEngine.canMoveToRoom(char.id, targetRoom);
      if (!canMove.allowed) return false;
    }

    // Shared room check (requires another character in same room)
    if (pre.requiresSharedRoom) {
      const hasOther = this.stateManager
        .getAllCharacters()
        .some((c) => c.id !== char.id && c.location.roomId === char.location.roomId);
      if (!hasOther) return false;
    }

    return true;
  }

  public validateAction(request: ActionRequest): ActionResult {
    const char = this.stateManager.getCharacter(request.actorId);
    if (!char) {
      return {
        status: "rejected",
        actionId: request.actionId,
        message: "Character not found.",
        reason: "INVALID_ACTOR",
      };
    }

    const action = this.configLoader.getAction(request.actionId);
    if (!action) {
      return {
        status: "rejected",
        actionId: request.actionId,
        message: `Action '${request.actionId}' does not exist in configuration.`,
        reason: "UNKNOWN_ACTION",
      };
    }

    if (!request.targetObjectId && action.requiresTarget) {
      // 1. Check held item
      if (char.holding) {
        const heldObj = this.configLoader.getObject(char.holding.objectId);
        if (heldObj?.interactions.includes(action.id)) {
          request.targetObjectId = heldObj.id;
        }
      }
      // 2. Check position object
      if (!request.targetObjectId) {
        const roomConfig = this.configLoader.getRoom(char.location.roomId);
        const pos = roomConfig?.positions.find((p) => p.id === char.location.positionId);
        if (pos?.objectId) {
          const posObj = this.configLoader.getObject(pos.objectId);
          if (posObj?.interactions.includes(action.id)) {
            request.targetObjectId = posObj.id;
          }
        }
      }
      // 3. Check objects in room
      if (!request.targetObjectId) {
        const roomObjs = this.configLoader.getObjectsInRoom(char.location.roomId);
        const match = roomObjs.find((o) => o.interactions.includes(action.id));
        if (match) {
          request.targetObjectId = match.id;
        }
      }
    }

    const targetObject = request.targetObjectId
      ? this.configLoader.getObject(request.targetObjectId)
      : undefined;
    if (action.requiresTarget && !targetObject) {
      return {
        status: "rejected",
        actionId: request.actionId,
        message: "Choose an object for this action.",
        reason: "MISSING_TARGET",
      };
    }
    if (request.targetObjectId && !targetObject) {
      return {
        status: "rejected",
        actionId: request.actionId,
        message: "That object does not exist.",
        reason: "INVALID_TARGET",
      };
    }
    if (targetObject) {
      const objectState = this.stateManager.getObjectState(targetObject.id);
      const isHeldByActor = objectState.heldBy === char.id;
      if (!targetObject.interactions.includes(action.id)) {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: `${action.name} is not available for ${targetObject.name}.`,
          reason: "INVALID_OBJECT_INTERACTION",
        };
      }
      if ((objectState.roomId ?? targetObject.roomId) !== char.location.roomId && !isHeldByActor) {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: `${targetObject.name} is not within reach.`,
          reason: "TARGET_OUT_OF_REACH",
        };
      }
      if (action.targetTypes) {
        const targetTypes = Array.isArray(targetObject.type) ? targetObject.type : [targetObject.type];
        const matches = targetTypes.some((t) => action.targetTypes!.includes(t));
        if (!matches) {
          return {
            status: "rejected",
            actionId: request.actionId,
            message: `${action.name} cannot be used with ${targetObject.name}.`,
            reason: "INVALID_TARGET_TYPE",
          };
        }
      }
    }

    if (action.preconditions.requiresSharedRoom) {
      const hasOther = this.stateManager
        .getAllCharacters()
        .some((c) => c.id !== char.id && c.location.roomId === char.location.roomId);
      if (!hasOther) {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: "You need to be in the same room as your roommate to do this.",
          reason: "ROOMMATE_NOT_PRESENT",
        };
      }
    }

    // Specific bedroom, wardrobe & reading validations
    if (["change_clothes", "wear_sleepwear", "wear_casual", "wear_work_wear"].includes(action.id)) {
      const wardrobeState = this.stateManager.getObjectState("wardrobe_001").state;
      if (wardrobeState !== "open") {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: "The wardrobe is shut. Open the wardrobe first before changing clothes.",
          reason: "WARDROBE_CLOSED",
        };
      }
    }

    if (action.id === "bedtime_reading" || (action.id === "read_book" && char.location.roomId === "bedroom")) {
      if (char.location.positionId !== "bed_center" || (char.body.posture !== "lying" && char.body.posture !== "sitting")) {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: "You need to be resting or sitting comfortably in bed to read here.",
          reason: "INVALID_POSTURE_OR_POSITION",
        };
      }
      if (!char.holding) {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: "You need to be holding a book to read in bed.",
          reason: "NOT_HOLDING_BOOK",
        };
      }
      const heldObj = this.configLoader.getObject(char.holding.objectId);
      const isBook =
        heldObj &&
        (heldObj.interactions.includes("read_book") ||
          heldObj.id.includes("book") ||
          heldObj.id.includes("notebook"));
      if (!isBook) {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: "The item you are holding is not a readable book.",
          reason: "NOT_A_BOOK",
        };
      }
      const lampState = this.stateManager.getObjectState("lamp_001").state;
      if (lampState !== "on") {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: "It is too dark to read. Turn on the bedside lamp first.",
          reason: "BEDSIDE_LAMP_OFF",
        };
      }
    }

    // Specific chore & grooming validation
    if (action.id === "wipe_mirror") {
      const targetId = request.targetObjectId || "mirror_001";
      const mirrorState = this.stateManager.getObjectState(targetId).state;
      if (mirrorState !== "foggy") {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: "The mirror is already clear. There is no steam to wipe.",
          reason: "PRECONDITIONS_FAILED",
        };
      }
    }

    if (action.id === "sweep_floor") {
      const isHoldingBroom = char.holding?.objectId === "broom_001";
      const broomState = this.stateManager.getObjectState("broom_001");
      const isNearBroom = broomState.roomId === char.location.roomId && !broomState.heldBy;
      if (!isHoldingBroom && !isNearBroom) {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: "You need a broom to sweep the floor. Pick up the broom or be in the room where it is kept.",
          reason: "PRECONDITIONS_FAILED",
        };
      }
    }

    if (action.id === "throw_trash" || action.id === "empty_bin") {
      const currentRoom = char.location.roomId;
      const roomObjects = this.configLoader.getObjectsInRoom(currentRoom);
      const hasBin = roomObjects.some(
        (o) => o.interactions.includes(action.id) || o.id.startsWith("trash_bin")
      );
      if (!hasBin) {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: "There is no trash bin in this room.",
          reason: "NO_TRASH_BIN_IN_ROOM",
        };
      }
    }

    if (!this.checkPreconditions(char, action.preconditions, action.id, targetObject?.id)) {
      return {
        status: "rejected",
        actionId: request.actionId,
        message:
          action.failureMessage ||
          `Preconditions not met for ${action.name}. Your posture is ${char.body.posture} in ${char.location.roomId}.`,
        reason: "PRECONDITIONS_FAILED",
      };
    }

    if (action.effects.pickUp) {
      if (!targetObject?.portable) {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: "This object cannot be carried.",
          reason: "NOT_PORTABLE",
        };
      }
      if (char.holding) {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: "Your hands are full. Put down what you are holding first.",
          reason: "HANDS_FULL",
        };
      }
    }

    if (action.effects.putDown && !char.holding) {
      return {
        status: "rejected",
        actionId: request.actionId,
        message: "You are not holding anything.",
        reason: "NOT_HOLDING_ITEM",
      };
    }

    return {
      status: "accepted",
      actionId: request.actionId,
      message: "Action is valid and executable.",
    };
  }

  public executeAction(request: ActionRequest): ActionResult {
    const validation = this.validateAction(request);
    if (validation.status === "rejected") {
      this.eventManager.recordEvent({
        actorId: request.actorId,
        timestamp: this.timeEngine.getFormattedClock(),
        type: "action_failed",
        data: { actionId: request.actionId, reason: validation.reason },
      });
      return validation;
    }

    const action = this.configLoader.getAction(request.actionId)!;
    const char = this.stateManager.getCharacter(request.actorId)!;
    const effects = action.effects;

    // Apply posture
    if (effects.posture) {
      char.body.posture = effects.posture;
    }

    // Apply orientation
    if (effects.orientation) {
      char.body.orientation = effects.orientation as any;
    }

    // Apply room change
    if (effects.moveToRoom) {
      char.location.roomId = effects.moveToRoom;
      char.location.positionId = effects.moveToPosition || "door_area";
    } else if (effects.moveToPosition) {
      char.location.positionId = effects.moveToPosition;
    }

    // Resolve implicit target if not provided
    let effectiveTargetId = request.targetObjectId;
    if (!effectiveTargetId) {
      if (action.id === "wipe_mirror") {
        effectiveTargetId = "mirror_001";
      } else if (action.id === "put_clothes_in_laundry" || action.id === "empty_laundry") {
        effectiveTargetId = "laundry_basket_001";
      } else if (action.id === "dry_with_towel") {
        effectiveTargetId = "towel_rack_001";
      } else if (action.id === "throw_trash" || action.id === "empty_bin") {
        effectiveTargetId = char.location.roomId === "toilet" ? "trash_bin_toilet_001" : "trash_bin_001";
      }
    }

    // Apply object state change
    if (effectiveTargetId && effects.objectState) {
      const targetState = effects.objectState;
      this.stateManager.updateObjectState(effectiveTargetId, (obj) => {
        obj.state = targetState;
      });
    }

    // Apply multiple object states if specified
    const multiStates = effects.objectStates || (effects as any).specificObjectStates;
    if (multiStates) {
      for (const [objId, newState] of Object.entries(multiStates)) {
        this.stateManager.updateObjectState(objId, (obj) => {
          obj.state = newState as string;
        });
      }
    }

    // Handle shower steam loop: hot shower fogs the mirror
    if (action.id === "take_shower" || action.id === "take_hot_shower") {
      this.stateManager.updateObjectState("mirror_001", (obj) => {
        obj.state = "foggy";
      });
      this.stateManager.updateObjectState("mirror_bathroom_001", (obj) => {
        obj.state = "foggy";
      });
      this.stateManager.updateNarrative({
        player_body: "Freshly showered with warm water droplets glistening on your skin, waiting to dry off."
      });
    }

    // Wiping mirror cleans the steam
    if (action.id === "wipe_mirror") {
      this.stateManager.updateObjectState("mirror_001", (obj) => {
        obj.state = "clear";
      });
      this.stateManager.updateObjectState("mirror_bathroom_001", (obj) => {
        obj.state = "clear";
      });
    }

    // Towel drying leaves character cozy and dry
    if (action.id === "dry_with_towel") {
      this.stateManager.updateNarrative({
        player_body: "Warm, clean, and thoroughly patted dry with a fluffy cotton bath towel."
      });
    }

    // Sweeping floor updates room ambience
    if (action.id === "sweep_floor") {
      this.stateManager.updateNarrative({
        room_ambience: `The floor in the ${char.location.roomId} is freshly swept clean and free of dust.`
      });
    }

    // Laundry updates basket state
    if (action.id === "put_clothes_in_laundry") {
      this.stateManager.updateObjectState("laundry_basket_001", (obj) => {
        obj.state = "has_clothes";
      });
    }

    if (effects.pickUp && request.targetObjectId) {
      char.holding = { objectId: request.targetObjectId, hand: "both" };
      this.stateManager.updateObjectState(request.targetObjectId, (obj) => {
        obj.heldBy = char.id;
      });
    }

    if (effects.putDown && char.holding) {
      const heldId = char.holding.objectId;
      this.stateManager.updateObjectState(heldId, (obj) => {
        obj.heldBy = null;
        obj.roomId = char.location.roomId;
        obj.positionId = char.location.positionId;
      });
      char.holding = null;
    }

    // Apply clothing changes
    if (effects.clothing) {
      char.clothing = {
        ...char.clothing,
        ...effects.clothing,
      };
    }

    // Apply needs, emotions, and personality changes
    if (effects.needChanges) {
      this.needsEngine.applyNeedChanges(char.id, effects.needChanges);
    }
    if (effects.emotionChanges) {
      this.needsEngine.applyNeedChanges(char.id, effects.emotionChanges);
    }
    if (effects.personalityChanges) {
      this.needsEngine.applyNeedChanges(char.id, effects.personalityChanges);
    }

    const companionChanges = effects.roommateChanges || effects.companionNeedChanges;
    if (companionChanges) {
      const companions = this.stateManager.getAllCharacters().filter(
        (c) => c.id !== char.id && c.location.roomId === char.location.roomId
      );
      for (const companion of companions) {
        this.needsEngine.applyNeedChanges(companion.id, companionChanges);
      }
    }

    let message = action.successMessage;

    // Subject-Specific Book Reading Engine
    let bookId = request.targetObjectId || char.holding?.objectId;
    if (!bookId) {
      if (action.id === "read_math_book") bookId = "math_book_001";
      else if (action.id === "read_physics_book") bookId = "physics_book_001";
      else if (action.id === "read_psychology_book") bookId = "psychology_book_001";
      else if (action.id === "read_mohit_notebook") bookId = "mohit_notebook_001";
      else if (action.id === "read_aria_notebook") bookId = "aria_notebook_001";
    }

    if (action.id === "read_book") {
      if (bookId === "math_book_001") {
        this.needsEngine.applyNeedChanges(char.id, {
          studiousness: 15,
          energy: 10,
          boredom: -10,
        });
        message = "You work through calculus problems and matrix transformations. The equations click into place with clear logic (+15 studiousness, +5 mental energy, -10 boredom).";
      } else if (bookId === "physics_book_001") {
        this.needsEngine.applyNeedChanges(char.id, {
          studiousness: 15,
          energy: 5,
          boredom: -10,
        });
        message = "You study classical mechanics and thermodynamics, diagramming force vectors and thermodynamic cycles (+15 studiousness, -10 boredom).";
      } else if (bookId === "psychology_book_001") {
        this.needsEngine.applyNeedChanges(char.id, {
          sociability: 15,
          energy: 5,
          stress: -10,
        });
        message = "You read insightful passages on cognitive empathy, perception, and human behavior, gaining a richer understanding of people (+15 sociability, -10 stress).";
      } else if (bookId === "mohit_notebook_001") {
        this.needsEngine.applyNeedChanges(char.id, {
          happiness: 10,
          energy: 5,
          stress: -15,
        });
        message = "You flip through your personal journal, revisiting sketches, reflections, and future goals. A reassuring calm sets in (+10 happiness, -15 stress).";
      } else if (bookId === "aria_notebook_001") {
        const aria = this.stateManager.getCharacter("ai_001");
        const ariaInRoom = aria && aria.location.roomId === char.location.roomId;
        if (ariaInRoom) {
          this.needsEngine.applyNeedChanges(char.id, { stress: 30, energy: 5 });
          this.needsEngine.applyNeedChanges(aria.id, { stress: 25, happiness: -20 });
          message = "You open Aria's private notebook, but she immediately notices! Her face flushes with indignation: 'Mohit! That’s my private notebook! What are you doing?!' Friction and tension spike in the room (+30 stress).";
          this.eventManager.recordEvent({
            actorId: char.id,
            timestamp: this.timeEngine.getFormattedClock(),
            type: "roommate_friction",
            data: { reason: "read_aria_notebook_caught", room: char.location.roomId },
          });
        } else {
          this.needsEngine.applyNeedChanges(char.id, { stress: 20, energy: 5 });
          message = "You secretly peek into Aria's notebook. A sharp knot of guilt tightens in your chest—this feels like an invasion of personal boundaries (+20 stress).";
          this.eventManager.recordEvent({
            actorId: char.id,
            timestamp: this.timeEngine.getFormattedClock(),
            type: "emotion_changed",
            data: { reason: "read_aria_notebook_secret", room: char.location.roomId },
          });
        }
      }
    } else if (action.id === "read_aria_notebook") {
      const aria = this.stateManager.getCharacter("ai_001");
      const ariaInRoom = aria && aria.location.roomId === char.location.roomId;
      if (ariaInRoom) {
        this.needsEngine.applyNeedChanges(char.id, { stress: 10 });
        this.needsEngine.applyNeedChanges(aria.id, { stress: 25, happiness: -20 });
        message = "You open Aria's private notebook, but she immediately notices! Her face flushes with indignation: 'Mohit! That’s my private notebook! What are you doing?!' Friction and tension spike in the room (+30 stress).";
        this.eventManager.recordEvent({
          actorId: char.id,
          timestamp: this.timeEngine.getFormattedClock(),
          type: "roommate_friction",
          data: { reason: "read_aria_notebook_caught", room: char.location.roomId },
        });
      } else {
        message = "You secretly peek into Aria's notebook. A sharp knot of guilt tightens in your chest—this feels like an invasion of personal boundaries (+20 stress).";
        this.eventManager.recordEvent({
          actorId: char.id,
          timestamp: this.timeEngine.getFormattedClock(),
          type: "emotion_changed",
          data: { reason: "read_aria_notebook_secret", room: char.location.roomId },
        });
      }
    }

    if (!this.timeEngine.usesWallClock()) {
      const durationSec = action.duration || 2;
      const timeProgress = this.timeEngine.advanceTime(durationSec);
      this.needsEngine.tick(timeProgress.minutesPassed);
    }

    // Record completed event
    this.eventManager.recordEvent({
      actorId: request.actorId,
      timestamp: this.timeEngine.getFormattedClock(),
      type: "action_completed",
      data: {
        actionId: action.id,
        actionName: action.name,
        room: char.location.roomId,
        position: char.location.positionId,
        posture: char.body.posture,
      },
    });

    return {
      status: "accepted",
      actionId: action.id,
      message,
      changes: {
        location: char.location,
        posture: char.body.posture,
        needs: char.needs,
        emotions: char.emotions,
        personality: char.personality,
      },
    };
  }
}
