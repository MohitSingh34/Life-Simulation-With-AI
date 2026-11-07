import { ConversationManager } from "./ConversationManager.js";
import { GameEngine } from "../engine/GameEngine.js";

const TOOL_HELP_INSTRUCTION =
  "If u want to use any tool, first call how to use it using help tool call and write keywords from the list to get help. Request help with &&help:<keyword>&& or &&help:<keyword1>,<keyword2>&&. Only use the current action IDs and object IDs listed below; the engine is authoritative and validates every command.";
const AUTOMATIC_LOOP_STATUS_LINE =
  "Optional self-directed loop: use &&start_automatic_message_loop&& to enable or &&stop_automatic_message_loop&& to disable; regular 10-minute idle check-ins continue either way, tool/action results return for immediate follow-up, and player messages are queued while the optional loop is enabled.";
const AUTOMATIC_LOOP_DETAILS =
  "The regular 10-minute idle check-in always runs after the player has been inactive for 10 minutes; your optional loop does not change that cadence. Start the optional self-directed loop at any time with &&start_automatic_message_loop&&; then use each scheduled check-in to decide whether to speak, act, or do nothing, and player messages received meanwhile will be queued and included in your next scheduled turn. Stop only the optional loop with &&stop_automatic_message_loop&&; regular idle check-ins continue. When you issue an action/tool command, the game immediately sends you its result for a follow-up response, so review that result before concluding.";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getCurrentPromptState(engine: GameEngine): JsonRecord {
  const snapshot = engine.stateManager.getSnapshot();
  const layout = engine.houseBuilder.getLayout();
  const now = new Date();
  return {
    timestampUtc: now.toISOString(),
    localTime: new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(now),
    simulationTime: snapshot.time,
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
    homeConfiguration: {
      grid: layout.grid,
      rooms: layout.rooms,
      walls: layout.walls,
      doors: layout.doors,
      windows: layout.windows,
    },
    placedObjects: layout.placedObjects.map(({
      id, templateId, roomId, x, y, width, height, rotation, state, interactions,
    }) => ({
      id,
      templateId,
      roomId,
      x,
      y,
      width,
      height,
      rotation,
      state,
      interactions,
      seatCount: engine.houseBuilder.getTemplate(templateId)?.seatCount ?? 0,
    })),
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
  for (const key of ["simulationTime", "narrative"] as const) {
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
  if (JSON.stringify(previous.homeConfiguration) !== JSON.stringify(current.homeConfiguration)) {
    changes.homeConfiguration = current.homeConfiguration;
  }
  return Object.keys(changes).length ? changes : "No simulation or configuration changes since the previous prompt.";
}

function getInitialCapabilities(engine: GameEngine): JsonRecord {
  const layout = engine.houseBuilder.getLayout();
  const actions = engine.configLoader.getAllActions().map((action) => ({
    id: action.id,
    name: action.name,
    category: action.category,
    description: action.description,
    preconditions: action.preconditions,
    targets: action.targetTypes ?? [],
    command: action.requiresTarget || action.effects.moveToTargetPosition
      ? `&&action:${action.id};target:<object_id>&&`
      : `&&action:${action.id}&&`,
  }));
  const objects = engine.configLoader.getAllObjects().map((object) => ({
    id: object.id,
    name: object.name,
    type: object.type,
    roomId: object.roomId,
    portable: object.portable,
    interactions: object.interactions,
  }));
  return {
    role: "You are Aria, the player's friend in an ongoing life simulation. It should feel alive. Always provide <dialogue> and <player_body>.",
    commandGuide: [
      TOOL_HELP_INSTRUCTION,
      "Action commands: &&action:<action_id>&& or &&action:<action_id>;target:<object_id>&&.",
      "Help commands: &&help:<keyword>&& or &&help:<keyword1>,<keyword2>&&. Ask for help before using an unfamiliar action.",
      AUTOMATIC_LOOP_DETAILS,
      "Only use configured action/object IDs. The engine is authoritative and validates each action.",
    ],
    actions,
    objects,
    homeConfiguration: {
      grid: layout.grid,
      rooms: layout.rooms,
      walls: layout.walls,
      doors: layout.doors,
      windows: layout.windows,
      placedObjects: layout.placedObjects.map((object) => ({
        ...object,
        seatCount: engine.houseBuilder.getTemplate(object.templateId)?.seatCount ?? 0,
      })),
    },
  };
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
  const isInitialPrompt =
    previousMetadata.ariaPromptInitialized !== true || !isRecord(previousState);
  const promptState = structuredClone(getCurrentPromptState(engine));
  const ai = engine.getAI();
  const player = engine.getPlayer();
  const automaticLoopEnabled = conversations.isAutomaticMessageLoopEnabled(conversationId);
  const state = {
    timestampUtc: promptState.timestampUtc,
    localTime: promptState.localTime,
    aria: {
      location: ai.location,
      body: ai.body,
      needs: ai.needs,
      holding: ai.holding?.objectId ?? null,
    },
    player: {
      location: player.location,
      body: player.body,
      needs: player.needs,
      holding: player.holding?.objectId ?? null,
    },
    automaticMessageLoop: automaticLoopEnabled,
    ...(isInitialPrompt
      ? { initialization: getInitialCapabilities(engine) }
      : {}),
    ...(isRecord(previousState)
      ? { updatedGameState: summarizeStateChanges(previousState, promptState) }
      : {}),
  };

  const parts = [
    isInitialPrompt ? `Initial game setup: ${JSON.stringify(state.initialization)}` : "",
    `Current physical state and real timestamp: ${JSON.stringify({
      timestampUtc: state.timestampUtc,
      localTime: state.localTime,
      simulationTime: promptState.simulationTime,
      aria: state.aria,
      player: state.player,
      ...(state.updatedGameState ? { updatedGameState: state.updatedGameState } : {}),
    })}`,
    AUTOMATIC_LOOP_STATUS_LINE,
    ...(outcomes.length > 0 ? [`Results of your previous commands: ${outcomes.join(" | ")}`] : []),
    message,
  ].filter(Boolean);

  conversations.setConversationMetadata(conversationId, {
    ariaPromptState: promptState,
    ariaPromptInitialized: true,
  });
  return parts.join("\n\n");
}
