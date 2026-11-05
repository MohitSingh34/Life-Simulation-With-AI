# 🍳 Agent 1 Task: Culinary & Kitchen Life Engine

## 🎯 Objective
Transform the Kitchen into an authentic culinary haven reflecting everyday Indian home life in Jabalpur. Enable full-cycle cooking, serving, eating, and cleaning loops so cooking feels physical, sensory, and rewarding.

---

## 📂 Governing Files to Read & Edit
- `src/config/rooms/kitchen.json`
- `src/config/objects.json`
- `src/config/actions/daily_activities.json`
- `src/config/actions/interactions.json`
- `src/engine/ActionEngine.ts` (if new action effect types are needed)

---

## 🛠️ Required Tasks

### 1. Fix Configuration Discrepancies
- **Masala Chai**: Add `"make_masala_chai"` to `stove_001.interactions` in `src/config/objects.json`. Ensure the action succeeds when the player stands before the stove.
- **Countertop Wiping**: In `src/config/objects.json`, ensure `counter_001` matches `wipe_counter` preconditions (add `"surface"` to its `type` array or add `"wipe_counter"` to its `interactions`).

### 2. Implement the Meal Serving & Dining Loop
- **`serve_meal` Action**:
  - Implement in `src/config/actions/daily_activities.json`.
  - Preconditions: Standing at stove or counter, cooked food exists (`stove_001` state: `cooking` or `on`), holding `plate_001`.
  - Effect: `plate_001` state becomes `with_food`, stove state resets to `on` or `idle`.
- **`eat_meal_from_plate` Action**:
  - Implement in `src/config/actions/daily_activities.json`.
  - Preconditions: Holding or sitting before `plate_001` (state `with_food`), posture `sitting` on `kitchen_chair_001`.
  - Effect: Hunger reduced by 50, Energy +15, Happiness +10, `plate_001` state becomes `dirty`.
- **`wash_dishes` Action Expansion**:
  - Allow washing dirty plates at `sink_kitchen_001` to return `plate_001` to state `empty` (clean).

### 3. Add Authentic Daily Food & Beverage Actions
- **Morning Breakfast / Poha / Paratha**: Add an action `cook_breakfast` (Poha/Aloo Paratha) in `daily_activities.json`.
- **Brewing Masala Chai for Two**: Add an action `brew_chai_duo` that prepares two cups of ginger cardamom tea, giving positive mood boosts to both Mohit and Aria when they are in the kitchen.
- **Spice Rack / Masala Dabba**: Add a new interactive kitchen object `spice_box_001` (Brass Masala Dabba) with cloves, cardamom, turmeric, and mustard seeds that can be inspected and used when cooking.

---

## 🧪 Verification & Acceptance Criteria
1. Run `npx tsc --noEmit` — 0 TypeScript compilation errors.
2. Run `npm test` — all simulation tests pass with 100% success.
3. Test that `make_masala_chai`, `serve_meal`, and `eat_meal_from_plate` succeed and alter player needs deterministically.
4. Document all additions and changes in [`AGENTS/agent1_communication.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent1_communication.md).
