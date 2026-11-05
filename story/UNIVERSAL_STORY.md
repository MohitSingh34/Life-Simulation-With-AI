# Universal Story Flow

This is a branching map of what the current game configuration supports, not a fixed sequence of events. Each choice is an action already defined in `src/config/actions/`, and each object description comes from `src/config/`. Actions appear only when their configured room, posture, object state, and holding requirements are satisfied.

```text
START
└── Mohit is in the Bedroom
    └── Wooden Bed: Mohit is lying on the bed
```

## 1. Body and rest choices

```text
Mohit is lying at the bed
├── Turn Left [turn_left]
│   └── Mohit faces left; remain in the current place and posture
├── Turn Right [turn_right]
│   └── Mohit faces right; remain in the current place and posture
├── Get Up from Bed [get_up]
│   └── Mohit stands beside the bed
├── Sit on Bed Edge [sit_down_bed]
│   └── Mohit sits on the bed
│       ├── Get Up from Bed [get_up]
│       │   └── Mohit stands beside the bed
│       ├── Lie Down on Bed [lie_down_bed]
│       │   └── Mohit lies on the bed
│       └── Take a Power Nap [nap]
│           └── Mohit rests for the configured nap duration
└── Sleep Through Night [sleep]
    └── Available while lying at the bed; sleep for the configured duration
```

From a standing position in the Bedroom:

```text
├── Lie Down on Bed [lie_down_bed]
│   └── Mohit lies on the bed
├── Sit on Bed Edge [sit_down_bed]
│   └── Mohit sits on the bed
├── Turn Left [turn_left] / Turn Right [turn_right]
│   └── Change facing direction
├── Make the Bed [make_bed]
│   └── The Wooden Bed becomes neat
└── Choose a Bedroom object or walk to another configured room
```

## 2. Bedroom

```text
Bedroom
├── Wooden Bed
│   ├── "A spacious solid wood bed with a firm cotton mattress, crisp bedsheet, and soft pillows."
│   ├── State `occupied_lying`: "Someone is resting comfortably in the bed."
│   ├── Lie Down on Bed [lie_down_bed]
│   ├── Sit on Bed Edge [sit_down_bed]
│   ├── Get Up from Bed [get_up]
│   ├── Make the Bed [make_bed] (standing)
│   ├── Sleep Through Night [sleep] (lying at bed)
│   └── Take a Power Nap [nap] (lying or sitting)
│
├── Bedside Table
│   └── "A small wooden nightstand supporting a brass lamp and personal items."
│
├── Bedside Lamp
│   ├── Off: "The lamp is unlit, waiting for the evening."
│   ├── Turn On Bedside Lamp [turn_on_lamp] (when off)
│   └── Turn Off Bedside Lamp [turn_off_lamp] (when on)
│
├── Teakwood Wardrobe
│   ├── Closed: "The twin wooden doors are shut tight."
│   ├── Open Wardrobe [open_wardrobe] (standing)
│   │   └── Open: "Hangers, neatly folded kurtas, jeans, and casual clothes are displayed inside."
│   └── Close Wardrobe [close_wardrobe]
│
├── Copper Water Flask
│   ├── Full: "The flask is heavy and cool to the touch, brimming with water."
│   ├── Pick Up Item [pick_up_item] (hands empty)
│   ├── Sip from Flask [sip_from_flask] (full or half)
│   ├── Drink from Copper Flask [drink_from_flask] (full or half)
│   └── Put Down Item [put_down_item] (while holding an item)
│
├── Mohit's Phone
│   ├── "A smartphone charging beside the bed, with familiar photos and messages."
│   └── Check Phone [check_phone]
│
├── Turn Left [turn_left] / Turn Right [turn_right]
│   └── Available as body actions; rotate 90 degrees
│
└── Walk (standing)
    ├── Walk to Study Room [walk_to_study_room]
    ├── Walk to Kitchen [walk_to_kitchen]
    └── Walk to Toilet [walk_to_toilet]
```

## 3. Study Room

```text
Study Room
├── Study Desk
│   └── Tidy the Desk [tidy_desk]
│
├── Desk Chair
│   ├── Sit at Study Desk [sit_down_study_chair] (standing)
│   └── Stand Up [stand_up] (sitting)
│
├── Desktop Computer
│   ├── Power On Computer [turn_on_computer] (when off)
│   ├── Work at Computer [use_computer] (sitting; computer on or in use)
│   ├── Browse the Web [browse_web] (computer on or in use)
│   ├── See Photos [view_photos] (computer on or in use)
│   ├── Take a Selfie [take_selfie] (computer on or in use)
│   ├── Record a Video [record_video] (computer on or in use)
│   └── Shut Down Computer [turn_off_computer] (when on or in use)
│
├── Bookshelf
│   ├── Browse the Bookshelf [browse_books]
│   ├── Pick Math Textbook [pick_up_math_book] (hands empty)
│   ├── Pick Physics Textbook [pick_up_physics_book] (hands empty)
│   ├── Pick Chemistry Textbook [pick_up_chemistry_book] (hands empty)
│   ├── Pick Psychology Book [pick_up_psychology_book] (hands empty)
│   ├── Pick Mohit's Notebook [pick_up_mohit_notebook] (hands empty)
│   ├── Pick Aria's Notebook [pick_up_aria_notebook] (hands empty)
│   ├── Read Book [read_book]
│   └── Put Down Item [put_down_item] (while holding an item)
│
├── Study Desk Lamp
│   ├── Turn On Light [turn_on_room_light] (when off)
│   └── Turn Off Light [turn_off_room_light] (when on)
│
├── Other configured activities
│   ├── Write in Journal [journal_notes]
│   ├── Meditate Peacefully [meditate] (sitting, lying, or kneeling)
│   ├── Morning Body Stretch [stretch_body]
│   └── Tidy Up Space [tidy_room]
│
└── Walk (standing)
    ├── Walk to Bedroom [walk_to_bedroom]
    ├── Walk to Kitchen [walk_to_kitchen]
    └── Walk to Toilet [walk_to_toilet]
```

## 4. Kitchen

```text
Kitchen
├── Gas Stove
│   ├── Ignite Gas Stove [turn_on_stove] (standing)
│   ├── Cook Fresh Meal [cook_meal] (standing; stove target)
│   ├── Brew Masala Chai [make_masala_chai] (standing; stove target)
│   └── Turn Off Gas Stove [turn_off_stove]
│
├── Refrigerator
│   ├── Open Refrigerator [open_fridge] (when closed)
│   │   ├── Take a Snack [get_food_from_fridge] (while open)
│   │   └── Take a Cold Drink [get_drink_from_fridge] (while open)
│   ├── Close Refrigerator [close_fridge] (while open)
│
├── Granite Countertop
│   ├── Prepare a Snack [prepare_snack]
│   └── Wipe Kitchen Counter [wipe_counter] (standing)
│
├── Kitchen Sink
│   ├── Turn On Kitchen Tap [turn_on_kitchen_tap]
│   ├── Turn Off Kitchen Tap [turn_off_kitchen_tap]
│   ├── Wash Hands [wash_hands_kitchen]
│   └── Wash the Dishes [wash_dishes]
│
├── Dining Stool
│   └── Sit on Kitchen Stool [sit_down_kitchen_stool] (standing)
│       └── Stand Up [stand_up] (sitting)
│
├── Glass Tumbler
│   ├── Fill Glass with Water [fill_glass_water] (empty or half)
│   ├── Sip Water [sip_water_glass] (filled)
│   ├── Drink Water from Glass [drink_water_glass] (filled or half)
│   ├── Pick Up Item [pick_up_item] (hands empty)
│   └── Put Down Item [put_down_item] (while holding an item)
│
├── Steel Dinner Plate
│   ├── "A traditional polished stainless steel thali plate."
│   ├── Pick Up Item [pick_up_item] (hands empty)
│   └── Put Down Item [put_down_item] (while holding an item)
│       └── The object config also names serve_meal and eat_meal_from_plate,
│           but those actions are not currently defined, so they are not choices here.
│
├── Kitchen Ceiling Light
│   ├── Turn On Light [turn_on_room_light] (when off)
│   └── Turn Off Light [turn_off_room_light] (when on)
│
├── Other configured activities
│   ├── Eat Quick Snack [eat_snack]
│   ├── Eat Home-Cooked Meal [eat_meal]
│   ├── Meditate Peacefully [meditate] (sitting, lying, or kneeling)
│   ├── Morning Body Stretch [stretch_body]
│   └── Tidy Up Space [tidy_room]
│
└── Walk (standing)
    ├── Walk to Bedroom [walk_to_bedroom]
    ├── Walk to Study Room [walk_to_study_room]
    └── Walk to Toilet [walk_to_toilet]
```

## 5. Toilet / Bathroom

```text
Toilet
├── Toilet
│   ├── Use Toilet [use_toilet]
│   └── Flush Toilet [flush_toilet]
│
├── Washbasin
│   ├── Wash Face with Cold Water [wash_face]
│   └── Brush Teeth [brush_teeth]
│
├── Bathroom Mirror
│   └── Look in Mirror [look_in_mirror] (standing)
│
├── Shower
│   ├── Turn On Shower [turn_on_shower] (when off)
│   ├── Take a Refreshing Shower [take_shower] (standing)
│   └── Turn Off Shower [turn_off_shower] (when running)
│
├── Bathroom Light
│   ├── Turn On Light [turn_on_room_light] (when off)
│   └── Turn Off Light [turn_off_room_light] (when on)
│
├── Other configured activities
│   ├── Meditate Peacefully [meditate] (sitting, lying, or kneeling)
│   ├── Morning Body Stretch [stretch_body]
│   └── Tidy Up Space [tidy_room]
│
└── Walk (standing)
    ├── Walk to Bedroom [walk_to_bedroom]
    ├── Walk to Study Room [walk_to_study_room]
    └── Walk to Kitchen [walk_to_kitchen]
```

## Shared flow rules from the current configuration

- Turning left or right changes orientation; it does not move Mohit to another position.
- Room-to-room movement requires a standing posture.
- `pick_up_item` and the specific book-pickup actions require empty hands. `put_down_item` requires a held item.
- The wardrobe currently supports opening and closing only; no clothing-change action is configured.
- The Steel Dinner Plate exists in the object catalog, but its `serve_meal` and `eat_meal_from_plate` interaction IDs do not have matching action definitions yet.
- The room connections and positions are defined in `src/config/world.json` and `src/config/rooms/`.
- This outline describes configured gameplay choices, not a guaranteed playable narrative sequence; engine validation and object-action wiring determine what is available at runtime.
- It intentionally excludes unconfigured story events, dialogue, rooms, objects, and choices.
