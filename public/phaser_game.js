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
    this.fitZoom = 1;
    this.zoomMultiplier = 1;

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
    this.pointerGesture = null;
    this.pointerObjectTarget = null;
    this.selectedPlacedDisplay = null;

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
    this.cameras.main.roundPixels = true;
    this.scale.on('resize', this.resizeCameraToFit, this);
    this.resizeCameraToFit(this.scale.gameSize);

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
      const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
      const zoomFactor = Math.exp(-deltaY * 0.001);
      this.zoomMultiplier = Phaser.Math.Clamp(this.zoomMultiplier * zoomFactor, 0.6, 2.4);
      const newZoom = this.fitZoom * this.zoomMultiplier;
      cam.setZoom(newZoom);
      this.updateCameraBounds(newZoom);
      this.updateZoomStatus();
      const zoomedWorldPoint = cam.getWorldPoint(pointer.x, pointer.y);
      cam.setScroll(
        cam.scrollX + worldPoint.x - zoomedWorldPoint.x,
        cam.scrollY + worldPoint.y - zoomedWorldPoint.y
      );
    });

    // Left drag pans the map; in Build & Edit, dragging an object moves it instead.
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown()) return;

      const isMiddleButton = pointer.button === 1;
      const isLeftButton = pointer.button === 0;
      if (!isMiddleButton && !isLeftButton) return;

      const forcePan = isMiddleButton || this.keySpace?.isDown === true;
      const target = this.pointerObjectTarget;
      this.pointerObjectTarget = null;
      const shouldMoveObject = isLeftButton && !forcePan && this.isBuildMode && !!target;
      const shouldPlaceItem = isLeftButton && !forcePan && this.isBuildMode && !!this.selectedCatalogItem && !target;
      const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
      const object = shouldMoveObject ? target.obj : null;

      this.pointerGesture = {
        startX: pointer.x,
        startY: pointer.y,
        startScrollX: cam.scrollX,
        startScrollY: cam.scrollY,
        moved: false,
        button: pointer.button,
        kind: shouldMoveObject ? 'object' : shouldPlaceItem ? 'place' : 'pan',
        object,
        display: shouldMoveObject ? target.display : null,
        target,
        grabOffsetX: object ? worldPoint.x - object.x * this.CELL_SIZE : 0,
        grabOffsetY: object ? worldPoint.y - object.y * this.CELL_SIZE : 0
      };
      if (this.game.canvas) this.game.canvas.style.cursor = 'grabbing';
    });

    this.input.on('pointermove', (pointer) => {
      const gesture = this.pointerGesture;
      if (gesture && pointer.isDown) {
        const dx = pointer.x - gesture.startX;
        const dy = pointer.y - gesture.startY;
        if (!gesture.moved && Math.hypot(dx, dy) >= 6) {
          gesture.moved = true;
          if (gesture.kind === 'place') gesture.kind = 'pan';
          this.isDraggingCamera = gesture.kind === 'pan';
        }

        if (gesture.moved && gesture.kind === 'pan') {
          cam.setScroll(
            gesture.startScrollX - dx / cam.zoom,
            gesture.startScrollY - dy / cam.zoom
          );
        } else if (gesture.moved && gesture.kind === 'object') {
          this.updateDraggedObject(gesture, pointer);
        }
      }
      this.updateCoordinateStatus(pointer);
    });

    this.input.on('pointerup', (pointer) => this.finishPointerGesture(pointer));
    this.input.on('pointerupoutside', (pointer) => {
      if (this.pointerGesture?.moved) {
        this.finishPointerGesture(pointer);
      } else {
        this.pointerGesture = null;
        this.isDraggingCamera = false;
        if (this.game.canvas) this.game.canvas.style.cursor = 'grab';
      }
    });

    // Keyboard Pan (WASD / Arrows)
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyEscape = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

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

  updateDraggedObject(gesture, pointer) {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const x = Math.floor((worldPoint.x - gesture.grabOffsetX) / this.CELL_SIZE);
    const y = Math.floor((worldPoint.y - gesture.grabOffsetY) / this.CELL_SIZE);
    const room = this.layout.rooms.find((candidate) =>
      x >= candidate.x &&
      y >= candidate.y &&
      x + gesture.object.width <= candidate.x + candidate.width &&
      y + gesture.object.height <= candidate.y + candidate.height
    );
    const valid = !!room && this.isValidObjectMove(gesture.object, x, y);

    gesture.newX = x;
    gesture.newY = y;
    gesture.newRoomId = room?.id;
    gesture.valid = valid;

    const width = gesture.object.width * this.CELL_SIZE;
    const height = gesture.object.height * this.CELL_SIZE;
    gesture.display.setPosition(
      x * this.CELL_SIZE + width / 2,
      y * this.CELL_SIZE + height / 2
    );
    gesture.display.setAlpha(valid ? 0.85 : 0.4);
    if (this.selectionHighlight) {
      this.selectionHighlight.setPosition(
        (x - gesture.object.x) * this.CELL_SIZE,
        (y - gesture.object.y) * this.CELL_SIZE
      );
    }
  }

  isValidObjectMove(object, x, y) {
    if (
      x < 0 ||
      y < 0 ||
      x + object.width > this.GRID_COLS ||
      y + object.height > this.GRID_ROWS
    ) return false;

    if (object.isSolid) {
      for (const other of this.layout.placedObjects) {
        if (other.id === object.id || !other.isSolid) continue;
        if (
          x < other.x + other.width &&
          x + object.width > other.x &&
          y < other.y + other.height &&
          y + object.height > other.y
        ) return false;
      }

      for (const door of this.layout.doors || []) {
        const doorWidth = door.orientation === 'horizontal' ? door.width : 1;
        const doorHeight = door.orientation === 'vertical' ? door.width : 1;
        if (
          x < door.x + doorWidth &&
          x + object.width > door.x &&
          y < door.y + doorHeight &&
          y + object.height > door.y
        ) return false;
      }
    }

    return true;
  }

  finishPointerGesture(pointer) {
    const gesture = this.pointerGesture;
    if (!gesture) return;

    this.pointerGesture = null;
    this.isDraggingCamera = false;

    if (gesture.moved && gesture.kind === 'object') {
      gesture.display.setAlpha(1);
      if (!gesture.valid) {
        this.deselectPlacedObject();
        this.updateLayout(this.layout);
        if (typeof window.showToast === 'function') {
          window.showToast('That spot is outside a room or blocked.', true);
        }
        return;
      }
      this.movePlacedObject(gesture);
      return;
    }

    if (gesture.moved || gesture.button !== 0) return;

    if (gesture.target) {
      if (!this.isBuildMode && typeof window.openObjectModal === 'function') {
        window.openObjectModal(gesture.target.obj.id);
      }
      return;
    }

    if (gesture.kind === 'place') {
      this.updateGhostPreview(pointer);
      if (this.ghostIsValid) {
        this.executePlacement(this.ghostGridX, this.ghostGridY);
      } else {
        this.showPlacementErrorFx(this.ghostGridX, this.ghostGridY);
      }
      return;
    }

    if (!this.isBuildMode && !this.selectedCatalogItem) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.handleFloorClickToWalk(
        Math.floor(worldPoint.x / this.CELL_SIZE),
        Math.floor(worldPoint.y / this.CELL_SIZE),
        worldPoint
      );
    }
  }

  movePlacedObject(gesture) {
    fetch('/api/house/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'move_object',
        params: {
          objectId: gesture.object.id,
          newX: gesture.newX,
          newY: gesture.newY,
          newRoomId: gesture.newRoomId
        },
        issuedBy: 'player_001'
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success || !data.layout) {
          throw new Error(data.message || `Move failed (HTTP ${res.status})`);
        }
        this.deselectPlacedObject();
        this.updateLayout(data.layout);
        if (typeof window.showToast === 'function') {
          window.showToast(`Moved ${gesture.object.name} to ${gesture.newRoomId}.`);
        }
      })
      .catch((err) => {
        console.error('Object move failed:', err);
        this.deselectPlacedObject();
        this.updateLayout(this.layout);
        if (typeof window.showToast === 'function') {
          window.showToast(err.message || 'Could not move item.', true);
        }
      });
  }

  setCoordinateStatus(text) {
    const status = document.getElementById('map-coordinate-status');
    if (status) status.textContent = text;
  }

  updateCoordinateStatus(pointer) {
    if (!this.isBuildMode) return;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const x = Math.floor(worldPoint.x / this.CELL_SIZE);
    const y = Math.floor(worldPoint.y / this.CELL_SIZE);
    const room = this.layout?.rooms?.find((candidate) =>
      x >= candidate.x &&
      x < candidate.x + candidate.width &&
      y >= candidate.y &&
      y < candidate.y + candidate.height
    );
    this.setCoordinateStatus(
      room ? `Grid (${x}, ${y}) · ${room.name}` : `Grid (${x}, ${y})`
    );
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
    window.addEventListener('mapFullscreenChanged', (e) => {
      requestAnimationFrame(() => {
        const parent = this.game.canvas.parentElement;
        if (parent) this.scale.setParentSize(parent.clientWidth, parent.clientHeight);
        if (e.detail?.enabled) this.resetCamera();
      });
    });

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
      this.zoomMultiplier = Phaser.Math.Clamp(this.zoomMultiplier * factor, 0.6, 2.4);
      const newZoom = this.fitZoom * this.zoomMultiplier;
      this.updateCameraBounds(newZoom);
      cam.zoomTo(newZoom, 150, 'Sine.easeInOut');
      this.updateZoomStatus();
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

      if (room.type === 'hallway') {
        this.floorLayer.lineStyle(1, 0xcbd5e1, 0.22);
        this.floorLayer.strokeLineShape(new Phaser.Geom.Line(rx + 2, ry + rh / 2, rx + rw - 2, ry + rh / 2));
        continue;
      }

      const labelText = this.add.text(rx + rw / 2, ry + 16, `${icon} ${room.name.toUpperCase()}`, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '19px',
        resolution: 2,
        fontWeight: 'bold',
        color: '#ffffff',
        backgroundColor: 'rgba(7, 10, 17, 0.72)',
        padding: { x: 5, y: 3 },
        stroke: '#000000',
        strokeThickness: 1
      });
      labelText.setAlpha(0.88);
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

    const hallwayCell = (x, y) => this.layout.rooms.some(room =>
      room.type === 'hallway' &&
      x >= room.x && x < room.x + room.width &&
      y >= room.y && y < room.y + room.height
    );

    for (const wall of this.layout.walls) {
      const x1 = wall.x1 * this.CELL_SIZE;
      const y1 = wall.y1 * this.CELL_SIZE;
      const x2 = wall.x2 * this.CELL_SIZE;
      const y2 = wall.y2 * this.CELL_SIZE;

      const isExt = !!wall.isExterior;
      const color = isExt ? 0x2d3748 : 0x1f2937;
      const highlight = isExt ? 0x4a5568 : 0x374151;
      const thickness = isExt ? 8 : 6;
      const drawSegment = (startX, startY, endX, endY) => {
        this.wallLayer.lineStyle(thickness + 2, 0x050811, 0.7);
        this.wallLayer.strokeLineShape(new Phaser.Geom.Line(startX, startY + 2, endX, endY + 2));
        this.wallLayer.lineStyle(thickness, color, 1.0);
        this.wallLayer.strokeLineShape(new Phaser.Geom.Line(startX, startY, endX, endY));
        this.wallLayer.lineStyle(1.5, highlight, 0.6);
        this.wallLayer.strokeLineShape(new Phaser.Geom.Line(startX, startY, endX, endY));
      };

      if (wall.y1 === wall.y2) {
        let runStart = null;
        const minX = Math.min(wall.x1, wall.x2);
        const maxX = Math.max(wall.x1, wall.x2);
        for (let x = minX; x <= maxX + 1; x++) {
          const open = x <= maxX && hallwayCell(x, wall.y1);
          if (open && runStart === null) {
            runStart = x;
          } else if (!open && runStart !== null) {
            drawSegment(runStart * this.CELL_SIZE, y1, x * this.CELL_SIZE, y1);
            runStart = null;
          }
        }
      } else if (wall.x1 === wall.x2) {
        let runStart = null;
        const minY = Math.min(wall.y1, wall.y2);
        const maxY = Math.max(wall.y1, wall.y2);
        for (let y = minY; y <= maxY + 1; y++) {
          const open = y <= maxY && hallwayCell(wall.x1, y);
          if (open && runStart === null) {
            runStart = y;
          } else if (!open && runStart !== null) {
            drawSegment(x1, runStart * this.CELL_SIZE, x1, y * this.CELL_SIZE);
            runStart = null;
          }
        }
      } else {
        drawSegment(x1, y1, x2, y2);
      }
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
    const w = obj.width * this.CELL_SIZE;
    const h = obj.height * this.CELL_SIZE;
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
    const customData = obj.customData || {};
    const edgeColor = Phaser.Display.Color.HexStringToColor(customData.edgeColor || '#ffffff').color;
    const edgeWidth = Number.isFinite(customData.edgeWidth) ? customData.edgeWidth : 1.5;
    const cornerRadius = Number.isFinite(customData.cornerRadius) ? customData.cornerRadius : 4;
    const box = this.add.graphics();
    box.fillStyle(bodyColor, 0.95);
    box.fillRoundedRect(-w / 2, -h / 2, w, h, cornerRadius);

    // Border line
    box.lineStyle(edgeWidth, edgeColor, 0.8);
    box.strokeRoundedRect(-w / 2, -h / 2, w, h, cornerRadius);
    container.add(box);

    // Emoji Icon (Crisp System Emoji)
    const iconFontSize = Math.min(Math.max(15, Math.floor(Math.min(w, h) * 0.7)), 32);
    const icon = this.add.text(0, 0, obj.icon || '📦', {
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
      fontSize: `${iconFontSize}px`,
      resolution: 2
    });
    icon.setOrigin(0.5, 0.5);
    container.add(icon);

    // Compact Label if size allows
    const labelText = customData.labelText?.trim() || obj.name;
    const fontSize = Number.isFinite(customData.fontSize)
      ? customData.fontSize
      : Math.min(18, Math.max(12, 240 / Math.max(labelText.length, 1)));
    const label = this.add.text(0, 0, labelText, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${fontSize}px`,
      resolution: 2,
      fontWeight: 'bold',
      color: customData.labelColor || '#f8fafc',
      backgroundColor: 'rgba(8, 11, 18, 0.96)',
      padding: { x: 6, y: 4 },
      stroke: '#000000',
      strokeThickness: 1,
      align: 'center'
    });
    label.setOrigin(0.5, 0.5);
    label.setVisible(false);
    container.add(label);
    container.setData('nameLabel', label);

    // Interactive Hit Area
    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });

    // Hover Highlight
    container.on('pointerover', () => {
      box.clear();
      box.fillStyle(bodyColor, 1.0);
      box.fillRoundedRect(-w / 2, -h / 2, w, h, cornerRadius);
      box.lineStyle(Math.max(2.5, edgeWidth), 0x38bdf8, 0.9);
      box.strokeRoundedRect(-w / 2, -h / 2, w, h, cornerRadius);
    });

    container.on('pointerout', () => {
      if (this.selectedPlacedObject?.id !== obj.id) label.setVisible(false);
      box.clear();
      box.fillStyle(bodyColor, 0.95);
      box.fillRoundedRect(-w / 2, -h / 2, w, h, cornerRadius);
      box.lineStyle(edgeWidth, edgeColor, 0.8);
      box.strokeRoundedRect(-w / 2, -h / 2, w, h, cornerRadius);
    });

    // Left Click Handling
    container.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown()) return; // Handled by canvas contextmenu
      this.pointerObjectTarget = { obj, display: container };
      if (this.isBuildMode) {
        if (!this.keySpace?.isDown && pointer.button !== 1) {
          this.cancelGhostPlacement();
          this.selectPlacedObject(obj, container);
        }
      }
    });
    container.on('pointerover', () => label.setVisible(true));

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
      fontSize: '16px',
      resolution: 2
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
      fontSize: '15px',
      resolution: 2,
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
      fontSize: '12px',
      resolution: 2,
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
    if (this.game.canvas) this.game.canvas.style.cursor = 'grab';
    this.gridLayer.setVisible(enabled);
    this.setCoordinateStatus(enabled
      ? 'Drag empty floor to pan · Click floor to place · Drag furniture to move · Space + drag pans anywhere'
      : 'Drag to pan · Scroll to zoom at the cursor · Click a floor to walk');
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
      const objW = obj.width;
      const objH = obj.height;

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
    this.selectedPlacedDisplay = displayContainer;
    displayContainer?.getData('nameLabel')?.setVisible(true);

    // Highlight selected object with animated golden ring
    this.selectionHighlight = this.add.graphics();
    this.selectionHighlight.lineStyle(3, 0xf59e0b, 1.0);
    const w = obj.width * this.CELL_SIZE;
    const h = obj.height * this.CELL_SIZE;
    this.selectionHighlight.strokeRoundedRect(obj.x * this.CELL_SIZE - 2, obj.y * this.CELL_SIZE - 2, w + 4, h + 4, 6);

    // Notify UI toolbar about selected object
    window.dispatchEvent(new CustomEvent('placedObjectSelected', { detail: { object: obj } }));
  }

  deselectPlacedObject() {
    this.selectedPlacedDisplay?.getData('nameLabel')?.setVisible(false);
    this.selectedPlacedDisplay = null;
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
        params: { objectId: this.selectedPlacedObject.id, angle: newRot }
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success || !data.layout) {
          throw new Error(data.message || `Rotate failed (HTTP ${res.status})`);
        }
        return data;
      })
      .then((data) => {
        this.updateLayout(data.layout);
        this.deselectPlacedObject();
      })
      .catch((err) => {
        console.error('Object rotation failed:', err);
        if (typeof window.showToast === 'function') window.showToast(err.message || 'Could not rotate item.', true);
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
        params: { objectId: objId }
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success || !data.layout) {
          throw new Error(data.message || `Remove failed (HTTP ${res.status})`);
        }
        return data;
      })
      .then((data) => {
        this.updateLayout(data.layout);
        this.deselectPlacedObject();
        if (typeof window.showToast === 'function') {
          window.showToast('Item demolished.');
        }
      })
      .catch((err) => {
        console.error('Object removal failed:', err);
        if (typeof window.showToast === 'function') window.showToast(err.message || 'Could not remove item.', true);
      });
  }

  editSelectedPlacedObject(changes) {
    if (!this.selectedPlacedObject) return;
    fetch('/api/house/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'edit_object',
        params: { objectId: this.selectedPlacedObject.id, ...changes }
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.layout) {
          this.updateLayout(data.layout);
          this.deselectPlacedObject();
          if (typeof window.showToast === 'function') window.showToast(data.message || 'Item updated');
        } else if (typeof window.showToast === 'function') {
          window.showToast(data.message || 'Could not update item', true);
        }
      })
      .catch((err) => {
        console.error('Object edit failed:', err);
        if (typeof window.showToast === 'function') window.showToast('Could not update item', true);
      });
  }

  // ============================================================
  // INSPECTION & RIGHT CLICK HOVERCARD
  // ============================================================

  handleRightClickInspection(gridX, gridY, rawEvent) {
    if (!this.layout) return;

    // 1. Check if an object was right clicked
    const hitObj = this.layout.placedObjects.find((obj) => {
      const w = obj.width;
      const h = obj.height;
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
      this.zoomMultiplier = 1.2;
      const zoom = this.fitZoom * this.zoomMultiplier;
      this.updateCameraBounds(zoom);
      this.cameras.main.zoomTo(zoom, 400, 'Sine.easeInOut');
      this.updateZoomStatus();
    }
  }

  resetCamera() {
    this.zoomMultiplier = 1;
    this.updateCameraBounds(this.fitZoom);
    this.cameras.main.pan(this.WORLD_WIDTH / 2, this.WORLD_HEIGHT / 2, 400, 'Sine.easeInOut');
    this.cameras.main.zoomTo(this.fitZoom, 400, 'Sine.easeInOut');
    this.updateZoomStatus();
  }

  updateZoomStatus() {
    const zoomLabel = document.getElementById('map-zoom-level');
    if (zoomLabel) zoomLabel.textContent = `${Math.round(this.zoomMultiplier * 100)}%`;
  }

  updateCameraBounds(zoom = this.cameras.main.zoom) {
    const width = this.scale.width;
    const height = this.scale.height;
    if (!width || !height || !zoom) return;
    const horizontalMargin = Math.max(0, (width / zoom - this.WORLD_WIDTH) / 2);
    const verticalMargin = Math.max(0, (height / zoom - this.WORLD_HEIGHT) / 2);
    this.cameras.main.setBounds(
      -horizontalMargin,
      -verticalMargin,
      this.WORLD_WIDTH + horizontalMargin * 2,
      this.WORLD_HEIGHT + verticalMargin * 2
    );
  }

  resizeCameraToFit(gameSize) {
    const width = gameSize?.width || this.scale.width;
    const height = gameSize?.height || this.scale.height;
    if (!width || !height) return;

    const centerX = this.cameras.main.midPoint?.x ?? this.WORLD_WIDTH / 2;
    const centerY = this.cameras.main.midPoint?.y ?? this.WORLD_HEIGHT / 2;
    this.fitZoom = Math.min(width / this.WORLD_WIDTH, height / this.WORLD_HEIGHT);
    const zoom = this.fitZoom * this.zoomMultiplier;
    this.cameras.main.setZoom(zoom);
    this.updateCameraBounds(zoom);
    this.cameras.main.centerOn(centerX, centerY);
    this.updateZoomStatus();
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
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER
    },
    scene: [HouseScene]
  };

  const game = new Phaser.Game(config);
  window.phaserHouseGame = game;
  return game;
};
