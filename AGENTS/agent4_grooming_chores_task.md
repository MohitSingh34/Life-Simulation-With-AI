# 🚿 Agent 4 Task: Bathroom, Grooming, Wellness & Housekeeping Chores

## 🎯 Objective
Expand personal hygiene, grooming, and household cleanliness into satisfying daily habits. Implement deep bathroom interactions (hot vs cold showers, mirror steaming, towel drying, skincare) and household chore loops (sweeping, wiping surfaces, managing laundry).

---

## 📂 Governing Files to Read & Edit
- `src/config/rooms/toilet.json`
- `src/config/objects.json`
- `src/config/actions/daily_activities.json`
- `src/config/actions/interactions.json`
- `src/engine/ActionEngine.ts`

---

## 🛠️ Required Tasks

### 1. Bathroom & Grooming Realism
- **Hot Shower & Mirror Steaming Loop**:
  - Update `take_shower`: When a hot shower is taken, the bathroom mirror (`mirror_bathroom_001`) transitions to state `foggy`.
  - Add action `wipe_mirror`: Requires standing at washbasin, mirror state `foggy`. Wiping the steam with a hand or towel returns mirror to `clear`, granting +5 happiness.
- **Towel Rack & Drying Off**:
  - Add object `towel_rack_001` with soft cotton bath towel.
  - Add action `dry_with_towel`: Required after shower to become fully dry, Hygiene +10, Comfort +10.
- **Oral Care & Skincare**:
  - Expand `brush_teeth` and add `apply_moisturizer` / `wash_hair` for thorough grooming before sleep or after waking.

### 2. Housekeeping & Household Maintenance Chores
A real home requires tidying and care:
- **Broom & Floor Sweeping**:
  - Add object `broom_001` (Soft grass broom / Jhadu) kept in the bathroom or kitchen utility corner.
  - Action `sweep_floor`: Available in any room when holding or near the broom. Room tidiness increases, stress decreases, hygiene of the room improves.
- **Trash Bin & Waste Disposal**:
  - Add object `trash_bin_001` in the kitchen and bathroom.
  - Action `throw_trash` / `empty_bin`: Emptying accumulated wrappers, tea bags, or peelings.
- **Laundry Basket (`laundry_basket_001`)**:
  - Place in the bathroom corner for soiled clothes.
  - Action `put_clothes_in_laundry`: Places dirty clothes after changing or showering.

---

## 🧪 Verification & Acceptance Criteria
1. Run `npx tsc --noEmit` — 0 TypeScript compilation errors.
2. Run `npm test` — all simulation tests pass with 100% success.
3. Verify that mirror fogging, wiping, drying off, and sweeping actions execute smoothly.
4. Document all changes in [`AGENTS/agent4_communication.md`](file:///home/no/applications/Game/life-simulation/AGENTS/agent4_communication.md).
