import {
  CharacterState,
  ObjectState,
  SimulationTime,
  SimulationSnapshot,
  CharacterTemplate,
  ObjectConfig,
  AiNarrativeState,
} from "../types/index.js";

export class StateManager {
  private characters: Map<string, CharacterState> = new Map();
  private objectStates: Map<string, ObjectState> = new Map();
  private narrative: AiNarrativeState = {};
  private time: SimulationTime = {
    day: 1,
    hour: 7,
    minute: 30,
    second: 0,
    dayOfWeek: 1, // Tuesday
    weather: "clear",
    speed: 1,
    paused: false,
  };

  constructor() {}

  public initialize(
    templates: CharacterTemplate[],
    objects: ObjectConfig[]
  ): void {
    this.narrative = {
      player_body:
        "Lying sideways on the soft cotton mattress. Both hands softly resting under your ear between head and pillow. Breathing is rhythmic and calm.",
      player_pose: "Lying down comfortably",
      player_mood: "😌 Calm & Relaxed",
      room_ambience:
        "Golden morning sunlight streams through the window grill, casting warm patterns across the bed sheet.",
      ai_activity: "Studying and taking notes",
    };
    this.characters.clear();
    for (const t of templates) {
      const isPlayer = t.type === "human";
      const charState: CharacterState = {
        id: t.id,
        name: t.name,
        type: t.type,
        location: {
          roomId: t.defaultRoom,
          positionId: t.defaultPosition,
        },
        body: {
          posture: isPlayer ? "lying" : "sitting",
          orientation: isPlayer ? "left" : "front",
          movement: "stationary",
        },
        needs: {
          hunger: isPlayer ? 45 : 30,
          thirst: isPlayer ? 40 : 25,
          energy: isPlayer ? 80 : 85,
          sleepiness: isPlayer ? 20 : 15,
          hygiene: isPlayer ? 70 : 85,
          bladder: isPlayer ? 50 : 20,
        },
        emotions: {
          happiness: 75,
          stress: 15,
          loneliness: 10,
          boredom: 15,
          confidence: 60,
        },
        clothing: t.clothing,
        activity: {
          current: isPlayer ? "resting" : "studying",
          status: "in_progress",
          startedAt: "07:30",
          duration: 0,
        },
        holding: null,
        personality: t.personality,
      };
      this.characters.set(t.id, charState);
    }

    this.objectStates.clear();
    for (const obj of objects) {
      this.objectStates.set(obj.id, {
        id: obj.id,
        state: obj.defaultState,
        roomId: obj.roomId,
        positionId: obj.positionId,
        heldBy: null,
        occupiedBy: null,
      });
    }

    // Set initial occupiedBy
    const bed = this.objectStates.get("bed_001");
    if (bed) {
      bed.state = "occupied_lying";
      bed.occupiedBy = "player_001";
    }

    const chair = this.objectStates.get("chair_study");
    if (chair) {
      chair.state = "occupied";
      chair.occupiedBy = "ai_001";
    }
  }

  public getCharacter(id: string): CharacterState | undefined {
    return this.characters.get(id);
  }

  public getAllCharacters(): CharacterState[] {
    return Array.from(this.characters.values());
  }

  public getCharactersInRoom(roomId: string): CharacterState[] {
    return Array.from(this.characters.values()).filter(
      (c) => c.location.roomId === roomId
    );
  }

  public updateCharacter(
    id: string,
    updater: (char: CharacterState) => void
  ): CharacterState {
    const char = this.characters.get(id);
    if (!char) {
      throw new Error(`Character ${id} not found`);
    }
    updater(char);
    return char;
  }

  public getObjectState(id: string): ObjectState {
    let state = this.objectStates.get(id);
    if (!state) {
      if (id === "mirror_bathroom_001" && this.objectStates.has("mirror_001")) {
        return this.objectStates.get("mirror_001")!;
      }
      if (id === "mirror_001" && this.objectStates.has("mirror_bathroom_001")) {
        return this.objectStates.get("mirror_bathroom_001")!;
      }
      if (id === "lamp_bedroom_001" && this.objectStates.has("lamp_001")) {
        return this.objectStates.get("lamp_001")!;
      }
      if (id === "lamp_001" && this.objectStates.has("lamp_bedroom_001")) {
        return this.objectStates.get("lamp_bedroom_001")!;
      }
      if (id === "sink_kitchen_001" && this.objectStates.has("sink_001")) {
        return this.objectStates.get("sink_001")!;
      }
      if (id === "sink_001" && this.objectStates.has("sink_kitchen_001")) {
        return this.objectStates.get("sink_kitchen_001")!;
      }
      state = { id, state: "normal", occupiedBy: null };
      this.objectStates.set(id, state);
    }
    return state;
  }

  public getAllObjectStates(): ObjectState[] {
    return Array.from(this.objectStates.values());
  }

  public updateObjectState(
    id: string,
    updater: (obj: ObjectState) => void
  ): ObjectState {
    const obj = this.getObjectState(id);
    updater(obj);

    // Keep mirror and lamp aliases synchronized
    if (id === "mirror_001" && this.objectStates.has("mirror_bathroom_001")) {
      const mirrorAlt = this.objectStates.get("mirror_bathroom_001");
      if (mirrorAlt) updater(mirrorAlt);
    } else if (id === "mirror_bathroom_001" && this.objectStates.has("mirror_001")) {
      const mirrorAlt = this.objectStates.get("mirror_001");
      if (mirrorAlt) updater(mirrorAlt);
    } else if (id === "lamp_001" && this.objectStates.has("lamp_bedroom_001")) {
      const lampAlt = this.objectStates.get("lamp_bedroom_001");
      if (lampAlt) updater(lampAlt);
    } else if (id === "lamp_bedroom_001" && this.objectStates.has("lamp_001")) {
      const lampAlt = this.objectStates.get("lamp_001");
      if (lampAlt) updater(lampAlt);
    } else if (id === "sink_001" && this.objectStates.has("sink_kitchen_001")) {
      const sinkAlt = this.objectStates.get("sink_kitchen_001");
      if (sinkAlt) updater(sinkAlt);
    } else if (id === "sink_kitchen_001" && this.objectStates.has("sink_001")) {
      const sinkAlt = this.objectStates.get("sink_001");
      if (sinkAlt) updater(sinkAlt);
    }

    return obj;
  }

  public getTime(): SimulationTime {
    return this.time;
  }

  public setTime(newTime: Partial<SimulationTime>): void {
    Object.assign(this.time, newTime);
  }

  public getNarrative(): AiNarrativeState {
    return { ...this.narrative };
  }

  public updateNarrative(updates: Partial<AiNarrativeState>): void {
    this.narrative = { ...this.narrative, ...updates };
    // Also mirror to player state if relevant
    const player = this.characters.get("player_001");
    if (player) {
      player.narrative = { ...(player.narrative || {}), ...updates };
    }
  }

  public getSnapshot(): SimulationSnapshot {
    const charactersObj: Record<string, CharacterState> = {};
    for (const [k, v] of this.characters.entries()) {
      charactersObj[k] = JSON.parse(JSON.stringify(v));
    }

    const objectsObj: Record<string, ObjectState> = {};
    for (const [k, v] of this.objectStates.entries()) {
      objectsObj[k] = JSON.parse(JSON.stringify(v));
    }

    return {
      version: "0.1.0",
      savedAt: new Date().toISOString(),
      time: { ...this.time },
      characters: charactersObj,
      objects: objectsObj,
      events: [],
      narrative: { ...this.narrative },
    };
  }

  public loadSnapshot(snapshot: SimulationSnapshot): void {
    this.time = { ...snapshot.time };
    this.narrative = snapshot.narrative || {};
    this.characters.clear();
    for (const [k, v] of Object.entries(snapshot.characters)) {
      this.characters.set(k, v);
    }
    this.objectStates.clear();
    for (const [k, v] of Object.entries(snapshot.objects)) {
      this.objectStates.set(k, v);
    }
  }
}
