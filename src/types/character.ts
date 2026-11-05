// ============================================================
// CHARACTER TYPES — Identity, body, needs, emotions, inventory
// ============================================================

export type Posture = "standing" | "sitting" | "lying" | "kneeling" | "squatting";
export type Orientation = "front" | "back" | "left" | "right";
export type Movement = "stationary" | "walking" | "running";
export type ActivityStatus = "idle" | "in_progress" | "completed" | "interrupted";

export interface CharacterBody {
  posture: Posture;
  orientation: Orientation;
  movement: Movement;
}

export interface CharacterNeeds {
  hunger: number;    // 0 = full, 100 = starving
  thirst: number;    // 0 = hydrated, 100 = dehydrated
  energy: number;    // 0 = exhausted, 100 = fully rested
  sleepiness: number; // 0 = alert, 100 = can't stay awake
  hygiene: number;   // 0 = dirty, 100 = clean
  bladder: number;   // 0 = empty, 100 = urgent
}

export interface CharacterEmotions {
  happiness: number;   // 0-100
  stress: number;      // 0-100
  loneliness: number;  // 0-100
  boredom: number;     // 0-100
}

export interface CharacterClothing {
  upper: string;
  lower: string;
  footwear: string;
}

export interface HeldItem {
  objectId: string;
  hand: "left" | "right" | "both";
}

export interface CharacterActivity {
  current: string;     // action ID or "idle"
  status: ActivityStatus;
  startedAt: string;   // simulation time
  duration: number;    // seconds remaining
}

export interface AiNarrativeState {
  player_body?: string;
  player_pose?: string;
  player_mood?: string;
  room_ambience?: string;
  ai_activity?: string;
  [key: string]: string | undefined;
}

export interface CharacterState {
  id: string;
  name: string;
  type: "human" | "ai";
  location: {
    roomId: string;
    positionId: string;
  };
  body: CharacterBody;
  needs: CharacterNeeds;
  emotions: CharacterEmotions;
  clothing: CharacterClothing;
  activity: CharacterActivity;
  holding: HeldItem | null;
  narrative?: AiNarrativeState;
  /** Personality traits for AI characters (0-100 scale) */
  personality?: {
    sociability: number;
    tidiness: number;
    studiousness: number;
    laziness: number;
    foodLove: number;
  };
}

export interface CharacterTemplate {
  id: string;
  name: string;
  type: "human" | "ai";
  defaultRoom: string;
  defaultPosition: string;
  clothing: CharacterClothing;
  personality?: CharacterState["personality"];
}

/** Need decay/recovery configuration */
export interface NeedConfig {
  id: keyof CharacterNeeds;
  name: string;
  /** Points gained per simulation minute while idle */
  decayPerMinute: number;
  /** Warning threshold */
  warningThreshold: number;
  /** Critical threshold */
  criticalThreshold: number;
  /** Warning message */
  warningMessage: string;
  /** Critical message */
  criticalMessage: string;
}

