// ============================================================
// WORLD TYPES — Rooms, positions, connections, doors
// ============================================================

/** A specific position within a room where a character can be */
export interface RoomPosition {
  id: string;
  name: string;
  /** Object at this position (e.g., "bed_001"), or null for open space */
  objectId: string | null;
  /** Can a character stand here? */
  standable: boolean;
  /** Can a character sit here? */
  sittable: boolean;
  /** Can a character lie here? */
  lieable: boolean;
}

/** A room within a building */
export interface RoomConfig {
  id: string;
  name: string;
  description: string;
  /** Atmospheric descriptions for different times of day */
  ambience: {
    morning: string;
    afternoon: string;
    evening: string;
    night: string;
  };
  positions: RoomPosition[];
}

/** A door connecting two rooms */
export interface DoorConnection {
  id: string;
  name: string;
  roomA: string;
  roomB: string;
  /** Current state */
  defaultState: "open" | "closed" | "locked";
}

/** Top-level world configuration */
export interface WorldConfig {
  id: string;
  name: string;
  city: string;
  country: string;
  floors: {
    id: string;
    name: string;
    rooms: string[]; // room IDs
  }[];
  connections: DoorConnection[];
  /** Configurable simulation parameters (e.g. AI ping heartbeat interval) */
  simulationConfig?: {
    ariaPingIntervalMinutes?: number;
    [key: string]: any;
  };
}

