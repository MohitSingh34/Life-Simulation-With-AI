import { ActionResult } from "../types/action.js";
import { GameEngine } from "../engine/GameEngine.js";

const ACTION_COMMAND = /&&action:([^&]*?)&&/gi;
const MAX_ACTIONS_PER_RESPONSE = 5;

export interface AiActionOption {
  actionId: string;
  name: string;
  description: string;
  category: string;
  duration: number;
  icon: string;
  targets?: Array<{ id: string; name: string; state: string }>;
}

export interface AiActionCommandResult {
  hasCommands: boolean;
  response: string;
  outcomes: string[];
}

export function getAiActionOptions(engine: GameEngine): AiActionOption[] {
  const ai = engine.getAI();
  const options: AiActionOption[] = [];

  for (const action of engine.configLoader.getAllActions()) {
    if (action.requiresTarget) {
      const targets = engine.configLoader.getAllObjects()
        .filter((object) => object.interactions.includes(action.id))
        .flatMap((object) => {
          const state = engine.stateManager.getObjectState(object.id);
          if ((state.roomId ?? object.roomId) !== ai.location.roomId && state.heldBy !== ai.id) {
            return [];
          }

          const result = engine.actionEngine.validateAction({
            actorId: ai.id,
            actionId: action.id,
            targetObjectId: object.id,
            timestamp: new Date().toISOString(),
          });
          return result.status === "accepted"
            ? [{ id: object.id, name: object.name, state: state.state }]
            : [];
        });

      if (targets.length > 0) {
        options.push({
          actionId: action.id,
          name: action.name,
          description: action.description,
          category: action.category,
          duration: action.duration,
          icon: action.icon,
          targets,
        });
      }
      continue;
    }

    const result = engine.actionEngine.validateAction({
      actorId: ai.id,
      actionId: action.id,
      timestamp: new Date().toISOString(),
    });
    if (result.status === "accepted") {
      options.push({
        actionId: action.id,
        name: action.name,
        description: action.description,
        category: action.category,
        duration: action.duration,
        icon: action.icon,
      });
    }
  }

  return options;
}

export function executeAiActionCommands(
  response: string,
  engine: GameEngine
): AiActionCommandResult {
  const outcomes: string[] = [];
  let commandCount = 0;
  const cleanedResponse = response.replace(ACTION_COMMAND, (_command, rawCommand: string) => {
    commandCount++;
    if (commandCount > MAX_ACTIONS_PER_RESPONSE) {
      outcomes.push(`Action command limit reached; ignored command ${commandCount}.`);
      return "";
    }

    const parsed = /^([a-z0-9_-]+)(?:;target:([a-z0-9_-]+))?$/i.exec(rawCommand.trim());
    if (!parsed) {
      outcomes.push(`Could not parse action command "${rawCommand.trim()}".`);
      return "";
    }

    const [, actionId, targetObjectId] = parsed;
    const action = engine.configLoader.getAction(actionId);
    if (!action) {
      outcomes.push(`Action "${actionId}" is not configured.`);
      return "";
    }
    if (action.requiresTarget && !targetObjectId) {
      outcomes.push(`Action "${actionId}" needs a target object id.`);
      return "";
    }

    const result: ActionResult = engine.actionEngine.executeAction({
      actorId: engine.getAI().id,
      actionId,
      targetObjectId,
      timestamp: new Date().toISOString(),
    });
    if (result.status === "accepted") {
      engine.emotionEngine.evaluateEmotions(engine.getAI().id);
    }
    engine.eventManager.recordEvent({
      actorId: engine.getAI().id,
      timestamp: engine.timeEngine.getFormattedClock(),
      type: "ai_decision",
      data: { actionId, targetObjectId, result },
    });
    outcomes.push(
      `${action.name} (${actionId}) ${result.status}: ${result.message}`
    );
    return "";
  });

  return {
    hasCommands: commandCount > 0,
    response: cleanedResponse.replace(/[ \t]{2,}/g, " ").trim(),
    outcomes,
  };
}
