# 🛏️ Agent 3 Task: Bedroom, Wardrobe & Dressing Lifecycle

## 🎯 Objective
Elevate the Bedroom experience from a simple bed station into an authentic personal sanctuary. Implement outfit switching from the wardrobe, mobile phone functionality, and smooth bed posture transitions so resting and waking feel fluid and natural.

---

## 📂 Governing Files to Read & Edit
- `src/config/rooms/bedroom.json`
- `src/config/objects.json`
- `src/config/character_template.json`
- `src/config/actions/body_actions.json`
- `src/config/actions/daily_activities.json`
- `src/config/actions/interactions.json`
- `src/engine/ActionEngine.ts` (if clothing state change handling needs explicit wiring)

---

## 🛠️ Required Tasks

### 1. Fix Phone Portability & Bedside Table Discrepancies
- **Mohit's Phone (`phone_001`)**: Add `"pick_up_item"` to its `interactions` array in `src/config/objects.json` so it can be carried across rooms into the study or living room.
- **Bedside Table (`bedside_table_001`)**: Remove `"check_phone"` from its `interactions` list to eliminate the `INVALID_TARGET_TYPE` error.

### 2. Direct Bed Posture Transitions (Fluid Waking)
- **Direct Recline & Rise Actions**:
  - Add an action `sit_up_in_bed` in `body_actions.json` allowing a lying character (`posture: ["lying"]`, pos: `bed_center`) to sit up directly without first having to execute `get_up` to stand on the floor.
  - Preconditions: `posture: ["lying"]`, pos: `bed_center`.
  - Effect: `posture` becomes `sitting`, remaining at `bed_center`.

### 3. Wardrobe Outfit Changing System
- **Clothing Sets in `wardrobe_001`**:
  - Outfits:
    - *Sleepwear / Nightwear*: Soft cotton kurta-pyjama or shorts.
    - *Casual Loungewear*: Comfortable t-shirt and track pants.
    - *Outdoor / Work Wear*: Crisp linen shirt and tailored trousers.
- **`change_clothes` Action**:
  - Implement in `src/config/actions/daily_activities.json` or `interactions.json`.
  - Preconditions: Standing at `wardrobe_area`, wardrobe state `open`.
  - Effect: Updates character's clothing status, +10 confidence, -5 stress.

### 4. Nightstand & Bedside Lamp Ambiance
- **Bedtime Reading**:
  - Allow reading any carried book while lying in bed if the bedside lamp (`lamp_bedroom_001`) is `on`.
- **Phone Interactivity**:
  - Add phone actions: `check_messages`, `play_alarm`, `listen_music_phone`.

---

## 🧪 Verification & Acceptance Criteria
1. Run `npx tsc --noEmit` — 0 TypeScript compilation errors.
2. Run `npm test` — all simulation tests pass with 100% success.
3. Verify that players can sit up directly in bed, pick up the phone, and change clothes from the wardrobe.
4. Document all changes in [`AGENTS/agent3_communication.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent3_communication.md).
