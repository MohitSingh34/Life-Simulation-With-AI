# Universal Story: The Shared Home

This is a guide to the game that currently exists, not a promise of planned features. Mohit and Aria occupy one simulation: they have individual bodies and needs, share rooms and object state, and can affect one another through configured social actions. The configuration and runtime listed below are authoritative; flavor text is descriptive.

## What the simulation starts with

The configured home is one ground floor in Jabalpur, India, with six rooms. At initialization, the simulation clock is Tuesday at 07:30.

| Character | Starting place and posture | Starting needs (0–100) |
|---|---|---|
| Mohit (`player_001`) | Lying on the bed in the bedroom | Hunger 45, thirst 40, energy 80, sleepiness 20, hygiene 70, bladder 50 |
| Aria (`ai_001`) | Sitting on the desk chair in the study | Hunger 30, thirst 25, energy 85, sleepiness 15, hygiene 85, bladder 20 |

Hunger, thirst, sleepiness, and bladder rise as they worsen. Energy and hygiene rise as they improve. The configured needs also decay or recover with time; resting and sleep have special handling. Need values are bounded by the engine.

At startup the bed is occupied by Mohit and the study chair by Aria. Sitting or lying on a configured seat/resting place updates its `occupiedBy` state; an occupied place rejects another character's attempt to use it. Leaving releases that occupancy. The two characters' positions, postures, held items, needs, emotions, and activities are separate; household object states are shared.

## The home and its routes

Every room is reachable from its connected neighbors while standing. Movement actions place the character at that room's configured doorway position. The kitchen–toilet and bedroom–toilet connections are configured closed but are not locked, so the movement engine still treats them as reachable.

| Room | Places and notable configured objects | What the room supports |
|---|---|---|
| Bedroom | Bed, bedside table and lamp, wardrobe, copper flask, Mohit's phone | Resting, sleeping and napping; bedside lighting; wardrobe changes; drinking from the flask; phone actions |
| Study room | Desk, occupied/available desk chair, computer, chess set, bookshelf and six books/notebooks | Computer work and media; reading; journaling; music; desk lamp; chess and roommate conversations |
| Kitchen | Stove, refrigerator, countertop, sink, stool, glass, plate, chai cup, masala dabba, ceiling light and trash bin | Cooking, food and drink, dishes, kitchen cleanup and shared chai |
| Toilet/bathroom | Toilet, washbasin, two mirror IDs, shower, towel rack, laundry basket, trash bin and broom | Toilet use, washing and grooming, showers, laundry and bathroom cleanup |
| Living room | Sofa, coffee table, TV/soundbar and indoor money plant | Resting, TV, music, table and plant interactions, social activities |
| Balcony | Planters, watering can and cane chair | Sitting outside, railing actions, plant-related actions and smelling flowers |

The room-to-room actions are `walk_to_bedroom`, `walk_to_study_room`, `walk_to_kitchen`, `walk_to_toilet`, `walk_to_living_room`, and `walk_to_balcony`. They require standing. Other location and posture changes use configured actions such as `get_up`, `stand_up`, `sit_down_study_chair`, `sit_on_sofa`, or `lie_down_bed`; there is no general free-coordinate character movement action.

## A day in the home

### Waking, resting and getting ready

Mohit begins lying in bed. `get_up` moves him to the bedside; `sit_up_in_bed` changes him to sitting on the bed. The bed supports sitting and lying and keeps track of occupancy. Once standing, he can make the bed, use the bedside lamp, open the wardrobe, and choose sleepwear, casual clothes, or work wear. Changing clothes requires standing at the wardrobe with it open.

`sleep` is configured for a lying character at `bed_center`; `nap` is configured in the bedroom while lying or sitting. Their configured durations are seven hours and 45 minutes. The engine applies the configured need effects and advances simulation time according to action duration outside wall-clock mode. This is a state-based simulation, not a continuous sleep animation.

### Food, water and household work

In the kitchen, the refrigerator must be opened before its snack and drink actions. A glass can be filled, sipped, or emptied by drinking; the glass supports `empty`, `filled_water`, and `half`. The copper flask supports `full`, `half`, and `empty`.

The stove supports configured breakfast, meal, and chai actions. A prepared meal can be served onto the plate when the serving requirements are met, eaten while seated at the kitchen stool, and then washed at the sink. `wash_dishes` targets the sink and sets the configured plate and chai-cup states to `empty`; it does not set the sink to `empty`. The action does not require the cup or plate to be dirty, so it can also leave an already-empty dish unchanged.

Other kitchen interactions include opening and closing the fridge, switching the stove and tap, making snacks, washing hands, wiping the countertop, and using the masala dabba. The configured chai actions change the chai-cup state and character needs as listed in the action data. `brew_chai_duo` also applies configured need changes to the roommate when both characters share the room.

### Hygiene and keeping the home in order

The bathroom supports toilet use and flushing; washing the face, brushing teeth, hair washing and moisturizer; hot, regular and cold showers; towel drying; mirror inspection and wiping; and laundry actions. The regular and hot shower actions fog the mirror in the engine, and `wipe_mirror` clears it when the character is standing at the mirror/washbasin and the mirror is foggy. The cold-shower action does not use that mirror-fogging path.

The laundry basket can hold clothes and be emptied. Trash actions are available in the kitchen and bathroom. The broom can be picked up and used to sweep. `tidy_room` and `sweep_floor` affect character needs; the available configured implementation does not model a persistent cleanliness level for every floor or room.

### Study and quiet activities

The study's computer can be powered on for computer work, web browsing, viewing photos, selfies, and video recording. The desk chair can be occupied by only one character at a time. The bookshelf contains math, physics, chemistry, psychology, Mohit's, and Aria's books/notebooks. Reading actions have configured posture, room, and item requirements; bedtime reading has its own bed, held-book, and lamp requirements.

The study also supports journaling, lo-fi music, desk tidying, and chess. Chess is available as a social activity in the study or living room while both characters share the room and the actor is sitting.

### Living room and balcony

The living room provides the sofa, TV/soundbar, coffee table and indoor plant. A character can sit or lie on the sofa, relax, watch TV, control the TV or speaker, wipe the table, and inspect or wipe the plant leaves.

The balcony provides the cane chair, planters and watering can. Configured actions include stepping outside, leaning on the railing, watering plants, smelling flowers, refilling the can, and sitting. Important runtime limit: `water_plants` changes configured character needs, but does not update the planter object's state. Treat `blooming`, `watered`, and `dry` as available object states, not as proof that the current watering action transitions between them.

## Mohit and Aria together

Both characters exist in the same room and object-state model; their interactions are not just dialogue. Configured shared actions include offering chai, asking about the day, playing chess, discussing a book, and discussing code. Their preconditions specify when another character must be present and, for some actions, which rooms or postures qualify. Effects are applied through the engine to the actor and/or roommate as configured.

Aria can also issue physical actions from her response:

```text
&&action:<action_id>&&
&&action:<action_id>;target:<object_id>&&
```

Her prompt receives the action IDs currently validated for her and valid target IDs with their current states. Commands run as `ai_001` through the same action engine used by the game. A response can contain at most five action commands. Invalid actions or targets are rejected and reported; Aria cannot use this mechanism to move Mohit. Room movement and posture changes must use configured actions, not arbitrary coordinates. The house-map build/reposition commands are a separate feature.

## Time, saves and reset

In simulation-time mode, action durations advance the clock and needs. The server can instead use wall-clock persistence. Action effects are applied when the action is executed; configured durations are not a promise of an animation or a continuously running multi-stage activity.

**Reset Needs** restores only each character's six physical needs to their initialized values. It preserves time, positions and postures, object states and occupancy, emotions, activities, the constructed home map, and conversation history. The reset baseline is Mohit's and Aria's starting needs in the table above.

## Where to verify the behavior

- World and room connections: [`src/config/world.json`](../src/config/world.json)
- Room positions and ambience: [`src/config/rooms/`](../src/config/rooms/)
- Object states and object-to-action links: [`src/config/objects.json`](../src/config/objects.json)
- Action requirements, durations, and effects: [`src/config/actions/`](../src/config/actions/)
- Validation and execution: [`src/engine/ActionEngine.ts`](../src/engine/ActionEngine.ts)
- Needs, starting state and reset baseline: [`src/engine/NeedsEngine.ts`](../src/engine/NeedsEngine.ts), [`src/engine/StateManager.ts`](../src/engine/StateManager.ts)
- Aria's physical action commands: [`src/ai/AiActionCommandProcessor.ts`](../src/ai/AiActionCommandProcessor.ts), [`src/server.ts`](../src/server.ts)

Action availability is state-dependent. Always check the action's configured preconditions, object interactions, and current state rather than treating this narrative as an unconditional list of actions.

## Physical needs: scales and thresholds

The six values below are stored independently for Mohit and Aria. All are clamped to 0–100. The table gives the configured per-minute baseline; it does not include action effects or the special resting/sleeping rates.

| Need | Direction of worsening | Baseline change per minute | Warning | Critical |
|---|---|---:|---:|---:|
| Hunger | Increases | +0.2083 | 65 | 85 |
| Thirst | Increases | +0.2381 | 60 | 80 |
| Energy | Decreases | -0.07 | 30 or lower | 15 or lower |
| Sleepiness | Increases | +0.07 | 70 | 90 |
| Hygiene | Decreases | -0.04 | 35 or lower | 20 or lower |
| Bladder | Increases | +0.09 | 70 | 90 |

During an active `sleep` tick, the rates are overridden to energy +0.4/minute, sleepiness -0.5/minute, hunger +0.03/minute, and thirst +0.04/minute; other needs use baseline rates. While lying but not sleeping, energy improves +0.1/minute and sleepiness improves by -0.05/minute. Need changes from actions use the same bounds; need-like emotions/personality values in an effect object are routed to their matching state field.

## Full action register

This register mirrors the currently loaded action configuration. Durations are simulation seconds. Target types are config filters; `—` means the action does not require an explicit target. Preconditions and effects are shown as compact JSON so values and IDs can be compared directly with `src/config/actions/`. A config entry is not automatically an implemented state transition; runtime-specific exceptions are noted after the tables.

### Movement and body

| ID | Name | Duration | Target types | Preconditions | Configured effects |
|---|---|---:|---|---|---|
| `walk_to_bedroom` | Walk to Bedroom | 5s | — | `{ "posture": ["standing"] }` | `{ "moveToRoom": "bedroom", "moveToPosition": "bedroom_door_area", "posture": "standing" }` |
| `walk_to_study_room` | Walk to Study Room | 5s | — | `{ "posture": ["standing"] }` | `{ "moveToRoom": "study_room", "moveToPosition": "study_door_area", "posture": "standing" }` |
| `walk_to_kitchen` | Walk to Kitchen | 5s | — | `{ "posture": ["standing"] }` | `{ "moveToRoom": "kitchen", "moveToPosition": "kitchen_door_area", "posture": "standing" }` |
| `walk_to_toilet` | Walk to Toilet | 5s | — | `{ "posture": ["standing"] }` | `{ "moveToRoom": "toilet", "moveToPosition": "toilet_door_area", "posture": "standing" }` |
| `walk_to_living_room` | Walk to Living Room | 5s | — | `{ "posture": ["standing"] }` | `{ "moveToRoom": "living_room", "moveToPosition": "entrance_door_area", "posture": "standing" }` |
| `walk_to_balcony` | Walk to Balcony | 5s | — | `{ "posture": ["standing"] }` | `{ "moveToRoom": "balcony", "moveToPosition": "balcony_door_area", "posture": "standing" }` |
| `get_up` | Get Up from Bed | 3s | — | `{ "roomId": "bedroom", "positionId": "bed_center", "posture": ["lying", "sitting"] }` | `{ "posture": "standing", "moveToPosition": "bedside" }` |
| `sit_up_in_bed` | Sit Up in Bed | 2s | — | `{ "roomId": "bedroom", "positionId": "bed_center", "posture": ["lying"] }` | `{ "posture": "sitting", "moveToPosition": "bed_center" }` |
| `stand_up` | Stand Up | 2s | — | `{ "posture": ["sitting", "kneeling", "squatting", "lying"] }` | `{ "posture": "standing" }` |
| `lie_down_bed` | Lie Down on Bed | 3s | — | `{ "roomId": "bedroom", "posture": ["standing", "sitting"] }` | `{ "moveToPosition": "bed_center", "posture": "lying" }` |
| `sit_down_bed` | Sit on Bed Edge | 2s | — | `{ "roomId": "bedroom", "posture": ["standing"] }` | `{ "moveToPosition": "bed_center", "posture": "sitting" }` |
| `sit_down_study_chair` | Sit at Study Desk | 2s | — | `{ "roomId": "study_room", "posture": ["standing"] }` | `{ "moveToPosition": "desk_chair", "posture": "sitting" }` |
| `sit_down_kitchen_stool` | Sit on Kitchen Stool | 2s | — | `{ "roomId": "kitchen", "posture": ["standing"] }` | `{ "moveToPosition": "dining_chair", "posture": "sitting" }` |
| `sit_on_sofa` | Sit on Sofa | 2s | — | `{ "roomId": "living_room", "posture": ["standing", "lying"] }` | `{ "moveToPosition": "sofa_area", "posture": "sitting" }` |
| `lie_down_sofa` | Lie Down on Sofa | 3s | — | `{ "roomId": "living_room", "posture": ["standing", "sitting"] }` | `{ "moveToPosition": "sofa_area", "posture": "lying" }` |
| `sit_on_cane_chair` | Sit on Cane Chair | 2s | — | `{ "roomId": "balcony", "posture": ["standing"] }` | `{ "moveToPosition": "cane_chair", "posture": "sitting" }` |
| `turn_left` | Turn Left | 1s | — | `{}` | `{ "orientation": "left" }` |
| `turn_right` | Turn Right | 1s | — | `{}` | `{ "orientation": "right" }` |

### Daily activities

| ID | Name | Duration | Target types | Preconditions | Configured effects |
|---|---|---:|---|---|---|
| `sleep` | Sleep Through Night | 25,200s | — | `{ "roomId": "bedroom", "positionId": "bed_center", "posture": ["lying"] }` | `{ "needChanges": { "energy": 90, "sleepiness": -95, "hunger": 25, "thirst": 20, "bladder": 35 }, "activity": "sleep" }` |
| `nap` | Take a Power Nap | 2,700s | — | `{ "roomId": "bedroom", "posture": ["lying", "sitting"] }` | `{ "needChanges": { "energy": 35, "sleepiness": -40 } }` |
| `cook_meal` | Cook Fresh Meal | 1,200s | `appliance` | `{ "roomId": "kitchen", "posture": ["standing"] }` | `{ "objectState": "cooking", "objectStates": { "stove_001": "cooking" }, "needChanges": { "hunger": 10, "stress": -10, "happiness": 5 } }` |
| `serve_meal` | Serve Meal onto Plate | 60s | `item`, `appliance` | `{ "roomId": "kitchen", "positionId": ["stove_area", "counter_area", "kitchen_door_area"], "posture": ["standing"], "holding": "plate_001", "requiredObjectStates": { "stove_001": ["cooking", "on"] } }` | `{ "objectStates": { "plate_001": "with_food", "stove_001": "idle" }, "needChanges": { "hunger": -5, "happiness": 5 } }` |
| `eat_meal_from_plate` | Eat Meal from Plate | 600s | `item` | `{ "roomId": "kitchen", "positionId": "dining_chair", "posture": ["sitting"], "requiredObjectStates": { "plate_001": "with_food" } }` | `{ "objectStates": { "plate_001": "dirty" }, "needChanges": { "hunger": -50, "energy": 15, "happiness": 10 } }` |
| `cook_breakfast` | Cook Breakfast (Poha & Aloo Paratha) | 600s | `appliance` | `{ "roomId": "kitchen", "posture": ["standing"] }` | `{ "objectState": "cooking", "objectStates": { "stove_001": "cooking" }, "needChanges": { "hunger": -35, "energy": 15, "happiness": 15, "stress": -10 } }` |
| `eat_meal` | Eat Home-Cooked Meal | 900s | — | `{ "roomId": "kitchen" }` | `{ "needChanges": { "hunger": -65, "energy": 15, "thirst": 10 } }` |
| `eat_snack` | Eat Quick Snack | 300s | — | `{ "roomId": "kitchen" }` | `{ "needChanges": { "hunger": -25 } }` |
| `use_computer` | Work at Computer | 1,800s | `electronics` | `{ "roomId": "study_room", "posture": ["sitting"], "objectState": ["on", "in_use"] }` | `{ "objectState": "in_use", "needChanges": { "energy": -8, "sleepiness": 8 } }` |
| `read_book` | Read Book | 1,500s | — | `{ "roomId": ["study_room", "bedroom"] }` | `{ "needChanges": { "energy": -5, "stress": -5 } }` |
| `use_toilet` | Use Toilet | 120s | — | `{ "roomId": "toilet" }` | `{ "needChanges": { "bladder": -100 } }` |
| `wash_face` | Wash Face with Cold Water | 60s | — | `{ "roomId": "toilet" }` | `{ "needChanges": { "hygiene": 15, "energy": 10, "sleepiness": -15 } }` |
| `brush_teeth` | Brush Teeth | 180s | — | `{ "roomId": "toilet", "posture": ["standing"] }` | `{ "needChanges": { "hygiene": 25, "happiness": 5, "stress": -5 } }` |
| `take_shower` | Take a Refreshing Shower | 600s | — | `{ "roomId": "toilet", "posture": ["standing"] }` | `{ "needChanges": { "hygiene": 65, "stress": -25, "energy": 15, "happiness": 10 }, "objectStates": { "mirror_001": "foggy", "mirror_bathroom_001": "foggy" } }` |
| `take_hot_shower` | Take a Steaming Hot Shower | 600s | — | `{ "roomId": "toilet", "posture": ["standing"] }` | `{ "needChanges": { "hygiene": 70, "stress": -30, "energy": 10, "comfort": 15, "happiness": 15 }, "objectStates": { "mirror_001": "foggy", "mirror_bathroom_001": "foggy" } }` |
| `take_cold_shower` | Take a Brisk Cold Shower | 300s | — | `{ "roomId": "toilet", "posture": ["standing"] }` | `{ "needChanges": { "hygiene": 65, "stress": -10, "energy": 25, "sleepiness": -30, "happiness": 5 } }` |
| `dry_with_towel` | Dry Off with Towel | 60s | — | `{ "roomId": "toilet", "posture": ["standing"] }` | `{ "needChanges": { "hygiene": 10, "comfort": 10, "happiness": 10, "stress": -5 } }` |
| `apply_moisturizer` | Apply Moisturizer | 90s | — | `{ "roomId": "toilet", "posture": ["standing"] }` | `{ "needChanges": { "hygiene": 10, "comfort": 10, "happiness": 10, "stress": -5 } }` |
| `wash_hair` | Wash Hair | 240s | — | `{ "roomId": "toilet", "posture": ["standing"] }` | `{ "needChanges": { "hygiene": 30, "happiness": 10, "stress": -15 } }` |
| `sweep_floor` | Sweep Floor | 180s | — | `{ "posture": ["standing"] }` | `{ "needChanges": { "hygiene": 10, "stress": -15, "happiness": 10, "energy": -5 } }` |
| `meditate` | Meditate Peacefully | 600s | — | `{ "posture": ["sitting", "lying", "kneeling"] }` | `{ "needChanges": { "stress": -30, "energy": 10 } }` |
| `make_masala_chai` | Brew Fresh Hot Tea | 360s | `appliance` | `{ "roomId": "kitchen", "posture": ["standing"] }` | `{ "objectStates": { "chai_cup_001": "steaming_chai" }, "needChanges": { "hunger": -10, "thirst": -30, "energy": 18, "stress": -15, "happiness": 15 } }` |
| `brew_tea` | Brew Normal Tea | 360s | `appliance` | `{ "roomId": "kitchen", "posture": ["standing"] }` | `{ "objectStates": { "chai_cup_001": "steaming_chai" }, "needChanges": { "hunger": -10, "thirst": -30, "energy": 18, "stress": -15, "happiness": 15 } }` |
| `brew_chai_duo` | Brew Hot Tea for Two | 420s | `appliance` | `{ "roomId": "kitchen", "posture": ["standing"] }` | `{ "objectState": "cooking", "objectStates": { "stove_001": "cooking", "chai_cup_001": "steaming_chai" }, "needChanges": { "hunger": -10, "thirst": -30, "energy": 20, "stress": -20, "happiness": 20, "loneliness": -25 }, "companionNeedChanges": { "thirst": -25, "energy": 15, "stress": -15, "happiness": 20, "loneliness": -20 } }` |
| `sip_hot_chai` | Sip Hot Chai | 60s | `item` | `{ "roomId": "kitchen", "requiredObjectStates": { "chai_cup_001": "steaming_chai" } }` | `{ "needChanges": { "thirst": -15, "energy": 8, "happiness": 8, "stress": -10 } }` |
| `drink_hot_chai` | Drink Entire Cup of Chai | 180s | `item` | `{ "roomId": "kitchen", "requiredObjectStates": { "chai_cup_001": "steaming_chai" } }` | `{ "objectStates": { "chai_cup_001": "dirty" }, "needChanges": { "thirst": -35, "hunger": -10, "energy": 15, "happiness": 15, "stress": -15 } }` |
| `journal_notes` | Write in Journal | 300s | — | `{ "roomId": "study_room", "posture": ["sitting"] }` | `{ "needChanges": { "stress": -20, "energy": 5 } }` |
| `stretch_body` | Morning Body Stretch | 60s | — | `{ "posture": ["standing"] }` | `{ "needChanges": { "energy": 12, "sleepiness": -15 } }` |
| `tidy_room` | Tidy Up Space | 240s | — | `{ "posture": ["standing"] }` | `{ "needChanges": { "hygiene": 10, "stress": -10, "energy": -5 } }` |
| `relax_on_sofa` | Relax on Sofa | 600s | — | `{ "roomId": "living_room", "positionId": "sofa_area", "posture": ["sitting", "lying"] }` | `{ "needChanges": { "energy": 10, "stress": -15, "happiness": 10, "sleepiness": 5 } }` |
| `watch_tv` | Watch TV | 1,800s | — | `{ "roomId": "living_room", "posture": ["sitting", "lying"] }` | `{ "needChanges": { "stress": -15, "happiness": 12, "sleepiness": 5, "energy": -2 } }` |
| `step_out_balcony` | Step Out onto Balcony | 60s | — | `{ "roomId": "balcony", "posture": ["standing"] }` | `{ "moveToPosition": "balcony_railing", "needChanges": { "stress": -10, "energy": 5 } }` |
| `lean_on_balcony_railing` | Lean on Balcony Railing | 300s | — | `{ "roomId": "balcony", "posture": ["standing"] }` | `{ "moveToPosition": "balcony_railing", "needChanges": { "stress": -15, "happiness": 10 } }` |
| `water_plants` | Water Balcony Plants | 180s | — | `{ "roomId": "balcony", "posture": ["standing"] }` | `{ "needChanges": { "happiness": 10, "stress": -10 } }` |
| `smell_flowers` | Smell Jasmine Flowers | 30s | — | `{ "roomId": "balcony", "posture": ["standing"] }` | `{ "needChanges": { "happiness": 8, "stress": -8 } }` |
| `change_clothes` | Change Clothes | 60s | — | `{ "roomId": "bedroom", "positionId": "wardrobe_area", "posture": ["standing"], "objectState": "open" }` | `{ "clothing": { "upper": "Comfortable T-Shirt", "lower": "Grey Track Pants", "footwear": "Slip-on Sandals" }, "needChanges": { "stress": -5 }, "emotionChanges": { "confidence": 10, "stress": -5 } }` |
| `wear_sleepwear` | Change into Sleepwear | 60s | — | `{ "roomId": "bedroom", "positionId": "wardrobe_area", "posture": ["standing"], "objectState": "open" }` | `{ "clothing": { "upper": "Soft Cotton Kurta", "lower": "Soft Cotton Pyjama", "footwear": "Barefoot" }, "needChanges": { "stress": -5 }, "emotionChanges": { "confidence": 10, "stress": -5 } }` |
| `wear_casual` | Change into Casual Loungewear | 60s | — | `{ "roomId": "bedroom", "positionId": "wardrobe_area", "posture": ["standing"], "objectState": "open" }` | `{ "clothing": { "upper": "Comfortable T-Shirt", "lower": "Grey Track Pants", "footwear": "Slip-on Sandals" }, "needChanges": { "stress": -5 }, "emotionChanges": { "confidence": 10, "stress": -5 } }` |
| `wear_work_wear` | Change into Outdoor / Work Wear | 60s | — | `{ "roomId": "bedroom", "positionId": "wardrobe_area", "posture": ["standing"], "objectState": "open" }` | `{ "clothing": { "upper": "Crisp Linen Shirt", "lower": "Tailored Trousers", "footwear": "Leather Loafers" }, "needChanges": { "stress": -5 }, "emotionChanges": { "confidence": 10, "stress": -5 } }` |
| `bedtime_reading` | Bedtime Reading | 1,200s | — | `{ "roomId": "bedroom", "positionId": "bed_center", "posture": ["lying", "sitting"], "holding": "any" }` | `{ "needChanges": { "energy": -5, "sleepiness": 10, "stress": -10, "boredom": -20 }, "emotionChanges": { "stress": -10, "happiness": 10 } }` |
| `code_project` | Work on Coding Project | 2,400s | `electronics` | `{ "roomId": "study_room", "posture": ["sitting", "standing"], "objectState": ["on", "in_use"] }` | `{ "objectState": "in_use", "needChanges": { "studiousness": 20, "energy": 10, "boredom": -15 }, "activity": "code_project" }` |
| `listen_lofi_music` | Listen to Lo-Fi Music | 1,800s | — | `{ "roomId": "study_room", "posture": ["sitting", "standing"] }` | `{ "needChanges": { "stress": -15, "happiness": 10 }, "activity": "listen_lofi_music" }` |
| `read_math_book` | Study Math Textbook | 1,800s | `item` | `{ "roomId": "study_room", "posture": ["sitting", "standing"] }` | `{ "needChanges": { "studiousness": 15, "energy": 5, "boredom": -10 }, "activity": "read_math_book" }` |
| `read_physics_book` | Study Physics Textbook | 1,800s | `item` | `{ "roomId": "study_room", "posture": ["sitting", "standing"] }` | `{ "needChanges": { "studiousness": 15, "boredom": -10 }, "activity": "read_physics_book" }` |
| `read_chemistry_book` | Study Chemistry Textbook | 1,800s | `item` | `{ "roomId": "study_room", "posture": ["sitting", "standing"] }` | `{ "needChanges": { "studiousness": 15, "boredom": -10 }, "activity": "read_chemistry_book" }` |
| `read_psychology_book` | Read Psychology Book | 1,500s | `item` | `{ "roomId": "study_room", "posture": ["sitting", "standing"] }` | `{ "needChanges": { "sociability": 15, "stress": -10 }, "activity": "read_psychology_book" }` |
| `read_mohit_notebook` | Read Mohit's Notebook | 1,200s | `item` | `{ "roomId": "study_room", "posture": ["sitting", "standing"] }` | `{ "needChanges": { "happiness": 10, "stress": -15 }, "activity": "read_mohit_notebook" }` |
| `read_aria_notebook` | Read Aria's Notebook | 600s | `item` | `{ "roomId": "study_room", "posture": ["sitting", "standing"] }` | `{ "needChanges": { "stress": 20 }, "activity": "read_aria_notebook" }` |

### Social actions

| ID | Name | Duration | Preconditions | Configured effects |
|---|---|---:|---|---|
| `offer_chai` | Offer Cup of Chai to Roommate | 600s | `{ "roomId": ["kitchen", "living_room", "study_room"], "requiresSharedRoom": true }` | Actor: stress -15, happiness +15, loneliness -20, sociability +10. Roommate: stress -15, happiness +15, loneliness -20, sociability +5. Activity `offer_chai`. |
| `ask_about_day` | Ask Aria About Her Day | 480s | `{ "requiresSharedRoom": true }` | Actor: loneliness -15, happiness +10, sociability +5, stress -5. Roommate: loneliness -15, happiness +10, stress -5. Activity `ask_about_day`. |
| `play_chess` | Play Chess with Aria | 1,800s | `{ "roomId": ["study_room", "living_room"], "posture": ["sitting"], "requiresSharedRoom": true }` | Actor and roommate: boredom -25, happiness +15, studiousness +10, sociability +10, stress -10. Activity `play_chess`. |
| `discuss_book` | Discuss Book with Aria | 600s | `{ "requiresSharedRoom": true }` | Actor: studiousness +10, sociability +10, boredom -15, loneliness -10. Roommate: studiousness +10, sociability +10, boredom -10. Activity `discuss_book`. |
| `discuss_code` | Discuss Code Architecture with Aria | 600s | `{ "requiresSharedRoom": true }` | Actor: studiousness +10, sociability +10, boredom -15, happiness +10. Roommate: studiousness +5, sociability +10, boredom -10. Activity `discuss_code`. |

Social effects apply to other characters in the actor's current room. “Roommate” means another character sharing that room, not necessarily Aria by hard-coded identity. Activity effects are set for the action and marked completed when the action execution finishes.

### Object interactions

| ID | Name | Duration | Target types | Preconditions | Configured effects |
|---|---|---:|---|---|---|
| `open_fridge` | Open Refrigerator | 2s | `appliance` | `{ "roomId": "kitchen", "posture": ["standing"], "objectState": "closed" }` | `{ "objectState": "open" }` |
| `close_fridge` | Close Refrigerator | 2s | `appliance` | `{ "roomId": "kitchen", "objectState": "open" }` | `{ "objectState": "closed" }` |
| `turn_on_stove` | Ignite Gas Stove | 3s | `appliance` | `{ "roomId": "kitchen", "posture": ["standing"] }` | `{ "objectState": "on" }` |
| `turn_off_stove` | Turn Off Gas Stove | 2s | `appliance` | `{ "roomId": "kitchen" }` | `{ "objectState": "off" }` |
| `turn_on_lamp` | Turn On Bedside Lamp | 1s | `appliance` | `{ "roomId": "bedroom", "objectState": "off" }` | `{ "objectState": "on" }` |
| `turn_off_lamp` | Turn Off Bedside Lamp | 1s | `appliance` | `{ "roomId": "bedroom", "objectState": "on" }` | `{ "objectState": "off" }` |
| `turn_on_computer` | Power On Computer | 5s | `electronics` | `{ "roomId": "study_room", "objectState": "off" }` | `{ "objectState": "on" }` |
| `turn_off_computer` | Shut Down Computer | 5s | `electronics` | `{ "roomId": "study_room", "objectState": ["on", "in_use"] }` | `{ "objectState": "off" }` |
| `open_wardrobe` | Open Wardrobe | 2s | `furniture` | `{ "roomId": "bedroom", "posture": ["standing"] }` | `{ "objectState": "open" }` |
| `close_wardrobe` | Close Wardrobe | 2s | `furniture` | `{ "roomId": "bedroom" }` | `{ "objectState": "closed" }` |
| `fill_glass_water` | Fill Glass with Water | 4s | `item` | `{ "roomId": "kitchen", "objectState": ["empty", "half"] }` | `{ "objectState": "filled_water" }` |
| `drink_water_glass` | Drink Water from Glass | 5s | `item` | `{ "objectState": ["filled_water", "half"] }` | `{ "objectState": "empty", "needChanges": { "thirst": -45 } }` |
| `drink_from_flask` | Drink from Copper Flask | 4s | `item` | `{ "objectState": ["full", "half"] }` | `{ "objectState": "empty", "needChanges": { "thirst": -40 } }` |
| `flush_toilet` | Flush Toilet | 3s | `fixture` | `{ "roomId": "toilet" }` | `{ "objectState": "clean" }` |
| `look_in_mirror` | Look in Mirror | 3s | `fixture` | `{ "roomId": "toilet", "posture": ["standing"] }` | `{ "needChanges": { "stress": -5 } }` |
| `wipe_mirror` | Wipe Steamy Mirror | 5s | — | `{ "roomId": "toilet", "positionId": ["washbasin_area", "mirror_area"], "posture": ["standing"], "objectState": "foggy" }` | `{ "objectState": "clear", "objectStates": { "mirror_001": "clear", "mirror_bathroom_001": "clear" }, "needChanges": { "happiness": 5 } }` |
| `throw_trash` | Throw Away Trash | 3s | — | `{ "roomId": ["kitchen", "toilet"], "posture": ["standing"] }` | `{ "objectState": "has_trash", "needChanges": { "hygiene": 5, "happiness": 2 } }` |
| `empty_bin` | Empty Trash Bin | 20s | — | `{ "roomId": ["kitchen", "toilet"], "posture": ["standing"] }` | `{ "objectState": "empty", "needChanges": { "hygiene": 10, "happiness": 5, "stress": -5 } }` |
| `put_clothes_in_laundry` | Put Clothes in Laundry Basket | 5s | — | `{ "roomId": "toilet", "posture": ["standing"] }` | `{ "objectState": "has_clothes", "objectStates": { "laundry_basket_001": "has_clothes" }, "needChanges": { "hygiene": 5, "happiness": 5 } }` |
| `empty_laundry` | Empty Laundry Basket | 15s | — | `{ "roomId": "toilet", "posture": ["standing"] }` | `{ "objectState": "empty", "objectStates": { "laundry_basket_001": "empty" }, "needChanges": { "happiness": 5, "stress": -5 } }` |
| `turn_on_kitchen_tap` | Turn On Kitchen Tap | 1s | `fixture` | `{ "roomId": "kitchen" }` | `{ "objectState": "running_tap" }` |
| `turn_off_kitchen_tap` | Turn Off Kitchen Tap | 1s | `fixture` | `{ "roomId": "kitchen" }` | `{ "objectState": "idle" }` |
| `pick_up_item` | Pick Up Item | 2s | Any configured target interaction | `{ "holding": "none" }` | `{ "pickUp": true }` |
| `pick_up_math_book` | Pick Math Textbook | 2s | `item` | `{ "roomId": "study_room", "holding": "none", "objectState": "on_shelf" }` | `{ "pickUp": true }` |
| `pick_up_physics_book` | Pick Physics Textbook | 2s | `item` | `{ "roomId": "study_room", "holding": "none", "objectState": "on_shelf" }` | `{ "pickUp": true }` |
| `pick_up_chemistry_book` | Pick Chemistry Textbook | 2s | `item` | `{ "roomId": "study_room", "holding": "none", "objectState": "on_shelf" }` | `{ "pickUp": true }` |
| `pick_up_psychology_book` | Pick Psychology Book | 2s | `item` | `{ "roomId": "study_room", "holding": "none", "objectState": "on_shelf" }` | `{ "pickUp": true }` |
| `pick_up_mohit_notebook` | Pick Mohit's Notebook | 2s | `item` | `{ "roomId": "study_room", "holding": "none", "objectState": "on_shelf" }` | `{ "pickUp": true }` |
| `pick_up_aria_notebook` | Pick Aria's Notebook | 2s | `item` | `{ "roomId": "study_room", "holding": "none", "objectState": "on_shelf" }` | `{ "pickUp": true }` |
| `put_down_item` | Put Down Item | 2s | — | `{ "holding": "any" }` | `{ "putDown": true }` |
| `make_bed` | Make the Bed | 60s | `furniture` | `{ "roomId": "bedroom", "posture": ["standing"] }` | `{ "objectState": "neat", "needChanges": { "energy": -2 } }` |
| `wipe_counter` | Wipe Kitchen Counter | 45s | `surface`, `fixture`, `furniture` | `{ "roomId": "kitchen", "posture": ["standing"] }` | `{ "needChanges": { "hygiene": 8, "energy": -2 } }` |
| `sip_water_glass` | Sip Water | 3s | `item` | `{ "objectState": "filled_water" }` | `{ "objectState": "half", "needChanges": { "thirst": -18 } }` |
| `sip_from_flask` | Sip from Flask | 3s | `item` | `{ "objectState": ["full", "half"] }` | `{ "objectState": "half", "needChanges": { "thirst": -18 } }` |
| `browse_books` | Browse the Bookshelf | 10s | `furniture` | `{ "roomId": "study_room" }` | `{}` |
| `browse_web` | Browse the Web | 600s | `electronics` | `{ "roomId": "study_room", "objectState": ["on", "in_use"] }` | `{ "objectState": "in_use", "needChanges": { "energy": -3, "sleepiness": 2 } }` |
| `view_photos` | See Photos | 300s | `electronics` | `{ "roomId": "study_room", "objectState": ["on", "in_use"] }` | `{ "objectState": "in_use", "needChanges": { "energy": 1 } }` |
| `take_selfie` | Take a Selfie | 30s | `electronics` | `{ "roomId": "study_room", "objectState": ["on", "in_use"] }` | `{ "objectState": "in_use" }` |
| `record_video` | Record a Video | 60s | `electronics` | `{ "roomId": "study_room", "objectState": ["on", "in_use"] }` | `{ "objectState": "in_use" }` |
| `turn_on_room_light` | Turn On Light | 1s | `appliance` | `{ "objectState": "off" }` | `{ "objectState": "on" }` |
| `turn_off_room_light` | Turn Off Light | 1s | `appliance` | `{ "objectState": "on" }` | `{ "objectState": "off" }` |
| `get_food_from_fridge` | Take a Snack | 15s | `appliance` | `{ "roomId": "kitchen", "objectState": "open" }` | `{ "needChanges": { "hunger": -25 } }` |
| `get_drink_from_fridge` | Take a Cold Drink | 10s | `appliance` | `{ "roomId": "kitchen", "objectState": "open" }` | `{ "needChanges": { "thirst": -35 } }` |
| `prepare_snack` | Prepare a Snack | 60s | `furniture` | `{ "roomId": "kitchen" }` | `{ "objectState": "has_items", "objectStates": { "plate_001": "with_food", "counter_001": "has_items" } }` |
| `wash_hands_kitchen` | Wash Hands | 30s | `fixture` | `{ "roomId": "kitchen" }` | `{ "needChanges": { "hygiene": 8 } }` |
| `wash_dishes` | Wash the Dishes | 180s | `fixture` | `{ "roomId": "kitchen" }` | `{ "objectStates": { "plate_001": "empty", "chai_cup_001": "empty" }, "needChanges": { "hygiene": 8, "energy": -2, "happiness": 5 } }` |
| `tidy_desk` | Tidy the Desk | 120s | `furniture` | `{ "roomId": "study_room" }` | `{ "objectState": "tidy", "needChanges": { "energy": -2 } }` |
| `check_phone` | Check Phone | 30s | `electronics` | `{}` | `{ "needChanges": { "boredom": -3 } }` |
| `check_messages` | Check Messages | 60s | `electronics` | `{}` | `{ "needChanges": { "boredom": -10, "loneliness": -10 }, "emotionChanges": { "happiness": 5, "loneliness": -10 } }` |
| `play_alarm` | Play Alarm | 15s | `electronics` | `{}` | `{ "needChanges": { "sleepiness": -15 } }` |
| `listen_music_phone` | Listen to Music on Phone | 300s | `electronics` | `{}` | `{ "needChanges": { "boredom": -15, "stress": -10 }, "emotionChanges": { "happiness": 10, "stress": -10 } }` |
| `turn_on_shower` | Turn On Shower | 5s | `fixture` | `{ "roomId": "toilet", "objectState": "off" }` | `{ "objectState": "running" }` |
| `turn_off_shower` | Turn Off Shower | 2s | `fixture` | `{ "roomId": "toilet", "objectState": "running" }` | `{ "objectState": "off" }` |
| `turn_on_tv` | Turn On TV | 2s | `appliance` | `{ "roomId": "living_room", "objectState": "off" }` | `{ "objectState": "on" }` |
| `turn_off_tv` | Turn Off TV | 2s | `appliance` | `{ "roomId": "living_room", "objectStateNot": "off" }` | `{ "objectState": "off" }` |
| `play_music_speaker` | Play Music on Soundbar | 2s | `appliance` | `{ "roomId": "living_room" }` | `{ "objectState": "playing_music", "needChanges": { "stress": -15, "happiness": 15 } }` |
| `stop_music_speaker` | Stop Speaker Music | 2s | `appliance` | `{ "roomId": "living_room", "objectState": "playing_music" }` | `{ "objectState": "off" }` |
| `wipe_coffee_table` | Wipe Coffee Table | 60s | `surface`, `furniture` | `{ "roomId": "living_room", "posture": ["standing"] }` | `{ "objectState": "clean", "needChanges": { "stress": -5 } }` |
| `inspect_plant` | Inspect Money Plant | 30s | `plant` | `{ "roomId": "living_room" }` | `{ "needChanges": { "stress": -5, "happiness": 5 } }` |
| `wipe_plant_leaves` | Wipe Plant Leaves | 60s | `plant` | `{ "roomId": "living_room", "posture": ["standing"] }` | `{ "objectState": "thriving", "needChanges": { "stress": -5, "happiness": 8 } }` |
| `refill_watering_can` | Refill Watering Can | 30s | `tool` | `{ "roomId": "balcony", "posture": ["standing"] }` | `{ "objectState": "full" }` |
| `open_spice_box` | Open Brass Masala Dabba | 5s | `item`, `surface` | `{ "roomId": "kitchen" }` | `{ "objectState": "open", "objectStates": { "spice_box_001": "open" } }` |
| `close_spice_box` | Close Brass Masala Dabba | 5s | `item`, `surface` | `{ "roomId": "kitchen" }` | `{ "objectState": "closed", "objectStates": { "spice_box_001": "closed" } }` |
| `inspect_spices` | Inspect Masala Dabba Spices | 15s | `item`, `surface` | `{ "roomId": "kitchen" }` | `{ "needChanges": { "stress": -5, "happiness": 5 } }` |
| `pinch_spices` | Pinch Spices for Cooking | 10s | `item`, `surface` | `{ "roomId": "kitchen", "posture": ["standing"] }` | `{ "needChanges": { "stress": -3, "happiness": 5 } }` |

### Interactions: reading these entries correctly

- For targeted actions, the object must list the action in its `interactions`, be within the actor's room or held by that actor, and match the configured target type. Portable pickup also requires free hands.
- If a target is omitted, the engine tries the held item, the object at the actor's current position, then a matching object in the current room. Some non-target actions also have explicit implicit targets: mirror, laundry basket, towel rack, or room trash bin.
- `objectState` changes the effective target object; `objectStates` changes the listed IDs. Both may be present. The state register is under `src/config/objects.json`.
- `objectState` preconditions are checked against the target/current-position object. `requiredObjectStates` checks the named object IDs separately. Special validation also exists for shared-room actions, bed reading, wardrobe use, mirror wiping, sweeping, trash-bin presence, and object occupancy.

## Object-state register

These are configured states, not a claim that every state transition is implemented by an action. Portable items can move when picked up and put down; the household map's build/reposition state is separate from the room object's configured state.

| Room | Object IDs | Configured states |
|---|---|---|
| Bedroom | `bed_001` | `neat`, `rumpled`, `occupied_lying`, `occupied_sitting` |
| Bedroom | `bedside_table_001` | `normal` |
| Bedroom | `lamp_001` | `off`, `on` |
| Bedroom | `wardrobe_001` | `closed`, `open` |
| Bedroom | `water_flask_001` | `full`, `half`, `empty` |
| Bedroom | `phone_001` | `on`, `off` |
| Study room | `desk_001` | `tidy`, `cluttered` |
| Study room | `chair_study` | `available`, `occupied` |
| Study room | `computer_001` | `off`, `on`, `in_use` |
| Study room | `chess_set_001` | `arranged`, `in_play` |
| Study room | `bookshelf_001` | `stocked` |
| Study room | `study_lamp_001` | `off`, `on` |
| Study room | `math_book_001`, `physics_book_001`, `chemistry_book_001`, `psychology_book_001`, `mohit_notebook_001`, `aria_notebook_001` | `on_shelf` |
| Kitchen | `stove_001` | `off`, `on`, `cooking`, `idle` |
| Kitchen | `fridge_001` | `closed`, `open` |
| Kitchen | `counter_001` | `clear`, `has_items`, `clean` |
| Kitchen | `sink_001` | `idle`, `running_tap` |
| Kitchen | `kitchen_chair_001` | `available`, `occupied` |
| Kitchen | `drinking_glass_001` | `empty`, `filled_water`, `half` |
| Kitchen | `plate_001` | `empty`, `with_food`, `dirty` |
| Kitchen | `chai_cup_001` | `empty`, `steaming_chai`, `dirty` |
| Kitchen | `spice_box_001` | `closed`, `open` |
| Kitchen | `kitchen_light_001` | `off`, `on` |
| Kitchen | `trash_bin_001` | `empty`, `has_trash`, `full` |
| Toilet | `toilet_seat_001` | `clean`, `in_use`, `needs_flush` |
| Toilet | `washbasin_001` | `idle`, `running_tap` |
| Toilet | `mirror_001`, `mirror_bathroom_001` | `clear`, `foggy` |
| Toilet | `shower_001` | `off`, `running` |
| Toilet | `towel_rack_001` | `hanging_towel`, `empty` |
| Toilet | `laundry_basket_001` | `empty`, `has_clothes`, `full` |
| Toilet | `trash_bin_toilet_001` | `empty`, `has_trash`, `full` |
| Toilet | `broom_001` | `idle`, `sweeping` |
| Toilet | `bathroom_light_001` | `off`, `on` |
| Living room | `sofa_001` | `neat`, `occupied_sitting`, `occupied_lying` |
| Living room | `coffee_table_001` | `clean`, `cluttered` |
| Living room | `tv_speaker_001` | `off`, `on`, `playing_music` |
| Living room | `house_plant_001` | `thriving`, `needs_water` |
| Balcony | `balcony_plants_001` | `blooming`, `watered`, `dry` |
| Balcony | `watering_can_001` | `full`, `empty` |
| Balcony | `cane_chair_001` | `vacant`, `occupied` |

`mirror_bathroom_001` aliases the bathroom mirror state; `sink_kitchen_001` aliases `sink_001`; and `lamp_bedroom_001` aliases `lamp_001`. `door_study` and `door_toilet` are not configured room objects; the corresponding door-area positions have no object ID.
