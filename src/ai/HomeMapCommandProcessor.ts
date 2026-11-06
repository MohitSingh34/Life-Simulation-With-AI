import { HouseBuilderEngine } from "../engine/HouseBuilderEngine.js";
import { HouseLayout, PlacedHouseObject } from "../types/house.js";

const COORDINATES_REQUEST = "&&coordinates_of_home_floor&&";
const REPOSITION_COMMAND = /&&&(.+?)-action:reposition;(-?\d+)\s*,\s*(-?\d+)(?:;([a-z0-9_-]+))?&&/gi;

export interface HomeMapCommandResult {
  hasCommands: boolean;
  response: string;
  outcomes: string[];
}

export function getHomeFloorCoordinates(layout: HouseLayout): object {
  return {
    coordinateSystem: "zero-based grid cells; x increases right, y increases down",
    grid: layout.grid,
    rooms: layout.rooms.map((room) => {
      const blocked = new Set<string>();
      for (const object of layout.placedObjects) {
        if (!object.isSolid) continue;
        const width = object.width;
        const height = object.height;
        for (let y = object.y; y < object.y + height; y++) {
          for (let x = object.x; x < object.x + width; x++) {
            if (
              x >= room.x && x < room.x + room.width &&
              y >= room.y && y < room.y + room.height
            ) {
              blocked.add(`${x},${y}`);
            }
          }
        }
      }

      for (const door of layout.doors) {
        const width = door.orientation === "horizontal" ? door.width : 1;
        const height = door.orientation === "vertical" ? door.width : 1;
        for (let y = door.y; y < door.y + height; y++) {
          for (let x = door.x; x < door.x + width; x++) {
            blocked.add(`${x},${y}`);
          }
        }
      }

      const freeSingleCellRuns = [];
      for (let y = room.y; y < room.y + room.height; y++) {
        const ranges: Array<[number, number]> = [];
        let runStart: number | null = null;
        for (let x = room.x; x <= room.x + room.width; x++) {
          const isFree = x < room.x + room.width && !blocked.has(`${x},${y}`);
          if (isFree && runStart === null) runStart = x;
          if (!isFree && runStart !== null) {
            ranges.push([runStart, x - 1]);
            runStart = null;
          }
        }
        if (ranges.length > 0) freeSingleCellRuns.push({ y, xRanges: ranges });
      }

      return {
        id: room.id,
        name: room.name,
        bounds: {
          minX: room.x,
          maxX: room.x + room.width - 1,
          minY: room.y,
          maxY: room.y + room.height - 1,
        },
        objects: layout.placedObjects
          .filter((object) => object.roomId === room.id)
          .map(({ id, name, x, y, width, height, rotation }) => ({
            id, name, x, y, width, height, rotation,
          })),
        freeSingleCellRuns,
      };
    }),
    freeCoordinateNote:
      "freeSingleCellRuns list top-left coordinates suitable for a 1x1 item; larger objects need adjacent free cells and all moves are validated",
  };
}

function findObject(selector: string, objects: PlacedHouseObject[]): PlacedHouseObject[] {
  const normalized = selector.trim().toLowerCase().replace(/_/g, " ");
  const exact = objects.filter((object) =>
    object.id.toLowerCase() === selector.trim().toLowerCase() ||
    object.name.toLowerCase() === selector.trim().toLowerCase() ||
    object.templateId.toLowerCase() === selector.trim().toLowerCase()
  );
  if (exact.length > 0) return exact;

  const words = new Set(normalized.split(/[^a-z0-9]+/).filter((word) => word.length > 1));
  const scored = objects.map((object) => {
    const objectWords = new Set(
      `${object.id} ${object.name} ${object.templateId}`
        .toLowerCase()
        .replace(/_/g, " ")
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 1)
    );
    return {
      object,
      score: [...words].filter((word) => objectWords.has(word)).length,
    };
  }).filter((candidate) => candidate.score > 0);

  if (scored.length === 0) return [];
  const bestScore = Math.max(...scored.map((candidate) => candidate.score));
  return scored.filter((candidate) => candidate.score === bestScore).map(({ object }) => object);
}

export function executeHomeMapCommands(
  response: string,
  houseBuilder: HouseBuilderEngine
): HomeMapCommandResult {
  const outcomes: string[] = [];
  let hasCommands = false;
  let cleanedResponse = response;
  const layout = houseBuilder.getLayout();

  if (cleanedResponse.includes(COORDINATES_REQUEST)) {
    hasCommands = true;
    cleanedResponse = cleanedResponse.replaceAll(COORDINATES_REQUEST, "");
    outcomes.push(
      `Home floor coordinate query succeeded. Available floor cells and current objects: ${JSON.stringify(getHomeFloorCoordinates(layout))}`
    );
  }

  cleanedResponse = cleanedResponse.replace(REPOSITION_COMMAND, (_command, selector: string, xText: string, yText: string, roomId?: string) => {
    hasCommands = true;
    const matches = findObject(selector, layout.placedObjects);
    if (matches.length !== 1) {
      const choices = matches.length > 1
        ? matches.map((object) => `${object.name} (${object.id})`).join(", ")
        : "no matching placed items";
      outcomes.push(`Could not reposition "${selector}": found ${choices}. Use the exact object id from the home map.`);
      return "";
    }

    const object = matches[0];
    const targetRoomId = roomId || object.roomId;
    const x = Number(xText);
    const y = Number(yText);
    const result = houseBuilder.executeCommand({
      action: "move_object",
      params: {
        objectId: object.id,
        newX: x,
        newY: y,
        newRoomId: targetRoomId,
      },
      issuedBy: "ai_001",
    });

    outcomes.push(result.success
      ? `Reposition succeeded: ${object.name} (${object.id}) is now at grid (${x}, ${y}) in ${targetRoomId}.`
      : `Reposition failed for ${object.name} (${object.id}): ${result.message}`);
    return "";
  });

  return {
    hasCommands,
    response: cleanedResponse.replace(/[ \t]{2,}/g, " ").trim(),
    outcomes,
  };
}
