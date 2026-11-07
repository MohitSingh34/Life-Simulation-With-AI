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
import { executeAiActionCommands, getAiActionOptions } from "./ai/AiActionCommandProcessor.js";

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
  realtimePersistence.start();
  const realtimeInterval = setInterval(() => {
    try {
      realtimePersistence.update();
    } catch (error) {
      console.error("Could not update or persist real-time simulation state:", error);
    }
  }, 1000);
  const gemini = new GeminiWebProvider();
  const conversationManager = new ConversationManager();
  const pendingCommandOutcomes = new Map<string, string[]>();

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
            heldBy: state.heldBy ?? null,
          };
        });

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
          houseLayout: engine.houseBuilder.getLayout(),
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
              gemini.generateReply(actionPrompt),
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
        const conversationId = conversationManager.getActiveConversation().id;
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
          const snapshot = engine.stateManager.getSnapshot();
          const room = engine.getCurrentRoomDetails();
          const houseLayout = engine.houseBuilder.getLayout();
          const prompt = [
            "Roleplay as Aria, the player's roommate in an ongoing everyday-life simulation set in Jabalpur.",
            "Relationship: you and the player have been in conflict. Neither of you could find another suitable place to live, so you reluctantly share the same flat. The living arrangement is a source of awkwardness and friction, not instant friendship.",
            "Play the relationship with nuance: be guarded, irritated, defensive, or blunt when the moment calls for it, but let small courtesies, humor, vulnerability, and gradual changes emerge naturally. Do not force hostility into every exchange or resolve the conflict immediately. Let the player's words and the events of the shared life shape how you respond.",
            "Speak in first person as Aria, like a real person in a face-to-face conversation. Reply to what the player actually said; keep it conversational and usually to one or two short sentences. Use natural wording, occasional pauses or dry humor, and avoid narration, stage directions, dialogue labels, lists, and explanations unless the player asks for them.",
            "Use the simulation state for immediate continuity, such as where you are, what you are doing, the time, and your current mood or needs. Do not invent actions, objects, locations, or events that contradict it. You may refer to personal details or history only when they are genuinely available from the conversation context; do not fabricate shared memories or imply access to information you were not given.",
            "The game engine applies simulation changes. Do not claim an action or home edit succeeded until the game reports its result; only describe changes that the engine confirms.",
            "INTERFACE CONTROL INSTRUCTIONS:",
            "You can control and update what is displayed on the player's screen! Format your output using these exact XML tags:",
            "<dialogue>Your in-character spoken response to the player.</dialogue>",
            "<player_body>An evocative, physical 1-2 sentence description of the player's physical body posture, hands, and bodily sensations right now.</player_body>",
            "<player_pose>A short 2-4 word summary of the player's posture (e.g. Lying on bed, Standing beside counter, Sitting at desk).</player_pose>",
            "<player_mood>A short mood description with emoji reflecting the vibe between you two (e.g. 😐 Guarded & Wary, 😌 Calm, 😒 Annoyed, 🙂 Softening).</player_mood>",
            "<room_ambience>A 1-sentence sensory description of this room's light, sound, and air right now.</room_ambience>",
            "<room_description>A 1-2 sentence description of the room from your perspective.</room_description>",
            "<ai_activity>A short description of what you are doing right now (e.g. Leaning against the desk with arms crossed, Chopping onions at the counter).</ai_activity>",
            "<ai_location>Short status badge for you (e.g. In Study Room • Reading, In Kitchen • Cooking).</ai_location>",
            "<player_clothing>What the player is wearing if changed or noticed.</player_clothing>",
            "<hunger_feeling>How hungry the player appears or feels (e.g. Stomach rumbling softly).</hunger_feeling>",
            "<thirst_feeling>How thirsty the player appears or feels (e.g. Could enjoy a glass of water).</thirst_feeling>",
            "<energy_feeling>The player's energy level (e.g. Rested and alert, Sluggish).</energy_feeling>",
            "<sleepiness_feeling>The player's drowsiness (e.g. Wide awake, Heavy eyelids).</sleepiness_feeling>",
            "<hygiene_feeling>The player's cleanliness (e.g. Fresh & comfortable, Sticky from heat).</hygiene_feeling>",
            "<bladder_feeling>The player's bladder status (e.g. Comfortable, Needs restroom).</bladder_feeling>",
            "<time_weather>Weather and temperature description (e.g. ☀️ 26°C Clear Sky).</time_weather>",
            "<time_period>Time period tag (e.g. Morning Light, Afternoon Sun).</time_period>",
            "You and the player can collaboratively rearrange the home. For adding furniture, you can output a construction command: <build_command>{\"action\":\"place_object\",\"params\":{\"templateId\":\"monstera_001\",\"roomId\":\"study_room\",\"x\":28,\"y\":8}}</build_command>. Only move items that exist in the supplied home layout.",
            "You can request a precise floor map by outputting &&coordinates_of_home_floor&&. The game will send you room bounds, occupied objects, and free single-cell coordinate runs in its next tool-result message.",
            "To move an existing object, output &&&object_id-action:reposition;x,y;room_id&& (the room suffix is optional). Example: &&&desk_001-action:reposition;28,8;study_room&&. Use the exact object id from the supplied home layout and zero-based grid coordinates. The game will validate bounds, collisions, and doorways, then send the result back to you before your final reply.",
            "Home coordinates are zero-based grid cells: x increases to the right, y increases downward, and each object's x/y is its top-left cell. Room x/y/width/height define the valid floor area. The floor query returns free coordinates for 1x1 objects; larger items need adjacent free cells and are validated on move.",
            "You can perform physical actions as Aria by emitting commands in this exact form: &&action:<action_id>&& or &&action:<action_id>;target:<object_id>&&. Use only action IDs and target IDs from the currently valid options below. Movement between rooms uses the configured walk_to_* actions; posture and position changes use their configured actions. Commands affect Aria only, never Mohit. The engine validates every command and reports whether it succeeded.",
            `Currently valid actions and target objects for Aria (refreshes after each command): ${JSON.stringify(getAiActionOptions(engine))}`,
            ...(pendingOutcomes.length > 0
              ? [`Result of your previous home command(s); use this to maintain continuity: ${pendingOutcomes.join(" | ")}`]
              : []),
            "Always provide <dialogue> and <player_body>. Any other tags are optional whenever you want to update or manipulate that specific screen element.",
            `Current simulation context (JSON): ${JSON.stringify({
              time: snapshot.time,
              characters: snapshot.characters,
              objects: snapshot.objects,
              currentRoom: {
                id: room.room.id,
                ambience: room.ambience,
                objects: room.objects,
              },
              home: {
                grid: {
                  cols: houseLayout.grid.cols,
                  rows: houseLayout.grid.rows,
                  coordinateSystem: "zero-based grid cells; x increases right, y increases down",
                },
                rooms: houseLayout.rooms.map(({ id, name, x, y, width, height }) => ({
                  id, name, x, y, width, height,
                })),
                placedObjects: houseLayout.placedObjects.map(({
                  id, name, roomId, x, y, width, height, rotation,
                }) => ({
                  id, name, roomId, x, y, width, height, rotation,
                })),
              },
            })}`,
            `The player says: ${JSON.stringify(body.message.trim())}`,
          ].join("\n\n");

          try {
            rawDialogue = await gemini.generateReply(prompt);
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
            const actionResult = executeAiActionCommands(mapResult.response, engine);
            rawDialogue = actionResult.response;
            const commandOutcomes = [...mapResult.outcomes, ...actionResult.outcomes];

            if (actionResult.hasCommands) {
              realtimePersistence.persist();
            }
            if (!mapResult.hasCommands && !actionResult.hasCommands) break;

            if (round === 2) {
              pendingCommandOutcomes.set(conversationId, commandOutcomes);
              break;
            }

            try {
              rawDialogue = await gemini.generateReply([
                "Your previous response requested home or physical-action tools. The game processed them.",
                `The player's original message was: ${JSON.stringify(body.message.trim())}`,
                `Command results: ${commandOutcomes.join(" ")}`,
                `Your currently valid physical actions and targets are: ${JSON.stringify(getAiActionOptions(engine))}`,
                "Now continue the same conversation in character. Acknowledge only successful changes, respond naturally to the player's original message, and do not repeat commands that have already succeeded.",
              ].join("\n\n"));
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
        if (gemini.isConfigured) {
          try {
            const remote = await gemini.listChats();
            conversationManager.syncRemoteChats(remote);
          } catch {
            // Ignore remote sync errors
          }
        }
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
        if (gemini.isConfigured) {
          try {
            await gemini.selectChat(session.cid || "", session.metadata);
          } catch (err) {
            console.warn("Could not select chat in Gemini worker:", err);
          }
        }
        sendJson({ activeConversation: session });
        return;
      }

      if (req.method === "POST" && pathname === "/api/conversations/new") {
        const body = await parseBody<{ title?: string }>();
        const session = conversationManager.createConversation(body.title);
        if (gemini.isConfigured) {
          try {
            await gemini.newChat();
          } catch (err) {
            console.warn("Could not start new chat in Gemini worker:", err);
          }
        }
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
