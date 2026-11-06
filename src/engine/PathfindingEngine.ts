// ============================================================
// PATHFINDING ENGINE — A* Algorithm & Grid-Based Collision Detection
// ============================================================

import { HouseLayout, PathWaypoint } from "../types/house.js";

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

export class PathfindingEngine {
  private cols: number;
  private rows: number;
  private cellSize: number;
  private grid: number[][]; // 0: walkable, 1: obstacle, 2: door

  constructor(cols = 40, rows = 38, cellSize = 20) {
    this.cols = cols;
    this.rows = rows;
    this.cellSize = cellSize;
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  }

  public getCols(): number {
    return this.cols;
  }

  public getRows(): number {
    return this.rows;
  }

  public getCellSize(): number {
    return this.cellSize;
  }

  public isWithinBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  public isWalkable(x: number, y: number): boolean {
    if (!this.isWithinBounds(x, y)) return false;
    return this.grid[y][x] === 0 || this.grid[y][x] === 2;
  }

  public setCell(x: number, y: number, value: number): void {
    if (this.isWithinBounds(x, y)) {
      this.grid[y][x] = value;
    }
  }

  public getCell(x: number, y: number): number {
    if (!this.isWithinBounds(x, y)) return 1;
    return this.grid[y][x];
  }

  /**
   * Rebuilds the collision matrix from an authoritative HouseLayout
   */
  public rebuildFromHouse(layout: HouseLayout): void {
    this.cols = layout.grid.cols;
    this.rows = layout.grid.rows;
    this.cellSize = layout.grid.cellSize;

    // Reset grid: by default, area outside rooms is non-walkable (exterior)
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(1));

    // 1. Mark all room floors as walkable
    for (const room of layout.rooms) {
      const rx1 = Math.max(0, room.x);
      const ry1 = Math.max(0, room.y);
      const rx2 = Math.min(this.cols - 1, room.x + room.width - 1);
      const ry2 = Math.min(this.rows - 1, room.y + room.height - 1);

      for (let y = ry1; y <= ry2; y++) {
        for (let x = rx1; x <= rx2; x++) {
          this.grid[y][x] = 0; // walkable room floor
        }
      }
    }

    // 2. Mark interior/exterior walls as solid obstacles
    for (const wall of layout.walls) {
      const x1 = Math.min(wall.x1, wall.x2);
      const x2 = Math.max(wall.x1, wall.x2);
      const y1 = Math.min(wall.y1, wall.y2);
      const y2 = Math.max(wall.y1, wall.y2);

      for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
          const hallwayFloor = layout.rooms.some(room =>
            room.type === "hallway" &&
            x >= room.x && x < room.x + room.width &&
            y >= room.y && y < room.y + room.height
          );
          if (hallwayFloor) continue;
          if (this.isWithinBounds(x, y)) {
            this.grid[y][x] = 1;
          }
        }
      }
    }

    // 3. Mark door thresholds as walkable
    for (const door of layout.doors) {
      if (door.orientation === "horizontal") {
        for (let dx = 0; dx < (door.width || 2); dx++) {
          const x = door.x + dx;
          const y = door.y;
          if (this.isWithinBounds(x, y)) {
            this.grid[y][x] = 2; // walkable door
          }
        }
      } else {
        for (let dy = 0; dy < (door.width || 2); dy++) {
          const x = door.x;
          const y = door.y + dy;
          if (this.isWithinBounds(x, y)) {
            this.grid[y][x] = 2; // walkable door
          }
        }
      }
    }

    // 4. Mark solid placed objects as obstacles
    for (const obj of layout.placedObjects) {
      if (obj.isSolid) {
        const ox1 = Math.max(0, obj.x);
        const oy1 = Math.max(0, obj.y);
        const ox2 = Math.min(this.cols - 1, obj.x + obj.width - 1);
        const oy2 = Math.min(this.rows - 1, obj.y + obj.height - 1);

        for (let y = oy1; y <= oy2; y++) {
          for (let x = ox1; x <= ox2; x++) {
            // Keep doorways passable even if adjacent to an object
            if (this.grid[y][x] !== 2) {
              this.grid[y][x] = 1;
            }
          }
        }
      }
    }
  }

  /**
   * Find A* path between start and target grid cells.
   * If target is occupied/solid, automatically targets the closest walkable neighbor.
   */
  public findPath(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number
  ): PathWaypoint[] {
    const sX = Math.round(Math.max(0, Math.min(this.cols - 1, startX)));
    const sY = Math.round(Math.max(0, Math.min(this.rows - 1, startY)));
    let tX = Math.round(Math.max(0, Math.min(this.cols - 1, targetX)));
    let tY = Math.round(Math.max(0, Math.min(this.rows - 1, targetY)));

    // Already there
    if (sX === tX && sY === tY) {
      return [{
        gridX: sX,
        gridY: sY,
        x: (sX + 0.5) * this.cellSize,
        y: (sY + 0.5) * this.cellSize,
      }];
    }

    // If target is solid, find nearest walkable neighbor
    if (!this.isWalkable(tX, tY)) {
      const neighbor = this.findNearestWalkableNeighbor(tX, tY, sX, sY);
      if (neighbor) {
        tX = neighbor.x;
        tY = neighbor.y;
      } else {
        return [];
      }
    }

    // A* algorithm implementation
    const openSet: AStarNode[] = [];
    const closedSet = new Uint8Array(this.cols * this.rows);

    const startNode: AStarNode = {
      x: sX,
      y: sY,
      g: 0,
      h: this.heuristic(sX, sY, tX, tY),
      f: this.heuristic(sX, sY, tX, tY),
      parent: null,
    };

    openSet.push(startNode);

    // Cardinal directions
    const directions = [
      { dx: 0, dy: -1 }, // North
      { dx: 1, dy: 0 },  // East
      { dx: 0, dy: 1 },  // South
      { dx: -1, dy: 0 }, // West
      { dx: 1, dy: -1 }, // North-East
      { dx: 1, dy: 1 },  // South-East
      { dx: -1, dy: 1 }, // South-West
      { dx: -1, dy: -1 },// North-West
    ];

    while (openSet.length > 0) {
      // Find node with lowest f score
      let lowestIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIndex].f) {
          lowestIndex = i;
        }
      }

      const current = openSet.splice(lowestIndex, 1)[0];
      const index = current.y * this.cols + current.x;

      if (current.x === tX && current.y === tY) {
        // Reconstruct path
        const path: PathWaypoint[] = [];
        let curr: AStarNode | null = current;
        while (curr) {
          path.unshift({
            gridX: curr.x,
            gridY: curr.y,
            x: (curr.x + 0.5) * this.cellSize,
            y: (curr.y + 0.5) * this.cellSize,
          });
          curr = curr.parent;
        }
        return path;
      }

      closedSet[index] = 1;

      for (const dir of directions) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;

        if (!this.isWalkable(nx, ny)) continue;

        const nIndex = ny * this.cols + nx;
        if (closedSet[nIndex] === 1) continue;

        // Prevent corner cutting for diagonal movement
        if (dir.dx !== 0 && dir.dy !== 0) {
          if (!this.isWalkable(current.x + dir.dx, current.y) || !this.isWalkable(current.x, current.y + dir.dy)) {
            continue;
          }
        }

        const moveCost = dir.dx !== 0 && dir.dy !== 0 ? 1.414 : 1.0;
        const tentativeG = current.g + moveCost;

        const existingOpen = openSet.find(n => n.x === nx && n.y === ny);

        if (!existingOpen) {
          const h = this.heuristic(nx, ny, tX, tY);
          openSet.push({
            x: nx,
            y: ny,
            g: tentativeG,
            h,
            f: tentativeG + h,
            parent: current,
          });
        } else if (tentativeG < existingOpen.g) {
          existingOpen.g = tentativeG;
          existingOpen.f = tentativeG + existingOpen.h;
          existingOpen.parent = current;
        }
      }
    }

    // No path found
    return [];
  }

  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    // Octile distance
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  }

  private findNearestWalkableNeighbor(
    tx: number,
    ty: number,
    fromX: number,
    fromY: number
  ): { x: number; y: number } | null {
    const candidates: { x: number; y: number; dist: number }[] = [];

    for (let r = 1; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) === r || Math.abs(dy) === r) {
            const nx = tx + dx;
            const ny = ty + dy;
            if (this.isWalkable(nx, ny)) {
              const d = Math.hypot(nx - fromX, ny - fromY);
              candidates.push({ x: nx, y: ny, dist: d });
            }
          }
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.dist - b.dist);
        return { x: candidates[0].x, y: candidates[0].y };
      }
    }
    return null;
  }
}
