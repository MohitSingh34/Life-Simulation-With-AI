import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GameEngine } from "./engine/GameEngine.js";
import { RealtimePersistence } from "./engine/RealtimePersistence.js";
import { GeminiWebProvider } from "./ai/GeminiWebProvider.js";
import { TagParser, ParsedAiEdits } from "./ai/TagParser.js";
import { ConversationManager } from "./ai/ConversationManager.js";
import { HouseCommand } from "./types/house.js";
import { AriaBuildProposal } from "./ai/AriaBuildPlanner.js";
import { executeHomeMapCommands, getHomeFloorCoordinates } from "./ai/HomeMapCommandProcessor.js";
import { executeAiActionCommands } from "./ai/AiActionCommandProcessor.js";
import { executeHelpCommands } from "./ai/HelpCommandProcessor.js";
import { buildAriaTurnPrompt } from "./ai/AriaPromptBuilder.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, "../public");

function loadEnvFile(): void {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) return;

  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(envPath);
      return;
    } catch {
      // Fallback to manual parsing below
    }
  }

  try {
    const raw = fs.readFileSync(envPath, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.warn("Could not parse .env file:", err);
  }
}

loadEnvFile();

export function createServer(port = 3000) {
  const engine = new GameEngine();
  engine.init();
  const realtimePersistence = new RealtimePersistence(engine);
  const gemini = new GeminiWebProvider();
  const conversationManager = new ConversationManager();
  const pendingCommandOutcomes = new Map<string, string[]>();

  if (gemini.isConfigured) {
    realtimePersistence.setAriaPingHandler(async () => {
      const activeConversation = conversationManager.getActiveConversation();
      const conversationId = activeConversation.id;
      const turnNumber = conversationManager.incrementPromptTurnCount(conversationId);
      const checkInMessage =
        "Scheduled simulation check-in: review the current state and decide whether to take a useful permitted action. You may do nothing. Keep any dialogue brief.";
      let rawDialogue = await gemini.generateReplyForSession(
        buildAriaTurnPrompt(
          engine,
          conversationManager,
          conversationId,
          turnNumber,
          checkInMessage
        ),
        conversationId
      );
      for (let round = 0; round < 3; round++) {
        const mapResult = executeHomeMapCommands(rawDialogue, engine.houseBuilder);
        const helpResult = executeHelpCommands(mapResult.response, engine);
        const actionResult = executeAiActionCommands(helpResult.response, engine);
        rawDialogue = actionResult.response;
        const outcomes = [...mapResult.outcomes, ...helpResult.outcomes, ...actionResult.outcomes];
        if (actionResult.hasCommands || mapResult.hasCommands) {
          realtimePersistence.persist();
        }
        if (!mapResult.hasCommands && !helpResult.hasCommands && !actionResult.hasCommands) break;
        if (round === 2) {
          pendingCommandOutcomes.set(conversationId, outcomes);
          break;
        }

        rawDialogue = await gemini.generateReplyForSession(
          buildAriaTurnPrompt(
            engine,
            conversationManager,
            conversationId,
            turnNumber,
            "Continue in character after reviewing the engine results. Do not repeat commands that have already succeeded.",
            outcomes
          ),
          conversationId
        );
      }

      const parsed = TagParser.parse(rawDialogue);
      if (parsed.edits.build_command) {
        try {
          const command = JSON.parse(parsed.edits.build_command);
          command.issuedBy = "ai_001";
          const result = engine.houseBuilder.executeCommand(command);
          pendingCommandOutcomes.set(conversationId, [
            result.success
              ? `Your build command succeeded: ${result.message}.`
              : `Your build command failed: ${result.message}.`,
          ]);
          if (!result.success) {
            parsed.dialogue = `I couldn't make that change: ${result.message}`;
            parsed.edits.dialogue = parsed.dialogue;
          }
        } catch (error) {
          console.error("Could not parse Aria's scheduled build command:", error);
        }
      }
      if (Object.keys(parsed.edits).length > 0) {
        engine.stateManager.updateNarrative(parsed.edits);
      }
      conversationManager.addMessage("aria", parsed.dialogue, engine.timeEngine.getFormattedClock());
      realtimePersistence.persist();
    });
  }

  realtimePersistence.start();
  const realtimeInterval = setInterval(() => {
    try {
      realtimePersistence.update();
    } catch (error) {
      console.error("Could not update or persist real-time simulation state:", error);
    }
  }, 1000);

  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Helper for JSON responses
    const sendJson = (data: unknown, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };

    // Helper to parse JSON body
    const parseBody = <T>(): Promise<T> => {
      return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (e) {
            reject(e);
          }
        });
      });
    };

    try {
      if (pathname.startsWith("/api/")) {
        realtimePersistence.update();
      }

      // 1. API: Get Game State
      if (req.method === "GET" && pathname === "/api/state") {
        const player = engine.getPlayer();
        const ai = engine.getAI();
        const roomDetails = engine.getCurrentRoomDetails();
        const availableActions = engine.getAvailablePlayerActions();
        const fullTime = engine.timeEngine.getFormattedFull();
        const clockTime = engine.timeEngine.getFormattedClock();
        const timeOfDay = engine.timeEngine.getTimeOfDay();
        const playerBodyState = engine.getCharacterBodyState(player.id);
        const aiBodyState = engine.getCharacterBodyState(ai.id);
        const mood = engine.emotionEngine.getMoodSummary(player.id);
        const playerAlerts = engine.needsEngine.checkAlerts(player.needs);
        const aiAlerts = engine.needsEngine
          .checkAlerts(ai.needs)
          .map((a) => a.replace(/You are|You |Your /gi, `${ai.name} `));
        const alerts = [...playerAlerts, ...aiAlerts];
        const events = engine.eventManager.getRecentEvents(8);
        const world = engine.configLoader.getWorld();
        const allRooms = engine.configLoader.getAllRooms();
        const objects = engine.configLoader.getAllObjects().map((object) => {
          const state = engine.stateManager.getObjectState(object.id);
          return {
            ...object,
            currentState: state.state,
            roomId: state.roomId ?? object.roomId,
            positionId: state.positionId ?? object.positionId,
            x: state.x,
            y: state.y,
            heldBy: state.heldBy ?? null,
            occupiedBy: state.occupiedBy ?? null,
          };
        });
        const houseLayout = engine.houseBuilder.getLayout();
        const houseLayoutWithStates = {
          ...houseLayout,
          placedObjects: houseLayout.placedObjects.map((object) => {
            const state = engine.stateManager.getObjectState(object.id);
            return {
              ...object,
              state: state.state,
              occupiedBy: state.occupiedBy ?? null,
            };
          }),
        };

        const inSameRoom = player.location.roomId === ai.location.roomId;
        const aiAvailableActions = engine.actionEngine.getAvailableActions(ai.id);
        const aiRoomName = engine.configLoader.getRoom(ai.location.roomId)?.name || ai.location.roomId;
        const visibleAiBodyState = inSameRoom
          ? engine.getCharacterBodyState(ai.id)
          : {
              pose: `In ${aiRoomName} (Out of sight)`,
              description: `Aria is currently in the ${aiRoomName}, out of your line of sight. Walk to ${aiRoomName} to observe her posture and physical state.`,
              status: "Out of sight"
            };

        sendJson({
          player,
          ai,
          inSameRoom,
          roomDetails,
          availableActions,
          aiAvailableActions,
          playerBodyState,
          aiBodyState: visibleAiBodyState,
          time: {
            full: fullTime,
            clock: clockTime,
            timeOfDay,
            day: engine.stateManager.getTime().day,
            dayOfWeek: engine.stateManager.getTime().dayOfWeek,
            speed: engine.stateManager.getTime().speed,
            paused: engine.stateManager.getTime().paused,
          },
          mood,
          alerts,
          events,
          world: { ...world, objects, allRooms },
          houseLayout: houseLayoutWithStates,
          narrative: engine.stateManager.getNarrative(),
          activeConversation: conversationManager.getActiveConversation(),
        });
        return;
      }

      // 2. API: Submit Player Action
      if (req.method === "POST" && pathname === "/api/action") {
        const body = await parseBody<{ actionId: string; targetObjectId?: string }>();
        if (!body.actionId) {
          sendJson({ error: "actionId is required" }, 400);
          return;
        }

        const execution = engine.submitPlayerAction(body.actionId, body.targetObjectId);
        const player = engine.getPlayer();
        const ai = engine.getAI();
        const roomDetails = engine.getCurrentRoomDetails();
        const availableActions = engine.getAvailablePlayerActions();
        const fullTime = engine.timeEngine.getFormattedFull();
        const mood = engine.emotionEngine.getMoodSummary(player.id);
        const events = engine.eventManager.getRecentEvents(8);

        let actionNarrativeEdits: ParsedAiEdits | undefined;

        // Key actions trigger AI to generate fresh physical body & room descriptions
        const KEY_ACTIONS = [
          "get_up", "lie_down_bed", "sit_down_bed", "sit_down_study_chair",
          "sit_down_kitchen_stool", "sit_on_sofa", "relax_on_sofa", "watch_tv",
          "play_music_speaker", "stand_up", "sleep", "nap", "cook_meal",
          "take_shower", "walk_to_bedroom", "walk_to_study_room",
          "walk_to_kitchen", "walk_to_toilet", "walk_to_living_room",
          "walk_to_balcony", "water_plants", "step_out_balcony",
          "lean_on_balcony_railing", "sit_on_cane_chair"
        ];

        if (execution.result.status === "accepted" && gemini.isConfigured && KEY_ACTIONS.includes(body.actionId)) {
          try {
            const actionPrompt = [
              "You are narrating an everyday-life simulation in Jabalpur, India.",
              `The player just executed the action: "${execution.result.message || body.actionId}".`,
              `Simulation state: ${JSON.stringify({
                room: roomDetails.room.name,
                position: player.location.positionId,
                posture: player.body.posture,
                time: engine.timeEngine.getFormattedClock(),
                needs: player.needs,
              })}`,
              "Produce the updated physical description and screen elements using these exact XML tags:",
              "<player_body>An evocative, physical 1-2 sentence description of the player's physical body posture, hands, and bodily sensations right now.</player_body>",
              "<player_pose>A short 2-4 word summary of the player's posture (e.g. Lying comfortably on bed, Standing beside bedside).</player_pose>",
              "<room_ambience>A 1-sentence sensory description of this room's light, sounds, and air right now.</room_ambience>",
              "Optional other tags if changed: <player_mood>, <player_clothing>, <room_description>, <ai_activity>, <hunger_feeling>, <thirst_feeling>, <energy_feeling>, <sleepiness_feeling>, <hygiene_feeling>, <bladder_feeling>.",
            ].join("\n\n");

            const rawActionReply = await Promise.race([
              gemini.generateReplyForSession(
                actionPrompt,
                conversationManager.getActiveConversation().id
              ),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
            ]);

            if (rawActionReply) {
              const parsedAction = TagParser.parse(rawActionReply);
              if (Object.keys(parsedAction.edits).length > 0) {
                engine.stateManager.updateNarrative(parsedAction.edits);
                actionNarrativeEdits = parsedAction.edits;
              }
            }
          } catch (err) {
            console.warn("Action narrative generation skipped:", err);
          }
        }

        realtimePersistence.persist();
        const inSameRoom = player.location.roomId === ai.location.roomId;
        const aiAvailableActions = engine.actionEngine.getAvailableActions(ai.id);
        const aiRoomName = engine.configLoader.getRoom(ai.location.roomId)?.name || ai.location.roomId;
        const visibleAiBodyState = inSameRoom
          ? engine.getCharacterBodyState(ai.id)
          : {
              pose: `In ${aiRoomName} (Out of sight)`,
              description: `Aria is currently in the ${aiRoomName}, out of your line of sight. Walk to ${aiRoomName} to observe her posture and physical state.`,
              status: "Out of sight"
            };

        sendJson({
          success: execution.result.status === "accepted",
          message: execution.result.message,
          alerts: execution.alerts,
          aiUpdate: execution.aiUpdate,
          player,
          ai,
          inSameRoom,
          roomDetails,
          availableActions,
          aiAvailableActions,
          playerBodyState: engine.getCharacterBodyState(player.id),
          aiBodyState: visibleAiBodyState,
          time: {
            full: fullTime,
            clock: engine.timeEngine.getFormattedClock(),
            timeOfDay: engine.timeEngine.getTimeOfDay(),
            speed: engine.stateManager.getTime().speed,
            paused: engine.stateManager.getTime().paused,
          },
          mood,
          events,
          edits: actionNarrativeEdits,
          narrative: engine.stateManager.getNarrative(),
        });
        return;
      }

      // 3. API: Talk to AI
      if (req.method === "POST" && pathname === "/api/talk") {
        const host = req.headers.host;
        let requestOrigin: string;
        try {
          if (!host) throw new Error("Missing host");
          const requestUrl = new URL(`http://${host}`);
          if (!["localhost", "127.0.0.1"].includes(requestUrl.hostname)) {
            sendJson({ error: "Gemini web chat is only available from this machine." }, 403);
            return;
          }
          requestOrigin = requestUrl.origin;
        } catch {
          sendJson({ error: "Invalid request host." }, 403);
          return;
        }

        if (req.headers.origin && req.headers.origin !== requestOrigin) {
          sendJson({ error: "Cross-origin Gemini requests are not allowed." }, 403);
          return;
        }

        const body = await parseBody<{ message?: unknown }>();
        if (typeof body.message !== "string" || !body.message.trim()) {
          sendJson({ error: "A message for Aria is required." }, 400);
          return;
        }
        if (body.message.length > 1000) {
          sendJson({ error: "Messages must be 1000 characters or fewer." }, 413);
          return;
        }

        const player = engine.getPlayer();
        const ai = engine.getAI();
        if (player.location.roomId !== ai.location.roomId) {
          sendJson({ error: "You and Aria must be in the same room to talk." }, 409);
          return;
        }
        const clockTime = engine.timeEngine.getFormattedClock();
        const activeConversation = conversationManager.getActiveConversation();
        const conversationId = activeConversation.id;
        const turnNumber = gemini.isConfigured
          ? conversationManager.incrementPromptTurnCount(conversationId)
          : 0;
        const pendingOutcomes = pendingCommandOutcomes.get(conversationId) || [];
        conversationManager.addMessage("player", body.message.trim(), clockTime);

        let rawDialogue: string;
        if (!gemini.isConfigured) {
          // Contextual offline/fallback Aria responses with full building support
          const lower = body.message.trim().toLowerCase();
          if (lower.includes("coordinate") && (lower.includes("floor") || lower.includes("home") || lower.includes("map"))) {
            rawDialogue = `<dialogue>Here is the current home floor map: ${JSON.stringify(getHomeFloorCoordinates(engine.houseBuilder.getLayout()))}</dialogue>`;
          } else {
            const isBuildRequest =
              lower.includes("build") ||
              lower.includes("decorate") ||
              lower.includes("plant") ||
              lower.includes("furniture") ||
              lower.includes("table") ||
              lower.includes("chair") ||
              lower.includes("sofa") ||
              lower.includes("move ") ||
              lower.includes("relocate ") ||
              lower.includes("reposition ") ||
              lower.includes("shift ") ||
              lower.includes("floor") ||
              lower.includes("add ") ||
              lower.includes("lamp") ||
              lower.includes("rug");

            if (isBuildRequest) {
              const proposal = engine.ariaBuildPlanner.parseNaturalLanguageRequest(body.message.trim());
              if (proposal) {
                const buildResult = engine.houseBuilder.executeCommand(proposal.command);
                if (buildResult.success) {
                  realtimePersistence.persist();
                  rawDialogue = `<dialogue>${proposal.dialogue}</dialogue><player_body>Standing and listening attentively, admiring the shared space.</player_body><ai_activity>Admiring the ${proposal.itemName} in ${proposal.roomName}</ai_activity>`;
                } else {
                  rawDialogue = `<dialogue>I couldn't make that change: ${buildResult.message}</dialogue><player_body>Standing relaxed, talking about home improvements.</player_body>`;
                }
              } else {
                rawDialogue = `<dialogue>I'd love to make our place cozier! Let's check out what we can add together.</dialogue><player_body>Standing relaxed, talking about home improvements.</player_body>`;
              }
            } else {
              const aiStep = engine.aiEngine.decideAndExecute("ai_001");
              const actName = aiStep?.actionName || "looking around";
              rawDialogue = `<dialogue>Hey Mohit. I was just ${actName.toLowerCase()}. Living together takes a bit of getting used to, but Jabalpur mornings have their own peaceful charm.</dialogue><player_body>Standing comfortably in the room, taking in the morning stillness.</player_body><ai_activity>${actName}</ai_activity>`;
            }
          }
        } else {
          const prompt = buildAriaTurnPrompt(
            engine,
            conversationManager,
            conversationId,
            turnNumber,
            `The player says: ${JSON.stringify(body.message.trim())}`,
            pendingOutcomes
          );

          try {
            rawDialogue = await gemini.generateReplyForSession(prompt, conversationId);
            pendingCommandOutcomes.delete(conversationId);
          } catch (error) {
            console.error("Gemini dialogue request failed:", error);
            sendJson(
              { error: error instanceof Error ? error.message : "Gemini could not reply." },
              502
            );
            return;
          }
        }

        if (gemini.isConfigured) {
          for (let round = 0; round < 3; round++) {
            const mapResult = executeHomeMapCommands(rawDialogue, engine.houseBuilder);
            const helpResult = executeHelpCommands(mapResult.response, engine);
            const actionResult = executeAiActionCommands(helpResult.response, engine);
            rawDialogue = actionResult.response;
            const commandOutcomes = [
              ...mapResult.outcomes,
              ...helpResult.outcomes,
              ...actionResult.outcomes,
            ];

            if (actionResult.hasCommands) {
              realtimePersistence.persist();
            }
            if (!mapResult.hasCommands && !helpResult.hasCommands && !actionResult.hasCommands) break;

            if (round === 2) {
              pendingCommandOutcomes.set(conversationId, commandOutcomes);
              break;
            }

            try {
              rawDialogue = await gemini.generateReplyForSession(
                buildAriaTurnPrompt(
                  engine,
                  conversationManager,
                  conversationId,
                  turnNumber,
                  `The player's original message was: ${JSON.stringify(body.message.trim())}. Continue in character and do not repeat commands that already succeeded.`,
                  commandOutcomes
                ),
                conversationId
              );
            } catch (error) {
              console.error("Could not send command results to Aria:", error);
              pendingCommandOutcomes.set(conversationId, commandOutcomes);
              break;
            }
          }
        }

        const parsed = TagParser.parse(rawDialogue);

        // Execute build command if suggested by AI
        if (parsed.edits.build_command) {
          try {
            const buildCmd = JSON.parse(parsed.edits.build_command);
            buildCmd.issuedBy = "ai_001";
            const buildResult = engine.houseBuilder.executeCommand(buildCmd);
            if (buildResult.success) {
              realtimePersistence.persist();
              pendingCommandOutcomes.set(conversationId, [
                `Your build command succeeded: ${buildResult.message}.`,
              ]);
            } else {
              console.warn("AI build command was rejected:", buildResult.message);
              pendingCommandOutcomes.set(conversationId, [
                `Your build command failed: ${buildResult.message}.`,
              ]);
              parsed.dialogue = `I couldn't make that change: ${buildResult.message}`;
              parsed.edits.dialogue = parsed.dialogue;
            }
          } catch (err) {
            console.warn("Could not parse build_command from AI:", err);
          }
        }
        if (Object.keys(parsed.edits).length > 0) {
          engine.stateManager.updateNarrative(parsed.edits);
          realtimePersistence.persist();
        }

        conversationManager.addMessage("aria", parsed.dialogue, clockTime);

        sendJson({
          dialogue: parsed.dialogue,
          edits: parsed.edits,
          layout: engine.houseBuilder.getLayout(),
          narrative: engine.stateManager.getNarrative(),
          activeConversation: conversationManager.getActiveConversation(),
        });
        return;
      }

      // 4. API: Conversation Management
      if (req.method === "GET" && pathname === "/api/conversations") {
        sendJson({
          activeId: conversationManager.getActiveConversation().id,
          conversations: conversationManager.listConversations(),
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/conversations/select") {
        const body = await parseBody<{ id: string }>();
        if (!body.id) {
          sendJson({ error: "id is required" }, 400);
          return;
        }
        const session = conversationManager.selectConversation(body.id);
        if (!session) {
          sendJson({ error: "Conversation not found" }, 404);
          return;
        }
        sendJson({ activeConversation: session });
        return;
      }

      if (req.method === "POST" && pathname === "/api/conversations/new") {
        const body = await parseBody<{ title?: string }>();
        const session = conversationManager.createConversation(body.title);
        sendJson({ activeConversation: session });
        return;
      }

      if (req.method === "GET" && pathname === "/api/conversations/current") {
        sendJson({ activeConversation: conversationManager.getActiveConversation() });
        return;
      }

      // 5. API: Time Control
      if (req.method === "POST" && pathname === "/api/time/speed") {
        const body = await parseBody<{ speed: number }>();
        if (typeof body.speed === "number") {
          engine.timeEngine.setSpeed(body.speed);
        }
        realtimePersistence.persist();
        sendJson({ speed: engine.stateManager.getTime().speed });
        return;
      }

      if (req.method === "POST" && pathname === "/api/time/pause") {
        const paused = engine.timeEngine.togglePause();
        realtimePersistence.persist();
        sendJson({ paused });
        return;
      }

      // 5. API: Snapshot
      if (req.method === "GET" && pathname === "/api/snapshot") {
        sendJson(engine.stateManager.getSnapshot());
        return;
      }

      // 6. API: Trigger AI Action (Autonomous Decision or Direct Action)
      if (req.method === "POST" && pathname === "/api/ai/act") {
        const body = await parseBody<{ actionId?: string }>();
        let aiExecution;
        if (body.actionId) {
          aiExecution = {
            actionName: body.actionId,
            actionId: body.actionId,
            result: engine.actionEngine.executeAction({
              actorId: "ai_001",
              actionId: body.actionId,
              timestamp: new Date().toISOString(),
            }),
            reasoning: "Player directed AI action",
          };
        } else {
          aiExecution = engine.aiEngine.decideAndExecute("ai_001");
        }
        realtimePersistence.persist();
        const player = engine.getPlayer();
        const ai = engine.getAI();
        const inSameRoom = player.location.roomId === ai.location.roomId;
        const aiRoomName = engine.configLoader.getRoom(ai.location.roomId)?.name || ai.location.roomId;
        const visibleAiBodyState = inSameRoom
          ? engine.getCharacterBodyState(ai.id)
          : {
              pose: `In ${aiRoomName} (Out of sight)`,
              description: `Aria is currently in the ${aiRoomName}, out of your line of sight. Walk to ${aiRoomName} to observe her posture and physical state.`,
              status: "Out of sight"
            };

        sendJson({
          execution: aiExecution,
          ai,
          inSameRoom,
          aiBodyState: visibleAiBodyState,
          aiAvailableActions: engine.actionEngine.getAvailableActions("ai_001"),
          events: engine.eventManager.getRecentEvents(8),
        });
        return;
      }

      // 7. API: Reset physical needs to their initialized values
      if (req.method === "POST" && pathname === "/api/reset") {
        const resetAt = new Date();
        realtimePersistence.update(resetAt);
        engine.stateManager.resetPhysicalNeeds();
        realtimePersistence.persist(resetAt);

        sendJson({
          success: true,
          message: "Mohit and Aria's physical needs have been reset to their starting values.",
        });
        return;
      }

      // 8. API: House Construction & 2D Phaser Layout
      if (req.method === "GET" && pathname === "/api/house") {
        const layout = engine.houseBuilder.getLayout();
        const catalog = engine.houseBuilder.getCatalog();
        const player = engine.getPlayer();
        const ai = engine.getAI();
        sendJson({
          layout,
          catalog,
          characters: {
            player: {
              id: player.id,
              name: player.name,
              roomId: player.location.roomId,
              positionId: player.location.positionId,
              posture: player.body.posture,
            },
            ai: {
              id: ai.id,
              name: ai.name,
              roomId: ai.location.roomId,
              positionId: ai.location.positionId,
              posture: ai.body.posture,
            },
          },
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/house/build") {
        const body = await parseBody<HouseCommand>();
        if (!body || !body.action) {
          sendJson({ error: "Invalid build command: action is required" }, 400);
          return;
        }
        const result = engine.houseBuilder.executeCommand(body);
        realtimePersistence.persist();
        sendJson(result);
        return;
      }

      if (req.method === "POST" && pathname === "/api/house/ai-build") {
        const body = await parseBody<{ roomId?: string; prompt?: string }>();
        let proposal: AriaBuildProposal | null = null;
        if (body.prompt) {
          proposal = engine.ariaBuildPlanner.parseNaturalLanguageRequest(body.prompt);
        } else {
          proposal = engine.ariaBuildPlanner.proposeEnhancement(body.roomId);
        }

        if (!proposal) {
          sendJson({
            success: false,
            message: "Aria evaluated the space and feels it is harmonious right now.",
            layout: engine.houseBuilder.getLayout(),
          });
          return;
        }

        const buildResult = engine.houseBuilder.executeCommand(proposal.command);
        realtimePersistence.persist();

        // Also add Aria's voice to conversation
        const activeConv = conversationManager.getActiveConversation();
        if (activeConv) {
          const timeStr = engine.timeEngine.getFormattedClock();
          conversationManager.addMessage("aria", proposal.dialogue, timeStr);
        }

        sendJson({
          success: buildResult.success,
          message: buildResult.message,
          proposal,
          layout: engine.houseBuilder.getLayout(),
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/house/reset") {
        const layout = engine.houseBuilder.resetToDefault();
        realtimePersistence.persist();
        sendJson({
          success: true,
          message: "House layout reset to default Jabalpur residence.",
          layout,
        });
        return;
      }

      // 9. API: A* Pathfinding Navigation
      if (req.method === "POST" && pathname === "/api/navigation/position") {
        const body = await parseBody<{ roomId: string; gridX: number; gridY: number }>();
        const player = engine.getPlayer();
        const room = engine.houseBuilder.getLayout().rooms.find(
          (candidate) => candidate.id === body.roomId
        );
        if (
          !room ||
          !Number.isInteger(body.gridX) ||
          !Number.isInteger(body.gridY) ||
          body.gridX < room.x ||
          body.gridX >= room.x + room.width ||
          body.gridY < room.y ||
          body.gridY >= room.y + room.height ||
          !engine.houseBuilder.pathfindingEngine.isWalkable(body.gridX, body.gridY)
        ) {
          sendJson({ error: "Choose a walkable floor position inside a room." }, 400);
          return;
        }

        if (player.location.roomId !== room.id || player.body.posture !== "standing") {
          sendJson({ error: "Stand up and enter the room before walking to that map position." }, 409);
          return;
        }

        player.location.roomId = room.id;
        player.location.positionId = `floor_${body.gridX}_${body.gridY}`;
        player.location.mapPosition = {
          roomId: room.id,
          x: body.gridX + 0.5,
          y: body.gridY + 0.5,
        };
        realtimePersistence.persist();
        sendJson({ success: true, player });
        return;
      }

      if (req.method === "GET" && pathname === "/api/navigation/path") {
        const sX = parseFloat(url.searchParams.get("startX") || "0");
        const sY = parseFloat(url.searchParams.get("startY") || "0");
        const tX = parseFloat(url.searchParams.get("targetX") || "0");
        const tY = parseFloat(url.searchParams.get("targetY") || "0");
        const path = engine.houseBuilder.pathfindingEngine.findPath(sX, sY, tX, tY);
        sendJson({ path });
        return;
      }

      // 6. Static File Serving
      let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);

      // Security check: ensure path is within PUBLIC_DIR
      if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mimeTypes: Record<string, string> = {
          ".html": "text/html",
          ".css": "text/css",
          ".js": "application/javascript",
          ".json": "application/json",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
        };
        const contentType = mimeTypes[ext] || "text/plain";
        res.writeHead(200, { "Content-Type": contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // Fallback 404
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
    } catch (err: any) {
      console.error("Server error:", err);
      sendJson({ error: err.message || "Internal server error" }, 500);
    }
  });

  server.on("close", () => {
    clearInterval(realtimeInterval);
    try {
      realtimePersistence.update();
    } catch (error) {
      console.error("Could not save final real-time simulation state:", error);
    }
    gemini.close();
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`\n🌐 Life Simulation Web Game is running at: http://localhost:${port}`);
    console.log(`Open http://localhost:${port} in your browser to play!\n`);
  });

  return server;
}

// If run directly:
if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  const port = parseInt(process.env.PORT || "3000", 10);
  createServer(port);
}
