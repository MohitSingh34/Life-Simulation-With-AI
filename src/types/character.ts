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
  confidence?: number; // 0-100
}

export interface CharacterClothing {
  upper: string;
  lower: string;
  footwear: string;
}

export interface CharacterAppearance {
  body: string;
  clothes: string;
  head: string;
  eyes: string;
  ears: string;
  face: string;
  face_hair: string;
  hair: string;
  neck: string;
  shoulders: string;
  torso_outer: string;
  torso_inner: string;
  chest: string;
  back: string;
  arms: string;
  upper_arm_left: string;
  upper_arm_right: string;
  elbow_left: string;
  elbow_right: string;
  forearm_left: string;
  forearm_right: string;
  wrist_left: string;
  wrist_right: string;
  hands: string;
  hand_left: string;
  hand_right: string;
  fingers: string;
  waist: string;
  hips: string;
  legs: string;
  thigh_left: string;
  thigh_right: string;
  knee_left: string;
  knee_right: string;
  calf_left: string;
  calf_right: string;
  ankle_left: string;
  ankle_right: string;
  feet: string;
  foot_left: string;
  foot_right: string;
  toes_left: string;
  toes_right: string;
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

export interface CharacterPersonality {
  sociability: number;
  tidiness: number;
  studiousness: number;
  laziness: number;
  foodLove: number;
}

export interface CharacterState {
  id: string;
  name: string;
  type: "human" | "ai";
  location: {
    roomId: string;
    positionId: string;
    /** Last exact map location, when movement was issued from the floor map */
    mapPosition?: {
      roomId: string;
      x: number;
      y: number;
    };
  };
  body: CharacterBody;
  needs: CharacterNeeds;
  emotions: CharacterEmotions;
  clothing: CharacterClothing;
  appearance: CharacterAppearance;
  activity: CharacterActivity;
  holding: HeldItem | null;
  narrative?: AiNarrativeState;
  /** Personality traits for characters (0-100 scale) */
  personality?: CharacterPersonality;
}

export interface CharacterTemplate {
  id: string;
  name: string;
  type: "human" | "ai";
  defaultRoom: string;
  defaultPosition: string;
  clothing: CharacterClothing;
  appearance: CharacterAppearance;
  personality?: CharacterPersonality;
  /** Heartbeat interval in simulation minutes for autonomous AI actions */
  pingIntervalMinutes?: number;
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
