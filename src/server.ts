import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GameEngine } from "./engine/GameEngine.js";
import { RealtimePersistence } from "./engine/RealtimePersistence.js";
import { GeminiWebProvider } from "./ai/GeminiWebProvider.js";
import { TagParser, ParsedAiEdits } from "./ai/TagParser.js";
import { ConversationManager } from "./ai/ConversationManager.js";

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
        if (!gemini.isConfigured) {
          sendJson(
            { error: "Gemini web is not configured. Follow the setup instructions in README.md." },
            503
          );
          return;
        }

        const clockTime = engine.timeEngine.getFormattedClock();
        conversationManager.addMessage("player", body.message.trim(), clockTime);

        const snapshot = engine.stateManager.getSnapshot();
        const room = engine.getCurrentRoomDetails();
        const prompt = [
          "Roleplay as Aria, the player's roommate in an ongoing everyday-life simulation set in Jabalpur.",
          "Relationship: you and the player have been in conflict. Neither of you could find another suitable place to live, so you reluctantly share the same flat. The living arrangement is a source of awkwardness and friction, not instant friendship.",
          "Play the relationship with nuance: be guarded, irritated, defensive, or blunt when the moment calls for it, but let small courtesies, humor, vulnerability, and gradual changes emerge naturally. Do not force hostility into every exchange or resolve the conflict immediately. Let the player's words and the events of the shared life shape how you respond.",
          "Speak in first person as Aria, like a real person in a face-to-face conversation. Reply to what the player actually said; keep it conversational and usually to one or two short sentences. Use natural wording, occasional pauses or dry humor, and avoid narration, stage directions, dialogue labels, lists, and explanations unless the player asks for them.",
          "Use the simulation state for immediate continuity, such as where you are, what you are doing, the time, and your current mood or needs. Do not invent actions, objects, locations, or events that contradict it. You may refer to personal details or history only when they are genuinely available from the conversation context; do not fabricate shared memories or imply access to information you were not given.",
          "Our conversation gets feeded to a visual interface renderer which accepts only those values which r predefined as options. Do not claim to change the game state, perform actions, or control the simulation; only the game engine can do that.",
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
          })}`,
          `The player says: ${JSON.stringify(body.message.trim())}`,
        ].join("\n\n");

        let rawDialogue: string;
        try {
          rawDialogue = await gemini.generateReply(prompt);
        } catch (error) {
          console.error("Gemini dialogue request failed:", error);
          sendJson(
            { error: error instanceof Error ? error.message : "Gemini could not reply." },
            502
          );
          return;
        }

        const parsed = TagParser.parse(rawDialogue);
        if (Object.keys(parsed.edits).length > 0) {
          engine.stateManager.updateNarrative(parsed.edits);
          realtimePersistence.persist();
        }

        conversationManager.addMessage("aria", parsed.dialogue, clockTime);

        sendJson({
          dialogue: parsed.dialogue,
          edits: parsed.edits,
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

      // 7. API: Reset Story to Fresh Day 1 State
      if (req.method === "POST" && pathname === "/api/reset") {
        const stateDir = path.resolve(__dirname, "../state");
        try {
          if (fs.existsSync(path.join(stateDir, "game-state.json"))) {
            fs.unlinkSync(path.join(stateDir, "game-state.json"));
          }
          if (fs.existsSync(path.join(stateDir, "timings.txt"))) {
            fs.unlinkSync(path.join(stateDir, "timings.txt"));
          }
          if (fs.existsSync(path.join(stateDir, "conversations.json"))) {
            fs.unlinkSync(path.join(stateDir, "conversations.json"));
          }
        } catch (e) {
          console.warn("Could not remove state files during reset:", e);
        }

        // Re-initialize engine and conversations
        engine.init();
        realtimePersistence.start();
        conversationManager.reset();

        sendJson({
          success: true,
          message: "Story has been reset to initial Day 1 state.",
          activeConversation: conversationManager.getActiveConversation(),
        });
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
