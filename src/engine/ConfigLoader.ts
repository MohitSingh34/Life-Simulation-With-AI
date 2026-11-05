import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  WorldConfig,
  RoomConfig,
  ObjectConfig,
  ActionConfig,
  CharacterTemplate,
  NeedConfig,
} from "../types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_ROOT = path.resolve(__dirname, "../config");

export class ConfigLoader {
  private static instance: ConfigLoader;

  private world!: WorldConfig;
  private rooms: Map<string, RoomConfig> = new Map();
  private objects: Map<string, ObjectConfig> = new Map();
  private actions: Map<string, ActionConfig> = new Map();
  private characterTemplates: CharacterTemplate[] = [];
  private needConfigs: NeedConfig[] = [];
  private emotionsConfig: Record<string, unknown> = {};

  private constructor() {
    this.loadAll();
  }

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  private readJson<T>(filePath: string): T {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch (err) {
      throw new Error(`Failed to load config JSON at ${filePath}: ${err}`);
    }
  }

  public loadAll(): void {
    // 1. World
    this.world = this.readJson<WorldConfig>(path.join(CONFIG_ROOT, "world.json"));

    // 2. Rooms
    const roomsDir = path.join(CONFIG_ROOT, "rooms");
    if (fs.existsSync(roomsDir)) {
      const roomFiles = fs.readdirSync(roomsDir).filter((f) => f.endsWith(".json"));
      for (const file of roomFiles) {
        const room = this.readJson<RoomConfig>(path.join(roomsDir, file));
        this.rooms.set(room.id, room);
      }
    }

    // 3. Objects
    const objectsList = this.readJson<ObjectConfig[]>(path.join(CONFIG_ROOT, "objects.json"));
    this.objects.clear();
    for (const obj of objectsList) {
      this.objects.set(obj.id, obj);
    }

    // 4. Actions
    this.actions.clear();
    const actionsDir = path.join(CONFIG_ROOT, "actions");
    if (fs.existsSync(actionsDir)) {
      const actionFiles = fs.readdirSync(actionsDir).filter((f) => f.endsWith(".json"));
      for (const file of actionFiles) {
        const list = this.readJson<ActionConfig[]>(path.join(actionsDir, file));
        for (const action of list) {
          this.actions.set(action.id, action);
        }
      }
    }

    // 5. Character templates
    this.characterTemplates = this.readJson<CharacterTemplate[]>(
      path.join(CONFIG_ROOT, "character_template.json")
    );

    // 6. Needs
    this.needConfigs = this.readJson<NeedConfig[]>(path.join(CONFIG_ROOT, "needs.json"));

    // 7. Emotions
    this.emotionsConfig = this.readJson<Record<string, unknown>>(
      path.join(CONFIG_ROOT, "emotions.json")
    );
  }

  public getWorld(): WorldConfig {
    return this.world;
  }

  public getRoom(id: string): RoomConfig | undefined {
    return this.rooms.get(id);
  }

  public getAllRooms(): RoomConfig[] {
    return Array.from(this.rooms.values());
  }

  public getObject(id: string): ObjectConfig | undefined {
    let obj = this.objects.get(id);
    if (!obj) {
      if (id === "mirror_bathroom_001" && this.objects.has("mirror_001")) {
        return this.objects.get("mirror_001");
      }
      if (id === "mirror_001" && this.objects.has("mirror_bathroom_001")) {
        return this.objects.get("mirror_bathroom_001");
      }
      if (id === "lamp_bedroom_001" && this.objects.has("lamp_001")) {
        return this.objects.get("lamp_001");
      }
      if (id === "lamp_001" && this.objects.has("lamp_bedroom_001")) {
        return this.objects.get("lamp_bedroom_001");
      }
      if (id === "sink_kitchen_001" && this.objects.has("sink_001")) {
        return this.objects.get("sink_001");
      }
      if (id === "sink_001" && this.objects.has("sink_kitchen_001")) {
        return this.objects.get("sink_kitchen_001");
      }
    }
    return obj;
  }

  public getAllObjects(): ObjectConfig[] {
    return Array.from(this.objects.values());
  }

  public getObjectsInRoom(roomId: string): ObjectConfig[] {
    return Array.from(this.objects.values()).filter((o) => o.roomId === roomId);
  }

  public getAction(id: string): ActionConfig | undefined {
    return this.actions.get(id);
  }

  public getAllActions(): ActionConfig[] {
    return Array.from(this.actions.values());
  }

  public getCharacterTemplates(): CharacterTemplate[] {
    return this.characterTemplates;
  }

  public getNeedConfigs(): NeedConfig[] {
    return this.needConfigs;
  }

  public getEmotionsConfig(): Record<string, unknown> {
    return this.emotionsConfig;
  }
}

