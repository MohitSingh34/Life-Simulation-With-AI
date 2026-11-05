// ============================================================
// EVENT TYPES — History of what happened in the simulation
// ============================================================

import { ObjectState } from "./object.js";
import { CharacterState, AiNarrativeState } from "./character.js";

export interface SimulationEvent {
  id: string;
  timestamp: string;  // simulation time
  realTime: string;   // real wall clock
  actorId: string;
  type: "action_completed" | "action_failed" | "need_warning" | "need_critical" |
        "location_changed" | "object_state_changed" | "time_advanced" |
        "emotion_changed" | "ai_decision" | "conversation" | "social_encounter" | "roommate_friction";
  data: Record<string, unknown>;
}

/** World time state */
export interface SimulationTime {
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** Day of week (0=Monday) */
  dayOfWeek: number;
  weather: "clear" | "cloudy" | "rainy" | "stormy";
  /** Time speed multiplier */
  speed: number;
  paused: boolean;
}

/** Complete snapshot of the simulation state */
export interface SimulationSnapshot {
  version: string;
  savedAt: string;
  time: SimulationTime;
  characters: Record<string, CharacterState>;
  objects: Record<string, ObjectState>;
  events: SimulationEvent[];
  narrative?: AiNarrativeState;
}
