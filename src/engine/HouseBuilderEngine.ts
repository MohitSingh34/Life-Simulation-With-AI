// ============================================================
// HOUSE BUILDER ENGINE — Construction, Editing, Validation & Persistence
// ============================================================

import fs from "node:fs";
import path from "node:path";
import {
  HouseLayout,
  HouseCommand,
  BuildResult,
  BuildItemTemplate,
  HouseRoom,
  PlacedHouseObject,
  FloorMaterialType,
  WallStyleType,
} from "../types/house.js";
import { PathfindingEngine } from "./PathfindingEngine.js";
import { StateManager } from "./StateManager.js";

const DEFAULT_STATE_DIR = path.resolve(process.cwd(), "state");
const HOUSE_STATE_FILE = path.join(DEFAULT_STATE_DIR, "house-layout.json");
const CATALOG_FILE = path.resolve(process.cwd(), "src/config/build_catalog.json");

export class HouseBuilderEngine {
  private layout!: HouseLayout;
  private catalog: BuildItemTemplate[] = [];
  public pathfindingEngine: PathfindingEngine;
  private stateManager?: StateManager;
  private stateFilePath: string;

  constructor(stateManager?: StateManager, stateFilePath = HOUSE_STATE_FILE) {
    this.stateManager = stateManager;
    this.stateFilePath = stateFilePath;
    this.pathfindingEngine = new PathfindingEngine(40, 38, 20);
    this.loadCatalog();
    this.loadOrInitLayout();
  }

  public setStateManager(stateManager: StateManager): void {
    this.stateManager = stateManager;
    this.syncPlacedObjectsWithStateManager();
  }

  private loadCatalog(): void {
    try {
      if (fs.existsSync(CATALOG_FILE)) {
        this.catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
      } else {
        this.catalog = [];
      }
    } catch (err) {
      console.warn("Could not load build catalog:", err);
      this.catalog = [];
    }
  }

  public getCatalog(): BuildItemTemplate[] {
    return this.catalog;
  }

  public getTemplate(id: string): BuildItemTemplate | undefined {
    return this.catalog.find(t => t.id === id);
  }

  public getLayout(): HouseLayout {
    return this.layout;
  }

  /**
   * Initializes or loads persisted house layout
   */
  public loadOrInitLayout(): HouseLayout {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const data = fs.readFileSync(this.stateFilePath, "utf8");
        this.layout = JSON.parse(data);
      } else {
        this.layout = this.createDefaultLayout();
        this.persist();
      }
    } catch (err) {
      console.warn("Could not read house layout file, initializing default:", err);
      this.layout = this.createDefaultLayout();
      this.persist();
    }

    if (this.addDefaultHallways()) this.persist();
    this.pathfindingEngine.rebuildFromHouse(this.layout);
    this.syncPlacedObjectsWithStateManager();
    return this.layout;
  }

  /**
   * Save authoritative layout to disk
   */
  public persist(): void {
    try {
      const dir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.layout.lastModified = new Date().toISOString();
      fs.writeFileSync(this.stateFilePath, JSON.stringify(this.layout, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to persist house layout:", err);
    }
  }

  /**
   * Reset house to pristine Jabalpur apartment floorplan
   */
  public resetToDefault(): HouseLayout {
    this.layout = this.createDefaultLayout();
    this.persist();
    this.pathfindingEngine.rebuildFromHouse(this.layout);
    this.syncPlacedObjectsWithStateManager();
    return this.layout;
  }

  /**
   * Synchronizes placed objects into the authoritative StateManager
   */
  private syncPlacedObjectsWithStateManager(): void {
    if (!this.stateManager) return;

    for (const obj of this.layout.placedObjects) {
      const existing = this.stateManager.getObjectState(obj.id);
      if (!existing) {
        this.stateManager.updateObjectState(obj.id, (state) => {
          state.id = obj.id;
          state.state = obj.state || "ready";
          state.roomId = obj.roomId;
          state.positionId = `${obj.roomId}_center`;
          state.occupiedBy = null;
        });
      }
    }
  }

  /**
   * Main entrypoint for processing structured construction commands
   */
  public executeCommand(command: HouseCommand): BuildResult {
    const issuedBy = command.issuedBy || "player_001";
    let result: BuildResult;

    switch (command.action) {
      case "place_object":
        result = this.placeObject(command.params as any, issuedBy);
        break;
      case "move_object":
        result = this.moveObject(command.params as any, issuedBy);
        break;
      case "rotate_object":
        result = this.rotateObject(command.params as any, issuedBy);
        break;
      case "edit_object":
        result = this.editObject(command.params as any, issuedBy);
        break;
      case "remove_object":
        result = this.removeObject(command.params as any, issuedBy);
        break;
      case "add_room":
        result = this.addRoom(command.params as any, issuedBy);
        break;
      case "modify_room":
        result = this.modifyRoom(command.params as any, issuedBy);
        break;
      case "remove_room":
        result = this.removeRoom(command.params as any, issuedBy);
        break;
      case "customize_floor":
        result = this.customizeFloor(command.params as any, issuedBy);
        break;
      case "customize_wall":
        result = this.customizeWall(command.params as any, issuedBy);
        break;
      default:
        result = {
          success: false,
          message: `Unknown build action: ${(command as any).action}`,
          command,
        };
    }

    if (result.success) {
      this.layout.version++;
      this.layout.modifiedBy = issuedBy;
      this.persist();
      this.pathfindingEngine.rebuildFromHouse(this.layout);
      this.syncPlacedObjectsWithStateManager();
      result.layout = this.layout;
    }

    return result;
  }

  /**
   * Places a new object from the catalog
   */
  public placeObject(
    params: {
      templateId: string;
      roomId: string;
      x: number;
      y: number;
      rotation?: 0 | 90 | 180 | 270;
      customName?: string;
    },
    issuedBy: "player_001" | "ai_001"
  ): BuildResult {
    const template = this.getTemplate(params.templateId);
    if (!template) {
      return {
        success: false,
        message: `Template "${params.templateId}" not found in build catalog`,
        command: { action: "place_object", params, issuedBy },
      };
    }

    const room = this.layout.rooms.find(r => r.id === params.roomId);
    if (!room) {
      return {
        success: false,
        message: `Room "${params.roomId}" does not exist in house layout`,
        command: { action: "place_object", params, issuedBy },
      };
    }

    const rotation = (params.rotation || 0) as 0 | 90 | 180 | 270;
    const isRotated = rotation === 90 || rotation === 270;
    const w = isRotated ? template.height : template.width;
    const h = isRotated ? template.width : template.height;

    // Check boundary within room
    if (
      params.x < room.x ||
      params.y < room.y ||
      params.x + w > room.x + room.width ||
      params.y + h > room.y + room.height
    ) {
      return {
        success: false,
        message: `Placement out of room bounds for "${room.name}"`,
        command: { action: "place_object", params, issuedBy },
      };
    }

    // Check collision with other solid objects
    if (template.isSolid) {
      for (const obj of this.layout.placedObjects) {
        if (!obj.isSolid) continue;
        const overlap = this.checkAABBOverlap(
          params.x,
          params.y,
          w,
          h,
          obj.x,
          obj.y,
          obj.width,
          obj.height
        );
        if (overlap) {
          return {
            success: false,
            message: `Cannot place item: overlaps with "${obj.name}"`,
            command: { action: "place_object", params, issuedBy },
          };
        }
      }
    }

    const uniqueId = `${params.templateId.replace(/_001$/, "")}_${Date.now().toString(36)}`;
    const newObj: PlacedHouseObject = {
      id: uniqueId,
      templateId: template.id,
      name: params.customName || template.name,
      type: template.type,
      roomId: room.id,
      x: params.x,
      y: params.y,
      width: w,
      height: h,
      rotation,
      icon: template.icon,
      color: template.color,
      state: template.defaultState,
      isSolid: template.isSolid,
      interactions: [...template.interactions],
      placedBy: issuedBy,
      placedAt: new Date().toISOString(),
    };

    this.layout.placedObjects.push(newObj);

    return {
      success: true,
      message: `${issuedBy === "ai_001" ? "Aria" : "You"} placed "${newObj.name}" in ${room.name}`,
      command: { action: "place_object", params, issuedBy },
      affectedObjectId: newObj.id,
      affectedRoomId: room.id,
    };
  }

  /**
   * Move an existing object
   */
  public moveObject(
    params: {
      objectId: string;
      newX: number;
      newY: number;
      newRoomId?: string;
      newRotation?: 0 | 90 | 180 | 270;
    },
    issuedBy: "player_001" | "ai_001"
  ): BuildResult {
    const obj = this.layout.placedObjects.find(o => o.id === params.objectId);
    if (!obj) {
      return {
        success: false,
        message: `Object "${params.objectId}" not found`,
        command: { action: "move_object", params, issuedBy },
      };
    }

    if (!Number.isInteger(params.newX) || !Number.isInteger(params.newY)) {
      return {
        success: false,
        message: "Object coordinates must be whole grid cells",
        command: { action: "move_object", params, issuedBy },
      };
    }

    const targetRoomId = params.newRoomId || obj.roomId;
    const room = this.layout.rooms.find(r => r.id === targetRoomId);
    if (!room) {
      return {
        success: false,
        message: `Target room "${targetRoomId}" not found`,
        command: { action: "move_object", params, issuedBy },
      };
    }

    const rot = params.newRotation !== undefined ? params.newRotation : obj.rotation;
    if (![0, 90, 180, 270].includes(rot)) {
      return {
        success: false,
        message: `Invalid rotation "${rot}"`,
        command: { action: "move_object", params, issuedBy },
      };
    }
    const isRotChange = (rot === 90 || rot === 270) !== (obj.rotation === 90 || obj.rotation === 270);
    const w = isRotChange ? obj.height : obj.width;
    const h = isRotChange ? obj.width : obj.height;

    // Check bounds
    if (
      params.newX < room.x ||
      params.newY < room.y ||
      params.newX + w > room.x + room.width ||
      params.newY + h > room.y + room.height
    ) {
      return {
        success: false,
        message: `Cannot move "${obj.name}": exceeds bounds of ${room.name}`,
        command: { action: "move_object", params, issuedBy },
      };
    }

    // Check collision with other solid objects
    if (obj.isSolid) {
      for (const other of this.layout.placedObjects) {
        if (other.id === obj.id || !other.isSolid) continue;
        if (
          this.checkAABBOverlap(
            params.newX,
            params.newY,
            w,
            h,
            other.x,
            other.y,
            other.width,
            other.height
          )
        ) {
          return {
            success: false,
            message: `Cannot move "${obj.name}": overlaps with "${other.name}"`,
            command: { action: "move_object", params, issuedBy },
          };
        }
      }
    }

    if (obj.isSolid) {
      for (const door of this.layout.doors) {
        const doorWidth = door.orientation === "horizontal" ? door.width : 1;
        const doorHeight = door.orientation === "vertical" ? door.width : 1;
        if (
          this.checkAABBOverlap(
            params.newX,
            params.newY,
            w,
            h,
            door.x,
            door.y,
            doorWidth,
            doorHeight
          )
        ) {
          return {
            success: false,
            message: `Cannot move "${obj.name}": blocks a doorway`,
            command: { action: "move_object", params, issuedBy },
          };
        }
      }
    }

    obj.x = params.newX;
    obj.y = params.newY;
    obj.width = w;
    obj.height = h;
    obj.rotation = rot;
    obj.roomId = targetRoomId;

    return {
      success: true,
      message: `Moved "${obj.name}" to ${room.name}`,
      command: { action: "move_object", params, issuedBy },
      affectedObjectId: obj.id,
      affectedRoomId: room.id,
    };
  }

  /**
   * Rotate an existing object by 90 degrees
   */
  public rotateObject(
    params: { objectId: string; angle?: 0 | 90 | 180 | 270 },
    issuedBy: "player_001" | "ai_001"
  ): BuildResult {
    const obj = this.layout.placedObjects.find(o => o.id === params.objectId);
    if (!obj) {
      return {
        success: false,
        message: `Object "${params.objectId}" not found`,
        command: { action: "rotate_object", params, issuedBy },
      };
    }

    const nextAngle = params.angle !== undefined
      ? params.angle
      : (((obj.rotation + 90) % 360) as 0 | 90 | 180 | 270);

    const oldW = obj.width;
    const oldH = obj.height;
    obj.width = oldH;
    obj.height = oldW;
    obj.rotation = nextAngle;

    const room = this.layout.rooms.find(r => r.id === obj.roomId);
    if (room) {
      if (obj.x + obj.width > room.x + room.width) {
        obj.x = room.x + room.width - obj.width;
      }
      if (obj.y + obj.height > room.y + room.height) {
        obj.y = room.y + room.height - obj.height;
      }
    }

    return {
      success: true,
      message: `Rotated "${obj.name}" to ${nextAngle}°`,
      command: { action: "rotate_object", params, issuedBy },
      affectedObjectId: obj.id,
    };
  }

    public editObject(
      params: {
        objectId: string;
        name?: string;
        width?: number;
        height?: number;
        rotation?: 0 | 90 | 180 | 270;
        color?: string;
        icon?: string;
        isSolid?: boolean;
        customData?: Record<string, unknown>;
      },
      issuedBy: "player_001" | "ai_001"
    ): BuildResult {
      const obj = this.layout.placedObjects.find(o => o.id === params.objectId);
      if (!obj) {
        return {
          success: false,
          message: `Object "${params.objectId}" not found`,
          command: { action: "edit_object", params, issuedBy },
        };
      }

      const name = params.name?.trim();
      const width = params.width ?? obj.width;
      const height = params.height ?? obj.height;
      const rotation = params.rotation ?? obj.rotation;
      const color = params.color ?? obj.color;
      const icon = params.icon ?? obj.icon;
      const isSolid = params.isSolid ?? obj.isSolid;
      const customData = { ...(obj.customData || {}), ...(params.customData || {}) };

      if (params.name !== undefined && (!name || name.length > 60)) {
        return {
          success: false,
          message: "Object name must be between 1 and 60 characters",
          command: { action: "edit_object", params, issuedBy },
        };
      }
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 20 || height > 20) {
        return {
          success: false,
          message: "Object dimensions must be whole grid cells between 1 and 20",
          command: { action: "edit_object", params, issuedBy },
        };
      }
      if (![0, 90, 180, 270].includes(rotation)) {
        return {
          success: false,
          message: `Invalid rotation "${rotation}"`,
          command: { action: "edit_object", params, issuedBy },
        };
      }
      if (params.color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) {
        return {
          success: false,
          message: "Object color must be a six-digit hex color",
          command: { action: "edit_object", params, issuedBy },
        };
      }
      if (params.icon !== undefined && (!icon || icon.length > 8)) {
        return {
          success: false,
          message: "Object icon must be between 1 and 8 characters",
          command: { action: "edit_object", params, issuedBy },
        };
      }

      const styleLimits: Record<string, [number, number]> = {
        fontSize: [8, 24],
        edgeWidth: [0, 8],
        cornerRadius: [0, 12],
      };
      const styleColors = ["labelColor", "edgeColor"];
      for (const [key, [min, max]] of Object.entries(styleLimits)) {
        const value = customData[key];
        if (value !== undefined &&
          (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)) {
          return {
            success: false,
            message: `${key} must be between ${min} and ${max}`,
            command: { action: "edit_object", params, issuedBy },
          };
        }
      }
      for (const key of styleColors) {
        const value = customData[key];
        if (value !== undefined && (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value))) {
          return {
            success: false,
            message: `${key} must be a six-digit hex color`,
            command: { action: "edit_object", params, issuedBy },
          };
        }
      }
      if (customData.labelText !== undefined &&
        (typeof customData.labelText !== "string" || customData.labelText.length > 30)) {
        return {
          success: false,
          message: "Object label must be 30 characters or fewer",
          command: { action: "edit_object", params, issuedBy },
        };
      }

      const room = this.layout.rooms.find(r => r.id === obj.roomId);
      const rotationChanged =
        (rotation === 90 || rotation === 270) !== (obj.rotation === 90 || obj.rotation === 270);
      const occupiedWidth = rotationChanged ? height : width;
      const occupiedHeight = rotationChanged ? width : height;
      if (!room || obj.x < room.x || obj.y < room.y ||
        obj.x + occupiedWidth > room.x + room.width ||
        obj.y + occupiedHeight > room.y + room.height) {
        return {
          success: false,
          message: "Edited object would extend beyond its room",
          command: { action: "edit_object", params, issuedBy },
        };
      }

      if (isSolid) {
        const collision = this.layout.placedObjects.find(other =>
          other.id !== obj.id &&
          other.isSolid &&
          this.checkAABBOverlap(
            obj.x, obj.y, occupiedWidth, occupiedHeight,
            other.x, other.y, other.width, other.height
          )
        );
        if (collision) {
          return {
            success: false,
            message: `Edited object would overlap "${collision.name}"`,
            command: { action: "edit_object", params, issuedBy },
          };
        }
        const doorway = this.layout.doors.find(door => this.checkAABBOverlap(
          obj.x,
          obj.y,
          occupiedWidth,
          occupiedHeight,
          door.x,
          door.y,
          door.orientation === "horizontal" ? door.width : 1,
          door.orientation === "vertical" ? door.width : 1
        ));
        if (doorway) {
          return {
            success: false,
            message: "Edited object would block a doorway",
            command: { action: "edit_object", params, issuedBy },
          };
        }
      }

      if (name) obj.name = name;
      obj.width = occupiedWidth;
      obj.height = occupiedHeight;
      obj.rotation = rotation;
      obj.color = color;
      obj.icon = icon;
      obj.isSolid = isSolid;
      obj.customData = customData;
      return {
        success: true,
        message: `Updated "${obj.name}"`,
        command: { action: "edit_object", params, issuedBy },
        affectedObjectId: obj.id,
        affectedRoomId: obj.roomId,
      };
    }

  /**
   * Remove an object from the house
   */
  public removeObject(
    params: { objectId: string },
    issuedBy: "player_001" | "ai_001"
  ): BuildResult {
    const index = this.layout.placedObjects.findIndex(o => o.id === params.objectId);
    if (index === -1) {
      return {
        success: false,
        message: `Object "${params.objectId}" not found`,
        command: { action: "remove_object", params, issuedBy },
      };
    }

    const [removed] = this.layout.placedObjects.splice(index, 1);

    return {
      success: true,
      message: `Removed "${removed.name}" from ${removed.roomId}`,
      command: { action: "remove_object", params, issuedBy },
      affectedObjectId: removed.id,
      affectedRoomId: removed.roomId,
    };
  }

  /**
   * Add a new room to the house layout
   */
  public addRoom(
    params: {
      roomId: string;
      name: string;
      type: string;
      gridX: number;
      gridY: number;
      gridWidth: number;
      gridHeight: number;
      floorType?: FloorMaterialType;
      wallColor?: string;
      description?: string;
    },
    issuedBy: "player_001" | "ai_001"
  ): BuildResult {
    if (this.layout.rooms.some(r => r.id === params.roomId)) {
      return {
        success: false,
        message: `A room with ID "${params.roomId}" already exists`,
        command: { action: "add_room", params, issuedBy },
      };
    }

    const roomName = params.name?.trim();
    if (!/^[a-z0-9_-]{1,40}$/i.test(params.roomId) ||
      !roomName || roomName.length > 40 ||
      ![params.gridX, params.gridY, params.gridWidth, params.gridHeight].every(Number.isInteger) ||
      params.gridWidth < 2 || params.gridHeight < 2 ||
      params.gridX < 0 || params.gridY < 0 ||
      params.gridX + params.gridWidth > this.layout.grid.cols ||
      params.gridY + params.gridHeight > this.layout.grid.rows) {
      return {
        success: false,
        message: "Room needs a valid ID/name, whole grid coordinates, and dimensions of at least 2×2 within the home",
        command: { action: "add_room", params, issuedBy },
      };
    }

    const overlappingRoom = this.layout.rooms.find(room => this.checkAABBOverlap(
      params.gridX, params.gridY, params.gridWidth, params.gridHeight,
      room.x, room.y, room.width, room.height
    ));
    if (overlappingRoom) {
      return {
        success: false,
        message: `Room would overlap "${overlappingRoom.name}"`,
        command: { action: "add_room", params, issuedBy },
      };
    }

    const newRoom: HouseRoom = {
      id: params.roomId,
      name: roomName,
      type: params.type || "room",
      x: params.gridX,
      y: params.gridY,
      width: params.gridWidth,
      height: params.gridHeight,
      floorType: params.floorType || "wood",
      wallColor: params.wallColor || "#f8fafc",
      wallStyle: "plaster",
      description: params.description || `A newly designed ${params.name}.`,
    };

    this.layout.rooms.push(newRoom);

    return {
      success: true,
      message: `Created new room: ${newRoom.name}`,
      command: { action: "add_room", params, issuedBy },
      affectedRoomId: newRoom.id,
    };
  }

  /**
   * Modify room properties
   */
  public modifyRoom(
    params: {
      roomId: string;
      name?: string;
      floorType?: FloorMaterialType;
      wallColor?: string;
      wallStyle?: WallStyleType;
      description?: string;
    },
    issuedBy: "player_001" | "ai_001"
  ): BuildResult {
    const room = this.layout.rooms.find(r => r.id === params.roomId);
    if (!room) {
      return {
        success: false,
        message: `Room "${params.roomId}" not found`,
        command: { action: "modify_room", params, issuedBy },
      };
    }

    if (params.name) room.name = params.name;
    if (params.floorType) room.floorType = params.floorType;
    if (params.wallColor) room.wallColor = params.wallColor;
    if (params.wallStyle) room.wallStyle = params.wallStyle;
    if (params.description) room.description = params.description;

    return {
      success: true,
      message: `Updated room: ${room.name}`,
      command: { action: "modify_room", params, issuedBy },
      affectedRoomId: room.id,
    };
  }

  /**
   * Remove a room and its placed contents
   */
  public removeRoom(
    params: { roomId: string },
    issuedBy: "player_001" | "ai_001"
  ): BuildResult {
    const index = this.layout.rooms.findIndex(r => r.id === params.roomId);
    if (index === -1) {
      return {
        success: false,
        message: `Room "${params.roomId}" not found`,
        command: { action: "remove_room", params, issuedBy },
      };
    }

    const [removed] = this.layout.rooms.splice(index, 1);
    this.layout.placedObjects = this.layout.placedObjects.filter(o => o.roomId !== removed.id);
    this.layout.doors = this.layout.doors.filter(d => d.roomA !== removed.id && d.roomB !== removed.id);

    return {
      success: true,
      message: `Removed room "${removed.name}"`,
      command: { action: "remove_room", params, issuedBy },
      affectedRoomId: removed.id,
    };
  }

  /**
   * Customize floor material for a room
   */
  public customizeFloor(
    params: { roomId: string; floorType: FloorMaterialType },
    issuedBy: "player_001" | "ai_001"
  ): BuildResult {
    const room = this.layout.rooms.find(r => r.id === params.roomId);
    if (!room) {
      return {
        success: false,
        message: `Room "${params.roomId}" not found`,
        command: { action: "customize_floor", params, issuedBy },
      };
    }

    room.floorType = params.floorType;

    return {
      success: true,
      message: `Updated floor in ${room.name} to ${params.floorType}`,
      command: { action: "customize_floor", params, issuedBy },
      affectedRoomId: room.id,
    };
  }

  /**
   * Customize wall color for a room
   */
  public customizeWall(
    params: { roomId: string; wallColor: string },
    issuedBy: "player_001" | "ai_001"
  ): BuildResult {
    const room = this.layout.rooms.find(r => r.id === params.roomId);
    if (!room) {
      return {
        success: false,
        message: `Room "${params.roomId}" not found`,
        command: { action: "customize_wall", params, issuedBy },
      };
    }

    room.wallColor = params.wallColor;

    return {
      success: true,
      message: `Updated wall color in ${room.name} to ${params.wallColor}`,
      command: { action: "customize_wall", params, issuedBy },
      affectedRoomId: room.id,
    };
  }

  private checkAABBOverlap(
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    x2: number,
    y2: number,
    w2: number,
    h2: number
  ): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  /**
   * Generates the authentic default 6-room Jabalpur apartment
   */
  private createDefaultLayout(): HouseLayout {
    return {
      id: "jabalpur_home_layout_001",
      name: "Jabalpur Residence",
      version: 1,
      grid: {
        cols: 40,
        rows: 38,
        cellSize: 20,
      },
      rooms: [
        {
          id: "bedroom",
          name: "Bedroom",
          type: "bedroom",
          x: 1,
          y: 1,
          width: 18,
          height: 11,
          floorType: "wood",
          wallColor: "#fef3c7",
          wallStyle: "plaster",
          description: "Cozy bedroom with wooden double bed, nightstand, and teak wardrobe.",
        },
        {
          id: "study_room",
          name: "Study Room",
          type: "study_room",
          x: 20,
          y: 1,
          width: 19,
          height: 11,
          floorType: "parquet",
          wallColor: "#f1f5f9",
          wallStyle: "plaster",
          description: "Sunlit study room with dual workstations, bookshelves, and desktop PC.",
        },
        {
          id: "kitchen",
          name: "Kitchen",
          type: "kitchen",
          x: 1,
          y: 13,
          width: 18,
          height: 11,
          floorType: "granite",
          wallColor: "#fef9c3",
          wallStyle: "tile",
          description: "Granite kitchen with 3-burner gas stove, sink, fridge, and dining table.",
        },
        {
          id: "toilet",
          name: "Bathroom",
          type: "toilet",
          x: 20,
          y: 13,
          width: 19,
          height: 11,
          floorType: "tile",
          wallColor: "#e0f2fe",
          wallStyle: "tile",
          description: "Cool tiled bathroom with shower enclosure, vanity basin, and western toilet.",
        },
        {
          id: "living_room",
          name: "Living Room",
          type: "living_room",
          x: 1,
          y: 25,
          width: 19,
          height: 12,
          floorType: "wood",
          wallColor: "#f8fafc",
          wallStyle: "plaster",
          description: "Welcoming living hall with plush sofa, 55-inch smart TV, coffee table, and plants.",
        },
        {
          id: "balcony",
          name: "Balcony",
          type: "balcony",
          x: 21,
          y: 26,
          width: 18,
          height: 11,
          floorType: "terracotta",
          wallColor: "#f0fdf4",
          wallStyle: "brick",
          description: "Breezy open balcony with cane chairs, potted jasmine, and fresh morning air.",
        },
        {
          id: "hall_north",
          name: "North Hall",
          type: "hallway",
          x: 1,
          y: 12,
          width: 38,
          height: 1,
          floorType: "wood",
          wallColor: "#94a3b8",
          wallStyle: "plaster",
          description: "A shared corridor connecting the north rooms.",
        },
        {
          id: "hall_south",
          name: "South Hall",
          type: "hallway",
          x: 1,
          y: 24,
          width: 38,
          height: 1,
          floorType: "wood",
          wallColor: "#94a3b8",
          wallStyle: "plaster",
          description: "A shared corridor connecting the south rooms.",
        },
      ],
      walls: [
        // Exterior Boundary
        { id: "wall_ext_north", x1: 0, y1: 0, x2: 39, y2: 0, thickness: 1, isExterior: true },
        { id: "wall_ext_west", x1: 0, y1: 0, x2: 0, y2: 37, thickness: 1, isExterior: true },
        { id: "wall_ext_south", x1: 0, y1: 37, x2: 39, y2: 37, thickness: 1, isExterior: true },
        { id: "wall_ext_east", x1: 39, y1: 0, x2: 39, y2: 37, thickness: 1, isExterior: true },

        // Central Vertical Divider
        { id: "wall_int_vert_top", x1: 19, y1: 1, x2: 19, y2: 12, thickness: 1, isExterior: false },
        { id: "wall_int_vert_mid", x1: 19, y1: 13, x2: 19, y2: 24, thickness: 1, isExterior: false },
        { id: "wall_int_vert_bot", x1: 20, y1: 25, x2: 20, y2: 37, thickness: 1, isExterior: false },

        // Horizontal Dividers
        { id: "wall_int_horiz_1", x1: 1, y1: 12, x2: 38, y2: 12, thickness: 1, isExterior: false },
        { id: "wall_int_horiz_2", x1: 1, y1: 24, x2: 38, y2: 24, thickness: 1, isExterior: false },
      ],
      doors: [
        { id: "door_bed_study", roomA: "bedroom", roomB: "study_room", x: 19, y: 6, width: 2, orientation: "vertical", isOpen: true },
        { id: "door_bed_kitchen", roomA: "bedroom", roomB: "kitchen", x: 9, y: 12, width: 2, orientation: "horizontal", isOpen: true },
        { id: "door_study_kitchen", roomA: "study_room", roomB: "kitchen", x: 20, y: 12, width: 2, orientation: "horizontal", isOpen: true },
        { id: "door_kitchen_toilet", roomA: "kitchen", roomB: "toilet", x: 19, y: 17, width: 2, orientation: "vertical", isOpen: true },
        { id: "door_bed_living", roomA: "bedroom", roomB: "living_room", x: 6, y: 24, width: 2, orientation: "horizontal", isOpen: true },
        { id: "door_kitchen_living", roomA: "kitchen", roomB: "living_room", x: 14, y: 24, width: 2, orientation: "horizontal", isOpen: true },
        { id: "door_living_balcony", roomA: "living_room", roomB: "balcony", x: 20, y: 30, width: 2, orientation: "vertical", isOpen: true },
      ],
      windows: [
        { id: "win_bed_north", roomId: "bedroom", x: 6, y: 0, width: 4, facing: "north" },
        { id: "win_study_north", roomId: "study_room", x: 26, y: 0, width: 5, facing: "north" },
        { id: "win_kitchen_west", roomId: "kitchen", x: 0, y: 16, width: 4, facing: "west" },
        { id: "win_living_west", roomId: "living_room", x: 0, y: 28, width: 5, facing: "west" },
        { id: "win_balcony_south", roomId: "balcony", x: 25, y: 37, width: 8, facing: "south" },
      ],
      placedObjects: [
        // --- BEDROOM ---
        {
          id: "bed_001",
          templateId: "double_bed_001",
          name: "Teakwood Double Bed",
          type: "furniture",
          roomId: "bedroom",
          x: 2,
          y: 2,
          width: 5,
          height: 6,
          rotation: 0,
          icon: "🛏️",
          color: "#854d0e",
          state: "made",
          isSolid: true,
          interactions: ["lie_down_bed", "sit_up_bed", "get_up", "make_bed", "sleep_night", "nap"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "bedside_table_001",
          templateId: "bedside_table_001",
          name: "Bedside Nightstand",
          type: "furniture",
          roomId: "bedroom",
          x: 8,
          y: 2,
          width: 2,
          height: 2,
          rotation: 0,
          icon: "🪑",
          color: "#9a3412",
          state: "clean",
          isSolid: true,
          interactions: ["read_in_bed"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "lamp_001",
          templateId: "bedside_lamp_001",
          name: "Brass Bedside Lamp",
          type: "lighting",
          roomId: "bedroom",
          x: 8,
          y: 3,
          width: 1,
          height: 1,
          rotation: 0,
          icon: "💡",
          color: "#eab308",
          state: "off",
          isSolid: false,
          interactions: ["turn_on_lamp", "turn_off_lamp"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "phone_001",
          templateId: "books_stack_001",
          name: "Mohit's Phone",
          type: "electronics",
          roomId: "bedroom",
          x: 8,
          y: 4,
          width: 1,
          height: 1,
          rotation: 0,
          icon: "📱",
          color: "#38bdf8",
          state: "idle",
          isSolid: false,
          interactions: ["check_phone", "check_messages", "play_alarm", "listen_music_phone"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "wardrobe_001",
          templateId: "wardrobe_001",
          name: "Teakwood Mirrored Wardrobe",
          type: "furniture",
          roomId: "bedroom",
          x: 13,
          y: 2,
          width: 3,
          height: 2,
          rotation: 0,
          icon: "🚪",
          color: "#581c87",
          state: "closed",
          isSolid: true,
          interactions: ["open_wardrobe", "close_wardrobe", "change_clothes", "wear_sleepwear", "wear_casual", "wear_outdoor"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },

        // --- STUDY ROOM ---
        {
          id: "desk_001",
          templateId: "study_desk_001",
          name: "Sheesham Workstation Desk",
          type: "furniture",
          roomId: "study_room",
          x: 29,
          y: 2,
          width: 5,
          height: 3,
          rotation: 0,
          icon: "🖥️",
          color: "#78350f",
          state: "clear",
          isSolid: true,
          interactions: ["study_subject", "code_project", "read_book"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "desk_chair_001",
          templateId: "ergo_chair_001",
          name: "Ergonomic Study Chair",
          type: "furniture",
          roomId: "study_room",
          x: 30,
          y: 5,
          width: 2,
          height: 2,
          rotation: 0,
          icon: "🪑",
          color: "#0284c7",
          state: "empty",
          isSolid: true,
          interactions: ["sit_down_chair", "stand_up"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "computer_001",
          templateId: "desktop_pc_001",
          name: "Developer Workstation PC",
          type: "electronics",
          roomId: "study_room",
          x: 30,
          y: 2,
          width: 2,
          height: 2,
          rotation: 0,
          icon: "🖥️",
          color: "#38bdf8",
          state: "off",
          isSolid: false,
          interactions: ["power_computer", "code_project", "listen_lofi_music"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "bookshelf_001",
          templateId: "bookshelf_001",
          name: "Solid Oak Bookshelf",
          type: "furniture",
          roomId: "study_room",
          x: 22,
          y: 2,
          width: 3,
          height: 2,
          rotation: 0,
          icon: "📚",
          color: "#b45309",
          state: "ready",
          isSolid: true,
          interactions: ["read_book", "read_math_book", "read_physics_book", "read_psychology_book", "read_mohit_notebook", "read_aria_notebook"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "chess_set_001",
          templateId: "chess_set_001",
          name: "Handcrafted Wooden Chess Set",
          type: "decor",
          roomId: "study_room",
          x: 25,
          y: 5,
          width: 1,
          height: 1,
          rotation: 0,
          icon: "♟️",
          color: "#e2e8f0",
          state: "ready",
          isSolid: false,
          interactions: ["play_chess"],
          placedBy: "ai_001",
          placedAt: new Date().toISOString(),
        },

        // --- KITCHEN ---
        {
          id: "stove_001",
          templateId: "gas_stove_001",
          name: "3-Burner Gas Stove",
          type: "appliance",
          roomId: "kitchen",
          x: 2,
          y: 15,
          width: 3,
          height: 2,
          rotation: 0,
          icon: "🔥",
          color: "#dc2626",
          state: "idle",
          isSolid: true,
          interactions: ["cook_breakfast", "cook_meal", "make_masala_chai", "brew_tea", "brew_chai_duo"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "counter_001",
          templateId: "study_desk_001",
          name: "Granite Kitchen Countertop",
          type: "furniture",
          roomId: "kitchen",
          x: 6,
          y: 15,
          width: 5,
          height: 2,
          rotation: 0,
          icon: "🪵",
          color: "#1e293b",
          state: "clean",
          isSolid: true,
          interactions: ["wipe_countertop", "prepare_snack"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "plate_001",
          templateId: "chai_service_001",
          name: "Stainless Steel Thali Plate",
          type: "decor",
          roomId: "kitchen",
          x: 8,
          y: 15,
          width: 1,
          height: 1,
          rotation: 0,
          icon: "🍽️",
          color: "#94a3b8",
          state: "empty",
          isSolid: false,
          interactions: ["serve_meal", "eat_meal_from_plate"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "chai_cup_001",
          templateId: "chai_service_001",
          name: "Cutting Chai Cup",
          type: "decor",
          roomId: "kitchen",
          x: 9,
          y: 15,
          width: 1,
          height: 1,
          rotation: 0,
          icon: "☕",
          color: "#ea580c",
          state: "empty",
          isSolid: false,
          interactions: ["sip_hot_chai", "drink_hot_chai"],
          placedBy: "ai_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "sink_001",
          templateId: "kitchen_sink_001",
          name: "Stainless Steel Kitchen Sink",
          type: "fixture",
          roomId: "kitchen",
          x: 13,
          y: 15,
          width: 3,
          height: 2,
          rotation: 0,
          icon: "🚰",
          color: "#94a3b8",
          state: "clean",
          isSolid: true,
          interactions: ["wash_dishes", "wash_hands_kitchen", "drink_water_glass"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "fridge_001",
          templateId: "refrigerator_001",
          name: "Frost-Free Refrigerator",
          type: "appliance",
          roomId: "kitchen",
          x: 13,
          y: 20,
          width: 3,
          height: 2,
          rotation: 0,
          icon: "🧊",
          color: "#475569",
          state: "closed",
          isSolid: true,
          interactions: ["drink_cold_water", "open_fridge"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "dining_chair_001",
          templateId: "dining_chair_001",
          name: "Kitchen Dining Stool",
          type: "furniture",
          roomId: "kitchen",
          x: 8,
          y: 18,
          width: 2,
          height: 2,
          rotation: 0,
          icon: "🪑",
          color: "#d97706",
          state: "empty",
          isSolid: true,
          interactions: ["sit_down_kitchen_stool", "stand_up"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },

        // --- BATHROOM / TOILET ---
        {
          id: "toilet_001",
          templateId: "toilet_001",
          name: "Dual-Flush Western Toilet",
          type: "fixture",
          roomId: "toilet",
          x: 22,
          y: 15,
          width: 2,
          height: 2,
          rotation: 0,
          icon: "🚽",
          color: "#f8fafc",
          state: "ready",
          isSolid: true,
          interactions: ["use_toilet", "flush_toilet"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "washbasin_001",
          templateId: "washbasin_001",
          name: "Ceramic Bathroom Washbasin",
          type: "fixture",
          roomId: "toilet",
          x: 27,
          y: 15,
          width: 3,
          height: 2,
          rotation: 0,
          icon: "🪞",
          color: "#0284c7",
          state: "ready",
          isSolid: true,
          interactions: ["brush_teeth", "wash_face", "wipe_mirror"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "shower_001",
          templateId: "shower_001",
          name: "Enclosed Overhead Rain Shower",
          type: "fixture",
          roomId: "toilet",
          x: 33,
          y: 15,
          width: 3,
          height: 3,
          rotation: 0,
          icon: "🚿",
          color: "#06b6d4",
          state: "dry",
          isSolid: true,
          interactions: ["take_shower", "take_quick_bath"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },

        // --- LIVING ROOM ---
        {
          id: "sofa_001",
          templateId: "plush_sofa_001",
          name: "Comfortable Living Sofa",
          type: "furniture",
          roomId: "living_room",
          x: 5,
          y: 27,
          width: 6,
          height: 3,
          rotation: 0,
          icon: "🛋️",
          color: "#3b82f6",
          state: "empty",
          isSolid: true,
          interactions: ["sit_on_sofa", "relax_on_sofa", "stand_from_sofa"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "table_001",
          templateId: "coffee_table_001",
          name: "Low Center Coffee Table",
          type: "furniture",
          roomId: "living_room",
          x: 6,
          y: 31,
          width: 4,
          height: 2,
          rotation: 0,
          icon: "🪵",
          color: "#92400e",
          state: "clean",
          isSolid: true,
          interactions: ["wipe_living_table", "play_chess"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "tv_cabinet_001",
          templateId: "tv_credenza_001",
          name: "Media Console Cabinet",
          type: "furniture",
          roomId: "living_room",
          x: 12,
          y: 27,
          width: 5,
          height: 2,
          rotation: 0,
          icon: "📺",
          color: "#1e293b",
          state: "ready",
          isSolid: true,
          interactions: ["watch_tv"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "tv_001",
          templateId: "smart_tv_001",
          name: "55-Inch 4K Smart TV",
          type: "electronics",
          roomId: "living_room",
          x: 12,
          y: 27,
          width: 4,
          height: 1,
          rotation: 0,
          icon: "📺",
          color: "#0f172a",
          state: "off",
          isSolid: false,
          interactions: ["watch_tv"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "soundbar_001",
          templateId: "soundbar_001",
          name: "Bluetooth Soundbar Speaker",
          type: "electronics",
          roomId: "living_room",
          x: 13,
          y: 28,
          width: 3,
          height: 1,
          rotation: 0,
          icon: "📻",
          color: "#334155",
          state: "off",
          isSolid: false,
          interactions: ["listen_living_music"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "plant_001",
          templateId: "money_plant_001",
          name: "Trailing Money Plant",
          type: "plant",
          roomId: "living_room",
          x: 2,
          y: 27,
          width: 1,
          height: 1,
          rotation: 0,
          icon: "🪴",
          color: "#22c55e",
          state: "healthy",
          isSolid: false,
          interactions: ["inspect_plant", "wipe_plant_leaves"],
          placedBy: "ai_001",
          placedAt: new Date().toISOString(),
        },

        // --- BALCONY ---
        {
          id: "cane_chair_001",
          templateId: "cane_chair_001",
          name: "Balcony Cane Chair",
          type: "furniture",
          roomId: "balcony",
          x: 23,
          y: 28,
          width: 2,
          height: 2,
          rotation: 0,
          icon: "🪑",
          color: "#ca8a04",
          state: "empty",
          isSolid: true,
          interactions: ["sit_balcony_chair", "stand_up"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "bistro_table_001",
          templateId: "bistro_table_001",
          name: "Balcony Bistro Table",
          type: "furniture",
          roomId: "balcony",
          x: 26,
          y: 28,
          width: 2,
          height: 2,
          rotation: 0,
          icon: "☕",
          color: "#334155",
          state: "clean",
          isSolid: true,
          interactions: ["offer_chai"],
          placedBy: "player_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "planters_001",
          templateId: "balcony_planters_001",
          name: "Jasmine & Marigold Planters",
          type: "plant",
          roomId: "balcony",
          x: 30,
          y: 34,
          width: 4,
          height: 1,
          rotation: 0,
          icon: "🌸",
          color: "#ec4899",
          state: "moist",
          isSolid: false,
          interactions: ["water_balcony_plants"],
          placedBy: "ai_001",
          placedAt: new Date().toISOString(),
        },
        {
          id: "fairy_lights_001",
          templateId: "fairy_lights_001",
          name: "Balcony Fairy Lights",
          type: "lighting",
          roomId: "balcony",
          x: 24,
          y: 35,
          width: 4,
          height: 1,
          rotation: 0,
          icon: "✨",
          color: "#fef08a",
          state: "on",
          isSolid: false,
          interactions: ["lean_on_railing"],
          placedBy: "ai_001",
          placedAt: new Date().toISOString(),
        },
      ],
      lastModified: new Date().toISOString(),
      modifiedBy: "system",
    };
  }

  private addDefaultHallways(): boolean {
    if (this.layout.grid.cols !== 40 || this.layout.grid.rows !== 38) return false;
    const hallways: HouseRoom[] = [
      {
        id: "hall_north",
        name: "North Hall",
        type: "hallway",
        x: 1,
        y: 12,
        width: 38,
        height: 1,
        floorType: "wood",
        wallColor: "#94a3b8",
        wallStyle: "plaster",
        description: "A shared corridor connecting the north rooms.",
      },
      {
        id: "hall_south",
        name: "South Hall",
        type: "hallway",
        x: 1,
        y: 24,
        width: 38,
        height: 1,
        floorType: "wood",
        wallColor: "#94a3b8",
        wallStyle: "plaster",
        description: "A shared corridor connecting the south rooms.",
      },
    ];
    let changed = false;
    for (const hallway of hallways) {
      if (!this.layout.rooms.some(room => room.id === hallway.id)) {
        this.layout.rooms.push(hallway);
        changed = true;
      }
    }
    return changed;
  }
}
