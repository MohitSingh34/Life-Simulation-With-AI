// ============================================================
// ACTION TYPES — What characters can do
// ============================================================

import { Posture, CharacterClothing } from "./character.js";

/** A condition that must be true for an action to be available */
export interface ActionPrecondition {
  /** Character must be in this room (or null = any room, or list of rooms) */
  roomId?: string | string[] | null;
  /** Character must be at this position (or null = any position, or list of positions) */
  positionId?: string | string[] | null;
  /** Character must have this posture */
  posture?: Posture | Posture[];
  /** Character must be holding nothing (or a specific item) */
  holding?: string | null | "any" | "none";
  /** Target object must be in this state */
  objectState?: string | string[];
  /** Target object must NOT be in this state */
  objectStateNot?: string | string[];
  /** Specific objects in world must be in these states */
  requiredObjectStates?: Record<string, string | string[]>;
  /** A specific need must be above/below a threshold */
  needAbove?: { need: string; value: number };
  needBelow?: { need: string; value: number };
  /** Requires roommate or another character to be in the same room */
  requiresSharedRoom?: boolean;
}

/** Effects an action has on character/world state */
export interface ActionEffect {
  /** Change character posture */
  posture?: Posture;
  /** Change character orientation */
  orientation?: string;
  /** Move character to a position */
  moveToPosition?: string;
  /** Move character to a room */
  moveToRoom?: string;
  /** Change an object's state */
  objectState?: string;
  /** Multiple object state changes by ID */
  objectStates?: Record<string, string>;
  /** Pick up an object */
  pickUp?: boolean;
  /** Put down held object */
  putDown?: boolean;
  /** Need changes (positive = increase, negative = decrease) */
  needChanges?: Partial<Record<string, number>>;
  /** Emotion changes (e.g. confidence, stress, happiness) */
  emotionChanges?: Partial<Record<string, number>>;
  /** Personality changes (studiousness, sociability, tidiness, etc.) */
  personalityChanges?: Partial<Record<string, number>>;
  /** Need and mood changes for other characters in the same room */
  companionNeedChanges?: Partial<Record<string, number>>;
  /** Roommate need and emotion changes */
  roommateChanges?: Partial<Record<string, number>>;
  /** Change character clothing */
  clothing?: Partial<CharacterClothing>;
  /** Activity to set */
  activity?: string;
}

/** An action definition */
export interface ActionConfig {
  id: string;
  name: string;
  /** Rich text description shown to player */
  description: string;
  /** Category for organization */
  category: "movement" | "body" | "interaction" | "daily" | "social";
  /** Duration in simulation seconds (0 = instant) */
  duration: number;
  /** Does this action require a target object? */
  requiresTarget: boolean;
  /** Valid target object types (if requiresTarget) */
  targetTypes?: string[];
  /** Preconditions */
  preconditions: ActionPrecondition;
  /** Effects on completion */
  effects: ActionEffect;
  /** Message shown on success */
  successMessage: string;
  /** Message shown on failure */
  failureMessage?: string;
  /** Ongoing description (for long actions like sleeping, cooking) */
  ongoingMessage?: string;
  /** Emoji icon for display */
  icon: string;
}

/** An action request submitted by human or AI */
export interface ActionRequest {
  actionId: string;
  actorId: string;
  targetObjectId?: string;
  targetCharacterId?: string;
  timestamp: string;
}

/** Result of validating/executing an action */
export interface ActionResult {
  status: "accepted" | "rejected";
  actionId: string;
  message: string;
  /** What changed */
  changes?: Record<string, unknown>;
  /** Reason for rejection */
  reason?: string;
}
