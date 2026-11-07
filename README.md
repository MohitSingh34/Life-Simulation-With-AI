# Life Simulation

A cozy, parameter-driven life simulation where a human player and an AI roommate live together in the same home. The game tracks needs, time, room states, object interactions, and daily routines in a structured simulation loop instead of treating the AI as the source of truth.

This project is intentionally built around a clear separation of concerns:

- Configuration defines what can exist in the world
- The engine decides what is valid and what changes state
- The UI renders the state to the player
- The AI agent can narrate and act, but it does not override the simulation engine

---

## Project structure

```text
life-simulation/
├── src/
│   ├── ai/
│   │   ├── AiActionCommandProcessor.ts
│   │   ├── AIDecisionEngine.ts
│   │   ├── ConversationManager.ts
│   │   ├── GeminiWebProvider.ts
│   │   ├── TagParser.ts
│   │   ├── gemini_web_worker.py
│   │   └── __pycache__/
│   │
│   ├── config/
│   │   ├── actions/
│   │   │   ├── daily_activities.json
│   │   │   ├── interactions.json
│   │   │   └── movement.json
│   │   ├── objects.json
│   │   ├── rooms/
│   │   │   ├── bedroom.json
│   │   │   ├── kitchen.json
│   │   │   ├── study_room.json
│   │   │   └── toilet.json
│   │   └── world.json
│   │
│   ├── engine/
│   │   ├── ActionEngine.ts
│   │   ├── BodyStateEngine.ts
│   │   ├── ConfigLoader.ts
│   │   ├── EmotionEngine.ts
│   │   ├── EventManager.ts
│   │   ├── GameEngine.ts
│   │   ├── MovementEngine.ts
│   │   ├── NeedsEngine.ts
│   │   ├── RealtimePersistence.ts
│   │   ├── StateManager.ts
│   │   ├── TimeEngine.ts
│   │   └── ...
│   │
│   ├── types/
│   │   ├── action.ts
│   │   ├── character.ts
│   │   ├── index.ts
│   │   ├── object.ts
│   │   └── world.ts
│   │
│   ├── ui/
│   │   └── TerminalUI.ts
│   │
│   ├── main.ts
│   ├── server.ts
│   ├── test_realtime_persistence.ts
│   ├── test_ai_action_commands.ts
│   ├── test_reset_physical_needs.ts
│   ├── test_runtime_state_bindings.ts
│   ├── test_simulation.ts
│   └── ...
│
├── public/
│   ├── assets/
│   │   └── rooms/
│   ├── themes/
│   │   ├── room-bedroom.css
│   │   ├── room-kitchen.css
│   │   ├── room-study.css
│   │   └── room-bathroom.css
│   ├── app.js
│   ├── index.html
│   └── style.css
│
├── state/
│   ├── conversations.json
│   ├── game-state.json
│   └── timings.txt
│
├── story/
│   └── UNIVERSAL_STORY.md
│
├── feedbackFromUser/
│   ├── DoneByAI.txt
│   └── needsToBeDone.txt
│
├── events/
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── package-lock.json
```

---

## How the game works

The game is a layered simulation:

1. World data is loaded from JSON under `src/config/`
2. The engine initializes characters, rooms, objects, and runtime state
3. Player actions are validated in `ActionEngine`
4. Need decay, time flow, posture changes, and room movement are applied by the engine layer
5. The browser or terminal UI reflects the current state
6. The AI layer can react, advise, narrate, and carry out actions, but the authoritative simulation still stays in the engine

This is important because the AI is not the “real world.” It is a narrator and decision-maker layered on top of a deterministic simulation.

---

## Folder-by-folder guide

### `src/config/`
This is the world definition layer. It contains the static data that tells the game what exists.

- `world.json` defines the world/rooms and how rooms connect
- `rooms/` defines room ambience and room details
- `objects.json` defines furniture, appliances, books, tools, and portable items
- `actions/` defines all move, interaction, and daily-life actions

If you want to add a new room object, new action, or new item, this is usually the first place to edit.

### `src/engine/`
This is the authoritative logic layer.

- `ConfigLoader.ts` loads and validates the JSON configuration
- `StateManager.ts` stores runtime state for players, AI, objects, time, and narrative
- `BodyStateEngine.ts` generates structured, extensible posture and physical-state descriptions from runtime room and position data
- `ActionEngine.ts` validates actions and applies their effects
- `MovementEngine.ts` handles room-to-room movement and connectivity
- `NeedsEngine.ts` manages hunger, thirst, energy, hygiene, bladder, and alerts
- `TimeEngine.ts` controls simulation time and time-of-day logic
- `EmotionEngine.ts` evaluates mood and social state
- `EventManager.ts` records important events and actions
- `GameEngine.ts` orchestrates the whole game loop
- `RealtimePersistence.ts` keeps time and saved state synchronized with the real world

This folder is the heart of the simulation. If a rule feels wrong, it is usually here.

### `src/types/`
TypeScript definitions for the game data model.

- `character.ts` defines posture, needs, clothing, inventory, and character state
- `action.ts` defines actions, preconditions, and effects
- `object.ts` defines objects and their runtime state
- `world.ts` defines room, position, and world relationships

These files are what keep the simulation consistent and typed.

### `src/ai/`
This is the AI layer.

- `AIDecisionEngine.ts` decides what the AI should do next
- `ConversationManager.ts` tracks active chats and conversation history
- `GeminiWebProvider.ts` sends dialogue through the local Gemini OpenAI-compatible API and uses each saved game conversation ID as its persistent Gemini session ID
- `TagParser.ts` parses XML-style narrative tags for in-game text updates
- `gemini_web_worker.py` contains the legacy direct Gemini browser bridge

The AI is a companion layer: it can narrate and make recommendations, but the engine still owns the true in-game state.

The web server sends Gemini requests to `http://127.0.0.1:8001/v1/chat/completions` by default and always requests `gemini-2.5-flash` for game dialogue. Set `GEMINI_API_URL` to override the endpoint and `GEMINI_API_KEY` if the Gemini API server requires an API key. Keep the Gemini API server running; game conversations use stable IDs so switching and returning to a saved game conversation resumes its Gemini session. Role, command, and capability details are sent only in the first prompt of each saved conversation. Later prompts include both characters' current physical state, an explicit UTC and India-local timestamp, and only game/configuration changes since the previous prompt.

Gemini receives a regular Aria idle check-in every 10 minutes after player activity has stopped; this is always enabled and does not depend on Aria's optional loop. Aria can start that optional self-directed mode during a chat or check-in with `&&start_automatic_message_loop&&`, and stop it with `&&stop_automatic_message_loop&&`. The ten-minute check-in cadence and idle/typing suppression remain the same; while optional mode is on, Aria uses each check-in as a self-directed turn and player messages are queued for her next turn. The game reports chat typing to `/api/activity` so scheduled turns can respect active input.

Aria can request on-demand instructions with `&&help:<keyword>&&` or `&&help:<keyword1>,<keyword2>&&`; supported keywords include action IDs/categories and `home`, `map`, `objects`, and `ui`. After returning help, the game sends the details back to Aria so she can issue a command. Physical actions use `&&action:<action_id>&&` or `&&action:<action_id>;target:<object_id>&&`. The engine validates each command, chooses the nearest compatible target when none is specified, and executes movement and posture changes through configured actions. Floor-map movement saves the character's exact location; putting down an item places it at that location. `give_item_to_aria` hands a held item to Aria when she is in the same room and has a free hand. The map reflects authoritative character positions and posture, held items, object states, and occupancy; completed actions also get a brief map-side visual cue. Pending requests use a small, non-blocking loading indicator in the bottom-right corner. The **Reset Needs** control restores both characters' initialized physical needs only—it preserves time, positions, objects, the home map, and conversations.

Any configured or placed seat can be targeted with `sit_on_seat`; clicking a seat on the Phaser map performs that action for the player. Furniture templates can define a `seatCount` (the four-seat dining table uses four independently tracked occupants). The **What would you like to do?** panel filters currently available actions live as the player types.

### `src/ui/`
The terminal presentation layer.

- `TerminalUI.ts` renders the simulation in the command line with needs bars, room summaries, and action prompts

This is independent from the browser UI and useful for direct debugging or a text-only play mode.

### `src/main.ts`
Startup entry point for mode selection.

This file chooses between:
- terminal mode
- browser mode
- default interactive mode prompt

### `src/server.ts`
Runs the web server and exposes live game data via HTTP endpoints.

Important routes:
- `/api/state` returns the current world snapshot
- `/api/action` accepts an action request and executes it
- conversation and AI routes are also served here

This is the bridge between the simulation engine and the browser client.

### `public/`
Browser UI assets.

- `index.html` is the main dashboard layout
- `app.js` drives rendering and interaction handling
- `style.css` contains the dashboard visual styling
- `themes/` modifies room visual themes by room
- `assets/rooms/` contains room artwork used as backdrops

This folder is the client-side presentation layer and is what the browser shows while the server runs the simulation in the background.

### `state/`
Persistence for runtime data and saved history.

- `game-state.json` stores the current simulation snapshot
- `timings.txt` records Jabalpur and simulation time information
- `conversations.json` stores chat history or saved conversations

This is the game’s save-state and time-trace layer.

### `feedbackFromUser/`
A lightweight place for user feedback and notes that are useful during iteration.

- `DoneByAI.txt` summarises completed work and decisions
- `needsToBeDone.txt` tracks iteration tasks and open improvements

This folder is not the runtime logic itself, but it is useful for project continuity.

### `story/`
Branching story-flow documentation based on currently configured rooms, objects, and actions.

- `UNIVERSAL_STORY.md` maps the playable choices from Mohit's starting state through the configured home
- The flow is a planning/reference document; action and world configuration remain the source of truth

### `events/`
A place for event logs or debugging traces if the simulation starts producing more detailed logs.

### `.env`
Environment variables such as AI credentials or session tokens. Keep secrets out of source control.

---

## Runtime flow

A typical game loop looks like this:

```text
GameEngine.init()
  -> ConfigLoader loads JSON world files
  -> StateManager initializes player/AI/object state
  -> server listens for browser or terminal actions
  -> ActionEngine validates request against rules
  -> StateManager updates world state
  -> NeedsEngine / TimeEngine / EmotionEngine adjust simulation logic
  -> UI refreshes with the new state
```

The most important mental model is this:

- configuration describes the world
- the engine determines valid changes
- the UI is just a view
- the AI is an optional narrative/behavior layer, not the authority

---

## Run the game

### Browser mode
```bash
cd /home/no/applications/Game/life-simulation
npm run web
```
Then open:
```text
http://localhost:3000
```

### Terminal mode
```bash
cd /home/no/applications/Game/life-simulation
npm run terminal
```

### Interactive mode selection
```bash
cd /home/no/applications/Game/life-simulation
npm start
```

### Test suite
```bash
cd /home/no/applications/Game/life-simulation
npm test
```

---

## Notes for contributors

- Do not treat the AI output as game truth.
- Add or edit room objects in `src/config/objects.json` and associated action config in `src/config/actions/`.
- Update types before adding new runtime fields to the game state.
- If you are changing gameplay rules, validate them in `src/engine/` before changing the UI.
- If you are changing the browser experience, the main places to inspect are `public/app.js`, `public/index.html`, and `public/style.css`.

This project is easiest to understand when you remember: the config defines the world, the engine governs it, and the UI simply reveals it.
