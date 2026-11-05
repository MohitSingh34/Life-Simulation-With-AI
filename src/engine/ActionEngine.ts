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
    if (pre.roomId && pre.roomId !== char.location.roomId) {
      return false;
    }

    // Position match
    if (pre.positionId && pre.positionId !== char.location.positionId) {
      return false;
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

    if ((pre.objectState || pre.objectStateNot) && targetObjectId) {
      const state = this.stateManager.getObjectState(targetObjectId).state;
      if (pre.objectState) {
        const allowedStates = Array.isArray(pre.objectState) ? pre.objectState : [pre.objectState];
        if (!allowedStates.includes(state)) return false;
      }
      if (pre.objectStateNot) {
        const blockedStates = Array.isArray(pre.objectStateNot) ? pre.objectStateNot : [pre.objectStateNot];
        if (blockedStates.includes(state)) return false;
      }
    }

    // Movement action check
    if (actionId.startsWith("walk_to_")) {
      const targetRoom = actionId.replace("walk_to_", "");
      const canMove = this.movementEngine.canMoveToRoom(char.id, targetRoom);
      if (!canMove.allowed) return false;
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
      if (action.targetTypes && !action.targetTypes.includes(targetObject.type)) {
        return {
          status: "rejected",
          actionId: request.actionId,
          message: `${action.name} cannot be used with ${targetObject.name}.`,
          reason: "INVALID_TARGET_TYPE",
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

    // Apply object state change
    if (request.targetObjectId && effects.objectState) {
      this.stateManager.updateObjectState(request.targetObjectId, (obj) => {
        obj.state = effects.objectState;
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

    // Apply needs change
    if (effects.needChanges) {
      this.needsEngine.applyNeedChanges(char.id, effects.needChanges);
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
      message: action.successMessage,
      changes: {
        location: char.location,
        posture: char.body.posture,
        needs: char.needs,
      },
    };
  }
}
