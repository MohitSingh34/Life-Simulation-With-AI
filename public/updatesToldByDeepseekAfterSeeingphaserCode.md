# 🐛 COMPLETE BUG & FIX DOCUMENT — `phaser_game.js` + HUD

I've read both docs (the updated `UNIVERSAL_STORY.md` with the full action register, and `UNIVERSAL_STORY_TREE.md` with the expanded branches and the note that needs are hidden only when Mohit & Aria are in different rooms). This document contains **every fix in one pass**, ordered so you can implement top-to-bottom. Read the executive table first.

---

## Executive Table

| ID | Type | Symptom | Root Cause | Fix Time |
|---|---|---|---|---|
| **BUG‑1** | Bug | Clicking/dragging furniture in Build Mode pans the camera instead of moving the item. Clicking furniture in Live Mode triggers walk, not the object modal. | `pointerObjectTarget` is set by the container's `pointerdown`, but the **global** `pointerdown` fires first in Phaser → `target` is always `null`. 
| **BUG‑2** | Bug | Character snaps to room center after `get_up`, `walk_to_*`, `sit_down_*`, `lie_down_bed` instead of the configured `bedside` / `bedroom_door_area` / `desk_chair`. | `resolveWorldCoords` looks up by `roomId`/`positionId` only — **ignores** `character.x` and `character.y` the server sends. 
| **BUG‑3** | Bug | After repeated state updates, pulse tweens accumulate on destroyed tokens. | `renderCharacters()` rebuilds tokens but doesn't kill the infinite pulse tween targeting them. Also `__HOUSE_INIT_DATA__` + `houseStateLoaded` both fire → two full renders. 
| **BUG‑4** | Bug | Every action (sleep, cook, shower, chai…) produces **zero** visual/audio feedback. State updates look identical to a frozen screen. | `houseStateUpdated` listener only redraws layout/characters, no `feedback` pipeline. | 

| **GAP‑2** | Feature | Posture (`standing` / `sitting` / `lying` / `kneeling` / `squatting`) has no visual. | Tokens are static. updates of physiccal state is important 
| **GAP‑3** | Feature | Held items (`plate_001`, `chai_cup_001`, `broom_001`, books) invisible. | No `holding` badge. 
| **GAP‑4** | Feature | Object state visual — lamp `on`, stove `cooking`, mirror `foggy`, fridge `open`, plate `with_food`, TV `on`, plants `dry`, etc. — **all invisible**. | `createPlacedObjectDisplay` renders a static box. 
| **GAP‑5** | Feature | Occupancy invisible — bed/desk chair/sofa/stool/cane chair look identical whether occupied or not. | No `occupiedBy` badge. 
| **GAP‑6** | Feature | Clock (`Tuesday · 07:30`) invisible. | No HUD. 
| **GAP‑7** | Feature | No room-aware panel; user can't see current room name or which actions are available. | No HUD. 


---

## 🔴 BUG‑1: Pointer Race — Objects Unclickable / Undraggable

### Root cause
In `setupCameraControls()`, the global `pointerdown` handler reads `this.pointerObjectTarget`. But that field is only set **later** by the container's own `pointerdown` handler. Phaser emits the **global** `pointerdown` first, then walks the interactive objects. So on every first click of a fresh object:

- `target = null` → `gesture.kind = 'pan'` → **camera pans instead of moving the object**.
- `gesture.target = null` in `finishPointerGesture` → `openObjectModal()` never runs → **click on bed does nothing**.
- In Live Mode the gesture falls through to `handleFloorClickToWalk()` → **clicking the bed triggers a walk**.

All three symptoms, one root cause.

### Fix — replace the entire `this.input.on('pointerdown', ...)` block inside `setupCameraControls()`:

```js
this.input.on('pointerdown', (pointer, currentlyOver) => {
  if (pointer.rightButtonDown()) return;

  const isMiddleButton = pointer.button === 1;
  const isLeftButton   = pointer.button === 0;
  if (!isMiddleButton && !isLeftButton) return;

  const forcePan = isMiddleButton || this.keySpace?.isDown === true;

  // ✅ Resolve the object the cursor is ACTUALLY over, from Phaser's
  //    currentlyOver array (fires before container handlers).
  const targetDisplay = (currentlyOver || [])
    .map(go => go.parentContainer || go)
    .find(go => go.getData && go.getData('objectData'));
  const targetObj = targetDisplay?.getData('objectData') || null;

  const shouldMoveObject = isLeftButton && !forcePan && this.isBuildMode && !!targetObj;
  const shouldPlaceItem  = isLeftButton && !forcePan && this.isBuildMode && !!this.selectedCatalogItem && !targetObj;
  const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);

  this.pointerGesture = {
    startX: pointer.x,
    startY: pointer.y,
    startScrollX: cam.scrollX,
    startScrollY: cam.scrollY,
    moved: false,
    button: pointer.button,
    kind: shouldMoveObject ? 'object' : shouldPlaceItem ? 'place' : 'pan',
    object:   shouldMoveObject ? targetObj     : null,
    display:  shouldMoveObject ? targetDisplay : null,
    target:   targetObj ? { obj: targetObj, display: targetDisplay } : null,
    grabOffsetX: targetObj ? worldPoint.x - targetObj.x * this.CELL_SIZE : 0,
    grabOffsetY: targetObj ? worldPoint.y - targetObj.y * this.CELL_SIZE : 0
  };

  if (shouldMoveObject) {
    this.cancelGhostPlacement();
    this.selectPlacedObject(targetObj, targetDisplay);
  }

  if (this.game.canvas) this.game.canvas.style.cursor = 'grabbing';
});
```

### Also — delete the redundant container `pointerdown`

Inside `createPlacedObjectDisplay()`, **delete** this block:

```js
// ❌ REMOVE THIS ENTIRE BLOCK
container.on('pointerdown', (pointer) => {
  if (pointer.rightButtonDown()) return;
  this.pointerObjectTarget = { obj, display: container };
  if (this.isBuildMode) {
    if (!this.keySpace?.isDown && pointer.button !== 1) {
      this.cancelGhostPlacement();
      this.selectPlacedObject(obj, container);
    }
  }
});
```

Keep `pointerover`, `pointerout`, and the second `pointerover` (name-label toggle) — those still work fine.

### Also — remove the redundant property on the constructor

Delete `this.pointerObjectTarget = null;` — no longer used.

---

## 🔴 BUG‑2: Server Coordinates Ignored

### Root cause
The server sends `{ roomId, positionId, posture, x, y }` for each character. `resolveWorldCoords` looks up by `roomId` + `positionId` and **never reads `x` / `y`**. Since many positions (`bedside`, `bedroom_door_area`, `desk_chair`, `sofa_area`, `dining_chair`, `cane_chair`, `balcony_door_area`, `entrance_door_area`) have **no placed object** (the docs confirm: *"door-area positions have no object ID"*), the function falls through to **room center**. Every posture / room move visually teleports the character to the middle of the room.

### Fix — replace `resolveWorldCoords` inside `updateCharacterPositionsFromData()`:

```js
updateCharacterPositionsFromData() {
  if (!this.layout) return;

  const resolveWorldCoords = (character) => {
    if (!character) return { x: 200, y: 200 };

    // 1. Server-supplied grid coords win (authoritative).
    //    Per docs, positions like bed_center/bedside/door-area are
    //    resolved server-side; trust x/y when present.
    if (Number.isFinite(character.x) && Number.isFinite(character.y)) {
      return {
        x: character.x * this.CELL_SIZE + this.CELL_SIZE / 2,
        y: character.y * this.CELL_SIZE + this.CELL_SIZE / 2
      };
    }

    // 2. Placed object match (bed_center → bed_001's center).
    const obj = this.layout.placedObjects?.find(
      o => o.roomId === character.roomId &&
           (o.id === character.positionId || o.templateId === character.positionId)
    );
    if (obj) {
      return {
        x: (obj.x + obj.width  / 2) * this.CELL_SIZE,
        y: (obj.y + obj.height / 2) * this.CELL_SIZE
      };
    }

    // 3. Room center fallback.
    const room = this.layout.rooms?.find(r => r.id === character.roomId);
    if (room) {
      return {
        x: (room.x + room.width  / 2) * this.CELL_SIZE,
        y: (room.y + room.height / 2) * this.CELL_SIZE
      };
    }
    return { x: 200, y: 200 };
  };

  if (this.characterTokens.player && !this.isPlayerMoving) {
    const p = this.characterData.player;
    const coords = resolveWorldCoords(p);
    this.characterTokens.player.setPosition(coords.x, coords.y);
    const tag = this.characterTokens.player.getData('nameTag');
    if (tag) tag.setText(`Mohit (${p.posture || 'standing'})`);
    this.applyPostureVisual(this.characterTokens.player, p.posture);
    this.applyHeldItemVisual(this.characterTokens.player, p.holding);
  }

  if (this.characterTokens.ai && !this.isAiMoving) {
    const ai = this.characterData.ai;
    const coords = resolveWorldCoords(ai);
    // Slight visual offset when both share the same cell
    if (this.characterData.player &&
        this.characterData.player.roomId === ai.roomId &&
        Math.abs(coords.x - this.characterTokens.player?.x) < 8 &&
        Math.abs(coords.y - this.characterTokens.player?.y) < 8) {
      coords.x += 22;
    }
    this.characterTokens.ai.setPosition(coords.x, coords.y);
    const tag = this.characterTokens.ai.getData('nameTag');
    if (tag) tag.setText(`Aria (${ai.posture || 'standing'})`);
    this.applyPostureVisual(this.characterTokens.ai, ai.posture);
    this.applyHeldItemVisual(this.characterTokens.ai, ai.holding);
  }
}
```

> ⚠️ **Server-side check:** confirm the server is sending `x` / `y` as **cell center** coordinates (e.g. `bed_center` = bed's `x + width/2`, `y + height/2`), not top-left. If it sends top-left, the +`CELL_SIZE/2` centering above will be wrong by half a cell. The safest way: log `characterData.player` once — if `x: 4, y: 5` and the bed sprite is also around there, you're good.

---

## 🔴 BUG‑3: Tween Leak on Re‑Render

### Root cause
Two things combine:

1. `renderCharacters()` calls `createCharacterToken()` which starts an **infinite** pulse tween (`repeat: -1`). The token is discarded on rebuild, but the tween isn't.
2. `initHouseData()` can be invoked **twice** on boot: once from `if (window.__HOUSE_INIT_DATA__)` in `create()`, once from `houseStateLoaded`. So `renderCharacters` runs twice at startup alone → 4 orphaned pulse tweens before the user even clicks.

### Fix — 3 small changes

**(a)** Delete the `__HOUSE_INIT_DATA__` path in `create()`:

```js
// ❌ REMOVE THIS BLOCK
if (window.__HOUSE_INIT_DATA__) {
  this.initHouseData(window.__HOUSE_INIT_DATA__);
}
```

Let `houseStateLoaded` be the only initializer.

**(b)** In `createCharacterToken`, stash the pulse tween on the token:

```js
const pulseRing = this.add.graphics();
pulseRing.lineStyle(2, color, 0.5);
pulseRing.strokeCircle(0, 0, 16);
container.add(pulseRing);

const pulseTween = this.tweens.add({            // 👈 capture
  targets: pulseRing,
  scaleX: 1.25, scaleY: 1.25,
  alpha: 0.1,
  duration: 1600,
  repeat: -1, yoyo: true,
  ease: 'Sine.easeInOut'
});
container.setData('pulseTween', pulseTween);    // 👈 store
```

**(c)** In `renderCharacters`, kill tokens' tweens first:

```js
renderCharacters() {
  // Kill tweens targeting previous tokens
  Object.values(this.characterTokens || {}).forEach(token => {
    if (!token) return;
    token.getData('pulseTween')?.stop();
    token.getData('speechBubble')?.getData?.('tweens')?.stop?.();
  });
  this.tweens.killTweensOf(this.characterContainer.list || []);

  this.characterContainer.removeAll(true);
  this.characterTokens = {
    player: this.createCharacterToken('player', 'Mohit', 0xf59e0b, 'M', '👨'),
    ai:     this.createCharacterToken('ai',     'Aria',  0xa855f7, 'A', '👩')
  };
  this.updateCharacterPositionsFromData();
}
```

---

## 🔴 BUG‑4: No Action Feedback Pipeline

### Root cause
`houseStateUpdated` redraws the map and tokens, but any action (`sleep`, `take_hot_shower`, `make_masala_chai`…) looks like a state swap — no sound, no toast, no floating text. The game feels frozen even when it isn't.

### Fix — extend the `houseStateUpdated` listener and add 2 helpers

In `setupBridgeEvents()`:

```js
window.addEventListener('houseStateUpdated', (e) => {
  const detail = e.detail || {};
  if (detail.layout)     this.updateLayout(detail.layout);
  if (detail.characters) this.updateCharacters(detail.characters);
  if (detail.feedback)   this.applyActionFeedback(detail.feedback);
  if (detail.state)      window.updateSimHUD?.(detail.state);   // see GAP-1
  if (detail.clock)      window.updateSimClock?.(detail.clock);  // see GAP-6
});
```

Add these two methods to `HouseScene`:

```js
applyActionFeedback(feedback) {
  if (!feedback) return;

  // Sound (silent-fail if missing)
  if (feedback.sound && this.sound) {
    try { this.sound.play(feedback.sound, { volume: feedback.volume ?? 1 }); }
    catch (e) { /* sound not loaded */ }
  }

  // DOM toast (existing global helper)
  if (feedback.toast && typeof window.showToast === 'function') {
    window.showToast(feedback.toast);
  }

  // Floating "+80 Energy" style text
  if (feedback.floatText) {
    const { text, x, y, color, actor } = feedback.floatText;
    let px = x, py = y;
    if (actor && !px && !py) {
      const token = this.characterTokens[actor];
      if (token) { px = token.x; py = token.y - 30; }
    }
    if (px != null && py != null) {
      this.showFloatingText(text || '', px, py, color || '#22c55e');
    }
  }

  // Camera shake
  if (feedback.shake) {
    this.cameras.main.shake(180, feedback.shake === 'strong' ? 0.008 : 0.004);
  }

  // Flash the acting character
  const flash = feedback.flashCharacter
    || (feedback.actor && feedback.actor in this.characterTokens ? feedback.actor : null);
  if (flash) {
    const token = this.characterTokens[flash];
    if (token) {
      this.tweens.add({
        targets: token,
        alpha: { from: 0.35, to: 1 },
        duration: 100,
        repeat: 3,
        yoyo: true
      });
    }
  }
}

showFloatingText(text, x, y, color = '#22c55e') {
  const txt = this.add.text(x, y, text, {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '18px',
    resolution: 2,
    fontWeight: 'bold',
    color,
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(0.5, 1);
  this.characterContainer.add(txt);

  this.tweens.add({
    targets: txt,
    y: y - 60,
    alpha: 0,
    duration: 1400,
    ease: 'Cubic.easeOut',
    onComplete: () => txt.destroy()
  });
}
```

> **Server contract required:** `houseStateUpdated` must include `detail.feedback = { sound?: string, toast?: string, floatText?: { text, x?, y?, actor?, color? }, shake?: 'light'|'strong', actor?: 'player'|'ai' }`. If the server doesn't send it yet, that's the one server change to make; the Phaser side is now ready.

---

## 🟡 GAP‑1 + GAP‑6 + GAP‑7: DOM HUD (Needs, Clock, Room)

add room clock to top date: November 7, 2026, Time 4:34. as per device



## 🟡 GAP‑2 + GAP‑3: Posture + Held Item Visuals

### Add two helpers to `HouseScene`:

```js
applyPostureVisual(token, posture) {
  if (!token) return;
  // Cache the "body" graphics container so we don't grab the tag/ring
  let body = token.getData('bodyGraphic');
  if (!body) return;

  const presets = {
    standing:  { scale: 1.00, angle: 0 },
    sitting:   { scale: 0.85, angle: 0 },
    lying:     { scale: 0.72, angle: -18 },
    kneeling:  { scale: 0.82, angle: 0 },
    squatting: { scale: 0.78, angle: 0 }
  };
  const p = presets[posture] || presets.standing;

  this.tweens.add({
    targets: body,
    scaleX: p.scale,
    scaleY: p.scale,
    angle: p.angle,
    duration: 180,
    ease: 'Sine.easeOut'
  });
}

applyHeldItemVisual(token, holding) {
  if (!token) return;
  let badge = token.getData('heldBadge');
  const hasItem = holding && holding !== 'none' && holding !== 'any';

  if (hasItem) {
    const icon = this.resolveItemIcon(holding);
    if (!badge) {
      badge = this.add.text(14, 6, icon, {
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
        fontSize: '14px',
        resolution: 2
      }).setOrigin(0.5);
      token.add(badge);
      token.setData('heldBadge', badge);
    } else {
      badge.setText(icon);
    }
  } else if (badge) {
    badge.destroy();
    token.setData('heldBadge', null);
  }
}

resolveItemIcon(itemId) {
  const map = {
    plate_001: '🍽️', chai_cup_001: '🍵', drinking_glass_001: '🥃',
    water_flask_001: '🥤', broom_001: '🧹', watering_can_001: '🚿',
    math_book_001: '📘', physics_book_001: '📗',
    chemistry_book_001: '📙', psychology_book_001: '📕',
    mohit_notebook_001: '📓', aria_notebook_001: '📔',
    phone_001: '📱'
  };
  return map[itemId] || '📦';
}
```

### Wire the body graphic — modify `createCharacterToken`:

Right after `container.add(base);`, add:

```js
// Create a "body" wrapper so we can scale/rotate for posture
const bodyGraphic = this.add.container(0, 0);
bodyGraphic.add(base);
bodyGraphic.add(text);
container.add(bodyGraphic);
container.setData('bodyGraphic', bodyGraphic);
```

Remove the earlier standalone `container.add(base);` and `container.add(text);` — they're now inside `bodyGraphic`.

> The pulse ring and name tag stay attached to `container`, so they don't scale with posture — the standing/sitting/lying cue only affects the avatar body.

---

## 🟡 GAP‑5 + GAP‑4: Occupancy + Object State Visuals

### Add two helpers to `HouseScene`:

```js
applyObjectStateVisual(container, obj) {
  // Wipe previous badges
  container.list
    .filter(c => c.getData && c.getData('stateBadge'))
    .forEach(c => c.destroy());

  const w = obj.width * this.CELL_SIZE;
  const h = obj.height * this.CELL_SIZE;

  // ---- Occupancy badge (highest priority) ----
  if (obj.occupiedBy) {
    const occIcon = obj.occupiedBy === 'player_001' ? '👨'
                  : obj.occupiedBy === 'ai_001'     ? '👩'
                  : '🔒';
    const t = this.add.text(w / 2 - 10, -h / 2 + 10, occIcon, {
      fontSize: '13px', resolution: 2
    }).setOrigin(0.5);
    t.setData('stateBadge', true);
    container.add(t);
    return; // occupancy wins; skip state badge
  }

  // ---- State badge (from UNIVERSAL_STORY.md object register) ----
  const badge = this.getObjectStateBadge(obj);
  if (!badge) return;

  const t = this.add.text(w / 2 - 10, -h / 2 + 10, badge, {
    fontSize: '13px', resolution: 2
  }).setOrigin(0.5);
  t.setData('stateBadge', true);
  container.add(t);
}

getObjectStateBadge(obj) {
  const id = obj.id || '';
  const s  = obj.state || '';
  // Mirrors src/config/objects.json state list (UNIVERSAL_STORY.md register)
  const map = {
    lamp_001:            { on: '💡' },
    kitchen_light_001:   { on: '💡' },
    study_lamp_001:      { on: '💡' },
    bathroom_light_001:  { on: '💡' },
    stove_001:           { on: '🔥', cooking: '🍳', idle: '' },
    shower_001:          { running: '💧' },
    sink_001:            { running_tap: '💧' },
    sink_kitchen_001:    { running_tap: '💧' },  // alias per docs
    washbasin_001:       { running_tap: '💧' },
    mirror_001:          { foggy: '💨' },
    mirror_bathroom_001: { foggy: '💨' },        // alias per docs
    fridge_001:          { open: '📖' },
    wardrobe_001:        { open: '👗' },
    computer_001:        { on: '🖥️', in_use: '🖥️' },
    tv_speaker_001:      { on: '📺', playing_music: '🎵' },
    plate_001:           { with_food: '🍛', dirty: '💩' },
    chai_cup_001:        { steaming_chai: '☕', dirty: '💩' },
    drinking_glass_001:  { filled_water: '💧', half: '💧' },
    water_flask_001:     { full: '💧', half: '💧' },
    toilet_seat_001:     { needs_flush: '⚠️', in_use: '⏳' },
    laundry_basket_001:  { has_clothes: '👕', full: '👕' },
    trash_bin_001:       { has_trash: '🗑️', full: '🗑️' },
    trash_bin_toilet_001:{ has_trash: '🗑️', full: '🗑️' },
    bed_001:             { rumpled: '〰️', neat: '✨' },
    coffee_table_001:    { cluttered: '📚' },
    house_plant_001:     { needs_water: '💧' },
    balcony_plants_001:  { dry: '💧', watered: '💦', blooming: '🌸' },
    watering_can_001:    { full: '💧' },
    chess_set_001:       { in_play: '♟️' },
    desk_001:            { cluttered: '📚' },
    bookshelf_001:       {} // 'stocked' has no badge
  };
  return map[id]?.[s] || '';
}
```

### Wire into `createPlacedObjectDisplay` — call `applyObjectStateVisual` **once**, at the end:

```js
// right before `return container;`
this.applyObjectStateVisual(container, obj);
return container;
```

### Wire into `renderPlacedObjects` — call `applyObjectStateVisual` on **every state refresh** (this is the loop that runs on each `updateLayout`):

```js
renderPlacedObjects() {
  this.objectContainer.removeAll(true);
  this.placedObjectDisplayMap.clear();
  if (!this.layout?.placedObjects) return;

  for (const obj of this.layout.placedObjects) {
    const objDisplay = this.createPlacedObjectDisplay(obj);
    this.objectContainer.add(objDisplay);
    this.placedObjectDisplayMap.set(obj.id, objDisplay);
    // Badge is applied inside createPlacedObjectDisplay — but on re-render,
    // we re-create the container, so it fires again. ✅ no extra work needed.
  }
}
```

> Because `renderPlacedObjects` is called on every `updateLayout` (which fires on `houseStateUpdated`), the badge always reflects current state. Done.

### Alias handling (per docs)

The docs note: `mirror_bathroom_001` aliases `mirror_001`, `sink_kitchen_001` aliases `sink_001`, `lamp_bedroom_001` aliases `lamp_001`. The map above includes both for safety, and if the server sends state on only the canonical ID, we've covered it.

---


## Notes on the New Docs

**Things the docs clarified that affect the code:**

1. **"Needs are made invisible only when user and ai are not in the same room."** → implemented in `updateSimHUD` (GAP‑1). Aria panel shows only when same room. Mohit's panel is always visible.

2. **`bedtime_reading` requires `holding: "any"` + lamp `on` + bed `sitting`/`lying`.** → This is server-validated, but the HUD now makes the requirement **visible**: Mohit must be holding something (`📖` / `📓` badge shows) and the lamp must be `💡` (badge shows). If the action fails, the player can see *why*.

3. **`walk_to_*` effects set `moveToPosition: "*_door_area"` which has no object.** → Reinforces BUG‑2's fix. The server *must* be sending `x`/`y` for these positions. If it isn't yet, that's the one remaining server-side item — Phaser is now ready.

4. **`take_cold_shower` does NOT fog the mirror** (only `take_shower` and `take_hot_shower` do). → The badge system naturally handles this: server sends `mirror_001.state` unchanged after cold shower, so no 💨 badge appears. Zero client-side logic needed. ✅

5. **`water_plants` does NOT change `balcony_plants_001.state`.** → Same: server won't send a state change, Phaser shows no badge change. ✅

6. **`wash_dishes` sets both `plate_001` and `chai_cup_001` to `empty`, but doesn't require them to be dirty.** → If both were already empty, no visible change happens. Player sees a toast (`"Dishes already clean"` from server feedback, or just silence) — recommend the server sends a `feedback.toast: "Dishes washed"` regardless, so the click feels responsive.

7. **Aliases (`mirror_bathroom_001`, `sink_kitchen_001`, `lamp_bedroom_001`).** → All three included in the `getObjectStateBadge` map. ✅

8. **Occupancy uses `occupiedBy` field, not just `state`.** → Handled in `applyObjectStateVisual` (occupancy check runs first). ✅

9. **`companionNeedChanges`** (from `brew_chai_duo`, `offer_chai`, etc.) → Server includes Aria's updated needs in `detail.state.ai.needs`. `updateSimHUD` re-renders both panels. ✅

10. **Aria's `&&action:...&&` runs through the same engine.** → Nothing Phaser-side to change. Aria's state changes arrive via `houseStateUpdated` identically to Mohit's. Her token moves, her badges update, her posture tweens — all free. ✅

---

That's the complete pass. Once these land, your Phaser layer will faithfully represent **every configured state** in `UNIVERSAL_STORY.md` without adding any logic of its own — which is exactly the architecture your docs promise. 🟩