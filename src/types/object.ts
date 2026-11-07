// ============================================================
// OBJECT TYPES — Furniture, items, interactive objects
// ============================================================

/** An interactive object in the world */
export interface ObjectConfig {
  id: string;
  name: string;
  type: string | string[];
  roomId: string;
  positionId: string;
  /** Current state */
  defaultState: string;
  /** All possible states */
  possibleStates: string[];
  /** Actions that can be performed on this object */
  interactions: string[]; // action IDs
  /** Description when character is near */
  description: string;
  /** State-specific descriptions */
  stateDescriptions?: Record<string, string>;
  /** Is this object portable? */
  portable: boolean;
  /** Icon for display */
  icon: string;
  /** Runtime state shown in object interaction UI */
  currentState?: string;
  /** Portable items displayed as contents of this object */
  containedObjectIds?: string[];
  /** Matching house-build template when this configured object has a map placement */
  houseTemplateId?: string;
  /** Specific default house placement represented by this configured object */
  houseObjectId?: string;
  /** Number of distinct sitting places represented by this object. */
  seatCount?: number;
}

/** Runtime state of an object */
export interface ObjectState {
  id: string;
  state: string;
  roomId?: string;
  positionId?: string;
  /** Grid-space center where a portable object was last put down */
  x?: number;
  y?: number;
  heldBy?: string | null;
  /** Who is using this object right now? */
  occupiedBy: string | null;
  /** Per-seat occupants for furniture with multiple seats. */
  occupiedSeats?: Record<string, string>;
}
