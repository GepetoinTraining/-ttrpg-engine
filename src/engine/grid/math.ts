import {
  SquareCoord,
  HexCoord,
  HexAxial,
  GridConfig,
  Cell,
  Token,
  SizeToGridMap,
  PathResult,
  PathNode,
  LineOfSightResult,
  CoverType,
  AreaOfEffect,
  AoeResult,
  MovementType,
} from "./types";

// ============================================
// HEX COORDINATE UTILITIES
// ============================================

export function axialToCube(axial: HexAxial): HexCoord {
  return {
    q: axial.q,
    r: axial.r,
    s: -axial.q - axial.r,
  };
}

export function cubeToAxial(cube: HexCoord): HexAxial {
  return {
    q: cube.q,
    r: cube.r,
  };
}

// Pixel to hex (pointy-top)
export function pixelToHexPointy(x: number, y: number, size: number): HexAxial {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  return hexRound({ q, r });
}

// Pixel to hex (flat-top)
export function pixelToHexFlat(x: number, y: number, size: number): HexAxial {
  const q = ((2 / 3) * x) / size;
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / size;
  return hexRound({ q, r });
}

// Hex to pixel (pointy-top)
export function hexToPixelPointy(
  hex: HexAxial,
  size: number,
): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r);
  const y = size * ((3 / 2) * hex.r);
  return { x, y };
}

// Hex to pixel (flat-top)
export function hexToPixelFlat(
  hex: HexAxial,
  size: number,
): { x: number; y: number } {
  const x = size * ((3 / 2) * hex.q);
  const y = size * ((Math.sqrt(3) / 2) * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}

// Round floating hex to nearest hex
function hexRound(hex: { q: number; r: number }): HexAxial {
  const s = -hex.q - hex.r;
  let rq = Math.round(hex.q);
  let rr = Math.round(hex.r);
  let rs = Math.round(s);

  const qDiff = Math.abs(rq - hex.q);
  const rDiff = Math.abs(rr - hex.r);
  const sDiff = Math.abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}

// Hex neighbors (6 directions)
const HEX_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0, s: -1 },
  { q: 1, r: -1, s: 0 },
  { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 },
  { q: -1, r: 1, s: 0 },
  { q: 0, r: 1, s: -1 },
];

export function hexNeighbor(hex: HexCoord, direction: number): HexCoord {
  const d = HEX_DIRECTIONS[direction];
  return {
    q: hex.q + d.q,
    r: hex.r + d.r,
    s: hex.s + d.s,
  };
}

export function hexNeighbors(hex: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map((d) => ({
    q: hex.q + d.q,
    r: hex.r + d.r,
    s: hex.s + d.s,
  }));
}

// ============================================
// SQUARE COORDINATE UTILITIES
// ============================================

// Square neighbors (8 directions including diagonals)
const SQUARE_DIRECTIONS_8: SquareCoord[] = [
  { x: 0, y: -1 }, // N
  { x: 1, y: -1 }, // NE
  { x: 1, y: 0 }, // E
  { x: 1, y: 1 }, // SE
  { x: 0, y: 1 }, // S
  { x: -1, y: 1 }, // SW
  { x: -1, y: 0 }, // W
  { x: -1, y: -1 }, // NW
];

// Square neighbors (4 directions, no diagonals)
const SQUARE_DIRECTIONS_4: SquareCoord[] = [
  { x: 0, y: -1 }, // N
  { x: 1, y: 0 }, // E
  { x: 0, y: 1 }, // S
  { x: -1, y: 0 }, // W
];

export function squareNeighbors(
  coord: SquareCoord,
  includeDiagonals: boolean = true,
): SquareCoord[] {
  const directions = includeDiagonals
    ? SQUARE_DIRECTIONS_8
    : SQUARE_DIRECTIONS_4;
  return directions.map((d) => ({
    x: coord.x + d.x,
    y: coord.y + d.y,
  }));
}

// ============================================
// DISTANCE CALCULATIONS
// ============================================

// D&D 5e uses a simplified distance: 5 ft per square, diagonals = 5 ft
// Optional variant: alternating 5-10-5-10 for diagonals
export function squareDistance(
  a: SquareCoord,
  b: SquareCoord,
  scale: number = 5,
  variantDiagonals: boolean = false,
): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);

  if (variantDiagonals) {
    // 5-10-5-10 variant (DMG optional rule)
    const diagonals = Math.min(dx, dy);
    const straight = Math.max(dx, dy) - diagonals;
    // Every other diagonal costs double
    const diagonalCost = Math.floor(diagonals / 2) * 2 + (diagonals % 2);
    return (straight + diagonalCost + Math.floor(diagonals / 2)) * scale;
  } else {
    // Standard 5e: diagonals = 5 ft (Chebyshev distance)
    return Math.max(dx, dy) * scale;
  }
}

// Hex distance (always consistent)
export function hexDistance(
  a: HexCoord,
  b: HexCoord,
  scale: number = 5,
): number {
  return (
    ((Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2) *
    scale
  );
}

// Universal distance function
export function calculateDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  gridType: "square" | "hex-pointy" | "hex-flat",
  scale: number = 5,
): number {
  if (gridType === "square") {
    return squareDistance({ x: ax, y: ay }, { x: bx, y: by }, scale);
  } else {
    // For hex, convert to cube coords
    const hexA = axialToCube({ q: ax, r: ay });
    const hexB = axialToCube({ q: bx, r: by });
    return hexDistance(hexA, hexB, scale);
  }
}

// ============================================
// LINE OF SIGHT (BRESENHAM'S LINE)
// ============================================

export function getLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): SquareCoord[] {
  const points: SquareCoord[] = [];

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (true) {
    points.push({ x, y });

    if (x === x1 && y === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return points;
}

export function checkLineOfSight(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  cells: Map<string, Cell>,
  tokens: Token[],
  scale: number = 5,
): LineOfSightResult {
  const line = getLine(fromX, fromY, toX, toY);
  const obstructions: { x: number; y: number; type: string }[] = [];
  let cover: CoverType = "none";
  let canSee = true;

  // Check each cell along the line
  for (let i = 1; i < line.length - 1; i++) {
    const point = line[i];
    const key = `${point.x},${point.y}`;
    const cell = cells.get(key);

    if (cell) {
      // Check for walls/impassable terrain
      if (cell.terrain === "wall" || cell.terrain === "impassable") {
        canSee = false;
        obstructions.push({ x: point.x, y: point.y, type: cell.terrain });
      }

      // Check for cover
      if (cell.providesCover !== "none") {
        // Upgrade cover level
        const coverLevels: CoverType[] = [
          "none",
          "half",
          "three_quarters",
          "full",
        ];
        const currentLevel = coverLevels.indexOf(cover);
        const cellLevel = coverLevels.indexOf(cell.providesCover);
        if (cellLevel > currentLevel) {
          cover = cell.providesCover;
        }
        obstructions.push({
          x: point.x,
          y: point.y,
          type: `cover_${cell.providesCover}`,
        });
      }

      // Check for magical darkness
      if (cell.lightLevel === "magical_darkness") {
        canSee = false;
        obstructions.push({ x: point.x, y: point.y, type: "magical_darkness" });
      }
    }

    // Check for creatures providing cover (optional rule)
    const blockingToken = tokens.find(
      (t) => t.x === point.x && t.y === point.y && t.id !== undefined, // not the origin or target
    );
    if (blockingToken) {
      const currentLevel = ["none", "half", "three_quarters", "full"].indexOf(
        cover,
      );
      if (currentLevel < 1) {
        cover = "half"; // creatures provide half cover
      }
    }
  }

  const distance = calculateDistance(fromX, fromY, toX, toY, "square", scale);

  return {
    canSee,
    distance,
    cover,
    obstructions,
  };
}

// ============================================
// PATHFINDING (A* ALGORITHM)
// ============================================

interface PathfindingOptions {
  gridConfig: GridConfig;
  cells: Map<string, Cell>;
  tokens: Token[];
  movingToken: Token;
  movementType: MovementType;
  allowDiagonals?: boolean;
  maxCost?: number;
}

export function findPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  options: PathfindingOptions,
): PathResult {
  const {
    gridConfig,
    cells,
    tokens,
    movingToken,
    movementType,
    allowDiagonals = true,
    maxCost = Infinity,
  } = options;

  const scale = gridConfig.scale;
  const startKey = `${startX},${startY}`;
  const endKey = `${endX},${endY}`;

  // Check if destination is valid
  const destCell = cells.get(endKey);
  if (
    destCell &&
    (destCell.terrain === "wall" || destCell.terrain === "impassable")
  ) {
    return {
      valid: false,
      path: [],
      totalCost: Infinity,
      movementRequired: Infinity,
      canComplete: false,
      triggersOpportunityAttacks: [],
    };
  }

  // A* pathfinding
  const openSet = new Set<string>([startKey]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([
    [startKey, heuristic(startX, startY, endX, endY)],
  ]);

  // Track tokens that threaten opportunity attacks
  const hostileTokens = tokens.filter(
    (t) => t.id !== movingToken.id && isHostile(t, movingToken),
  );
  const threatenedCells = new Set<string>();
  hostileTokens.forEach((t) => {
    getThreatenedCells(t).forEach((cell) => threatenedCells.add(cell));
  });

  const opportunityAttacks = new Set<string>();

  while (openSet.size > 0) {
    // Find node with lowest fScore
    let current = "";
    let lowestF = Infinity;
    openSet.forEach((key) => {
      const f = fScore.get(key) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = key;
      }
    });

    if (current === endKey) {
      // Reconstruct path
      const path = reconstructPath(cameFrom, current, gScore);
      const totalCost = gScore.get(endKey) ?? 0;

      return {
        valid: true,
        path,
        totalCost,
        movementRequired: totalCost * scale,
        canComplete: totalCost * scale <= movingToken.movementRemaining,
        triggersOpportunityAttacks: Array.from(opportunityAttacks),
      };
    }

    openSet.delete(current);
    const [cx, cy] = current.split(",").map(Number);

    // Get neighbors
    const neighbors = getNeighbors(cx, cy, gridConfig.type, allowDiagonals);

    for (const neighbor of neighbors) {
      const { x: nx, y: ny } = neighbor;
      const neighborKey = `${nx},${ny}`;

      // Check bounds
      if (
        nx < 0 ||
        nx >= gridConfig.width ||
        ny < 0 ||
        ny >= gridConfig.height
      ) {
        continue;
      }

      // Check if passable
      const cell = cells.get(neighborKey);
      if (!isPassable(cell, movementType)) {
        continue;
      }

      // Check for blocking tokens
      const blockingToken = tokens.find(
        (t) => t.id !== movingToken.id && tokenOccupiesCell(t, nx, ny),
      );
      if (blockingToken && isHostile(blockingToken, movingToken)) {
        continue; // can't move through hostile creatures
      }

      // Calculate movement cost
      const moveCost = getMovementCost(
        cell,
        movementType,
        allowDiagonals,
        cx,
        cy,
        nx,
        ny,
      );
      const tentativeG = (gScore.get(current) ?? Infinity) + moveCost;

      if (tentativeG > maxCost) {
        continue;
      }

      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        // Check for opportunity attacks (leaving threatened square)
        if (threatenedCells.has(current) && !threatenedCells.has(neighborKey)) {
          // Find which hostile token we're leaving
          hostileTokens.forEach((t) => {
            if (getThreatenedCells(t).has(current)) {
              opportunityAttacks.add(t.id);
            }
          });
        }

        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeG);
        fScore.set(neighborKey, tentativeG + heuristic(nx, ny, endX, endY));
        openSet.add(neighborKey);
      }
    }
  }

  // No path found
  return {
    valid: false,
    path: [],
    totalCost: Infinity,
    movementRequired: Infinity,
    canComplete: false,
    triggersOpportunityAttacks: [],
  };
}

function heuristic(x1: number, y1: number, x2: number, y2: number): number {
  // Chebyshev distance (allows diagonals at cost 1)
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function getNeighbors(
  x: number,
  y: number,
  gridType: string,
  allowDiagonals: boolean,
): SquareCoord[] {
  if (gridType === "square") {
    return squareNeighbors({ x, y }, allowDiagonals);
  } else {
    // Hex - convert and use hex neighbors
    const hex = axialToCube({ q: x, r: y });
    return hexNeighbors(hex).map((h) => ({ x: h.q, y: h.r }));
  }
}

function isPassable(
  cell: Cell | undefined,
  movementType: MovementType,
): boolean {
  if (!cell) return true; // undefined cells are passable

  switch (cell.terrain) {
    case "wall":
    case "impassable":
      return false;
    case "water_deep":
      return movementType === "swim" || movementType === "fly";
    case "lava":
      return movementType === "fly";
    case "pit":
      return movementType === "fly";
    default:
      return true;
  }
}

function getMovementCost(
  cell: Cell | undefined,
  movementType: MovementType,
  allowDiagonals: boolean,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number {
  let cost = 1;

  // Difficult terrain
  if (cell && cell.movementCost > 1 && movementType !== "fly") {
    cost = cell.movementCost;
  }

  // Diagonal movement (optional: costs 1.5, rounded)
  if (allowDiagonals && fromX !== toX && fromY !== toY) {
    // Standard 5e: diagonals cost same as straight
    // Variant: could multiply by 1.5
  }

  return cost;
}

function reconstructPath(
  cameFrom: Map<string, string>,
  current: string,
  gScore: Map<string, number>,
): PathNode[] {
  const path: PathNode[] = [];
  let key = current;

  while (key) {
    const [x, y] = key.split(",").map(Number);
    path.unshift({
      x,
      y,
      cost: gScore.get(key) ?? 0,
      totalCost: gScore.get(key) ?? 0,
    });
    key = cameFrom.get(key) ?? "";
  }

  return path;
}

function tokenOccupiesCell(token: Token, x: number, y: number): boolean {
  const size = SizeToGridMap[token.size];
  return (
    x >= token.x && x < token.x + size && y >= token.y && y < token.y + size
  );
}

function getThreatenedCells(token: Token): Set<string> {
  const threatened = new Set<string>();
  const size = SizeToGridMap[token.size];
  const reach = 5; // Standard reach, could be from token data

  // Cells adjacent to the token (within reach)
  for (let dx = -1; dx <= size; dx++) {
    for (let dy = -1; dy <= size; dy++) {
      // Skip interior cells
      if (dx >= 0 && dx < size && dy >= 0 && dy < size) continue;

      const tx = token.x + dx;
      const ty = token.y + dy;
      threatened.add(`${tx},${ty}`);
    }
  }

  return threatened;
}

// Placeholder - should check actual allegiance/faction
function isHostile(a: Token, b: Token): boolean {
  // This would check faction/allegiance data
  return false; // Implement based on your faction system
}

// ============================================
// AREA OF EFFECT CALCULATIONS
// ============================================

export function calculateAoE(
  aoe: AreaOfEffect,
  gridConfig: GridConfig,
  tokens: Token[],
): AoeResult {
  const affectedCells: { x: number; y: number }[] = [];
  const affectedTokens: string[] = [];
  const scale = gridConfig.scale;

  switch (aoe.shape) {
    case "circle":
    case "sphere": {
      const radiusCells = Math.ceil((aoe.radius ?? 0) / scale);
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        for (let dy = -radiusCells; dy <= radiusCells; dy++) {
          const x = aoe.originX + dx;
          const y = aoe.originY + dy;
          const dist = calculateDistance(
            aoe.originX,
            aoe.originY,
            x,
            y,
            gridConfig.type,
            scale,
          );
          if (dist <= (aoe.radius ?? 0)) {
            affectedCells.push({ x, y });
          }
        }
      }
      break;
    }

    case "cone": {
      const lengthCells = Math.ceil((aoe.length ?? 0) / scale);
      const angleRad = ((aoe.direction ?? 0) * Math.PI) / 180;
      const halfAngle = ((aoe.angle ?? 90) * Math.PI) / 360;

      for (let dx = -lengthCells; dx <= lengthCells; dx++) {
        for (let dy = -lengthCells; dy <= lengthCells; dy++) {
          const x = aoe.originX + dx;
          const y = aoe.originY + dy;
          const dist = calculateDistance(
            aoe.originX,
            aoe.originY,
            x,
            y,
            gridConfig.type,
            scale,
          );

          if (dist <= (aoe.length ?? 0) && dist > 0) {
            // Check angle
            const cellAngle = Math.atan2(dy, dx);
            const angleDiff = Math.abs(normalizeAngle(cellAngle - angleRad));
            if (angleDiff <= halfAngle) {
              affectedCells.push({ x, y });
            }
          }
        }
      }
      break;
    }

    case "cube":
    case "square": {
      const sizeCells = Math.ceil((aoe.length ?? 0) / scale);
      for (let dx = 0; dx < sizeCells; dx++) {
        for (let dy = 0; dy < sizeCells; dy++) {
          affectedCells.push({
            x: aoe.originX + dx,
            y: aoe.originY + dy,
          });
        }
      }
      break;
    }

    case "line": {
      const lengthCells = Math.ceil((aoe.length ?? 0) / scale);
      const widthCells = Math.ceil((aoe.width ?? 5) / scale);
      const angleRad = ((aoe.direction ?? 0) * Math.PI) / 180;

      for (let i = 0; i < lengthCells; i++) {
        for (
          let w = -Math.floor(widthCells / 2);
          w <= Math.floor(widthCells / 2);
          w++
        ) {
          const x = Math.round(
            aoe.originX + i * Math.cos(angleRad) - w * Math.sin(angleRad),
          );
          const y = Math.round(
            aoe.originY + i * Math.sin(angleRad) + w * Math.cos(angleRad),
          );
          affectedCells.push({ x, y });
        }
      }
      break;
    }

    case "cylinder": {
      // Same as circle, but with height consideration
      const radiusCells = Math.ceil((aoe.radius ?? 0) / scale);
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        for (let dy = -radiusCells; dy <= radiusCells; dy++) {
          const x = aoe.originX + dx;
          const y = aoe.originY + dy;
          const dist = calculateDistance(
            aoe.originX,
            aoe.originY,
            x,
            y,
            gridConfig.type,
            scale,
          );
          if (dist <= (aoe.radius ?? 0)) {
            affectedCells.push({ x, y });
          }
        }
      }
      break;
    }
  }

  // Find affected tokens
  const affectedCellSet = new Set(affectedCells.map((c) => `${c.x},${c.y}`));
  for (const token of tokens) {
    const size = SizeToGridMap[token.size];
    for (let dx = 0; dx < size; dx++) {
      for (let dy = 0; dy < size; dy++) {
        const key = `${token.x + dx},${token.y + dy}`;
        if (affectedCellSet.has(key)) {
          // Check elevation for 3D effects
          if (aoe.shape === "sphere" || aoe.shape === "cylinder") {
            const heightFeet = aoe.height ?? aoe.radius ?? 0;
            if (
              token.elevation >= aoe.originElevation &&
              token.elevation <= aoe.originElevation + heightFeet / scale
            ) {
              affectedTokens.push(token.id);
            }
          } else {
            affectedTokens.push(token.id);
          }
          break;
        }
      }
    }
  }

  return {
    affectedCells,
    affectedTokens: [...new Set(affectedTokens)], // dedupe
  };
}

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return Math.abs(angle);
}

// ============================================
// GRID RENDERING HELPERS
// ============================================

export function cellToPixel(
  x: number,
  y: number,
  gridConfig: GridConfig,
): { px: number; py: number } {
  const { type, cellSize, offsetX, offsetY } = gridConfig;

  if (type === "square") {
    return {
      px: x * cellSize + offsetX,
      py: y * cellSize + offsetY,
    };
  } else if (type === "hex-pointy") {
    const pos = hexToPixelPointy({ q: x, r: y }, cellSize);
    return {
      px: pos.x + offsetX,
      py: pos.y + offsetY,
    };
  } else {
    // hex-flat
    const pos = hexToPixelFlat({ q: x, r: y }, cellSize);
    return {
      px: pos.x + offsetX,
      py: pos.y + offsetY,
    };
  }
}

export function pixelToCell(
  px: number,
  py: number,
  gridConfig: GridConfig,
): { x: number; y: number } {
  const { type, cellSize, offsetX, offsetY } = gridConfig;
  const adjustedX = px - offsetX;
  const adjustedY = py - offsetY;

  if (type === "square") {
    return {
      x: Math.floor(adjustedX / cellSize),
      y: Math.floor(adjustedY / cellSize),
    };
  } else if (type === "hex-pointy") {
    const hex = pixelToHexPointy(adjustedX, adjustedY, cellSize);
    return { x: hex.q, y: hex.r };
  } else {
    // hex-flat
    const hex = pixelToHexFlat(adjustedX, adjustedY, cellSize);
    return { x: hex.q, y: hex.r };
  }
}
