# Universal Story Tree: Current Configured Paths

This tree reflects configured rooms, actions, object states, and runtime rules. It is an index of possible branches, not a scripted sequence: an action appears or succeeds only when its current preconditions and target validation pass. For the world overview and implementation boundaries, see [`UNIVERSAL_STORY.md`](./UNIVERSAL_STORY.md).

## Start

```text
Tuesday, 07:30 — Jabalpur home
├── Mohit: bedroom / bed_center / lying; bed occupied by player_001
│   ├── get_up → bedside / standing
│   └── sit_up_in_bed → bed_center / sitting
└── Aria: study_room / desk_chair / sitting; chair occupied by ai_001
    └── stand_up → standing; desk chair becomes available
```

The startup clock and need values are in [`StateManager.ts`](../src/engine/StateManager.ts). In the browser, **Reset Needs** restores the six startup physical needs for both characters; it does not restart this tree or reset the home.

## Movement and posture

All six rooms are connected into one reachable floor plan. Walking requires standing; room changes use the configured `walk_to_*` action and put the character at that room's door position.

```text
Any room (standing)
├── walk_to_bedroom
├── walk_to_study_room
├── walk_to_kitchen
├── walk_to_toilet
├── walk_to_living_room
└── walk_to_balcony

Bedroom
├── lying or sitting on bed → get_up → bedside / standing
├── lying on bed → sit_up_in_bed → bed / sitting
├── standing or sitting → lie_down_bed → bed / lying
└── standing → sit_down_bed → bed / sitting

Study room
└── standing → sit_down_study_chair → desk_chair / sitting

Kitchen
└── standing → sit_down_kitchen_stool → dining_chair / sitting

Living room
├── standing or lying → sit_on_sofa → sofa / sitting
└── standing or sitting → lie_down_sofa → sofa / lying

Balcony
└── standing → sit_on_cane_chair → cane chair / sitting
```

The runtime synchronizes occupancy for the bed, study chair, sofa, kitchen stool, and cane chair where configured. A destination that is already occupied cannot be claimed by the other character. `stand_up` is available from sitting, kneeling, squatting, or lying postures; `turn_left` and `turn_right` change orientation.

## Branch by room

### Bedroom

```text
Bedroom
├── Bed [bed_001]
│   ├── Lie Down on Bed [lie_down_bed]
│   ├── Sit on Bed Edge [sit_down_bed]
│   ├── Sit Up in Bed [sit_up_in_bed]
│   ├── Get Up from Bed [get_up]
│   ├── Sleep Through Night [sleep] — lying at bed_center
│   ├── Take a Power Nap [nap] — lying or sitting in bedroom
│   └── Make the Bed [make_bed] — standing; sets bed state to neat
├── Bedside Lamp [lamp_001]
│   ├── Turn On [turn_on_lamp] — off → on
│   └── Turn Off [turn_off_lamp] — on → off
├── Wardrobe [wardrobe_001]
│   ├── Open / Close [open_wardrobe, close_wardrobe]
│   └── Change Clothes / Wear Sleepwear / Wear Casual / Wear Work Wear
│       [change_clothes, wear_sleepwear, wear_casual, wear_work_wear]
│       └── changing requires standing at wardrobe with it open
├── Copper Flask [water_flask_001]
│   ├── Sip [sip_from_flask] — full or half → half
│   └── Drink [drink_from_flask] — full or half → empty
├── Mohit's Phone [phone_001]
│   └── Check Phone, Check Messages, Play Alarm, Listen to Music on Phone
│       [check_phone, check_messages, play_alarm, listen_music_phone]
└── Bedtime Reading [bedtime_reading]
    └── bed_center, sitting or lying, holding a book, bedside lamp on
```

### Study room

```text
Study room
├── Computer [computer_001]
│   ├── Power On / Shut Down [turn_on_computer, turn_off_computer]
│   ├── Work at Computer / Code Project [use_computer, code_project]
│   ├── Browse Web / View Photos / Take Selfie / Record Video
│   │   [browse_web, view_photos, take_selfie, record_video]
│   └── computer actions that require it to be on/in use check that state
├── Desk and chair [desk_001, chair_study]
│   ├── Tidy Desk [tidy_desk]
│   └── Sit at Desk [sit_down_study_chair] — occupied chair prevents another sitter
├── Study Desk Lamp [study_lamp_001]
│   └── Turn Light On / Off [turn_on_room_light, turn_off_room_light]
├── Bookshelf and books [bookshelf_001]
│   ├── Browse Books [browse_books]
│   └── Pick up / read the configured math, physics, chemistry or psychology book
│       [pick_up_math_book, read_math_book, pick_up_physics_book, read_physics_book,
│        pick_up_chemistry_book, read_chemistry_book, pick_up_psychology_book,
│        read_psychology_book]
├── Notebooks
│   ├── Pick up / read Mohit's notebook [pick_up_mohit_notebook, read_mohit_notebook]
│   └── Pick up / read Aria's notebook [pick_up_aria_notebook, read_aria_notebook]
├── Write in Journal [journal_notes]
├── Listen to Lo-Fi Music [listen_lofi_music]
└── Shared branches
    ├── Play Chess [play_chess] — both together; sitting; study or living room
    ├── Discuss Book [discuss_book] — both together
    └── Discuss Code [discuss_code] — both together
```

Reading is limited to the configured subject-specific actions and requirements. For bedtime reading, use the separate bedroom action. Actions that pick up items require the actor to have free hands; putting an item down uses `put_down_item`.

### Kitchen

```text
Kitchen
├── Refrigerator [fridge_001]
│   ├── Open / Close [open_fridge, close_fridge]
│   └── Take a Snack / Cold Drink [get_food_from_fridge, get_drink_from_fridge]
│       └── fridge must be open
├── Stove [stove_001]
│   ├── Ignite / Turn Off [turn_on_stove, turn_off_stove]
│   ├── Cook Breakfast / Cook Meal [cook_breakfast, cook_meal]
│   ├── Brew Fresh Tea / Normal Tea / Chai for Two
│   │   [make_masala_chai, brew_tea, brew_chai_duo]
│   └── the configured cooking actions update stove/cup/plate states and needs
├── Serving and eating
│   ├── Pick up plate → serve meal [pick_up_item, serve_meal]
│   │   └── serving requires the plate in hand and the stove in a permitted state
│   ├── Sit on stool [sit_down_kitchen_stool]
│   └── Eat plated meal [eat_meal_from_plate] — sitting at dining_chair;
│       plate must be with_food; meal changes plate to dirty
├── Water
│   ├── Fill glass [fill_glass_water] — empty or half → filled_water
│   ├── Sip glass [sip_water_glass] — filled_water → half
│   └── Drink glass [drink_water_glass] — filled_water or half → empty
├── Chai cup [chai_cup_001]
│   ├── Brew actions can set steaming_chai
│   ├── Sip [sip_hot_chai] — requires steaming_chai
│   └── Drink [drink_hot_chai] — requires steaming_chai; sets cup dirty
├── Masala dabba [spice_box_001]
│   └── Open / inspect / pinch spices / close
│       [open_spice_box, inspect_spices, pinch_spices, close_spice_box]
├── Sink [sink_001]
│   ├── Turn Tap On / Off [turn_on_kitchen_tap, turn_off_kitchen_tap]
│   ├── Wash Hands [wash_hands_kitchen]
│   └── Wash Dishes [wash_dishes] — sets plate and chai cup to empty;
│       sink stays in its own idle/running_tap state
├── Counter [counter_001]
│   └── Prepare Snack / Wipe Counter [prepare_snack, wipe_counter]
├── Kitchen Ceiling Light [kitchen_light_001]
│   └── Turn Light On / Off [turn_on_room_light, turn_off_room_light]
└── Shared chai [offer_chai]
    └── both characters together in kitchen, living room, or study room
```

The sink alias `sink_kitchen_001` resolves to the kitchen sink in the engine. `wash_dishes` uses the sink as its target; it does not require the dishes to start dirty.

### Toilet and bathroom

```text
Bathroom
├── Toilet [toilet_seat_001]
│   ├── Use Toilet [use_toilet]
│   └── Flush Toilet [flush_toilet]
├── Washbasin [washbasin_001]
│   ├── Wash Face [wash_face]
│   ├── Brush Teeth [brush_teeth]
│   ├── Apply Moisturizer [apply_moisturizer]
│   └── Wash Hair [wash_hair]
├── Shower [shower_001]
│   ├── Turn On / Off [turn_on_shower, turn_off_shower]
│   ├── Take a Shower [take_shower]
│   ├── Take a Hot Shower [take_hot_shower]
│   └── Take a Cold Shower [take_cold_shower]
├── After shower
│   ├── Dry Off with Towel [dry_with_towel]
│   ├── Look in Mirror [look_in_mirror]
│   └── Wipe Steamy Mirror [wipe_mirror] — mirror must be foggy
├── Laundry
│   └── Put Clothes in Basket / Empty Basket
│       [put_clothes_in_laundry, empty_laundry]
├── Cleanup
│   ├── Throw Away Trash / Empty Bin [throw_trash, empty_bin]
│   └── Pick up Broom / Sweep Floor [pick_up_item, sweep_floor]
└── Turn Bathroom Light On / Off [turn_on_room_light, turn_off_room_light]
```

The configured `take_shower` and `take_hot_shower` paths fog the mirror in the runtime; `wipe_mirror` clears it. Do not infer that every shower variant fogs it.

### Living room

```text
Living room
├── Sofa [sofa_001]
│   ├── Sit / Lie Down [sit_on_sofa, lie_down_sofa]
│   └── Relax [relax_on_sofa]
├── TV and soundbar [tv_speaker_001]
│   ├── Turn TV On / Off [turn_on_tv, turn_off_tv]
│   ├── Watch TV [watch_tv]
│   └── Play / Stop Speaker Music [play_music_speaker, stop_music_speaker]
├── Coffee Table [coffee_table_001]
│   └── Wipe Table [wipe_coffee_table]
├── Indoor plant [house_plant_001]
│   └── Inspect / Wipe Leaves [inspect_plant, wipe_plant_leaves]
└── Shared branches
    ├── Offer Chai [offer_chai] — both together
    ├── Ask About the Day [ask_about_day] — both together
    ├── Discuss Book / Code [discuss_book, discuss_code] — both together
    └── Play Chess [play_chess] — both together and sitting
```

### Balcony

```text
Balcony
├── Step Outside / Lean on Railing
│   [step_out_balcony, lean_on_balcony_railing]
├── Planters [balcony_plants_001]
│   ├── Water Plants [water_plants]
│   └── Smell Flowers [smell_flowers]
├── Watering Can [watering_can_001]
│   ├── Refill [refill_watering_can]
│   └── Pick Up [pick_up_item]
└── Cane Chair [cane_chair_001]
    └── Sit [sit_on_cane_chair]
```

`water_plants` is a configured action, but the current action does not change `balcony_plants_001`'s object state. It applies the configured need changes only.

## Aria's action branch

Aria's prompt receives her currently valid configured actions and targets. She may emit up to five commands in one response:

```text
&&action:<action_id>&&
&&action:<action_id>;target:<object_id>&&
```

The server validates and executes each as Aria (`ai_001`). Use the exact IDs in the current options: target-required actions need a target, and room travel or posture changes must use configured actions. Results are returned to Aria before she continues. A rejected command does not mean the requested state change happened. This command path controls Aria only; home-map construction/reposition commands are separate.

## End of a branch: what reset means

**Reset Needs** returns the six physical needs for Mohit and Aria to their initialized values. It does not erase chats, rewind time, move either character, clear object state, release occupancy, reset activities, or restore the map. This action is a needs reset, not a new game.

## Expanded story branches

These are playable pathways through the configured actions, not mandatory quests. Follow a branch only if the listed current room, position, posture, held item, object state, and shared-room requirements are satisfied. In the action register in [`UNIVERSAL_STORY.md`](./UNIVERSAL_STORY.md), the config's exact JSON preconditions/effects and durations are listed for every action.

### Branch A: Wake, wash, dress, and get ready

```text
Mohit starts lying on bed_center
├── get_up (bedroom, bed_center, lying or sitting)
│   └── standing at bedside; bed occupancy released
├── optional: turn_left / turn_right
│   └── change facing direction; position unchanged
├── walk_to_toilet (must be standing; accessible room connection)
│   ├── use_toilet → bladder decreases by 100
│   ├── wash_face → hygiene +15, energy +10, sleepiness -15
│   ├── brush_teeth (standing) → hygiene +25, happiness +5, stress -5
│   ├── wash_hair (standing) → hygiene +30, happiness +10, stress -15
│   └── optional moisturizer (standing)
│       └── hygiene +10; comfort effect increases happiness/reduces stress
├── walk_to_bedroom (standing)
├── walk_to_wardrobe (via position change/action availability)
│   ├── open_wardrobe → closed becomes open
│   ├── wear_sleepwear / wear_casual / wear_work_wear / change_clothes
│   │   └── require wardrobe_area, standing, and wardrobe open
│   └── close_wardrobe → state becomes closed
└── walk to kitchen or another connected room
```

The bathroom actions above are each discrete actions. Their configured durations are 60s for face washing, 180s for brushing teeth, 240s for washing hair, and 90s for moisturizer. The shower variants take 300s (cold) or 600s (regular/hot); their configured need and mirror effects are listed in the full action register.

### Branch B: Choose rest or sleep

```text
Bedroom
├── Stand → lie_down_bed → bed_center / lying
│   ├── sleep (bedroom + bed_center + lying)
│   │   ├── configured duration: 25,200 seconds
│   │   ├── action changes: energy +90, sleepiness -95, hunger +25,
│   │   │   thirst +20, bladder +35
│   │   └── sleep tick uses faster energy recovery and sleepiness reduction
│   └── nap (bedroom + lying or sitting)
│       └── 2,700 seconds; configured energy +35 and sleepiness -40
├── Stand → sit_down_bed → bed_center / sitting
│   └── eligible posture for nap and bedtime reading, not sleep
└── Make Bed (standing, target bed_001)
    └── sets bed state neat; energy -2
```

Sleep and nap apply their need deltas when the configured action is executed. In simulation-time mode, the action duration advances clock/needs; in wall-clock mode, real-time persistence advances needs separately. The game does not play out a real-time seven-hour animation.

### Branch C: Use a light, read, and study

```text
Study room
├── Walk to computer_area
│   ├── turn_on_computer (computer off → on)
│   ├── sit_down_study_chair (if the chair is free)
│   ├── use_computer (seated; computer on/in_use)
│   │   └── computer becomes in_use; energy -8, sleepiness +8
│   ├── code_project (computer on/in_use; sitting or standing)
│   │   └── studiousness +20, energy +10, boredom -15; activity recorded
│   ├── browse_web / view_photos / take_selfie / record_video
│   │   └── computer must be on/in_use; relevant effects are action-specific
│   └── turn_off_computer (off; allowed from on/in_use)
├── Walk to desk and chair
│   ├── tidy_desk → desk tidy; energy -2
│   ├── turn_on_room_light / turn_off_room_light → target lamp off/on transition
│   └── journal_notes (sitting) → stress -20, energy +5
├── Study books
│   ├── Pick up the chosen book/notebook (hands must be free)
│   ├── read_math_book → studiousness +15, energy +5, boredom -10
│   ├── read_physics_book / read_chemistry_book → studiousness +15, boredom -10
│   ├── read_psychology_book → sociability +15, stress -10
│   ├── read_mohit_notebook → happiness +10, stress -15
│   └── read_aria_notebook → configured stress +20; see privacy note below
└── listen_lofi_music (sitting or standing)
    └── stress -15, happiness +10
```

The bookshelf's object state is `stocked`; books start `on_shelf`. `browse_books` requires the bookshelf as target. Book pickup actions require the item to be `on_shelf` and free hands. Some reading actions have subject-specific behavior in `ActionEngine`, so their runtime results can include extra need/social changes beyond the config row.

### Branch D: Prepare and eat food

```text
Kitchen
├── Take food from fridge
│   ├── open_fridge (fridge closed; standing)
│   ├── get_food_from_fridge (fridge open) → hunger -25
│   ├── get_drink_from_fridge (fridge open) → thirst -35
│   └── close_fridge (when open)
├── Cook
│   ├── cook_breakfast (standing; target stove)
│   │   └── stove becomes cooking; hunger -35, energy +15, happiness +15, stress -10
│   ├── cook_meal (standing; target stove)
│   │   └── stove becomes cooking; hunger +10, stress -10, happiness +5
│   ├── make_masala_chai / brew_tea (standing; target stove)
│   │   └── chai cup becomes steaming_chai; hunger -10, thirst -30, energy +18,
│   │       stress -15, happiness +15
│   └── brew_chai_duo (standing; target stove)
│       └── stove cooking, chai cup steaming; actor and same-room companion change
├── Serve plate-based meal
│   ├── pick_up_item on plate_001 (free hands)
│   ├── serve_meal (standing in an allowed kitchen position; holding plate;
│   │   stove cooking or on)
│   │   └── plate with_food; stove idle
│   ├── sit_down_kitchen_stool → dining_chair / sitting
│   └── eat_meal_from_plate (dining_chair, sitting, plate with_food)
│       └── plate dirty; hunger -50, energy +15, happiness +10
├── Alternative: eat_meal or eat_snack
│   └── kitchen only; configured hunger change -65 or -25
└── Wash up
    ├── stand_up
    ├── wash_dishes at sink_001
    │   └── plate and chai cup become empty; sink retains idle/running_tap state
    └── wash_hands_kitchen at sink → hygiene +8
```

The meal cooking actions accept a stove target but do not require a separate `turn_on_stove` action in their configured preconditions. `serve_meal` explicitly accepts stove state `cooking` or `on`. `wash_dishes` currently cleans both configured dishes even when one was not dirty; it does not check the sink tap state.

### Branch E: Drink water or chai

```text
Water
├── Kitchen glass starts empty
│   ├── fill_glass_water (glass empty/half) → filled_water
│   ├── sip_water_glass (glass filled_water) → half; thirst -18
│   └── drink_water_glass (glass filled_water/half) → empty; thirst -45
└── Bedroom copper flask starts full
    ├── sip_from_flask (full/half) → half; thirst -18
    └── drink_from_flask (full/half) → empty; thirst -40

Chai
├── brew one of the configured chai actions → chai_cup_001 steaming_chai
├── sip_hot_chai (steaming_chai) → thirst -15, energy +8, happiness +8, stress -10
├── drink_hot_chai (steaming_chai) → cup dirty; thirst -35, hunger -10,
│   energy +15, happiness +15, stress -15
├── wash_dishes → chai cup empty
└── offer_chai (shared room; configured room among kitchen/living/study)
    └── actor and companion effects apply from the social action config
```

### Branch F: Clean, groom, laundry, and trash

```text
Bathroom cleaning loop
├── take_shower or take_hot_shower
│   └── fog mirror_001 and mirror_bathroom_001
├── dry_with_towel (standing, bathroom)
│   └── towel-rack target is inferred; hygiene/comfort/mood effects apply
├── wipe_mirror (standing at washbasin_area or mirror_area; mirror foggy)
│   └── both mirror aliases clear; happiness +5
└── take_cold_shower
    └── cold-shower needs apply; it does not invoke mirror fogging

Laundry
├── put_clothes_in_laundry (standing, toilet room)
│   └── basket → has_clothes
└── empty_laundry (standing, toilet room)
    └── basket → empty

Trash and sweeping
├── throw_trash / empty_bin
│   └── standing, kitchen or toilet; engine selects that room's bin
├── pick up broom (only if hands free)
└── sweep_floor (standing; hold broom or be in its room)
    └── needs change and room ambience narrative changes; floor cleanliness is not stored

Kitchen cleaning
├── turn_on_kitchen_tap → sink running_tap
├── turn_off_kitchen_tap → sink idle
├── wipe_counter (standing; target counter) → hygiene +8, energy -2
└── prepare_snack (target counter) → counter has_items and plate with_food
```

There are object state descriptions for the trash bins and laundry basket, but the trash actions do not enforce a complete `empty → has_trash → full` lifecycle. The action's target is selected from the current room by the engine. A broom can be used while held or while unheld in the same room.

### Branch G: Rest in the living room or go outside

```text
Living room
├── Sit on sofa / lie down on sofa → occupancy and posture update
├── relax_on_sofa (sitting/lying at sofa_area)
│   └── energy +10, stress -15, happiness +10, sleepiness +5
├── watch_tv (sitting/lying in living room)
│   └── stress -15, happiness +12, sleepiness +5, energy -2
├── turn_on_tv / turn_off_tv (TV state on/off)
├── play_music_speaker / stop_music_speaker (playing_music/off)
├── wipe_coffee_table (standing; state clean; stress -5)
└── inspect_plant / wipe_plant_leaves (plant target)
    └── wipe leaves sets house plant to thriving

Balcony
├── step_out_balcony / lean_on_balcony_railing
│   └── move position to balcony_railing; configured need effects apply
├── water_plants (standing; happiness +10, stress -10)
│   └── CURRENT GAP: planter state does not change
├── smell_flowers (standing; happiness +8, stress -8)
├── refill_watering_can (standing; target can becomes full)
└── sit_on_cane_chair (standing; chair occupancy checked and updated)
```

### Branch H: Interact with Aria

```text
Same-room presence
├── ask_about_day → configured actor and roommate social effects
├── discuss_book → configured study/social effects for both characters
├── discuss_code → configured code/social effects for both characters
├── offer_chai (kitchen, living room, or study room)
│   └── room must also contain the other character
└── play_chess (study or living room)
    └── both characters present; actor sitting; configured effects on both
```

Each action validates the actor's current state and applies its configured deltas through `NeedsEngine`. The dialogue generated by the AI is separate from these deterministic changes. `ask_about_day`, `discuss_book`, and `discuss_code` do not specify a restricted room, but still require a shared room. For effects, positive hunger/thirst/sleepiness/bladder increases mean worse; positive energy/hygiene increases mean better.

## Household map and room movement are different layers

```text
Configured simulation positions
├── Each room position may bind a character to an object (bed, chair, etc.)
├── walk_to_* selects configured doorway position
└── posture/location actions update occupancy in the shared object state

House builder map
├── Separate layout coordinates for placed furniture and room geometry
├── Aria may query floor coordinates or request a build/reposition command
└── map edits do not mean character teleports or replace walk_to_* actions
```

The AI's map command formats are distinct from `&&action:...&&` commands. Physical movement uses the configured simulation action IDs. The browser's Phaser canvas presents the home map; HTML renders the action, needs, and conversation UI.

## What persists across a restart

| State file / store | Purpose | Effect of **Reset Needs** |
|---|---|---|
| `state/game-state.json` | Saved simulation snapshot and wall-clock checkpoint | Preserved; only needs are updated and persisted |
| `state/timings.txt` | Realtime checkpoint log | Preserved |
| `state/conversations.json` | Conversation list, active conversation, messages | Preserved |
| House-builder layout state | User-placed/moved home objects | Preserved |
| Current in-memory action/object/character states | Shared running simulation | Needs change only |

If `conversations.json` is malformed, the updated loader copies the original bytes to a uniquely named `.corrupt-*.bak` file before writing a fresh conversation store. This recovers future startup cases; it cannot reconstruct messages already overwritten by an earlier startup that had no backup behavior.
