/**
 * ============================================================
 * PHASER 3 HOUSE SIMULATION & BUILDER ENGINE
 * Interactive 2D House Engine for Life Simulation
 * ============================================================
 */

class HouseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HouseScene' });

    // Grid configuration
    this.GRID_COLS = 40;
    this.GRID_ROWS = 38;
    this.CELL_SIZE = 20;
    this.WORLD_WIDTH = this.GRID_COLS * this.CELL_SIZE; // 800
    this.WORLD_HEIGHT = this.GRID_ROWS * this.CELL_SIZE; // 760

    // Data State
    this.layout = null;
    this.catalog = [];
    this.characterData = {
      player: { roomId: 'bedroom', positionId: 'bed_center', posture: 'lying', x: 4, y: 5 },
      ai: { roomId: 'study_room', positionId: 'desk_chair', posture: 'sitting', x: 26, y: 6 }
    };

    // Modes & Selection
    this.isBuildMode = false;
    this.selectedCatalogItem = null;
    this.selectedPlacedObject = null;
    this.ghostRotation = 0; // 0, 90, 180, 270
    this.ghostGridX = 0;
    this.ghostGridY = 0;
    this.ghostIsValid = false;

    // Movement / Pathfinding
    this.isPlayerMoving = false;
    this.isAiMoving = false;

    // Camera drag state
    this.isDraggingCamera = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.cameraStartX = 0;
    this.cameraStartY = 0;

    // Rendered Display Object Maps
    this.roomGraphicsMap = new Map();
    this.placedObjectDisplayMap = new Map();
    this.characterTokens = { player: null, ai: null };
  }

  preload() {
    // Generate procedural textures if needed
  }

  create() {
    // Setup World bounds
    this.cameras.main.setBounds(0, 0, this.WORLD_WIDTH, this.WORLD_HEIGHT);
    this.cameras.main.centerOn(this.WORLD_WIDTH / 2, this.WORLD_HEIGHT / 2);
    this.cameras.main.setZoom(1.0);

    // Create Layers
    this.foundationLayer = this.add.graphics();
    this.floorLayer = this.add.graphics();
    this.gridLayer = this.add.graphics();
    this.gridLayer.setVisible(false);
    this.wallLayer = this.add.graphics();
    this.decorLayer = this.add.container(0, 0);
    this.objectContainer = this.add.container(0, 0);
    this.effectLayer = this.add.graphics();
    this.characterContainer = this.add.container(0, 0);
    this.ghostContainer = this.add.container(0, 0);
    this.ghostGraphics = this.add.graphics();
    this.ghostContainer.add(this.ghostGraphics);
    this.ghostContainer.setVisible(false);

    // Setup Camera Controls
    this.setupCameraControls();

    // Setup Pointer & Mouse Interaction
    this.setupInteractions();

    // Setup Custom Event Listeners
    this.setupBridgeEvents();

    // Initial draw if layout is already loaded
    if (window.__HOUSE_INIT_DATA__) {
      this.initHouseData(window.__HOUSE_INIT_DATA__);
    }
  }

  /**
   * Setup Camera drag-to-pan, scroll-wheel zoom, and keyboard navigation
   */
  setupCameraControls() {
    const cam = this.cameras.main;

    // Wheel Zoom
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Phaser.Math.Clamp(cam.zoom * zoomFactor, 0.6, 2.4);
      cam.zoomTo(newZoom, 120, 'Sine.easeInOut');
    });

    // Pointer Drag to Pan (Middle click or Left click drag on empty background)
    this.input.on('pointerdown', (pointer) => {
      if (pointer.button === 1 || (pointer.button === 0 && !this.selectedCatalogItem && pointer.event.shiftKey)) {
        this.isDraggingCamera = true;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.cameraStartX = cam.scrollX;
        this.cameraStartY = cam.scrollY;
      }
    });

    this.input.on('pointermove', (pointer) => {
      if (this.isDraggingCamera) {
        const dx = (pointer.x - this.dragStartX) / cam.zoom;
        const dy = (pointer.y - this.dragStartY) / cam.zoom;
        cam.setScroll(this.cameraStartX - dx, this.cameraStartY - dy);
      }
    });

    this.input.on('pointerup', () => {
      this.isDraggingCamera = false;
    });

    // Keyboard Pan (WASD / Arrows)
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyEscape = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    // Rotate Ghost Key (R)
    this.keyR.on('down', () => {
      if (this.isBuildMode && this.selectedCatalogItem) {
        this.rotateGhost();
      } else if (this.isBuildMode && this.selectedPlacedObject) {
        this.rotateSelectedPlacedObject();
      }
    });

    // Deselect Key (Esc)
    this.keyEscape.on('down', () => {
      this.cancelGhostPlacement();
      this.deselectPlacedObject();
    });
  }

  /**
   * Pointer interactions: click-to-walk, placement, object selection
   */
  setupInteractions() {
    this.input.on('pointermove', (pointer) => {
      if (this.isBuildMode && this.selectedCatalogItem) {
        this.updateGhostPreview(pointer);
      }
    });

    // Left click handling
    this.input.on('pointerdown', (pointer) => {
      // Ignore right clicks here (handled separately for info cards)
      if (pointer.rightButtonDown()) return;

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const gridX = Math.floor(worldPoint.x / this.CELL_SIZE);
      const gridY = Math.floor(worldPoint.y / this.CELL_SIZE);

      if (this.isBuildMode) {
        if (this.selectedCatalogItem) {
          // Place item
          if (this.ghostIsValid) {
            this.executePlacement(gridX, gridY);
          } else {
            this.showPlacementErrorFx(gridX, gridY);
          }
        }
      } else {
        // LIVE MODE: Click to walk if clicking on walkable floor
        if (!this.selectedCatalogItem) {
          this.handleFloorClickToWalk(gridX, gridY, worldPoint);
        }
      }
    });

    // Right-click support: Disable standard context menu on canvas & trigger hovercard
    this.input.mouse.disableContextMenu();
    this.game.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = this.game.canvas.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;
      const worldPoint = this.cameras.main.getWorldPoint(pointerX, pointerY);
      const gridX = Math.floor(worldPoint.x / this.CELL_SIZE);
      const gridY = Math.floor(worldPoint.y / this.CELL_SIZE);

      this.handleRightClickInspection(gridX, gridY, e);
    });
  }

  /**
   * Listen to events triggered from app.js / UI
   */
  setupBridgeEvents() {
    window.addEventListener('houseStateLoaded', (e) => {
      if (e.detail) this.initHouseData(e.detail);
    });

    window.addEventListener('houseStateUpdated', (e) => {
      if (e.detail?.layout) this.updateLayout(e.detail.layout);
      if (e.detail?.characters) this.updateCharacters(e.detail.characters);
    });

    window.addEventListener('setBuildMode', (e) => {
      this.setBuildMode(!!e.detail?.enabled);
    });

    window.addEventListener('selectCatalogItem', (e) => {
      this.selectCatalogItem(e.detail?.item);
    });

    window.addEventListener('rotateGhostItem', () => {
      this.rotateGhost();
    });

    window.addEventListener('cancelBuildPlacement', () => {
      this.cancelGhostPlacement();
    });

    window.addEventListener('cameraFocus', (e) => {
      if (e.detail?.target === 'mohit') {
        this.focusOnCharacter('player');
      } else if (e.detail?.target === 'aria') {
        this.focusOnCharacter('ai');
      } else if (e.detail?.target === 'reset') {
        this.resetCamera();
      }
    });

    window.addEventListener('cameraZoom', (e) => {
      const cam = this.cameras.main;
      const factor = e.detail?.direction === 'in' ? 1.25 : 0.8;
      const newZoom = Phaser.Math.Clamp(cam.zoom * factor, 0.6, 2.4);
      cam.zoomTo(newZoom, 150, 'Sine.easeInOut');
    });
  }

  update(time, delta) {
    // Keyboard Camera Pan
    const cam = this.cameras.main;
    const speed = 8 / cam.zoom;

    if (this.cursors.left.isDown || this.keyA.isDown) cam.scrollX -= speed;
    if (this.cursors.right.isDown || this.keyD.isDown) cam.scrollX += speed;
    if (this.cursors.up.isDown || this.keyW.isDown) cam.scrollY -= speed;
    if (this.cursors.down.isDown || this.keyS.isDown) cam.scrollY += speed;
  }

  // ============================================================
  // HOUSE DATA & RENDERING
  // ============================================================

  initHouseData(data) {
    if (!data) return;
    this.layout = data.layout;
    this.catalog = data.catalog || [];
    if (data.characters) {
      this.characterData = data.characters;
    }

    this.renderFoundation();
    this.renderRooms();
    this.renderWalls();
    this.renderDoorsAndWindows();
    this.renderPlacedObjects();
    this.renderGrid();
    this.renderCharacters();
  }

  updateLayout(newLayout) {
    if (!newLayout) return;
    this.layout = newLayout;
    this.renderRooms();
    this.renderWalls();
    this.renderDoorsAndWindows();
    this.renderPlacedObjects();
    this.renderGrid();
  }

  /**
   * Render Foundation
   */
  renderFoundation() {
    this.foundationLayer.clear();
    // Drop shadow
    this.foundationLayer.fillStyle(0x05070c, 0.8);
    this.foundationLayer.fillRoundedRect(6, 6, this.WORLD_WIDTH - 12, this.WORLD_HEIGHT - 12, 14);

    // Foundation Base
    this.foundationLayer.fillStyle(0x111622, 1.0);
    this.foundationLayer.fillRoundedRect(10, 10, this.WORLD_WIDTH - 20, this.WORLD_HEIGHT - 20, 12);
  }

  /**
   * Render Rooms & Procedural Floors
   */
  renderRooms() {
    this.floorLayer.clear();
    this.decorLayer.removeAll(true);
    if (!this.layout?.rooms) return;

    for (const room of this.layout.rooms) {
      const rx = room.x * this.CELL_SIZE;
      const ry = room.y * this.CELL_SIZE;
      const rw = room.width * this.CELL_SIZE;
      const rh = room.height * this.CELL_SIZE;

      // Base Floor Color
      const floorColors = {
        wood: { base: 0x3d2817, line: 0x4e341f },
        parquet: { base: 0x4a3219, line: 0x5c3e20 },
        granite: { base: 0x1e2430, line: 0x2b3445 },
        marble: { base: 0x2d3748, line: 0x3f4d63 },
        terracotta: { base: 0x6e3519, line: 0x8a4522 },
        tile: { base: 0x0f2942, line: 0x1d436a },
        tatami: { base: 0x42462e, line: 0x555a3c },
        carpet: { base: 0x412338, line: 0x562f4b }
      };

      const style = floorColors[room.floorType] || floorColors.wood;

      // Fill room floor
      this.floorLayer.fillStyle(style.base, 1.0);
      this.floorLayer.fillRoundedRect(rx, ry, rw, rh, 6);

      // Floor procedural pattern details
      this.floorLayer.lineStyle(1, style.line, 0.45);
      if (room.floorType === 'wood' || room.floorType === 'parquet') {
        const plankHeight = 14;
        for (let py = ry + plankHeight; py < ry + rh; py += plankHeight) {
          this.floorLayer.strokeLineShape(new Phaser.Geom.Line(rx + 2, py, rx + rw - 2, py));
        }
      } else if (room.floorType === 'tile' || room.floorType === 'granite' || room.floorType === 'terracotta') {
        const tileSize = 20;
        for (let px = rx + tileSize; px < rx + rw; px += tileSize) {
          this.floorLayer.strokeLineShape(new Phaser.Geom.Line(px, ry + 2, px, ry + rh - 2));
        }
        for (let py = ry + tileSize; py < ry + rh; py += tileSize) {
          this.floorLayer.strokeLineShape(new Phaser.Geom.Line(rx + 2, py, rx + rw - 2, py));
        }
      }

      // Room Ambient Rim
      this.floorLayer.lineStyle(2, 0xffffff, 0.08);
      this.floorLayer.strokeRoundedRect(rx, ry, rw, rh, 6);

      // Room Name Tag
      const roomIcons = {
        bedroom: '🛏️',
        study_room: '📚',
        kitchen: '🍳',
        toilet: '🚿',
        living_room: '🛋️',
        balcony: '🌿',
        patio: '🪴',
        hallway: '🚪',
        garden: '🌸'
      };
      const icon = roomIcons[room.type] || '🏠';

      const labelText = this.add.text(rx + rw / 2, ry + 16, `${icon} ${room.name.toUpperCase()}`, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      });
      labelText.setAlpha(0.7);
      labelText.setOrigin(0.5, 0.5);
      this.decorLayer.add(labelText);
    }
  }

  /**
   * Render Walls
   */
  renderWalls() {
    this.wallLayer.clear();
    if (!this.layout?.walls) return;

    for (const wall of this.layout.walls) {
      const x1 = wall.x1 * this.CELL_SIZE;
      const y1 = wall.y1 * this.CELL_SIZE;
      const x2 = wall.x2 * this.CELL_SIZE;
      const y2 = wall.y2 * this.CELL_SIZE;

      const isExt = !!wall.isExterior;
      const color = isExt ? 0x2d3748 : 0x1f2937;
      const highlight = isExt ? 0x4a5568 : 0x374151;
      const thickness = isExt ? 8 : 6;

      // Shadow
      this.wallLayer.lineStyle(thickness + 2, 0x050811, 0.7);
      this.wallLayer.strokeLineShape(new Phaser.Geom.Line(x1, y1 + 2, x2, y2 + 2));

      // Main Wall Line
      this.wallLayer.lineStyle(thickness, color, 1.0);
      this.wallLayer.strokeLineShape(new Phaser.Geom.Line(x1, y1, x2, y2));

      // Wall Rim Accent
      this.wallLayer.lineStyle(1.5, highlight, 0.6);
      this.wallLayer.strokeLineShape(new Phaser.Geom.Line(x1, y1, x2, y2));
    }
  }

  /**
   * Render Doors and Windows
   */
  renderDoorsAndWindows() {
    if (this.layout?.doors) {
      for (const door of this.layout.doors) {
        const dx = door.x * this.CELL_SIZE;
        const dy = door.y * this.CELL_SIZE;
        const dw = (door.orientation === 'horizontal' ? door.width : 1) * this.CELL_SIZE;
        const dh = (door.orientation === 'vertical' ? door.width : 1) * this.CELL_SIZE;

        // Clear wall line behind door with floor wood threshold
        this.wallLayer.fillStyle(0x3a2e20, 1.0);
        this.wallLayer.fillRect(dx - 1, dy - 1, dw + 2, dh + 2);

        // Door frame trim
        this.wallLayer.lineStyle(2, 0xeab308, 0.75);
        this.wallLayer.strokeRect(dx, dy, dw, dh);
      }
    }

    if (this.layout?.windows) {
      for (const win of this.layout.windows) {
        const wx = win.x * this.CELL_SIZE;
        const wy = win.y * this.CELL_SIZE;
        const isHoriz = win.facing === 'north' || win.facing === 'south';
        const ww = (isHoriz ? win.width : 1) * this.CELL_SIZE;
        const wh = (!isHoriz ? win.width : 1) * this.CELL_SIZE;

        // Glass pane
        this.wallLayer.fillStyle(0x38bdf8, 0.45);
        this.wallLayer.fillRect(wx, wy, ww, wh);

        // Window border
        this.wallLayer.lineStyle(2, 0x7dd3fc, 0.8);
        this.wallLayer.strokeRect(wx, wy, ww, wh);
      }
    }
  }

  /**
   * Render Grid Overlay (Build Mode)
   */
  renderGrid() {
    this.gridLayer.clear();
    this.gridLayer.lineStyle(1, 0xffffff, 0.12);

    for (let c = 0; c <= this.GRID_COLS; c++) {
      const x = c * this.CELL_SIZE;
      this.gridLayer.strokeLineShape(new Phaser.Geom.Line(x, 0, x, this.WORLD_HEIGHT));
    }

    for (let r = 0; r <= this.GRID_ROWS; r++) {
      const y = r * this.CELL_SIZE;
      this.gridLayer.strokeLineShape(new Phaser.Geom.Line(0, y, this.WORLD_WIDTH, y));
    }
  }

  /**
   * Render Placed Furniture & Objects
   */
  renderPlacedObjects() {
    this.objectContainer.removeAll(true);
    this.placedObjectDisplayMap.clear();
    if (!this.layout?.placedObjects) return;

    for (const obj of this.layout.placedObjects) {
      const objDisplay = this.createPlacedObjectDisplay(obj);
      this.objectContainer.add(objDisplay);
      this.placedObjectDisplayMap.set(obj.id, objDisplay);
    }
  }

  /**
   * Create an interactive Phaser container for a placed object
   */
  createPlacedObjectDisplay(obj) {
    const isRotated = obj.rotation === 90 || obj.rotation === 270;
    const w = (isRotated ? obj.height : obj.width) * this.CELL_SIZE;
    const h = (isRotated ? obj.width : obj.height) * this.CELL_SIZE;
    const cx = obj.x * this.CELL_SIZE + w / 2;
    const cy = obj.y * this.CELL_SIZE + h / 2;

    const container = this.add.container(cx, cy);
    container.setData('objectData', obj);

    // Drop shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.35);
    shadow.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w, h, 4);
    container.add(shadow);

    // Main Body Box
    const bodyColor = Phaser.Display.Color.HexStringToColor(obj.color || '#475569').color;
    const box = this.add.graphics();
    box.fillStyle(bodyColor, 0.95);
    box.fillRoundedRect(-w / 2, -h / 2, w, h, 4);

    // Border line
    box.lineStyle(1.5, 0xffffff, 0.25);
    box.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
    container.add(box);

    // Emoji Icon (Crisp System Emoji)
    const iconFontSize = Math.min(Math.max(12, Math.floor(Math.min(w, h) * 0.55)), 28);
    const icon = this.add.text(0, 0, obj.icon || '📦', {
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
      fontSize: `${iconFontSize}px`
    });
    icon.setOrigin(0.5, 0.5);
    container.add(icon);

    // Compact Label if size allows
    if (w >= 40 && h >= 24) {
      const shortName = obj.name.length > 12 ? obj.name.substring(0, 11) + '..' : obj.name;
      const label = this.add.text(0, h / 2 - 6, shortName, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '9px',
        fontWeight: 'bold',
        color: '#f8fafc',
        stroke: '#000000',
        strokeThickness: 2
      });
      label.setOrigin(0.5, 0.5);
      container.add(label);
    }

    // Interactive Hit Area
    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });

    // Hover Highlight
    container.on('pointerover', () => {
      box.clear();
      box.fillStyle(bodyColor, 1.0);
      box.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
      box.lineStyle(2.5, 0x38bdf8, 0.9); // Cyan glowing border
      box.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
    });

    container.on('pointerout', () => {
      box.clear();
      box.fillStyle(bodyColor, 0.95);
      box.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
      box.lineStyle(1.5, 0xffffff, 0.25);
      box.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
    });

    // Left Click Handling
    container.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown()) return; // Handled by canvas contextmenu

      if (this.isBuildMode) {
        this.selectPlacedObject(obj, container);
      } else {
        // Live Mode: open interaction modal
        if (typeof window.openObjectModal === 'function') {
          window.openObjectModal(obj.id);
        }
      }
    });

    return container;
  }

  // ============================================================
  // CHARACTER TOKENS & ANIMATED WALKING
  // ============================================================

  renderCharacters() {
    this.characterContainer.removeAll(true);
    this.characterTokens = {
      player: this.createCharacterToken('player', 'Mohit', 0xf59e0b, 'M', '👨'),
      ai: this.createCharacterToken('ai', 'Aria', 0xa855f7, 'A', '👩')
    };

    this.updateCharacterPositionsFromData();
  }

  createCharacterToken(type, name, color, initial, emoji) {
    const container = this.add.container(0, 0);

    // Glowing Pulse Ring
    const pulseRing = this.add.graphics();
    pulseRing.lineStyle(2, color, 0.5);
    pulseRing.strokeCircle(0, 0, 16);
    container.add(pulseRing);

    // Tween pulse
    this.tweens.add({
      targets: pulseRing,
      scaleX: 1.25,
      scaleY: 1.25,
      alpha: 0.1,
      duration: 1600,
      repeat: -1,
      yoyo: true,
      ease: 'Sine.easeInOut'
    });

    // Avatar Base Circle
    const base = this.add.graphics();
    base.fillStyle(color, 1.0);
    base.fillCircle(0, 0, 12);
    base.lineStyle(2, 0xffffff, 0.95);
    base.strokeCircle(0, 0, 12);
    container.add(base);

    // Avatar Letter/Emoji
    const text = this.add.text(0, 0, emoji, {
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, system-ui, sans-serif',
      fontSize: '13px'
    });
    text.setOrigin(0.5, 0.5);
    container.add(text);

    // Name & Posture Floating Tag
    const tagBg = this.add.graphics();
    tagBg.fillStyle(0x0a0e17, 0.85);
    tagBg.fillRoundedRect(-34, -28, 68, 16, 4);
    tagBg.lineStyle(1, color, 0.6);
    tagBg.strokeRoundedRect(-34, -28, 68, 16, 4);
    container.add(tagBg);

    const nameTag = this.add.text(0, -20, name, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '10px',
      fontWeight: 'bold',
      color: '#ffffff'
    });
    nameTag.setOrigin(0.5, 0.5);
    container.add(nameTag);
    container.setData('nameTag', nameTag);

    // Speech / Action Bubble Container
    const speechBubble = this.add.container(0, -50);
    speechBubble.setVisible(false);
    container.add(speechBubble);
    container.setData('speechBubble', speechBubble);

    this.characterContainer.add(container);
    return container;
  }

  updateCharacters(characters) {
    if (!characters) return;
    this.characterData = characters;
    this.updateCharacterPositionsFromData();
  }

  updateCharacterPositionsFromData() {
    if (!this.layout) return;

    // Helper: find default or object center coordinates for a room/position
    const resolveWorldCoords = (roomId, positionId) => {
      // Check placed objects first
      if (this.layout?.placedObjects) {
        const obj = this.layout.placedObjects.find(
          (o) => o.roomId === roomId && (o.id === positionId || o.templateId === positionId)
        );
        if (obj) {
          return {
            x: (obj.x + obj.width / 2) * this.CELL_SIZE,
            y: (obj.y + obj.height / 2) * this.CELL_SIZE
          };
        }
      }

      // Check room center
      const room = this.layout?.rooms?.find((r) => r.id === roomId);
      if (room) {
        return {
          x: (room.x + room.width / 2) * this.CELL_SIZE,
          y: (room.y + room.height / 2) * this.CELL_SIZE
        };
      }

      return { x: 200, y: 200 };
    };

    if (this.characterTokens.player && !this.isPlayerMoving) {
      const p = this.characterData.player;
      const coords = resolveWorldCoords(p.roomId, p.positionId);
      this.characterTokens.player.setPosition(coords.x, coords.y);
      const tag = this.characterTokens.player.getData('nameTag');
      if (tag) tag.setText(`Mohit (${p.posture || 'standing'})`);
    }

    if (this.characterTokens.ai && !this.isAiMoving) {
      const ai = this.characterData.ai;
      let coords = resolveWorldCoords(ai.roomId, ai.positionId);
      // Slight offset if in same room & position
      if (
        this.characterData.player &&
        this.characterData.player.roomId === ai.roomId &&
        Math.abs(coords.x - this.characterTokens.player?.x) < 20
      ) {
        coords.x += 24;
      }
      this.characterTokens.ai.setPosition(coords.x, coords.y);
      const tag = this.characterTokens.ai.getData('nameTag');
      if (tag) tag.setText(`Aria (${ai.posture || 'studying'})`);
    }
  }

  /**
   * Smoothly move character along A* path waypoints
   */
  walkCharacterAlongPath(characterType, waypoints, onComplete) {
    const token = this.characterTokens[characterType];
    if (!token || !waypoints || waypoints.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    if (characterType === 'player') this.isPlayerMoving = true;
    else this.isAiMoving = true;

    // Build timeline / sequential tweens
    const tweensList = [];
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const targetX = wp.x !== undefined ? wp.x : wp.gridX * this.CELL_SIZE + this.CELL_SIZE / 2;
      const targetY = wp.y !== undefined ? wp.y : wp.gridY * this.CELL_SIZE + this.CELL_SIZE / 2;

      tweensList.push({
        targets: token,
        x: targetX,
        y: targetY,
        duration: 90, // Smooth 90ms per cell
        ease: 'Linear'
      });
    }

    let currentIndex = 0;
    const playNextTween = () => {
      if (currentIndex >= tweensList.length) {
        if (characterType === 'player') this.isPlayerMoving = false;
        else this.isAiMoving = false;
        if (onComplete) onComplete();
        return;
      }

      const twConfig = tweensList[currentIndex];
      currentIndex++;
      twConfig.onComplete = playNextTween;
      this.tweens.add(twConfig);
    };

    playNextTween();
  }

  /**
   * Show temporary speech bubble over a character
   */
  showCharacterSpeech(characterType, text) {
    const token = this.characterTokens[characterType];
    if (!token) return;
    const bubble = token.getData('speechBubble');
    if (!bubble) return;

    bubble.removeAll(true);
    bubble.setVisible(true);

    const bubbleBg = this.add.graphics();
    const shortText = text.length > 40 ? text.substring(0, 38) + '...' : text;
    const textObj = this.add.text(0, 0, `💬 "${shortText}"`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#ffffff',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      padding: { x: 8, y: 5 }
    });
    textObj.setOrigin(0.5, 0.5);
    bubble.add(textObj);

    // Auto fade after 4.5 seconds
    this.tweens.add({
      targets: bubble,
      alpha: 0,
      duration: 600,
      delay: 4500,
      onComplete: () => {
        bubble.setVisible(false);
        bubble.setAlpha(1.0);
      }
    });
  }

  // ============================================================
  // NAVIGATION & CLICK-TO-WALK (LIVE MODE)
  // ============================================================

  handleFloorClickToWalk(gridX, gridY, worldPoint) {
    // Check which room was clicked
    const clickedRoom = this.layout?.rooms?.find(
      (r) => gridX >= r.x && gridX < r.x + r.width && gridY >= r.y && gridY < r.y + r.height
    );

    if (!clickedRoom) return;

    // Show visual ripple effect at destination
    this.showClickRipple(worldPoint.x, worldPoint.y);

    // Current player position
    const startX = this.characterTokens.player ? this.characterTokens.player.x : 100;
    const startY = this.characterTokens.player ? this.characterTokens.player.y : 100;
    const startGridX = Math.floor(startX / this.CELL_SIZE);
    const startGridY = Math.floor(startY / this.CELL_SIZE);

    // Call A* path API
    fetch(`/api/navigation/path?startX=${startGridX}&startY=${startGridY}&targetX=${gridX}&targetY=${gridY}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.path && data.path.length > 0) {
          this.walkCharacterAlongPath('player', data.path, () => {
            // If moved to a new room, execute walk action to synchronize simulation
            if (window.gameState && window.gameState.player.location.roomId !== clickedRoom.id) {
              if (typeof window.submitAction === 'function') {
                window.submitAction(`walk_to_${clickedRoom.id}`);
              }
            }
          });
        } else if (clickedRoom.id !== window.gameState?.player?.location?.roomId) {
          // Direct room step fallback
          if (typeof window.submitAction === 'function') {
            window.submitAction(`walk_to_${clickedRoom.id}`);
          }
        }
      })
      .catch((err) => {
        console.warn('Navigation request error:', err);
      });
  }

  showClickRipple(x, y) {
    const ripple = this.add.graphics();
    ripple.lineStyle(2, 0x38bdf8, 1.0);
    ripple.strokeCircle(x, y, 6);

    this.tweens.add({
      targets: ripple,
      scaleX: 3.0,
      scaleY: 3.0,
      alpha: 0,
      duration: 500,
      onComplete: () => ripple.destroy()
    });
  }

  // ============================================================
  // BUILD MODE ENGINE (GHOST PREVIEW, ROTATION, PLACEMENT)
  // ============================================================

  setBuildMode(enabled) {
    this.isBuildMode = enabled;
    this.gridLayer.setVisible(enabled);
    if (!enabled) {
      this.cancelGhostPlacement();
      this.deselectPlacedObject();
    }
  }

  selectCatalogItem(item) {
    if (!item) {
      this.cancelGhostPlacement();
      return;
    }
    this.selectedCatalogItem = item;
    this.ghostRotation = 0;
    this.ghostContainer.setVisible(true);
    this.deselectPlacedObject();
  }

  rotateGhost() {
    this.ghostRotation = (this.ghostRotation + 90) % 360;
    // Trigger update preview with current pointer
    const pointer = this.input.activePointer;
    this.updateGhostPreview(pointer);
  }

  cancelGhostPlacement() {
    this.selectedCatalogItem = null;
    this.ghostContainer.setVisible(false);
  }

  updateGhostPreview(pointer) {
    if (!this.selectedCatalogItem) return;

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const gridX = Math.floor(worldPoint.x / this.CELL_SIZE);
    const gridY = Math.floor(worldPoint.y / this.CELL_SIZE);

    this.ghostGridX = gridX;
    this.ghostGridY = gridY;

    const isRot = this.ghostRotation === 90 || this.ghostRotation === 270;
    const wCells = isRot ? this.selectedCatalogItem.height : this.selectedCatalogItem.width;
    const hCells = isRot ? this.selectedCatalogItem.width : this.selectedCatalogItem.height;

    const pixelW = wCells * this.CELL_SIZE;
    const pixelH = hCells * this.CELL_SIZE;
    const pixelX = gridX * this.CELL_SIZE;
    const pixelY = gridY * this.CELL_SIZE;

    // Check validity
    this.ghostIsValid = this.validatePlacement(gridX, gridY, wCells, hCells);

    // Render ghost preview
    this.ghostContainer.setPosition(pixelX, pixelY);
    this.ghostGraphics.clear();

    const tintColor = this.ghostIsValid ? 0x22c55e : 0xef4444; // Green vs Red
    this.ghostGraphics.fillStyle(tintColor, 0.45);
    this.ghostGraphics.fillRoundedRect(0, 0, pixelW, pixelH, 4);

    this.ghostGraphics.lineStyle(2, tintColor, 0.9);
    this.ghostGraphics.strokeRoundedRect(0, 0, pixelW, pixelH, 4);
  }

  validatePlacement(gridX, gridY, wCells, hCells) {
    if (!this.layout) return false;

    // 1. Grid boundary bounds
    if (gridX < 0 || gridY < 0 || gridX + wCells > this.GRID_COLS || gridY + hCells > this.GRID_ROWS) {
      return false;
    }

    // 2. Must be fully contained inside at least one room
    const insideRoom = this.layout.rooms.find(
      (r) =>
        gridX >= r.x &&
        gridY >= r.y &&
        gridX + wCells <= r.x + r.width &&
        gridY + hCells <= r.y + r.height
    );
    if (!insideRoom) return false;

    // 3. Collision with solid placed objects
    for (const obj of this.layout.placedObjects) {
      if (!obj.isSolid) continue;
      const isRot = obj.rotation === 90 || obj.rotation === 270;
      const objW = isRot ? obj.height : obj.width;
      const objH = isRot ? obj.width : obj.height;

      // AABB overlap check
      const overlaps =
        gridX < obj.x + objW &&
        gridX + wCells > obj.x &&
        gridY < obj.y + objH &&
        gridY + hCells > obj.y;

      if (overlaps) return false;
    }

    // 4. Do not block doorways
    if (this.layout.doors) {
      for (const door of this.layout.doors) {
        const dW = door.orientation === 'horizontal' ? door.width : 1;
        const dH = door.orientation === 'vertical' ? door.width : 1;
        const overlapsDoor =
          gridX < door.x + dW &&
          gridX + wCells > door.x &&
          gridY < door.y + dH &&
          gridY + hCells > door.y;
        if (overlapsDoor) return false;
      }
    }

    return true;
  }

  executePlacement(gridX, gridY) {
    if (!this.selectedCatalogItem) return;

    const targetRoom = this.layout.rooms.find(
      (r) => gridX >= r.x && gridY >= r.y && gridX < r.x + r.width && gridY < r.y + r.height
    );

    const command = {
      action: 'place_object',
      params: {
        templateId: this.selectedCatalogItem.id,
        roomId: targetRoom ? targetRoom.id : 'living_room',
        x: gridX,
        y: gridY,
        rotation: this.ghostRotation
      },
      issuedBy: 'player_001'
    };

    // Dispatch build request to server
    fetch('/api/house/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command)
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.layout) {
          this.updateLayout(data.layout);
          this.showPlacementSuccessFx(gridX * this.CELL_SIZE, gridY * this.CELL_SIZE);
          if (typeof window.showToast === 'function') {
            window.showToast(`Placed ${this.selectedCatalogItem.name}!`);
          }
          this.cancelGhostPlacement();
        } else {
          if (typeof window.showToast === 'function') {
            window.showToast(data.message || 'Could not place item', true);
          }
        }
      })
      .catch((err) => {
        console.error('Build placement failed:', err);
      });
  }

  showPlacementSuccessFx(x, y) {
    const fx = this.add.graphics();
    fx.lineStyle(3, 0x22c55e, 1.0);
    fx.strokeCircle(x + 20, y + 20, 10);

    this.tweens.add({
      targets: fx,
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration: 400,
      onComplete: () => fx.destroy()
    });
  }

  showPlacementErrorFx(gridX, gridY) {
    const fx = this.add.graphics();
    fx.fillStyle(0xef4444, 0.4);
    fx.fillRect(gridX * this.CELL_SIZE, gridY * this.CELL_SIZE, this.CELL_SIZE * 2, this.CELL_SIZE * 2);

    this.tweens.add({
      targets: fx,
      alpha: 0,
      duration: 350,
      onComplete: () => fx.destroy()
    });
  }

  // ============================================================
  // PLACED OBJECT SELECTION & EDITING (ROTATE, MOVE, REMOVE)
  // ============================================================

  selectPlacedObject(obj, displayContainer) {
    this.deselectPlacedObject();
    this.selectedPlacedObject = obj;

    // Highlight selected object with animated golden ring
    this.selectionHighlight = this.add.graphics();
    this.selectionHighlight.lineStyle(3, 0xf59e0b, 1.0);
    const isRot = obj.rotation === 90 || obj.rotation === 270;
    const w = (isRot ? obj.height : obj.width) * this.CELL_SIZE;
    const h = (isRot ? obj.width : obj.height) * this.CELL_SIZE;
    this.selectionHighlight.strokeRoundedRect(obj.x * this.CELL_SIZE - 2, obj.y * this.CELL_SIZE - 2, w + 4, h + 4, 6);

    // Notify UI toolbar about selected object
    window.dispatchEvent(new CustomEvent('placedObjectSelected', { detail: { object: obj } }));
  }

  deselectPlacedObject() {
    this.selectedPlacedObject = null;
    if (this.selectionHighlight) {
      this.selectionHighlight.destroy();
      this.selectionHighlight = null;
    }
    window.dispatchEvent(new CustomEvent('placedObjectSelected', { detail: { object: null } }));
  }

  rotateSelectedPlacedObject() {
    if (!this.selectedPlacedObject) return;
    const newRot = ((this.selectedPlacedObject.rotation || 0) + 90) % 360;

    fetch('/api/house/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rotate_object',
        params: { id: this.selectedPlacedObject.id, rotation: newRot }
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.layout) {
          this.updateLayout(data.layout);
          this.deselectPlacedObject();
        }
      });
  }

  removeSelectedPlacedObject() {
    if (!this.selectedPlacedObject) return;
    const objId = this.selectedPlacedObject.id;

    fetch('/api/house/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'remove_object',
        params: { id: objId }
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.layout) {
          this.updateLayout(data.layout);
          this.deselectPlacedObject();
          if (typeof window.showToast === 'function') {
            window.showToast('Item demolished.');
          }
        }
      });
  }

  // ============================================================
  // INSPECTION & RIGHT CLICK HOVERCARD
  // ============================================================

  handleRightClickInspection(gridX, gridY, rawEvent) {
    if (!this.layout) return;

    // 1. Check if an object was right clicked
    const hitObj = this.layout.placedObjects.find((obj) => {
      const isRot = obj.rotation === 90 || obj.rotation === 270;
      const w = isRot ? obj.height : obj.width;
      const h = isRot ? obj.width : obj.height;
      return gridX >= obj.x && gridX < obj.x + w && gridY >= obj.y && gridY < obj.y + h;
    });

    if (hitObj) {
      if (typeof window.showPhaserObjectHovercard === 'function') {
        window.showPhaserObjectHovercard(hitObj, rawEvent);
      }
      return;
    }

    // 2. Check if a room floor was right clicked
    const hitRoom = this.layout.rooms.find(
      (r) => gridX >= r.x && gridX < r.x + r.width && gridY >= r.y && gridY < r.y + r.height
    );

    if (hitRoom) {
      if (typeof window.showPhaserRoomHovercard === 'function') {
        window.showPhaserRoomHovercard(hitRoom, rawEvent);
      }
      return;
    }
  }

  // ============================================================
  // CAMERA HELPERS
  // ============================================================

  focusOnCharacter(type) {
    const token = this.characterTokens[type];
    if (token) {
      this.cameras.main.pan(token.x, token.y, 400, 'Sine.easeInOut');
      this.cameras.main.zoomTo(1.2, 400, 'Sine.easeInOut');
    }
  }

  resetCamera() {
    this.cameras.main.pan(this.WORLD_WIDTH / 2, this.WORLD_HEIGHT / 2, 400, 'Sine.easeInOut');
    this.cameras.main.zoomTo(1.0, 400, 'Sine.easeInOut');
  }
}

// Global initialization function called by app.js
window.initPhaserHouseGame = function (containerId, initialData) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Phaser container #${containerId} not found.`);
    return null;
  }

  window.__HOUSE_INIT_DATA__ = initialData;

  const config = {
    type: Phaser.AUTO,
    parent: containerId,
    width: 800,
    height: 760,
    backgroundColor: '#0a0d14',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [HouseScene]
  };

  const game = new Phaser.Game(config);
  window.phaserHouseGame = game;
  return game;
};
