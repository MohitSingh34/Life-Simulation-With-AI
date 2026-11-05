// ============================================================
// HOUSE BUILDER & 2D LAYOUT TYPES — Phaser 3, Construction & Pathfinding
// ============================================================

export interface HouseGridConfig {
  cols: number;
  rows: number;
  cellSize: number; // in pixels (e.g. 20)
}

export type FloorMaterialType =
  | "wood"
  | "tile"
  | "granite"
  | "marble"
  | "terracotta"
  | "carpet"
  | "tatami"
  | "parquet";

export type WallStyleType =
  | "plaster"
  | "brick"
  | "wood_panel"
  | "modern_glass"
  | "tile";

export interface HouseRoom {
  id: string;
  name: string;
  type: string; // bedroom, study_room, kitchen, toilet, living_room, balcony, patio, hallway, garden
  x: number; // grid x
  y: number; // grid y
  width: number; // grid width
  height: number; // grid height
  floorType: FloorMaterialType;
  wallColor: string;
  wallStyle: WallStyleType;
  description: string;
}

export interface HouseWall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  isExterior: boolean;
  color?: string;
}

export interface HouseDoor {
  id: string;
  roomA: string;
  roomB: string;
  x: number; // grid x
  y: number; // grid y
  width: number; // grid units
  orientation: "horizontal" | "vertical";
  isOpen: boolean;
}

export interface HouseWindow {
  id: string;
  roomId: string;
  x: number; // grid x
  y: number; // grid y
  width: number; // grid units
  facing: "north" | "south" | "east" | "west";
}

export interface PlacedHouseObject {
  id: string;
  templateId: string;
  name: string;
  type: string; // furniture, appliance, decor, plant, lighting, electronics, fixture
  roomId: string;
  x: number; // grid x
  y: number; // grid y
  width: number; // grid units
  height: number; // grid units
  rotation: 0 | 90 | 180 | 270;
  icon: string;
  color: string;
  state: string;
  isSolid: boolean; // blocks pathfinding
  interactions: string[];
  placedBy: "player_001" | "ai_001";
  placedAt: string;
  customData?: Record<string, any>;
}

export interface BuildItemTemplate {
  id: string;
  name: string;
  category:
    | "seating"
    | "tables"
    | "beds"
    | "storage"
    | "appliances"
    | "lighting"
    | "decor"
    | "plants"
    | "fixtures";
  type: string;
  width: number; // default grid width
  height: number; // default grid height
  icon: string;
  color: string;
  description: string;
  defaultState: string;
  possibleStates: string[];
  interactions: string[];
  isSolid: boolean;
  allowedRooms?: string[];
  price?: number;
}

export interface HouseLayout {
  id: string;
  name: string;
  version: number;
  grid: HouseGridConfig;
  rooms: HouseRoom[];
  walls: HouseWall[];
  doors: HouseDoor[];
  windows: HouseWindow[];
  placedObjects: PlacedHouseObject[];
  lastModified: string;
  modifiedBy: string;
}

export type BuildActionType =
  | "place_object"
  | "move_object"
  | "rotate_object"
  | "remove_object"
  | "add_room"
  | "modify_room"
  | "remove_room"
  | "add_door"
  | "remove_door"
  | "add_window"
  | "remove_window"
  | "customize_floor"
  | "customize_wall";

export interface HouseCommand {
  action: BuildActionType;
  params: Record<string, any>;
  issuedBy?: "player_001" | "ai_001";
  reasoning?: string;
}

export interface BuildResult {
  success: boolean;
  message: string;
  command: HouseCommand;
  layout?: HouseLayout;
  affectedObjectId?: string;
  affectedRoomId?: string;
}

export interface PathWaypoint {
  x: number; // in world pixels or grid coords
  y: number;
  gridX: number;
  gridY: number;
}
