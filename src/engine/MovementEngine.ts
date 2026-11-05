import { StateManager } from "./StateManager.js";
import { ConfigLoader } from "./ConfigLoader.js";
import { DoorConnection } from "../types/index.js";

export class MovementEngine {
  constructor(
    private stateManager: StateManager,
    private configLoader: ConfigLoader
  ) {}

  public getConnectedDoors(roomId: string): DoorConnection[] {
    const world = this.configLoader.getWorld();
    return world.connections.filter(
      (conn) => conn.roomA === roomId || conn.roomB === roomId
    );
  }

  public getReachableRooms(roomId: string): string[] {
    const doors = this.getConnectedDoors(roomId);
    const rooms = new Set<string>();

    for (const d of doors) {
      if (d.defaultState !== "locked") {
        const dest = d.roomA === roomId ? d.roomB : d.roomA;
        rooms.add(dest);
      }
    }

    return Array.from(rooms);
  }

  public canMoveToRoom(
    characterId: string,
    targetRoomId: string
  ): { allowed: boolean; reason?: string } {
    const char = this.stateManager.getCharacter(characterId);
    if (!char) return { allowed: false, reason: "Character does not exist." };

    if (char.body.posture !== "standing") {
      return {
        allowed: false,
        reason: `Cannot walk while ${char.body.posture}. Stand up first!`,
      };
    }

    const currentRoom = char.location.roomId;
    if (currentRoom === targetRoomId) {
      return { allowed: false, reason: "Already in this room." };
    }

    const reachable = this.getReachableRooms(currentRoom);
    if (!reachable.includes(targetRoomId)) {
      return {
        allowed: false,
        reason: `No accessible door from ${currentRoom} to ${targetRoomId}.`,
      };
    }

    return { allowed: true };
  }
}

