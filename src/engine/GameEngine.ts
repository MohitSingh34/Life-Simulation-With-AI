import { ConfigLoader } from "./ConfigLoader.js";
import { StateManager } from "./StateManager.js";
import { EventManager } from "./EventManager.js";
import { TimeEngine } from "./TimeEngine.js";
import { NeedsEngine } from "./NeedsEngine.js";
import { MovementEngine } from "./MovementEngine.js";
import { ActionEngine } from "./ActionEngine.js";
import { EmotionEngine } from "./EmotionEngine.js";
import { AIDecisionEngine } from "../ai/AIDecisionEngine.js";
import { BodyStateEngine } from "./BodyStateEngine.js";
import {
  CharacterState,
  ActionConfig,
  ActionResult,
  RoomConfig,
  ObjectConfig,
} from "../types/index.js";

export class GameEngine {
  public configLoader!: ConfigLoader;
  public stateManager!: StateManager;
  public eventManager!: EventManager;
  public timeEngine!: TimeEngine;
  public needsEngine!: NeedsEngine;
  public movementEngine!: MovementEngine;
  public actionEngine!: ActionEngine;
  public emotionEngine!: EmotionEngine;
  public aiEngine!: AIDecisionEngine;
  public bodyStateEngine!: BodyStateEngine;

  public init(): void {
    this.configLoader = ConfigLoader.getInstance();
    this.stateManager = new StateManager();
    this.eventManager = new EventManager();
    this.timeEngine = new TimeEngine(this.stateManager);
    this.needsEngine = new NeedsEngine(this.stateManager, this.configLoader);
    this.movementEngine = new MovementEngine(this.stateManager, this.configLoader);
    this.actionEngine = new ActionEngine(
      this.stateManager,
      this.configLoader,
      this.eventManager,
      this.movementEngine,
      this.needsEngine,
      this.timeEngine
    );
    this.emotionEngine = new EmotionEngine(this.stateManager);
    this.bodyStateEngine = new BodyStateEngine();
    this.aiEngine = new AIDecisionEngine(
      this.stateManager,
      this.actionEngine,
      this.configLoader,
      this.movementEngine,
      this.timeEngine
    );

    // Initialize state
    this.stateManager.initialize(
      this.configLoader.getCharacterTemplates(),
      this.configLoader.getAllObjects()
    );
  }

  public getPlayer(): CharacterState {
    return this.stateManager.getCharacter("player_001")!;
  }

  public getAI(): CharacterState {
    return this.stateManager.getCharacter("ai_001")!;
  }

  public getAvailablePlayerActions(): ActionConfig[] {
    return this.actionEngine.getAvailableActions("player_001");
  }

  public submitPlayerAction(
    actionId: string,
    targetObjectId?: string
  ): {
    result: ActionResult;
    alerts: string[];
    aiUpdate?: { actionName: string; dialogue?: string } | null;
  } {
    const result = this.actionEngine.executeAction({
      actorId: "player_001",
      actionId,
      targetObjectId,
      timestamp: new Date().toISOString(),
    });

    this.emotionEngine.evaluateEmotions("player_001");
    this.emotionEngine.evaluateEmotions("ai_001");

    // Check alerts for player
    const alerts = this.needsEngine.checkAlerts(this.getPlayer().needs);

    // AI takes an autonomous step
    const aiStep = this.aiEngine.decideAndExecute("ai_001");
    const aiUpdate = aiStep
      ? { actionName: aiStep.actionName, dialogue: aiStep.dialogue }
      : null;

    return {
      result,
      alerts,
      aiUpdate,
    };
  }

  /**
   * Retrieves the configured idle ping interval for Aria in minutes.
   * Checks process.env.ARIA_PING_INTERVAL_MINUTES -> world.json simulationConfig -> character_template -> default 10.
   */
  public getAriaPingIntervalMinutes(): number {
    if (process.env.ARIA_PING_INTERVAL_MINUTES) {
      const parsed = parseInt(process.env.ARIA_PING_INTERVAL_MINUTES, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const worldConfig = this.configLoader.getWorld() as any;
    if (worldConfig.simulationConfig?.ariaPingIntervalMinutes) {
      return worldConfig.simulationConfig.ariaPingIntervalMinutes;
    }
    const aiTemplate = this.configLoader.getCharacterTemplates().find((t) => t.id === "ai_001");
    if (aiTemplate?.pingIntervalMinutes) {
      return aiTemplate.pingIntervalMinutes;
    }
    return 10;
  }

  /**
   * Executes an autonomous heartbeat tick for Aria.
   */
  public tickAutonomousAI(): {
    actionName: string;
    result: ActionResult;
    dialogue?: string;
  } | null {
    const aiStep = this.aiEngine.decideAndExecute("ai_001");
    if (aiStep) {
      if (aiStep.result.status === "accepted") {
        this.emotionEngine.evaluateEmotions("ai_001");
      }
      this.eventManager.recordEvent({
        actorId: "ai_001",
        timestamp: this.timeEngine.getFormattedClock(),
        type: "ai_decision",
        data: {
          actionId: aiStep.actionName,
          dialogue: aiStep.dialogue,
          result: aiStep.result,
        },
      });
    }
    return aiStep;
  }

  public getCurrentRoomDetails(): {
    room: RoomConfig;
    ambience: string;
    objects: ObjectConfig[];
    charactersPresent: CharacterState[];
  } {
    const player = this.getPlayer();
    const room = this.configLoader.getRoom(player.location.roomId)!;
    const timeOfDay = this.timeEngine.getTimeOfDay();
    const ambience = room.ambience[timeOfDay];
    const objects = this.configLoader.getAllObjects()
      .filter((object) => {
        const state = this.stateManager.getObjectState(object.id);
        return (state.roomId ?? object.roomId) === room.id && !state.heldBy;
      })
      .map((object) => ({
        ...object,
        currentState: this.stateManager.getObjectState(object.id).state,
      }));
    const charactersPresent = this.stateManager.getCharactersInRoom(room.id);

    return {
      room,
      ambience,
      objects,
      charactersPresent,
    };
  }

  public getCharacterBodyState(characterId: string): { pose: string; body: string } {
    const character = this.stateManager.getCharacter(characterId);
    return character ? this.bodyStateEngine.getCharacterBodyState(character) : {
      pose: "Idle",
      body: "The character is not present in the current simulation.",
    };
  }

  public getPlayerStatusSummary(): string {
    const p = this.getPlayer();
    const timeStr = this.timeEngine.getFormattedFull();
    const mood = this.emotionEngine.getMoodSummary(p.id);
    return `🕒 ${timeStr} | Mood: ${mood}`;
  }

  public talkToAI(): string {
    const player = this.getPlayer();
    const ai = this.getAI();

    if (player.location.roomId !== ai.location.roomId) {
      return `Aria is in the ${ai.location.roomId}. You can't hear each other from here.`;
    }

    const responses = [
      "Aria looks over with a warm smile: 'Hey there! How are you feeling today?'",
      "Aria looks up: 'Did you know Jabalpur has the world's most beautiful marble rocks at Bhedaghat? We should go watch the sunset sometime.'",
      "Aria laughs softly: 'I was just getting some reading done. It's so peaceful in the house right now.'",
      "Aria nods cheerfully: 'If you're hungry, there's always fresh snacks in the kitchen!'",
      "Aria sips some water: 'Make sure you take proper breaks if you're working at the screen!'",
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }
}
