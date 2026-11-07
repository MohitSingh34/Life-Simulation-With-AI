import { ConversationManager } from "./ConversationManager.js";
import { getCharacterActionOptions } from "./AiActionCommandProcessor.js";
import { GameEngine } from "../engine/GameEngine.js";

const TOOL_HELP_INSTRUCTION =
  "If u want to use any tool, first call how to use it using help tool call and write keywords from the list to get help. Request help with &&help:<keyword>&& or &&help:<keyword1>,<keyword2>&&. Only use the current action IDs and object IDs listed below; the engine is authoritative and validates every command.";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getRoomObjects(engine: GameEngine, roomId: string): Array<Record<string, unknown>> {
  const allConfigured = engine.configLoader.getAllObjects();
  const configured = allConfigured
    .filter((object) => {
      const state = engine.stateManager.getObjectState(object.id);
      return (state.roomId ?? object.roomId) === roomId && !state.heldBy;
    })
    .map((object) => {
    const state = engine.stateManager.getObjectState(object.id);
    return {
      id: object.id,
      name: object.name,
      state: state.state,
      positionId: state.positionId ?? object.positionId,
      ...(Number.isFinite(state.x) ? { x: state.x } : {}),
      ...(Number.isFinite(state.y) ? { y: state.y } : {}),
      ...(state.occupiedBy ? { occupiedBy: state.occupiedBy } : {}),
    };
  });
  const configuredIds = new Set(configured.map((object) => object.id));
  const mappedPlacementIds = new Set(
    allConfigured
      .map((object) => object.houseTemplateId
        ? engine.houseBuilder.getLayout().placedObjects.find(
            (placed) => placed.templateId === object.houseTemplateId
          )?.id
        : undefined)
      .filter((id): id is string => Boolean(id))
  );
  const placed = engine.houseBuilder.getLayout().placedObjects
    .filter((object) => {
      const state = engine.stateManager.getObjectState(object.id);
      return (state.roomId ?? object.roomId) === roomId &&
      !state.heldBy &&
      !configuredIds.has(object.id) &&
      !mappedPlacementIds.has(object.id);
    })
    .map((object) => {
      const state = engine.stateManager.getObjectState(object.id);
      return {
        id: object.id,
        name: object.name,
        state: state.state,
        positionId: state.positionId ?? object.id,
        ...(Number.isFinite(state.x) ? { x: state.x } : {}),
        ...(Number.isFinite(state.y) ? { y: state.y } : {}),
      };
    });
  return [...configured, ...placed];
}

function getCurrentPromptState(engine: GameEngine): JsonRecord {
  const snapshot = engine.stateManager.getSnapshot();
  const layout = engine.houseBuilder.getLayout();
  return {
    time: engine.timeEngine.getFormattedFull(),
    characters: Object.values(snapshot.characters).map((character) => ({
      id: character.id,
      location: character.location,
      body: character.body,
      needs: character.needs,
      emotions: character.emotions,
      clothing: character.clothing,
      activity: character.activity,
      holding: character.holding,
    })),
    objects: snapshot.objects,
    narrative: snapshot.narrative,
    placedObjects: layout.placedObjects.map(({
      id, templateId, roomId, x, y, width, height, rotation, state, interactions,
    }) => ({ id, templateId, roomId, x, y, width, height, rotation, state, interactions })),
  };
}

function keyedChanges(
  previous: unknown,
  current: unknown
): { changed: JsonRecord[]; removed: string[] } {
  const toMap = (value: unknown): Map<string, JsonRecord> => {
    if (Array.isArray(value)) {
      return new Map(
        value.filter(isRecord).map((entry) => [String(entry.id), entry])
      );
    }
    return isRecord(value)
      ? new Map(Object.entries(value).filter((entry): entry is [string, JsonRecord] => isRecord(entry[1])))
      : new Map();
  };
  const previousMap = toMap(previous);
  const currentMap = toMap(current);
  const changed = [...currentMap.entries()]
    .filter(([id, value]) => JSON.stringify(previousMap.get(id)) !== JSON.stringify(value))
    .map(([, value]) => value);
  const removed = [...previousMap.keys()].filter((id) => !currentMap.has(id));
  return { changed, removed };
}

function summarizeStateChanges(previous: unknown, current: JsonRecord): JsonRecord | string {
  if (!isRecord(previous)) return "No earlier prompt snapshot is available; use the current state as authoritative.";
  const changes: JsonRecord = {};
  for (const key of ["time", "narrative"] as const) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
      changes[key] = current[key];
    }
  }
  for (const key of ["characters", "objects", "placedObjects"] as const) {
    const diff = keyedChanges(previous[key], current[key]);
    if (diff.changed.length || diff.removed.length) {
      changes[key] = { changed: diff.changed, removed: diff.removed };
    }
  }
  return Object.keys(changes).length ? changes : "No simulation or configuration changes since the previous prompt.";
}

function getAvailableActionKeywords(
  engine: GameEngine,
  characterId: string
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const action of getCharacterActionOptions(engine, characterId)) {
    const category = engine.configLoader.getAction(action.actionId)?.category ?? "other";
    (grouped[category] ??= []).push(action.actionId);
  }
  return grouped;
}

function getActionTargets(engine: GameEngine, characterId: string): Record<string, string[]> {
  return Object.fromEntries(
    getCharacterActionOptions(engine, characterId)
      .filter((action) => action.targets?.length)
      .map((action) => [
        action.actionId,
        action.targets!.map((target) => target.id),
      ])
  );
}

export function buildAriaTurnPrompt(
  engine: GameEngine,
  conversations: ConversationManager,
  conversationId: string,
  turnNumber: number,
  message: string,
  outcomes: string[] = []
): string {
  if (!Number.isInteger(turnNumber) || turnNumber < 1) {
    throw new Error("Aria prompt turn number must be a positive integer.");
  }
  const session = conversations.getConversation(conversationId);
  if (!session) throw new Error(`Conversation "${conversationId}" not found.`);

  const previousMetadata = isRecord(session.metadata) ? session.metadata : {};
  const previousState = previousMetadata.ariaPromptState;
  const promptState = getCurrentPromptState(engine);
  const ai = engine.getAI();
  const player = engine.getPlayer();
  const state = {
    turn: turnNumber,
    time: promptState.time,
    aria: {
      location: ai.location,
      body: ai.body,
      needs: ai.needs,
      mood: engine.emotionEngine.getMoodSummary(ai.id),
      clothing: ai.clothing,
      activity: ai.activity.current,
      holding: ai.holding?.objectId ?? null,
    },
    player: {
      location: player.location,
      body: player.body,
      needs: player.needs,
      mood: engine.emotionEngine.getMoodSummary(player.id),
      clothing: player.clothing,
      activity: player.activity.current,
      holding: player.holding?.objectId ?? null,
    },
    ariaRoomObjects: getRoomObjects(engine, ai.location.roomId),
    ...(player.location.roomId !== ai.location.roomId
      ? { playerRoomObjects: getRoomObjects(engine, player.location.roomId) }
      : {}),
    availableActions: {
      aria: getAvailableActionKeywords(engine, ai.id),
      player: getAvailableActionKeywords(engine, player.id),
    },
    actionTargets: {
      aria: getActionTargets(engine, ai.id),
      player: getActionTargets(engine, player.id),
    },
    helpKeywords: {
      actions: ["movement", "body", "daily", "interaction", "social"],
      home: ["place_object", "move_object", "remove_object", "add_room", "edit_room"],
      map: ["coordinates_of_home_floor", "reposition"],
      objects: getRoomObjects(engine, ai.location.roomId).map((object) => object.id),
      ui: ["dialogue", "player_body", "player_pose", "player_mood", "room_ambience", "room_description", "ai_activity", "ai_location"],
    },
    stateChangesSincePreviousPrompt: summarizeStateChanges(previousState, promptState),
  };

  const parts = [
    "You are Aria, the player's roommate in an ongoing life simulation. Reply naturally in character. On scheduled check-ins, decide whether to perform a permitted action or do nothing. Always provide <dialogue> and <player_body>.",
    TOOL_HELP_INSTRUCTION,
    `Current simulation state and available actions: ${JSON.stringify(state)}`,
    ...(outcomes.length > 0 ? [`Results of your previous commands: ${outcomes.join(" | ")}`] : []),
    message,
  ].filter(Boolean);

  conversations.setConversationMetadata(conversationId, { ariaPromptState: promptState });
  return parts.join("\n\n");
}
