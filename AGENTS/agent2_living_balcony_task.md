# 🛋️ Agent 2 Task: Living Room & Balcony Expansion

## 🎯 Objective
Expand the ground floor home by adding two essential living spaces:
1. **Living Room / Hall (`living_room`)**: A welcoming common space for relaxation, conversation, music, and tea.
2. **Balcony / Verandah (`balcony`)**: An airy outdoor space looking out over Jabalpur streets for fresh morning air, watering potted plants, and watching monsoon rain.

---

## 📂 Governing Files to Read & Edit
- `src/config/world.json` (add new room IDs and door connections)
- `src/config/rooms/living_room.json` (create new room definition)
- `src/config/rooms/balcony.json` (create new room definition)
- `src/config/objects.json` (add living room & balcony furniture/appliances/plants)
- `src/config/actions/movement.json` (add walking actions to/from new rooms)
- `src/config/actions/daily_activities.json` & `interactions.json` (leisure & outdoor actions)
- `public/themes/room-living_room.css` & `public/themes/room-balcony.css` (visual room themes)
- `public/app.js` (add top-down map coordinates and room scene mappings)

---

## 🛠️ Required Tasks

### 1. Architectural Topology & Door Connections (`world.json`)
- Add `living_room` to `rooms` in `world.json`:
  - Connect `bedroom` $\leftrightarrow$ `living_room` via `door_bedroom_living`.
  - Connect `kitchen` $\leftrightarrow$ `living_room` via `door_kitchen_living`.
  - Connect `living_room` $\leftrightarrow$ `balcony` via `door_living_balcony`.
- Ensure `study_room` can connect to `living_room` or through bedroom/kitchen.

### 2. Room Configuration Files
- **`src/config/rooms/living_room.json`**:
  - Positions: `sofa_area`, `coffee_table_area`, `tv_cabinet_area`, `entrance_door_area`.
  - Ambience descriptions for morning, afternoon, evening, night.
- **`src/config/rooms/balcony.json`**:
  - Positions: `balcony_railing`, `planters_area`, `balcony_door_area`, `cane_chair`.
  - Sensory descriptions of fresh breeze, monsoon smells (petrichor), evening street murmurs.

### 3. New Interactive Objects (`objects.json`)
- **Comfortable Sofa (`sofa_001`)**: Seating posture, relaxing, reading.
- **Coffee Table (`coffee_table_001`)**: Surface for putting down tea, snacks, board games.
- **Smart TV / Speaker (`tv_speaker_001`)**: State `off`/`on`/`playing_music`. Actions to play relaxing classical/indie tunes or watch a movie.
- **Indoor Potted Plant (`house_plant_001`)**: Snake plant/money plant on stand.
- **Balcony Planters & Watering Can (`watering_can_001`, `balcony_plants_001`)**: Action `water_plants` (+10 happiness, -10 stress).
- **Balcony Cane Chair (`cane_chair_001`)**: Sitting outside to enjoy fresh air.

### 4. Movement & Daily Actions
- Walking actions: `walk_to_living_room`, `walk_to_balcony`, and back.
- Actions: `sit_on_sofa`, `relax_on_sofa`, `play_music_speaker`, `watch_tv`, `step_out_balcony`, `lean_on_balcony_railing`, `water_plants`.

---

## 🧪 Verification & Acceptance Criteria
1. Run `npx tsc --noEmit` — 0 TypeScript compilation errors.
2. Run `npm test` — all existing and new movement tests pass.
3. Verify that players can walk smoothly into `living_room` and `balcony`, sit on the sofa, and water plants.
4. Document all changes in [`AGENTS/agent2_communication.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent2_communication.md).
