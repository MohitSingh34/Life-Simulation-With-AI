// ============================================================
// ARIA BUILD PLANNER — Autonomous & Collaborative AI Construction
// ============================================================

import { HouseBuilderEngine } from "../engine/HouseBuilderEngine.js";
import { HouseCommand, BuildResult, BuildItemTemplate, HouseRoom } from "../types/house.js";

export interface AriaBuildProposal {
  command: HouseCommand;
  dialogue: string;
  roomName: string;
  itemName: string;
}

export class AriaBuildPlanner {
  constructor(private houseBuilder: HouseBuilderEngine) {}

  /**
   * Evaluates a room and proposes an aesthetic, comforting home addition
   */
  public proposeEnhancement(targetRoomId?: string): AriaBuildProposal | null {
    const layout = this.houseBuilder.getLayout();
    const rooms = layout.rooms;
    if (rooms.length === 0) return null;

    // Pick targeted room or pick room with fewest decorative touches
    let room: HouseRoom;
    if (targetRoomId) {
      room = rooms.find(r => r.id === targetRoomId) || rooms[0];
    } else {
      const roomCounts = rooms.map(r => ({
        room: r,
        count: layout.placedObjects.filter(o => o.roomId === r.id).length,
      }));
      roomCounts.sort((a, b) => a.count - b.count);
      room = roomCounts[0].room;
    }

    // Aesthetic candidates tailored to room types
    const candidatesByRoom: Record<string, string[]> = {
      study_room: ["monstera_001", "arc_floor_lamp_001", "chess_set_001", "acoustic_guitar_001", "geometric_rug_001"],
      living_room: ["armchair_001", "monstera_001", "wall_art_001", "geometric_rug_001", "floor_cushion_001", "beanbag_001"],
      balcony: ["balcony_planters_001", "fairy_lights_001", "bistro_table_001", "cane_chair_001"],
      bedroom: ["bedside_lamp_001", "geometric_rug_001", "floor_cushion_001", "single_bed_001"],
      kitchen: ["chai_service_001", "microwave_001", "dining_chair_001"],
      toilet: ["monstera_001", "washbasin_001"],
    };

    const templates = candidatesByRoom[room.id] || ["monstera_001", "geometric_rug_001"];

    // Find an item not already over-saturated in this room
    let chosenTemplateId: string | null = null;
    for (const tId of templates) {
      const alreadyPlaced = layout.placedObjects.filter(o => o.roomId === room.id && o.templateId === tId);
      if (alreadyPlaced.length === 0) {
        chosenTemplateId = tId;
        break;
      }
    }

    if (!chosenTemplateId) {
      chosenTemplateId = templates[Math.floor(Math.random() * templates.length)];
    }

    const template = this.houseBuilder.getTemplate(chosenTemplateId);
    if (!template) return null;

    // Find valid grid cell within room
    const spot = this.findValidPlacementSpot(room, template);
    if (!spot) return null;

    const command: HouseCommand = {
      action: "place_object",
      params: {
        templateId: template.id,
        roomId: room.id,
        x: spot.x,
        y: spot.y,
        rotation: 0,
      },
      issuedBy: "ai_001",
      reasoning: `Aria wanted to make the ${room.name} cozier and more inviting.`,
    };

    const dialogues: Record<string, string> = {
      monstera_001: `I thought the ${room.name} could really use some greenery to catch the soft morning light. Look how fresh this Monstera looks!`,
      balcony_planters_001: `I placed some blooming jasmine and marigolds out by the railing. The breeze will carry their sweet scent right inside!`,
      arc_floor_lamp_001: `I set up this warm arc lamp in the ${room.name}—it creates the most peaceful evening glow for reading and winding down.`,
      armchair_001: `I added this velvet reading chair to the ${room.name}. Now we have the perfect spot to curl up with a book!`,
      geometric_rug_001: `A soft artisanal rug makes the ${room.name} feel so much warmer and grounded barefoot. What do you think?`,
      wall_art_001: `I hung an oil painting of Bhedaghat's marble cliffs on the wall. It reminds me of the river sunset.`,
      chai_service_001: `I brought out our brass chai service set so we can easily share hot tea whenever we take breaks!`,
      chess_set_001: `I arranged the handcrafted wooden chessboard right here so we can play a match whenever we feel like taking a thinking break.`,
      fairy_lights_001: `I strung some warm fairy lights along the balcony railing. When twilight falls over Jabalpur, it feels magical out here.`,
    };

    const dialogue = dialogues[template.id] || `I added a lovely ${template.name} to the ${room.name}! It makes our home feel so lively and welcoming.`;

    return {
      command,
      dialogue,
      roomName: room.name,
      itemName: template.name,
    };
  }

  /**
   * Parse natural language player building or decorating requests
   */
  public parseNaturalLanguageRequest(text: string): AriaBuildProposal | null {
    const lower = text.toLowerCase();
    const layout = this.houseBuilder.getLayout();

    // 1. Detect target room
    let targetRoom = layout.rooms.find(r => lower.includes(r.id) || lower.includes(r.name.toLowerCase()));
    if (!targetRoom) {
      if (lower.includes("balcony") || lower.includes("terrace")) targetRoom = layout.rooms.find(r => r.id === "balcony");
      else if (lower.includes("study") || lower.includes("office") || lower.includes("desk")) targetRoom = layout.rooms.find(r => r.id === "study_room");
      else if (lower.includes("bed") || lower.includes("sleep")) targetRoom = layout.rooms.find(r => r.id === "bedroom");
      else if (lower.includes("kitchen") || lower.includes("cook")) targetRoom = layout.rooms.find(r => r.id === "kitchen");
      else if (lower.includes("living") || lower.includes("hall") || lower.includes("lounge")) targetRoom = layout.rooms.find(r => r.id === "living_room");
      else if (lower.includes("bath") || lower.includes("toilet") || lower.includes("wash")) targetRoom = layout.rooms.find(r => r.id === "toilet");
    }

    if (/\b(move|relocate|reposition|shift)\b/.test(lower)) {
      const object = this.findRequestedObject(lower, layout.placedObjects);
      if (!object) return null;

      const explicitTargetRoom = layout.rooms.find((candidate) => {
        const labels = [candidate.name.toLowerCase(), candidate.id.replace(/_/g, " ")];
        return labels.some((label) =>
          [`to ${label}`, `to the ${label}`, `into ${label}`, `into the ${label}`]
            .some((phrase) => lower.includes(phrase))
        );
      });
      const room = explicitTargetRoom ||
        layout.rooms.find((candidate) => candidate.id === object.roomId) ||
        targetRoom ||
        layout.rooms[0];
      const coordinatePair = lower.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/);
      const xMatch = lower.match(/\bx\s*(?::|=|\s)\s*(-?\d+)\b/);
      const yMatch = lower.match(/\by\s*(?::|=|\s)\s*(-?\d+)\b/);
      const coordinates = coordinatePair
        ? { x: Number(coordinatePair[1]), y: Number(coordinatePair[2]) }
        : xMatch && yMatch
          ? { x: Number(xMatch[1]), y: Number(yMatch[1]) }
          : null;
      const spot = coordinates || this.findValidMoveSpot(object, room);
      if (!spot) return null;

      return {
        command: {
          action: "move_object",
          params: {
            objectId: object.id,
            newX: spot.x,
            newY: spot.y,
            newRoomId: room.id,
          },
          issuedBy: "ai_001",
        },
        dialogue: `I moved the ${object.name} to grid (${spot.x}, ${spot.y}) in the ${room.name}.`,
        roomName: room.name,
        itemName: object.name,
      };
    }

    const room = targetRoom || layout.rooms[0];

    // 2. Detect requested item category or template
    let templateId: string | null = null;
    if (lower.includes("plant") || lower.includes("greenery") || lower.includes("flower")) {
      templateId = room.id === "balcony" ? "balcony_planters_001" : "monstera_001";
    } else if (lower.includes("light") || lower.includes("lamp")) {
      templateId = room.id === "balcony" ? "fairy_lights_001" : "arc_floor_lamp_001";
    } else if (lower.includes("chair") || lower.includes("seat") || lower.includes("armchair")) {
      templateId = room.id === "balcony" ? "cane_chair_001" : "armchair_001";
    } else if (lower.includes("rug") || lower.includes("carpet")) {
      templateId = "geometric_rug_001";
    } else if (lower.includes("art") || lower.includes("painting") || lower.includes("canvas")) {
      templateId = "wall_art_001";
    } else if (lower.includes("chai") || lower.includes("tea")) {
      templateId = "chai_service_001";
    } else if (lower.includes("chess") || lower.includes("game")) {
      templateId = "chess_set_001";
    } else if (lower.includes("cushion")) {
      templateId = "floor_cushion_001";
    } else if (lower.includes("sofa")) {
      templateId = "plush_sofa_001";
    } else if (lower.includes("desk") || lower.includes("table")) {
      templateId = room.id === "balcony" ? "bistro_table_001" : "coffee_table_001";
    }

    // 3. Detect Floor customization
    if (lower.includes("floor")) {
      let floorType: any = "wood";
      if (lower.includes("marble")) floorType = "marble";
      else if (lower.includes("tile")) floorType = "tile";
      else if (lower.includes("granite")) floorType = "granite";
      else if (lower.includes("terracotta")) floorType = "terracotta";
      else if (lower.includes("parquet")) floorType = "parquet";
      else if (lower.includes("carpet")) floorType = "carpet";

      return {
        command: {
          action: "customize_floor",
          params: { roomId: room.id, floorType },
          issuedBy: "ai_001",
        },
        dialogue: `Done! I've updated the flooring in the ${room.name} to ${floorType}. It gives the entire room such an elegant texture!`,
        roomName: room.name,
        itemName: `${floorType} flooring`,
      };
    }

    if (!templateId) {
      return this.proposeEnhancement(room.id);
    }

    const template = this.houseBuilder.getTemplate(templateId);
    if (!template) return this.proposeEnhancement(room.id);

    const spot = this.findValidPlacementSpot(room, template);
    if (!spot) return this.proposeEnhancement(room.id);

    return {
      command: {
        action: "place_object",
        params: {
          templateId: template.id,
          roomId: room.id,
          x: spot.x,
          y: spot.y,
          rotation: 0,
        },
        issuedBy: "ai_001",
      },
      dialogue: `Great idea! I placed the ${template.name} right in the ${room.name}. It fits perfectly!`,
      roomName: room.name,
      itemName: template.name,
    };
  }

  private findValidPlacementSpot(
    room: HouseRoom,
    template: BuildItemTemplate
  ): { x: number; y: number } | null {
    const layout = this.houseBuilder.getLayout();
    const w = template.width;
    const h = template.height;

    // Search interior grid cells within room boundaries
    for (let dy = 1; dy <= room.height - h - 1; dy++) {
      for (let dx = 1; dx <= room.width - w - 1; dx++) {
        const x = room.x + dx;
        const y = room.y + dy;

        let collides = false;
        if (template.isSolid) {
          for (const obj of layout.placedObjects) {
            if (!obj.isSolid) continue;
            if (
              x < obj.x + obj.width &&
              x + w > obj.x &&
              y < obj.y + obj.height &&
              y + h > obj.y
            ) {
              collides = true;
              break;
            }
          }
        }

        // Also check that it doesn't block door thresholds
        for (const door of layout.doors) {
          const dW = door.orientation === "horizontal" ? (door.width || 2) : 1;
          const dH = door.orientation === "vertical" ? (door.width || 2) : 1;
          if (
            x < door.x + dW &&
            x + w > door.x &&
            y < door.y + dH &&
            y + h > door.y
          ) {
            collides = true;
            break;
          }
        }

        if (!collides) {
          return { x, y };
        }
      }
    }

    return null;
  }

  private findRequestedObject(
    text: string,
    objects: ReturnType<HouseBuilderEngine["getLayout"]>["placedObjects"]
  ) {
    const exactMatch = objects.find((object) =>
      text.includes(object.id.toLowerCase()) ||
      text.includes(object.name.toLowerCase())
    );
    if (exactMatch) return exactMatch;

    const ignoredWords = new Set([
      "move", "relocate", "reposition", "shift", "the", "a", "an", "to", "into",
      "from", "in", "on", "at", "near", "closer", "please", "aria", "grid",
      "room", "living", "study", "bedroom", "kitchen", "toilet", "balcony",
      "patio", "garden", "hallway", "floor", "object", "furniture",
    ]);
    const requestWords = new Set(
      text.match(/[a-z0-9_]+/g)?.filter((word) => word.length > 2 && !ignoredWords.has(word)) || []
    );
    return objects
      .map((object) => {
        const objectWords = new Set(
          `${object.name} ${object.id} ${object.templateId} ${object.type}`
            .toLowerCase()
            .match(/[a-z0-9_]+/g) || []
        );
        const score = [...requestWords].filter((word) => objectWords.has(word)).length;
        return { object, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.object;
  }

  private findValidMoveSpot(
    object: ReturnType<HouseBuilderEngine["getLayout"]>["placedObjects"][number],
    room: HouseRoom
  ): { x: number; y: number } | null {
    const layout = this.houseBuilder.getLayout();
    for (let y = room.y + 1; y <= room.y + room.height - object.height - 1; y++) {
      for (let x = room.x + 1; x <= room.x + room.width - object.width - 1; x++) {
        const overlapsObject = object.isSolid && layout.placedObjects.some((other) =>
          other.id !== object.id &&
          other.isSolid &&
          x < other.x + other.width &&
          x + object.width > other.x &&
          y < other.y + other.height &&
          y + object.height > other.y
        );
        const overlapsDoor = object.isSolid && layout.doors.some((door) => {
          const doorWidth = door.orientation === "horizontal" ? door.width : 1;
          const doorHeight = door.orientation === "vertical" ? door.width : 1;
          return (
            x < door.x + doorWidth &&
            x + object.width > door.x &&
            y < door.y + doorHeight &&
            y + object.height > door.y
          );
        });
        if (!overlapsObject && !overlapsDoor) return { x, y };
      }
    }
    return null;
  }
}
