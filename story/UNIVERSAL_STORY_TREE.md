# Universal Story Flow (In-Depth Action & Object Tree)
> **Document Role**: Detailed Verbatim Action & Object Tree Hierarchy with Room Ambience, Flavor Text & Posture Condition Rules.  
> **Modular Blueprint Companion**: See [UNIVERSAL_STORY.md](file:///home/no/applications/Game/life-simulation/story/UNIVERSAL_STORY.md) for the visual Mermaid diagrams, governing file lists, capability matrices, and multi-agent task verification.  

This is an authoritative branching tree of what the current game configuration supports, verified against `src/config/` and the game engine (`ActionEngine`, `MovementEngine`, `StateManager`, `NeedsEngine`, `AIDecisionEngine`). Each choice is an action defined in `src/config/actions/`, and each object description comes from `src/config/objects.json`. Actions appear and succeed only when their configured room, posture, object state, and holding requirements are satisfied.

```text
START
└── Mohit is in the Bedroom
    └── Wooden Bed: Mohit is lying on the bed (bed_center)
```

---

## 1. Body and Rest Choices

### When Mohit is lying on the bed (`bed_center`):
```text
Mohit is lying on the bed
├── Turn Left [turn_left]
│   └── Mohit faces left; remains lying at bed_center
├── Turn Right [turn_right]
│   └── Mohit faces right; remains lying at bed_center
├── Sit Up in Bed [sit_up_in_bed]
│   └── Direct posture transition from lying to sitting directly on the bed
├── Sleep Through Night [sleep]
│   └── Available while lying at bed_center; sleeps for 7 hours (25,200s; energy +80, sleepiness -85)
├── Take a Power Nap [nap]
│   └── Available while lying or sitting; recharges for 45 minutes (2,700s; energy +35, sleepiness -40)
├── Meditate Peacefully [meditate]
│   └── Available while lying, sitting, or kneeling; centers thoughts for 10 minutes (600s; stress -15)
├── Bedtime Reading [bedtime_reading]
│   └── Available when sitting or lying in bed, holding a book, and bedside lamp is turned on
└── Get Up from Bed [get_up]
    └── Posture becomes standing; Mohit moves to bedside
```

---

### When Mohit is sitting on the bed edge (`bed_center`):
```text
Mohit is sitting on the bed edge
├── Lie Down on Bed [lie_down_bed]
│   └── Mohit reclines gently; posture becomes lying at bed_center
├── Get Up from Bed [get_up]
│   └── Posture becomes standing; Mohit moves to bedside
├── Stand Up [stand_up]
│   └── Posture becomes standing at current position (bed_center)
├── Take a Power Nap [nap]
│   └── Available while sitting or lying; rests for 45 minutes
├── Meditate Peacefully [meditate]
│   └── Centers thoughts for 10 minutes
└── Bedtime Reading [bedtime_reading]
    └── Available while holding a book and bedside lamp is on
```

---

### When Mohit is standing in the Bedroom:
```text
Mohit is standing in the Bedroom
├── Lie Down on Bed [lie_down_bed]
│   └── Mohit lies down; posture becomes lying at bed_center
├── Sit on Bed Edge [sit_down_bed]
│   └── Mohit sits down; posture becomes sitting at bed_center
├── Make the Bed [make_bed]
│   └── Straightens bedsheet and fluffs pillows; Wooden Bed state becomes neat
├── Morning Body Stretch [stretch_body]
│   └── Full-body standing stretch (+12 energy, -15 sleepiness)
├── Tidy Up Space [tidy_room]
│   └── Straightens bedroom blankets and scattered items (+10 hygiene, -10 stress)
├── Turn Left [turn_left] / Turn Right [turn_right]
│   └── Rotates body 90 degrees
└── Walk to another reachable room (requires standing)
    ├── Walk to Study Room [walk_to_study_room] (via door_bedroom_study)
    ├── Walk to Kitchen [walk_to_kitchen] (via door_bedroom_kitchen)
    ├── Walk to Toilet [walk_to_toilet] (via door_bedroom_toilet)
    └── Walk to Living Room [walk_to_living_room] (via door_bedroom_living)
```

---

## 2. Bedroom

```text
Bedroom
├── Wooden Bed
│   ├── "A spacious solid wood bed with a firm cotton mattress, crisp bedsheet, and soft pillows."
│   ├── State `neat`: "The bedsheet is smoothly pulled tight with the pillows fluffed up neatly."
│   ├── State `rumpled`: "The blanket is crumpled and the pillows are indented from use."
│   ├── State `occupied_lying`: "Someone is resting comfortably in the bed."
│   ├── State `occupied_sitting`: "Someone is sitting upright on the edge of the mattress."
│   ├── Lie Down on Bed [lie_down_bed] (requires standing or sitting)
│   ├── Sit on Bed Edge [sit_down_bed] (requires standing)
│   ├── Sit Up in Bed [sit_up_in_bed] (requires lying at bed_center)
│   ├── Get Up from Bed [get_up] (requires lying or sitting at bed_center; moves to bedside)
│   ├── Make the Bed [make_bed] (requires standing)
│   ├── Sleep Through Night [sleep] (requires lying at bed_center)
│   └── Take a Power Nap [nap] (requires lying or sitting)
│
├── Bedside Table
│   └── "A small wooden nightstand supporting a brass lamp and personal items."
│
├── Bedside Brass Lamp
│   ├── Off: "The lamp is unlit, waiting for the evening."
│   ├── On: "A soothing golden glow radiates from underneath the lampshade."
│   ├── Turn On Bedside Lamp [turn_on_lamp] (when off)
│   ├── Turn Off Bedside Lamp [turn_off_lamp] (when on)
│   └── Bedtime Reading [bedtime_reading] (holding book, sitting/lying in bed, lamp on)
│
├── Teakwood Wardrobe
│   ├── Closed: "The twin wooden doors are shut tight."
│   ├── Open: "Hangers, neatly folded kurtas, jeans, and casual clothes are displayed inside."
│   ├── Open Wardrobe [open_wardrobe] (requires standing; when closed)
│   ├── Change Clothes [change_clothes] (requires wardrobe open; swaps outfit, +10 confidence)
│   ├── Wear Sleepwear [wear_sleepwear] (Soft Cotton Kurta, Pyjama, Barefoot; stress -5)
│   ├── Wear Casual Loungewear [wear_casual] (Comfortable T-Shirt, Track Pants, Sandals)
│   ├── Wear Outdoor / Work Wear [wear_work_wear] (Crisp Linen Shirt, Tailored Trousers, Loafers)
│   └── Close Wardrobe [close_wardrobe] (when open)
│
├── Copper Water Flask
│   ├── Full: "The flask is heavy and cool to the touch, brimming with water."
│   ├── Half: "The flask has a comfortable amount of water left."
│   ├── Empty: "The copper bottle is empty and hollow."
│   ├── Pick Up Item [pick_up_item] (requires empty hands; portable item)
│   ├── Sip from Flask [sip_from_flask] (when full or half; sets state to half)
│   ├── Drink from Copper Flask [drink_from_flask] (when full or half; sets state to empty)
│   └── Put Down Item [put_down_item] (while holding the flask)
│
├── Mohit's Phone
│   ├── "A smartphone charging beside the bed, with familiar photos and messages."
│   ├── Pick Up Item [pick_up_item] (requires empty hands; carriable across all rooms)
│   ├── Check Phone [check_phone] (stress -5, happiness +5)
│   ├── Check Messages [check_messages] (loneliness -10, happiness +8)
│   ├── Play Alarm [play_alarm] (gentle awakening chime)
│   ├── Listen to Music on Phone [listen_music_phone] (stress -15, happiness +10)
│   └── Put Down Item [put_down_item] (while holding the phone)
│
├── Other configured activities in Bedroom
│   ├── Morning Body Stretch [stretch_body] (requires standing)
│   ├── Tidy Up Space [tidy_room] (requires standing)
│   └── Meditate Peacefully [meditate] (requires sitting, lying, or kneeling)
│
├── Turn Left [turn_left] / Turn Right [turn_right]
│   └── Available in any posture; rotates orientation by 90 degrees
│
└── Walk (requires standing)
    ├── Walk to Study Room [walk_to_study_room] (via door_bedroom_study)
    ├── Walk to Kitchen [walk_to_kitchen] (via door_bedroom_kitchen)
    ├── Walk to Toilet [walk_to_toilet] (via door_bedroom_toilet)
    └── Walk to Living Room [walk_to_living_room] (via door_bedroom_living)
```

---

## 3. Study Room

```text
Study Room
├── Study Desk
│   ├── "A heavy wooden work desk with pen stands, a notebook, and adequate workspace."
│   ├── Tidy the Desk [tidy_desk] (room: study_room)
│   └── Write in Journal [journal_notes] (requires sitting)
│
├── Desk Chair
│   ├── Available: "The chair is empty, waiting at the desk."
│   ├── Occupied: "Someone is seated comfortably at the workstation."
│   ├── Sit at Study Desk [sit_down_study_chair] (requires standing; moves to desk_chair)
│   └── Stand Up [stand_up] (requires sitting)
│
├── Desktop Computer
│   ├── Off: "The dark monitors reflect the quiet room."
│   ├── On: "The wallpaper glows invitingly, ready for work or gaming."
│   ├── In Use: "Code, articles, and media flicker across the glowing monitors."
│   ├── Power On Computer [turn_on_computer] (when off)
│   ├── Software Development Project [code_project] (requires sitting; +20 studiousness, +10 energy, -15 boredom)
│   ├── Listen to Lo-Fi Study Beats [listen_lofi_music] (stress -15, happiness +10)
│   ├── Work at Computer [use_computer] (requires sitting; when on or in_use)
│   ├── Browse the Web [browse_web] (when on or in_use)
│   ├── See Photos [view_photos] (when on or in_use)
│   ├── Take a Selfie [take_selfie] (when on or in_use)
│   ├── Record a Video [record_video] (when on or in_use)
│   └── Shut Down Computer [turn_off_computer] (when on or in_use)
│
├── Bookshelf
│   ├── "A study shelf holding textbooks, personal notebooks, and well-used reference books."
│   ├── Browse the Bookshelf [browse_books] (inspects titles on shelf)
│   ├── Read Math Textbook [read_math_book] (+15 studiousness, +5 energy, -10 boredom)
│   ├── Read Physics Textbook [read_physics_book] (+15 studiousness, -10 boredom)
│   ├── Read Psychology Book [read_psychology_book] (+15 sociability, -10 stress)
│   ├── Read Mohit's Notebook [read_mohit_notebook] (+10 happiness, -15 stress)
│   ├── Read Aria's Notebook [read_aria_notebook] (secret boundary tension; +20 guilt stress)
│   ├── Pick Up Item [pick_up_item] (can pick up any portable book/item with empty hands)
│   ├── Read Book [read_book] (daily activity in study_room or holding book)
│   └── Put Down Item [put_down_item] (while holding an item)
│
├── Roommate Social Dynamics (Shared Presence with Aria)
│   ├── Offer Chai to Roommate [offer_chai] (mutual happiness +15, stress -10)
│   ├── Ask Aria About Her Day [ask_about_day] (loneliness -15, sociability +5)
│   ├── Play Tactical Chess Match [play_chess] (boredom -25, studiousness +10)
│   ├── Discuss Book Insights [discuss_book] (studiousness +10, sociability +10)
│   └── Discuss Code Architecture [discuss_code] (studiousness +10, sociability +10)
│
├── Study Desk Lamp
│   ├── Turn On Light [turn_on_room_light] (when off)
│   └── Turn Off Light [turn_off_room_light] (when on)
│
├── Other configured activities in Study Room
│   ├── Meditate Peacefully [meditate] (requires sitting, lying, or kneeling)
│   ├── Morning Body Stretch [stretch_body] (requires standing)
│   └── Tidy Up Space [tidy_room] (requires standing)
│
├── Turn Left [turn_left] / Turn Right [turn_right]
│   └── Available in any posture; rotates orientation by 90 degrees
│
└── Walk (requires standing)
    ├── Walk to Bedroom [walk_to_bedroom] (via door_bedroom_study)
    ├── Walk to Kitchen [walk_to_kitchen] (via door_study_kitchen)
    ├── Walk to Living Room [walk_to_living_room] (via door_study_living)
    └── ❌ Walk to Toilet [walk_to_toilet] is NOT directly possible from Study Room.
        There is no door connecting Study Room and Toilet in world.json.
        To reach the Toilet, characters use BFS pathfinding through Bedroom or Kitchen.
```

---

## 4. Kitchen

```text
Kitchen
├── Brass Masala Dabba
│   ├── Closed: "A traditional circular brass spice box with a snug lid keeping spices fresh."
│   ├── Open: "Seven small brass katoris holding turmeric, mustard, cumin, and whole cloves."
│   ├── Inspect Spices [inspect_spices] (inspects aromatic spices)
│   ├── Open Masala Dabba [open_spice_box] (sets state to open)
│   ├── Pinch Spices for Tempering [pinch_spices] (+5 tidiness, +3 happiness)
│   └── Close Masala Dabba [close_spice_box] (sets state to closed)
│
├── Gas Stove
│   ├── Off: "The stove burners are cool and extinguished."
│   ├── On: "A steady blue ring of flame hisses softly."
│   ├── Cooking: "A pan is sizzling pleasantly, releasing delicious aromas."
│   ├── Ignite Gas Stove [turn_on_stove] (requires standing)
│   ├── Brew Single Masala Chai [make_masala_chai] (thirst -20, energy +10, stress -10)
│   ├── Brew Chai for Two [brew_chai_duo] (shared chai boost for Mohit and Aria)
│   ├── Cook Morning Breakfast [cook_breakfast] (Poha & Aloo Paratha griddled on tawa)
│   ├── Cook Fresh Meal [cook_meal] (dal, rice & phulkas; stove state becomes cooking)
│   └── Turn Off Gas Stove [turn_off_stove] (switches stove off or idle)
│
├── Steel Dinner Plate
│   ├── Empty: "The stainless steel thali plate shines brightly."
│   ├── With Food: "A freshly cooked warm meal of dal, rice, warm rotis and sabzi is arranged."
│   ├── Dirty: "Leftover traces of dal and spices, waiting to be washed at the sink."
│   ├── Pick Up Item [pick_up_item] (requires empty hands; portable item)
│   ├── Serve Cooked Meal [serve_meal] (holding plate, stove cooking; plate becomes with_food)
│   ├── Eat Meal from Plate [eat_meal_from_plate] (seated at dining stool; hunger -50, plate dirty)
│   └── Put Down Item [put_down_item] (while holding the plate)
│
├── Refrigerator
│   ├── Closed: "The refrigerator stands humming quietly with its door sealed shut."
│   ├── Open: "A rush of chilled air spills out, lighting up shelves filled with fresh food."
│   ├── Open Refrigerator [open_fridge] (requires standing; when closed)
│   │   ├── Take a Snack [get_food_from_fridge] (when open; hunger -15)
│   │   └── Take a Cold Drink [get_drink_from_fridge] (when open; thirst -20)
│   └── Close Refrigerator [close_fridge] (when open)
│
├── Granite Countertop
│   ├── Clear: "A gleaming black granite slab used for chopping and meal preparation."
│   ├── Has Items: "Prepared food and snack items are arranged on the counter."
│   ├── Prepare a Snack [prepare_snack] (counter state becomes has_items)
│   └── Wipe Kitchen Counter [wipe_counter] (counter cleaned; tidiness +10, stress -5)
│
├── Kitchen Sink (sink_001 / sink_kitchen_001)
│   ├── Idle: "The stainless sink is dry and clean."
│   ├── Running Tap: "A clean stream of water splashes smoothly down the stainless drain."
│   ├── Turn On Kitchen Tap [turn_on_kitchen_tap]
│   ├── Turn Off Kitchen Tap [turn_off_kitchen_tap]
│   ├── Wash Hands [wash_hands_kitchen]
│   └── Wash Dishes [wash_dishes] (cleans dirty plates, resetting state to empty)
│
├── Dining Stool
│   ├── Available: "A tall wooden counter stool suited for quick meals or resting."
│   ├── Occupied: "Someone is seated on the stool."
│   ├── Sit on Kitchen Stool [sit_down_kitchen_stool] (requires standing; moves to dining_chair)
│   └── Stand Up [stand_up] (requires sitting)
│
├── Glass Tumbler
│   ├── Empty: "The glass is dry and clean."
│   ├── Filled Water: "Clear, refreshing water fills the glass to the brim."
│   ├── Fill Glass with Water [fill_glass_water] (requires room: kitchen; empty or half)
│   ├── Sip Water [sip_water_glass] (when filled_water; sets state to half)
│   ├── Drink Water from Glass [drink_water_glass] (when filled_water or half; sets state to empty)
│   ├── Pick Up Item [pick_up_item] (requires empty hands; portable item)
│   └── Put Down Item [put_down_item] (while holding the tumbler)
│
├── Trash Bin
│   ├── Empty / Full: "Under-sink waste bin for food scraps."
│   ├── Throw Kitchen Trash [throw_trash] (bin becomes full; tidiness +5)
│   └── Empty Kitchen Bin [empty_bin] (bin emptied; tidiness +10)
│
├── Kitchen Ceiling Light
│   ├── Turn On Light [turn_on_room_light] (when off)
│   └── Turn Off Light [turn_off_room_light] (when on)
│
├── Other configured activities in Kitchen
│   ├── Eat Quick Snack [eat_snack] (room: kitchen; satisfies hunger)
│   ├── Eat Home-Cooked Meal [eat_meal] (room: kitchen; satisfies hunger & boosts energy)
│   ├── Meditate Peacefully [meditate] (requires sitting, lying, or kneeling)
│   ├── Morning Body Stretch [stretch_body] (requires standing)
│   └── Tidy Up Space [tidy_room] (requires standing)
│
├── Turn Left [turn_left] / Turn Right [turn_right]
│   └── Available in any posture; rotates orientation by 90 degrees
│
└── Walk (requires standing)
    ├── Walk to Bedroom [walk_to_bedroom] (via door_bedroom_kitchen)
    ├── Walk to Study Room [walk_to_study_room] (via door_study_kitchen)
    ├── Walk to Toilet [walk_to_toilet] (via door_kitchen_toilet)
    └── Walk to Living Room [walk_to_living_room] (via door_kitchen_living)
```

---

## 5. Toilet / Bathroom

```text
Toilet
├── Toilet Fixture
│   ├── Clean: "The toilet is clean and ready for use."
│   ├── In Use: "Currently in use."
│   ├── Needs Flush: "Awaiting a flush."
│   ├── Use Toilet [use_toilet] (room: toilet; completely empties bladder to 0)
│   └── Flush Toilet [flush_toilet] (resets toilet state to clean)
│
├── Washbasin
│   ├── Idle: "A ceramic sink with chrome faucet, soap dispenser, and toothbrush stand."
│   ├── Running Tap: "A steady stream of clean tap water."
│   ├── Wash Face with Cold Water [wash_face] (boosts hygiene, energy, awakens)
│   ├── Brush Teeth [brush_teeth] (boosts hygiene +20)
│   ├── Apply Daily Moisturizer [apply_moisturizer] (+8 confidence, -5 stress)
│   └── Wash Hair [wash_hair] (+25 hygiene, refreshment)
│
├── Bathroom Mirror
│   ├── Clear: "The mirror gives a crisp, true reflection."
│   ├── Foggy: "Warm steam blankets the mirror surface in a hazy mist after showering."
│   ├── Look in Mirror [look_in_mirror] (requires standing; reduces stress)
│   └── Wipe Condensation from Mirror [wipe_mirror] (resets foggy mirror to clear; +10 happiness)
│
├── Towel Rack
│   ├── "A stainless steel rack holding clean, fluffy cotton bath towels."
│   └── Dry Off with Towel [dry_with_towel] (requires standing; hygiene to 100, warm comfort)
│
├── Laundry Basket
│   ├── Empty / Filled: "A handwoven cane laundry hamper for used linens."
│   ├── Put Clothes in Laundry [put_clothes_in_laundry] (basket becomes filled)
│   └── Empty Laundry Basket [empty_laundry] (resets basket to empty)
│
├── Trash Bin
│   ├── Empty / Full: "Small stainless steel pedal bin."
│   ├── Throw Bathroom Trash [throw_trash] (bin becomes full; tidiness +5)
│   └── Empty Bathroom Bin [empty_bin] (bin emptied; tidiness +10)
│
├── Grass Floor Broom
│   ├── "A traditional phool jhadu resting neatly against the bathroom tiled corner."
│   ├── Pick Up Item [pick_up_item] (carriable across all rooms)
│   ├── Sweep the Floor [sweep_floor] (holding broom; sweeps floors in any room, +15 tidiness)
│   └── Put Down Item [put_down_item] (while holding the broom)
│
├── Shower
│   ├── Off: "The shower is off."
│   ├── Running: "Warm streams of water cascade down in a relaxing deluge."
│   ├── Turn On Shower [turn_on_shower] (when off; state becomes running)
│   ├── Take a Refreshing Shower [take_shower] (standing; +65 hygiene, -25 stress, fogs mirror)
│   └── Turn Off Shower [turn_off_shower] (when running; state becomes off)
│
├── Bathroom Light
│   ├── Turn On Light [turn_on_room_light] (when off)
│   └── Turn Off Light [turn_off_room_light] (when on)
│
├── Other configured activities in Toilet
│   ├── Meditate Peacefully [meditate] (requires sitting, lying, or kneeling)
│   ├── Morning Body Stretch [stretch_body] (requires standing)
│   └── Tidy Up Space [tidy_room] (requires standing)
│
├── Turn Left [turn_left] / Turn Right [turn_right]
│   └── Available in any posture; rotates orientation by 90 degrees
│
└── Walk (requires standing)
    ├── Walk to Bedroom [walk_to_bedroom] (via door_bedroom_toilet)
    ├── Walk to Kitchen [walk_to_kitchen] (via door_kitchen_toilet)
    └── ❌ Walk to Study Room [walk_to_study_room] is NOT directly possible from Toilet.
        There is no door connecting Toilet and Study Room in world.json.
        To reach the Study Room, characters navigate through Bedroom or Kitchen.
```

---

## 6. Living Room & Balcony

```text
Living Room
├── Comfortable Plush Sofa
│   ├── Available / Occupied: "A generous three-seater sofa dressed in warm earthy fabric with handloom cushions."
│   ├── Sit on Sofa [sit_down_sofa] (requires standing; moves to sofa_area)
│   ├── Relax on Sofa [relax_on_sofa] (requires sitting; stress -15, happiness +10)
│   └── Stand Up [stand_up] (requires sitting)
│
├── Smart TV & Soundbar Speaker
│   ├── Off: "The sleek wall-mounted panel rests dark against the textured wall."
│   ├── Streaming: "Vibrant high-definition visuals illuminate the room with ambient backlighting."
│   ├── Turn On Smart TV [turn_on_smart_tv] (sets state to streaming)
│   ├── Watch Movie on TV [watch_movie_tv] (requires sitting on sofa, TV streaming; -35 boredom)
│   ├── Play Acoustic Room Music [play_room_music] (TV streaming; -15 stress, +10 happiness)
│   └── Turn Off Smart TV [turn_off_smart_tv] (sets state to off)
│
├── Teakwood Coffee Table
│   ├── "A low Sheesham coffee table with brass corner inlay, holding coasters and art magazines."
│   └── Organize Coffee Table [organize_living_table] (+10 tidiness, -5 stress)
│
├── Indoor Money Plant
│   ├── "A thriving indoor pothos in a terracotta planter, trailing lush green heart-shaped leaves."
│   └── Prune Money Plant [prune_house_plant] (+8 happiness, +5 tidiness)
│
├── Living Room Light
│   ├── Turn On Light [turn_on_room_light] (when off)
│   └── Turn Off Light [turn_off_room_light] (when on)
│
├── Turn Left [turn_left] / Turn Right [turn_right]
│   └── Available in any posture; rotates orientation by 90 degrees
│
└── Walk (requires standing)
    ├── Walk to Bedroom [walk_to_bedroom] (via door_bedroom_living)
    ├── Walk to Study Room [walk_to_study_room] (via door_study_living)
    ├── Walk to Kitchen [walk_to_kitchen] (via door_kitchen_living)
    └── Step onto Balcony [walk_to_balcony] (via door_living_balcony)

---

Balcony
├── Balcony Railing
│   ├── "A sturdy wrought-iron railing with a polished teakwood top, looking over the quiet Jabalpur avenue."
│   └── Look at City View [look_at_city_view] (standing at railing; stress -15, loneliness -10)
│
├── Balcony Planters
│   ├── Normal / Blooming: "A vibrant assortment of potted bougainvillea, fragrant jasmine, and seasonal marigolds."
│   ├── Water Balcony Plants [water_balcony_plants] (plants become blooming; +12 happiness)
│   └── Smell Jasmine Flowers [smell_balcony_flowers] (+8 happiness, -8 stress)
│
├── Galvanized Watering Can
│   ├── "A vintage green galvanized watering can with a brass rosette spout."
│   ├── Pick Up Item [pick_up_item] (carriable across all rooms)
│   └── Put Down Item [put_down_item] (while holding the watering can)
│
├── Handwoven Cane Chair
│   ├── Available / Occupied: "A comfortable handwoven cane armchair with a soft indigo cotton cushion."
│   ├── Sit in Cane Chair [sit_down_cane_chair] (requires standing; moves to cane_chair)
│   ├── Sip Tea on Balcony [sip_tea_on_balcony] (requires sitting; stress -20, happiness +15)
│   └── Stand Up [stand_up] (requires sitting)
│
├── Turn Left [turn_left] / Turn Right [turn_right]
│   └── Available in any posture; rotates orientation by 90 degrees
│
└── Walk back inside (requires standing)
    └── Walk into Living Room [walk_to_living_room] (via door_living_balcony)
```

---

## 7. Shared Flow Rules & Architecture Verification

### Movement Topology & Door Constraints
The apartment contains **6 distinct rooms** interconnected by 8 verified door connections in `src/config/world.json`:
- **Bedroom** connects to: `study_room` (`door_bedroom_study`), `kitchen` (`door_bedroom_kitchen`), `toilet` (`door_bedroom_toilet`), and `living_room` (`door_bedroom_living`).
- **Kitchen** connects to: `bedroom` (`door_bedroom_kitchen`), `study_room` (`door_study_kitchen`), `toilet` (`door_kitchen_toilet`), and `living_room` (`door_kitchen_living`).
- **Study Room** connects to: `bedroom` (`door_bedroom_study`), `kitchen` (`door_study_kitchen`), and `living_room` (`door_study_living`).
- **Toilet** connects to: `bedroom` (`door_bedroom_toilet`) and `kitchen` (`door_kitchen_toilet`).
- **Living Room** connects to: `bedroom`, `kitchen`, `study_room`, and `balcony` (`door_living_balcony`).
- **Balcony** connects to: `living_room` only (`door_living_balcony`).
- **Direct Movement Restriction**: There is no direct door between Study Room and Toilet, or between Balcony and Bedroom. The engine verifies direct doorway legality via `MovementEngine.canMoveToRoom` and automatically resolves multi-step transitions using Breadth-First Search (BFS) pathfinding.
- **Walking Posture**: All room-to-room walking actions (`walk_to_*`) require `posture: ["standing"]`.

### Posture Transitions
- **Lying down**:
  - Valid body actions: `Turn Left [turn_left]`, `Turn Right [turn_right]`, `Sit Up in Bed [sit_up_in_bed]`, `Get Up from Bed [get_up]`.
  - Valid rest/mind actions: `Sleep Through Night [sleep]` (at `bed_center`), `Take a Power Nap [nap]`, `Meditate Peacefully [meditate]`.
  - Can read in bed via `Bedtime Reading [bedtime_reading]` when holding a book and bedside lamp is turned on.
- **Sitting**:
  - In Bed: `Lie Down on Bed [lie_down_bed]`, `Stand Up [stand_up]`, `Get Up from Bed [get_up]`.
  - On Sofa: `sit_down_sofa`, `relax_on_sofa`, `watch_movie_tv`, `Stand Up [stand_up]`.
  - In Cane Chair: `sit_down_cane_chair`, `sip_tea_on_balcony`, `Stand Up [stand_up]`.
  - In Desk Chair: `sit_down_study_chair`, `code_project`, `journal_notes`, `play_chess`, `Stand Up [stand_up]`.
  - At Dining Stool: `sit_down_kitchen_stool`, `eat_meal_from_plate`, `Stand Up [stand_up]`.
- **Standing**:
  - Required for all walking, stretching (`stretch_body`), tidying (`tidy_room`), making the bed (`make_bed`), showering (`take_shower`), looking in the mirror (`look_in_mirror`), wiping the mirror (`wipe_mirror`), wardrobe outfit changing (`change_clothes`, `wear_sleepwear`, `wear_casual`, `wear_work_wear`), opening the fridge (`open_fridge`), cooking (`cook_breakfast`, `cook_meal`, `make_masala_chai`), and watering plants (`water_balcony_plants`).

### Portable Items & Inventory
- Portable objects: `water_flask_001`, `drinking_glass_001`, `plate_001`, `phone_001`, `broom_001`, `watering_can_001`, and all six study books (`math_book_001`, `physics_book_001`, `chemistry_book_001`, `psychology_book_001`, `mohit_notebook_001`, `aria_notebook_001`).
- `pick_up_item` requires empty hands (`holding: "none"`).
- `put_down_item` drops the carried item into the actor's current room and sub-room position.
- Consumables and carried utility tools can be transported and used in any room where their action preconditions are met (e.g. broom sweeping floors across all rooms, checking phone messages anywhere).

### Verification & Test Suite Status
All items previously identified as discrepancies or missing have been fully implemented, synchronized, and verified with 100% test pass rate across all 7 automated test suites:
1. `src/test_simulation.ts` — Core engine, movement, AI dialogue, snapshot persistence, and BFS pathfinding.
2. `src/test_realtime_persistence.ts` — Real-time clock and offline biological needs progression.
3. `src/test_grooming_chores.ts` — Bathroom grooming, mirror steam wiping, towel drying, laundry basket, trash bins, and multi-room broom sweeping.
4. `src/test_living_balcony.ts` — Living room, plush sofa, smart TV, coffee table, money plant, balcony railing, flower planters, watering can, and cane chair.
5. `src/test_study_social.ts` — Subject-specific books (Math, Physics, Psychology), desktop coding, lo-fi beats, roommate chess, and shared tea encounters.
6. `src/test_bedroom_wardrobe.ts` — Direct bed rising/reclining, wardrobe dressing outfits, phone portability, bedside lamp ambiance, and bedtime reading.
7. `src/test_culinary_engine.ts` — Brass masala dabba, countertop wiping, single and duo masala chai brewing, breakfast cooking, meal serving onto thali, dining loop, and sink dishwashing.
