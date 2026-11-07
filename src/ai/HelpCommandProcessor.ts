import { GameEngine } from "../engine/GameEngine.js";
import { getCharacterActionOptions } from "./AiActionCommandProcessor.js";

const HELP_COMMAND = /&&help:([^&]*?)&&/gi;

export interface HelpCommandResult {
  hasCommands: boolean;
  response: string;
  outcomes: string[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "_");
}

function getHelpForKeyword(keyword: string, engine: GameEngine): string {
  const key = normalize(keyword);
  const allActions = engine.configLoader.getAllActions();
  const ariaActions = getCharacterActionOptions(engine, engine.getAI().id);
  const playerActions = getCharacterActionOptions(engine, engine.getPlayer().id);

  if (key === "help" || key === "tools" || key === "capabilities") {
    return [
      "Help keywords: actions, movement, body, daily, interaction, social, home, map, objects, ui.",
      "Use &&help:<keyword>&& or &&help:<keyword1>,<keyword2>&&. Use an action ID from availableActions for exact action help.",
      "Use &&action:<action_id>&& or &&action:<action_id>;target:<object_id>&& to perform an Aria action.",
    ].join(" ");
  }

  if (["home", "building", "build", "place_object", "move_object", "remove_object", "add_room", "edit_room"].includes(key)) {
    return [
      "Home commands: place furniture with <build_command>{\"action\":\"place_object\",\"params\":{\"templateId\":\"<template_id>\",\"roomId\":\"<room_id>\",\"x\":0,\"y\":0}}</build_command>.",
      "Move an existing placed item with &&&<object_id>-action:reposition;<x>,<y>;<room_id>&&. Use exact IDs from the current home configuration.",
      "Ask for the current floor map with &&coordinates_of_home_floor&& before choosing coordinates. The engine validates bounds, collisions, and doorways.",
    ].join(" ");
  }

  if (["map", "coordinates", "floor_map", "coordinates_of_home_floor", "reposition"].includes(key)) {
    return [
      "Request live room bounds, occupied objects, and free floor coordinates by emitting &&coordinates_of_home_floor&&.",
      "Move an existing item with &&&<object_id>-action:reposition;<x>,<y>;<room_id>&& using zero-based grid coordinates. Do not invent coordinates or object IDs.",
    ].join(" ");
  }

  if ([
    "ui", "interface", "screen", "dialogue", "player_body", "player_pose",
    "player_mood", "room_ambience", "room_description", "ai_activity",
    "ai_location", "player_clothing", "hunger_feeling", "thirst_feeling",
    "energy_feeling", "sleepiness_feeling", "hygiene_feeling",
    "bladder_feeling", "time_weather", "time_period",
  ].includes(key)) {
    return "Return screen updates using XML-style tags such as <dialogue>...</dialogue>, <player_body>...</player_body>, <player_pose>...</player_pose>, <player_mood>...</player_mood>, <room_ambience>...</room_ambience>, <room_description>...</room_description>, <ai_activity>...</ai_activity>, and <ai_location>...</ai_location>. Always include dialogue and player_body.";
  }

  if (["objects", "interactions", "object"].includes(key)) {
    const ariaRoomId = engine.getAI().location.roomId;
    const allConfigured = engine.configLoader.getAllObjects();
    const configured = allConfigured
      .filter((object) => {
        const state = engine.stateManager.getObjectState(object.id);
        return (state.roomId ?? object.roomId) === ariaRoomId && !state.heldBy;
      })
      .map((object) => {
        const state = engine.stateManager.getObjectState(object.id);
        return {
          id: object.id,
          name: object.name,
          interactions: object.interactions,
          state: state.state,
          positionId: state.positionId ?? object.positionId,
        };
      });
    const configuredIds = new Set(configured.map((object) => object.id));
    const mappedPlacedIds = new Set(
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
        return (state.roomId ?? object.roomId) === ariaRoomId &&
        !state.heldBy &&
        !configuredIds.has(object.id) &&
        !mappedPlacedIds.has(object.id);
      })
      .map((object) => {
        const state = engine.stateManager.getObjectState(object.id);
        return {
          id: object.id,
          name: object.name,
          interactions: object.interactions,
          state: state.state,
          positionId: state.positionId ?? object.id,
        };
      });
    const objects = [...configured, ...placed];
    return `Current room objects and their supported interactions: ${JSON.stringify(objects)}. Configured object states are available in the current state message.`;
  }

  const configuredObject = engine.configLoader.getAllObjects().find(
    (object) => normalize(object.id) === key || normalize(object.name) === key
  );
  const placedObject = engine.houseBuilder.getLayout().placedObjects.find(
    (object) => normalize(object.id) === key || normalize(object.name) === key
  );
  const object = configuredObject
    ? engine.objectInteractionEngine.getObject(configuredObject.id)
    : placedObject
      ? engine.objectInteractionEngine.getObject(placedObject.id)
      : undefined;
  if (object) {
    const state = engine.stateManager.getObjectState(object.id);
    return `Object help: ${JSON.stringify({
      id: object.id,
      name: object.name,
      roomId: state.roomId ?? object.roomId,
      state: state.state,
      description: object.description,
      interactions: object.interactions.map((actionId) => ({
        id: actionId,
        name: engine.configLoader.getAction(actionId)?.name ?? actionId,
      })),
      heldBy: state.heldBy ?? null,
      occupiedBy: state.occupiedBy,
    })}. Ask help for an interaction action ID to learn its preconditions and command syntax.`;
  }

  const categoryAliases: Record<string, string> = {
    movement: "movement",
    move: "movement",
    body: "body",
    daily: "daily",
    interaction: "interaction",
    social: "social",
  };
  const action = allActions.find((candidate) => normalize(candidate.id) === key);
  if (key === "actions") {
    const categories = [...new Set(allActions.map((candidate) => candidate.category))];
    return `Action categories and action-ID keywords: ${JSON.stringify(
      Object.fromEntries(categories.map((category) => [
        category,
        allActions.filter((candidate) => candidate.category === category).map((candidate) => candidate.id),
      ]))
    )}. Ask help for an exact action ID or category for detailed usage.`;
  }
  const actionCategory = categoryAliases[key];
  const matchedActions = action
    ? [action]
    : actionCategory
      ? allActions.filter((candidate) => candidate.category === actionCategory)
      : [];

  if (matchedActions.length > 0) {
    const details = matchedActions.map((candidate) => {
      const ariaAvailable = ariaActions.some((available) => available.actionId === candidate.id);
      const playerAvailable = playerActions.some((available) => available.actionId === candidate.id);
      return {
        id: candidate.id,
        name: candidate.name,
        description: candidate.description,
        availableForAria: ariaAvailable,
        availableForPlayer: playerAvailable,
        preconditions: candidate.preconditions,
        targetTypes: candidate.targetTypes,
        requiresTarget: candidate.requiresTarget || candidate.effects.moveToTargetPosition === true,
        effect: candidate.effects,
        command: candidate.requiresTarget || candidate.effects.moveToTargetPosition
          ? `&&action:${candidate.id};target:<current_target_id>&& (or omit target to let the engine choose the nearest compatible object)`
          : `&&action:${candidate.id}&&`,
      };
    });
    return `Action help: ${JSON.stringify(details)}`;
  }

  return `No help entry matches "${keyword}". Ask for help, an action category, an action ID, home, map, objects, or ui.`;
}

export function executeHelpCommands(response: string, engine: GameEngine): HelpCommandResult {
  const outcomes: string[] = [];
  let commandCount = 0;
  const cleanedResponse = response.replace(HELP_COMMAND, (_command, rawKeywords: string) => {
    commandCount++;
    const keywords = rawKeywords.split(",").map((keyword) => keyword.trim()).filter(Boolean);
    if (keywords.length === 0) {
      outcomes.push("Help request was empty. Use &&help:<keyword>&&.");
      return "";
    }

    for (const keyword of keywords.slice(0, 5)) {
      outcomes.push(getHelpForKeyword(keyword, engine));
    }
    if (keywords.length > 5) outcomes.push("Help query limit is five keywords per call.");
    return "";
  });

  return {
    hasCommands: commandCount > 0,
    response: cleanedResponse.replace(/[ \t]{2,}/g, " ").trim(),
    outcomes,
  };
}
