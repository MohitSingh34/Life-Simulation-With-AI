import { ConfigLoader } from "./ConfigLoader.js";
import { HouseBuilderEngine } from "./HouseBuilderEngine.js";
import { StateManager } from "./StateManager.js";
import { ObjectConfig } from "../types/index.js";
import { BuildItemTemplate, PlacedHouseObject } from "../types/house.js";

type WorldPoint = { x: number; y: number };

export class ObjectInteractionEngine {
  constructor(
    private readonly stateManager: StateManager,
    private readonly configLoader: ConfigLoader,
    private readonly houseBuilder: HouseBuilderEngine
  ) {}

  public getObject(objectId: string): ObjectConfig | undefined {
    const configured = this.configLoader.getObject(objectId);
    if (configured) {
      const template = configured.houseTemplateId
        ? this.houseBuilder.getTemplate(configured.houseTemplateId)
        : undefined;
      const seatCount = configured.seatCount ??
        template?.seatCount ??
        (template?.category === "seating" || this.hasSeatName(configured.name) ? 1 : 0);
      return seatCount > 0
        ? {
            ...configured,
            seatCount,
            interactions: [...new Set([...configured.interactions, "sit_on_seat"])],
          }
        : configured;
    }

    const placed = this.houseBuilder.getLayout().placedObjects.find((object) => object.id === objectId);
    if (!placed) return undefined;
    const template = this.houseBuilder.getTemplate(placed.templateId);
    if (!template) return undefined;
    const seatCount = this.getSeatCountForTemplate(template, placed.name);

    return {
      id: placed.id,
      name: placed.name,
      type: placed.type,
      roomId: placed.roomId,
      positionId: placed.id,
      defaultState: template.defaultState,
      possibleStates: template.possibleStates,
      interactions: seatCount > 0
        ? [...new Set([...this.getPlacedInteractions(placed), "sit_on_seat"])]
        : this.getPlacedInteractions(placed),
      description: template.description,
      portable: false,
      icon: placed.icon,
      ...(seatCount > 0 ? { seatCount } : {}),
    };
  }

  public getObjectsForAction(roomId: string, actionId: string): ObjectConfig[] {
    const configured = this.configLoader
      .getAllObjects()
      .filter((object) => {
        const state = this.stateManager.getObjectState(object.id);
        return (state.roomId ?? object.roomId) === roomId &&
          (this.getObject(object.id)?.interactions.includes(actionId) ?? false);
      });
    const mappedPlacementIds = new Set(
      configured
        .map((object) => this.findPlacement(object)?.id)
        .filter((id): id is string => Boolean(id))
    );
    const configuredIds = new Set(configured.map((object) => object.id));
    const placed = this.houseBuilder.getLayout().placedObjects
      .filter(
        (object) =>
          object.roomId === roomId &&
          (this.getObject(object.id)?.interactions.includes(actionId) ?? false) &&
          !configuredIds.has(object.id) &&
          !mappedPlacementIds.has(object.id)
      )
      .map((object) => this.getObject(object.id))
      .filter((object): object is ObjectConfig => Boolean(object));

    return [...configured, ...placed];
  }

  public findTargetObject(actorId: string, actionId: string): ObjectConfig | undefined {
    const actor = this.stateManager.getCharacter(actorId);
    if (!actor) return undefined;

    const actorPoint = this.getCharacterPoint(actor.location.roomId, actor.location.positionId);
    return this.getObjectsForAction(actor.location.roomId, actionId)
      .filter((object) => {
        const state = this.stateManager.getObjectState(object.id);
        return (state.roomId ?? object.roomId) === actor.location.roomId &&
          (!state.heldBy || state.heldBy === actor.id) &&
          (actionId !== "sit_on_seat" ||
            Boolean(this.getAvailableSeatPositionId(object.id, actor.id)));
      })
      .sort((left, right) => {
        const leftDistance = this.distanceToObject(actorPoint, left, actor.location.positionId);
        const rightDistance = this.distanceToObject(actorPoint, right, actor.location.positionId);
        return leftDistance - rightDistance || left.id.localeCompare(right.id);
      })[0];
  }

  public getPositionId(objectId: string): string | undefined {
    const object = this.getObject(objectId);
    if (!object) return undefined;
    if (this.configLoader.getObject(objectId)) {
      const state = this.stateManager.getObjectState(objectId);
      const hasRuntimePosition = Number.isFinite(state.x) ||
        (state.roomId !== undefined && state.roomId !== object.roomId);
      return hasRuntimePosition
        ? state.positionId ?? object.positionId
        : object.positionId;
    }

    const placement = this.findPlacement(object);
    return placement?.id ?? this.stateManager.getObjectState(objectId).positionId ?? object.positionId;
  }

  public getAvailableSeatPositionId(objectId: string, actorId: string): string | undefined {
    const object = this.getObject(objectId);
    if (!object || !object.seatCount) return undefined;
    const occupancyIds = this.getOccupancyObjectIds(objectId);
    for (let index = 0; index < object.seatCount; index++) {
      const occupant = occupancyIds
        .map((id) => this.stateManager.getObjectState(id))
        .map((state) => state.occupiedSeats?.[String(index)] ??
          (index === 0 ? state.occupiedBy : null))
        .find(Boolean);
      if (!occupant || occupant === actorId) {
        return object.seatCount === 1
          ? this.getPositionId(objectId)
          : `${objectId}__seat_${index}`;
      }
    }
    return undefined;
  }

  public getSeatIndexForPosition(objectId: string, positionId: string): number {
    const match = new RegExp(`^${objectId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}__seat_(\\d+)$`).exec(positionId);
    return match ? Number(match[1]) : 0;
  }

  public getOccupancyObjectIds(objectId: string): string[] {
    const object = this.getObject(objectId);
    if (!object) return [objectId];
    const placement = this.findPlacement(object);
    const configured = this.configLoader.getAllObjects().find(
      (candidate) =>
        candidate.id === objectId ||
        (placement && this.findPlacement(candidate)?.id === placement.id)
    );
    return [...new Set([objectId, placement?.id, configured?.id].filter(
      (id): id is string => Boolean(id)
    ))];
  }

  public getRoomId(objectId: string): string | undefined {
    const object = this.getObject(objectId);
    if (!object) return undefined;
    return this.stateManager.getObjectState(objectId).roomId ?? object.roomId;
  }

  public getPositionPoint(roomId: string, positionId: string): WorldPoint {
    return this.getCharacterPoint(roomId, positionId);
  }

  public getCanonicalPositionId(roomId: string, positionId: string): string {
    const placed = this.houseBuilder.getLayout().placedObjects.find(
      (object) => object.roomId === roomId && object.id === positionId
    );
    if (!placed) return positionId;

    const configured = this.configLoader.getAllObjects().find(
      (object) =>
        object.roomId === roomId &&
        this.findPlacement(object)?.id === placed.id
    );
    return configured?.positionId ?? positionId;
  }

  public getOccupancyObjectId(roomId: string, positionId: string): string | undefined {
    const seatPosition = /^(.*)__seat_\d+$/.exec(positionId);
    if (seatPosition) {
      const object = this.getObject(seatPosition[1]);
      return object && this.getRoomId(object.id) === roomId ? object.id : undefined;
    }
    const roomPosition = this.configLoader.getRoom(roomId)?.positions.find(
      (position) => position.id === positionId
    );
    if (roomPosition?.objectId) return roomPosition.objectId;

    const placed = this.houseBuilder.getLayout().placedObjects.find(
      (object) => object.roomId === roomId && object.id === positionId
    );
    if (!placed) return undefined;

    const configured = this.configLoader.getAllObjects().find(
      (object) =>
        object.roomId === roomId &&
        this.findPlacement(object)?.id === placed.id
    );
    return configured?.id ?? placed.id;
  }

  private getCharacterPoint(roomId: string, positionId: string): WorldPoint {
    const seatPosition = /^(.*)__seat_(\d+)$/.exec(positionId);
    if (seatPosition) {
      const placed = this.findPlacementByObjectId(seatPosition[1]);
      if (placed) return this.getSeatPoint(placed, Number(seatPosition[2]));
    }

    const floorPosition = /^floor_(\d+)_(\d+)$/.exec(positionId);
    if (floorPosition) {
      return {
        x: Number(floorPosition[1]) + 0.5,
        y: Number(floorPosition[2]) + 0.5,
      };
    }

    const roomPosition = this.configLoader.getRoom(roomId)?.positions.find(
      (position) => position.id === positionId
    );
    const positionedObject = roomPosition?.objectId
      ? this.configLoader.getObject(roomPosition.objectId)
      : this.configLoader.getAllObjects().find(
          (object) => object.roomId === roomId && object.positionId === positionId
        );
    const placement = positionedObject ? this.findPlacement(positionedObject) : undefined;
    if (placement) return this.centerOf(placement);

    const directPlacement = this.houseBuilder.getLayout().placedObjects.find(
      (object) => object.roomId === roomId && object.id === positionId
    );
    if (directPlacement) return this.centerOf(directPlacement);

    const room = this.houseBuilder.getLayout().rooms.find((candidate) => candidate.id === roomId);
    if (room) {
      const roomCenter = { x: room.x + room.width / 2, y: room.y + room.height / 2 };
      if (/door|entrance/i.test(positionId)) {
        const doors = this.houseBuilder.getLayout().doors
          .filter((door) => door.roomA === roomId || door.roomB === roomId)
          .map((door) => ({
            x: door.x + (door.orientation === "horizontal" ? door.width / 2 : 0.5),
            y: door.y + (door.orientation === "vertical" ? door.width / 2 : 0.5),
          }))
          .sort((left, right) =>
            Math.hypot(left.x - roomCenter.x, left.y - roomCenter.y) -
            Math.hypot(right.x - roomCenter.x, right.y - roomCenter.y)
          );
        const door = doors[0];
        if (door) {
          const distance = Math.hypot(roomCenter.x - door.x, roomCenter.y - door.y) || 1;
          return {
            x: door.x + (roomCenter.x - door.x) / distance * 0.6,
            y: door.y + (roomCenter.y - door.y) / distance * 0.6,
          };
        }
      }
      return roomCenter;
    }

    return { x: 0, y: 0 };
  }

  private distanceToObject(point: WorldPoint, object: ObjectConfig, positionId: string): number {
    const state = this.stateManager.getObjectState(object.id);
    if (Number.isFinite(state.x) && Number.isFinite(state.y)) {
      return Math.hypot(point.x - state.x!, point.y - state.y!);
    }
    const placement = this.findPlacement(object);
    if (!placement) {
      return object.positionId === positionId ? 0 : Number.MAX_SAFE_INTEGER;
    }

    const dx = Math.max(placement.x - point.x, 0, point.x - (placement.x + placement.width));
    const dy = Math.max(placement.y - point.y, 0, point.y - (placement.y + placement.height));
    return Math.hypot(dx, dy);
  }

  private findPlacement(object: ObjectConfig): PlacedHouseObject | undefined {
    const placedObjects = this.houseBuilder.getLayout().placedObjects;
    return placedObjects.find(
      (placed) =>
        placed.roomId === object.roomId &&
        (
          placed.id === object.id ||
          placed.id === object.houseObjectId ||
          placed.templateId === object.houseTemplateId
        )
    );
  }

  private getPlacedInteractions(placed: PlacedHouseObject): string[] {
    const templateInteractions = this.houseBuilder.getTemplate(placed.templateId)?.interactions ?? [];
    return [...new Set([...placed.interactions, ...templateInteractions])];
  }

  private getSeatCountForTemplate(template: BuildItemTemplate, name: string): number {
    return template.seatCount ??
      (template.category === "seating" || this.hasSeatName(name) ? 1 : 0);
  }

  private hasSeatName(name: string): boolean {
    return /\b(chair|stool|sofa|bench|seat)\b/i.test(name);
  }

  private findPlacementByObjectId(objectId: string): PlacedHouseObject | undefined {
    const object = this.getObject(objectId);
    if (!object) return undefined;
    return this.findPlacement(object);
  }

  private getSeatPoint(placed: PlacedHouseObject, seatIndex: number): WorldPoint {
    const center = this.centerOf(placed);
    const offsets = [
      { x: 0, y: -placed.height / 2 - 0.45 },
      { x: placed.width / 2 + 0.45, y: 0 },
      { x: 0, y: placed.height / 2 + 0.45 },
      { x: -placed.width / 2 - 0.45, y: 0 },
    ];
    const offset = offsets[seatIndex % offsets.length];
    return { x: center.x + offset.x, y: center.y + offset.y };
  }

  private centerOf(object: PlacedHouseObject): WorldPoint {
    return {
      x: object.x + object.width / 2,
      y: object.y + object.height / 2,
    };
  }
}
