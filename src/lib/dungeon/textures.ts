/**
 * Texture catalog.
 *
 * Each entry is a CSS background string that paints the swatch as a
 * tileable pattern using the project's paper palette. When a real
 * generated image is available (Gemini / SVG-skill), the renderer
 * swaps `imageUrl` over the CSS `background`.
 *
 * Categories cover the full palette the AI DM will need:
 *   dungeon · earth · water · outdoor · urban · interior · metal ·
 *   ruin · underdark · planar · special
 *
 * Add a texture: append an entry to TEXTURES, add the kind to TextureKind
 * in types.ts. Pickers + AI prompt seeds update automatically.
 */

import type { TextureKind } from './types'

export interface TexturePattern {
  kind: TextureKind
  label: string
  background: string
  baseColor: string
  category:
    | 'dungeon'
    | 'earth'
    | 'water'
    | 'outdoor'
    | 'urban'
    | 'interior'
    | 'metal'
    | 'ruin'
    | 'underdark'
    | 'planar'
    | 'special'
  tags: string[]
  /** Seed prompt for image generation when Gemini Nano Banana lands. */
  promptSeed: string
}

const T = (
  kind: TextureKind,
  label: string,
  category: TexturePattern['category'],
  baseColor: string,
  background: string,
  tags: string[],
  promptSeed: string,
): TexturePattern => ({ kind, label, category, baseColor, background, tags, promptSeed })

export const TEXTURES: Record<TextureKind, TexturePattern> = {
  // ── Dungeon · stone & wood ──────────────────────────────────────────────
  'stone-smooth': T(
    'stone-smooth', 'Smooth stone', 'dungeon', '#cdc4ad',
    'repeating-linear-gradient(0deg, rgba(31,27,22,0.06) 0 1px, transparent 1px 24px),' +
      'repeating-linear-gradient(90deg, rgba(31,27,22,0.06) 0 1px, transparent 1px 36px),' +
      '#cdc4ad',
    ['stone', 'flat', 'urban', 'temple'],
    'overhead seamless tile of cut grey stone flagstones, mortar lines, soft scuffs',
  ),
  'stone-rough': T(
    'stone-rough', 'Rough stone', 'dungeon', '#b9ad94',
    'radial-gradient(circle at 25% 35%, rgba(31,27,22,0.10) 0 2px, transparent 3px),' +
      'radial-gradient(circle at 70% 60%, rgba(31,27,22,0.08) 0 2px, transparent 3px),' +
      'repeating-linear-gradient(45deg, rgba(31,27,22,0.04) 0 1px, transparent 2px 8px),' +
      '#b9ad94',
    ['stone', 'cave', 'rough', 'natural'],
    'overhead seamless tile of unhewn cave stone, pitted, irregular',
  ),
  'stone-mossy': T(
    'stone-mossy', 'Mossy stone', 'dungeon', '#a3a684',
    'radial-gradient(circle at 30% 40%, rgba(77,106,58,0.45) 0 6px, transparent 8px),' +
      'radial-gradient(circle at 75% 70%, rgba(77,106,58,0.35) 0 5px, transparent 7px),' +
      'repeating-linear-gradient(0deg, rgba(31,27,22,0.05) 0 1px, transparent 1px 24px),' +
      '#a3a684',
    ['stone', 'damp', 'overgrown', 'ruin'],
    'overhead seamless tile of stone flagstones overgrown with green moss patches',
  ),
  'stone-cracked': T(
    'stone-cracked', 'Cracked stone', 'dungeon', '#c5bba2',
    'linear-gradient(125deg, transparent 47%, rgba(31,27,22,0.35) 47% 47.5%, transparent 47.5% 60%, rgba(31,27,22,0.30) 60% 60.5%, transparent 60.5%),' +
      'repeating-linear-gradient(0deg, rgba(31,27,22,0.04) 0 1px, transparent 1px 28px),' +
      '#c5bba2',
    ['stone', 'damaged', 'ruin', 'collapse'],
    'overhead seamless tile of cracked stone with branching fissures',
  ),
  'wood-plank': T(
    'wood-plank', 'Wood planks', 'dungeon', '#a17a4a',
    'repeating-linear-gradient(90deg, rgba(31,27,22,0.18) 0 1px, transparent 1px 56px),' +
      'repeating-linear-gradient(0deg, rgba(31,27,22,0.05) 0 2px, rgba(255,255,255,0.04) 2px 4px),' +
      '#a17a4a',
    ['wood', 'tavern', 'ship', 'manor'],
    'overhead seamless tile of warm wooden plank floor with grain',
  ),
  'wood-charred': T(
    'wood-charred', 'Charred wood', 'dungeon', '#3b2a1f',
    'repeating-linear-gradient(90deg, rgba(0,0,0,0.4) 0 1px, transparent 1px 50px),' +
      'radial-gradient(circle at 40% 50%, rgba(168,68,42,0.25) 0 8px, transparent 10px),' +
      '#3b2a1f',
    ['wood', 'fire', 'ruin', 'burned'],
    'overhead seamless tile of fire-blackened plank floor with embers',
  ),

  // ── Earth & natural ─────────────────────────────────────────────────────
  'earth-packed': T(
    'earth-packed', 'Packed earth', 'earth', '#9c7a55',
    'radial-gradient(circle at 20% 30%, rgba(31,27,22,0.12) 0 1.5px, transparent 2.5px),' +
      'radial-gradient(circle at 65% 70%, rgba(31,27,22,0.10) 0 1.5px, transparent 2.5px),' +
      '#9c7a55',
    ['earth', 'cave', 'natural', 'dirt'],
    'overhead seamless tile of packed dirt floor, faint footprints',
  ),
  mud: T(
    'mud', 'Mud', 'earth', '#5b4a30',
    'radial-gradient(ellipse 8px 4px at 30% 40%, rgba(0,0,0,0.35) 0 3px, transparent 5px),' +
      'radial-gradient(ellipse 10px 5px at 70% 65%, rgba(0,0,0,0.25) 0 4px, transparent 6px),' +
      '#5b4a30',
    ['earth', 'wet', 'difficult', 'swamp'],
    'overhead seamless tile of wet brown mud, glistening',
  ),
  gravel: T(
    'gravel', 'Gravel', 'earth', '#8a8674',
    'radial-gradient(circle at 20% 30%, rgba(0,0,0,0.20) 0 2px, transparent 3px),' +
      'radial-gradient(circle at 50% 60%, rgba(0,0,0,0.15) 0 2px, transparent 3px),' +
      'radial-gradient(circle at 75% 25%, rgba(0,0,0,0.18) 0 1.5px, transparent 2.5px),' +
      'radial-gradient(circle at 30% 80%, rgba(255,255,255,0.07) 0 1.5px, transparent 2.5px),' +
      '#8a8674',
    ['earth', 'gravel', 'difficult', 'path'],
    'overhead seamless tile of loose pebbly gravel with mixed grey tones',
  ),
  scree: T(
    'scree', 'Scree slope', 'earth', '#7a7466',
    'radial-gradient(ellipse 4px 6px at 25% 35%, rgba(0,0,0,0.30) 0 3px, transparent 4px),' +
      'radial-gradient(ellipse 5px 8px at 70% 60%, rgba(0,0,0,0.25) 0 4px, transparent 5px),' +
      'radial-gradient(ellipse 4px 5px at 45% 80%, rgba(255,255,255,0.10) 0 3px, transparent 4px),' +
      '#7a7466',
    ['earth', 'mountain', 'difficult', 'rocky'],
    'overhead seamless tile of mountain scree, broken angular rocks',
  ),
  ash: T(
    'ash', 'Ash', 'earth', '#3d3a35',
    'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.04) 0 1.5px, transparent 2.5px),' +
      'radial-gradient(circle at 75% 70%, rgba(168,68,42,0.10) 0 2px, transparent 3px),' +
      '#3d3a35',
    ['earth', 'ash', 'volcanic', 'aftermath'],
    'overhead seamless tile of grey volcanic ash with faint ember glints',
  ),

  // ── Water ────────────────────────────────────────────────────────────────
  'water-still': T(
    'water-still', 'Still water', 'water', '#3a5d7a',
    'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 8px),' +
      'linear-gradient(180deg, rgba(58,93,122,0.9), rgba(31,55,80,0.95))',
    ['water', 'pool', 'cistern'],
    'overhead seamless tile of still dark water with faint surface ripples',
  ),
  'water-flowing': T(
    'water-flowing', 'Flowing water', 'water', '#3a5d7a',
    'repeating-linear-gradient(20deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 6px),' +
      'repeating-linear-gradient(20deg, rgba(31,55,80,0.6) 0 6px, rgba(58,93,122,0.6) 6px 12px)',
    ['water', 'river', 'current', 'difficult'],
    'overhead seamless tile of flowing river water with diagonal ripples',
  ),
  'water-deep': T(
    'water-deep', 'Deep water', 'water', '#1c2e3f',
    'radial-gradient(ellipse at center, rgba(31,55,80,0.0) 0 30%, rgba(8,18,32,0.7) 100%),' +
      '#1c2e3f',
    ['water', 'deep', 'swimming', 'drowning'],
    'overhead seamless tile of black-deep water, lightless, abyssal',
  ),
  'sea-foam': T(
    'sea-foam', 'Sea foam', 'water', '#a4c0c8',
    'radial-gradient(ellipse 12px 6px at 30% 40%, rgba(255,255,255,0.7) 0 5px, transparent 7px),' +
      'radial-gradient(ellipse 16px 8px at 70% 65%, rgba(255,255,255,0.5) 0 6px, transparent 9px),' +
      'linear-gradient(180deg, rgba(164,192,200,0.95), rgba(120,160,170,0.9))',
    ['water', 'coast', 'tide', 'beach'],
    'overhead seamless tile of frothing sea foam over shallow water',
  ),
  'wet-sand': T(
    'wet-sand', 'Wet sand', 'water', '#b09972',
    'radial-gradient(circle at 30% 40%, rgba(31,27,22,0.18) 0 1.5px, transparent 3px),' +
      'repeating-linear-gradient(110deg, rgba(0,0,0,0.06) 0 1px, transparent 1px 5px),' +
      '#b09972',
    ['sand', 'coast', 'beach', 'tide'],
    'overhead seamless tile of wet packed sand with shell fragments',
  ),

  // ── Outdoor wilderness ──────────────────────────────────────────────────
  grass: T(
    'grass', 'Grass', 'outdoor', '#4d6a3a',
    'repeating-linear-gradient(72deg, rgba(31,27,22,0.10) 0 1px, transparent 1px 4px),' +
      'repeating-linear-gradient(108deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 6px),' +
      '#4d6a3a',
    ['grass', 'plain', 'meadow', 'outdoor'],
    'overhead seamless tile of short green grass with subtle blade variation',
  ),
  'forest-leaf': T(
    'forest-leaf', 'Forest leaf litter', 'outdoor', '#5b4426',
    'radial-gradient(ellipse 6px 3px at 20% 30%, rgba(168,68,42,0.4) 0 3px, transparent 5px),' +
      'radial-gradient(ellipse 8px 4px at 65% 70%, rgba(176,136,56,0.5) 0 4px, transparent 6px),' +
      'radial-gradient(ellipse 5px 3px at 80% 30%, rgba(77,106,58,0.6) 0 3px, transparent 4px),' +
      '#5b4426',
    ['forest', 'leaves', 'autumn', 'temperate'],
    'overhead seamless tile of forest floor with autumn leaves and twigs',
  ),
  'pine-needle': T(
    'pine-needle', 'Pine needles', 'outdoor', '#3d3724',
    'repeating-linear-gradient(35deg, rgba(31,27,22,0.20) 0 1px, transparent 1px 5px),' +
      'repeating-linear-gradient(125deg, rgba(176,136,56,0.10) 0 1px, transparent 1px 6px),' +
      '#3d3724',
    ['forest', 'pine', 'needle', 'evergreen'],
    'overhead seamless tile of dry pine needles densely matted',
  ),
  'jungle-floor': T(
    'jungle-floor', 'Jungle floor', 'outdoor', '#3d4a26',
    'radial-gradient(ellipse 14px 7px at 25% 35%, rgba(77,106,58,0.55) 0 6px, transparent 9px),' +
      'radial-gradient(ellipse 10px 6px at 70% 65%, rgba(31,27,22,0.30) 0 5px, transparent 7px),' +
      'repeating-linear-gradient(60deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 5px),' +
      '#3d4a26',
    ['jungle', 'tropical', 'overgrown', 'humid'],
    'overhead seamless tile of damp jungle floor with broad leaves and humus',
  ),
  marsh: T(
    'marsh', 'Marsh', 'outdoor', '#4a553a',
    'radial-gradient(ellipse 16px 8px at 30% 40%, rgba(31,55,40,0.5) 0 8px, transparent 11px),' +
      'radial-gradient(ellipse 8px 4px at 65% 65%, rgba(77,106,58,0.4) 0 4px, transparent 6px),' +
      '#4a553a',
    ['marsh', 'swamp', 'wet', 'difficult'],
    'overhead seamless tile of marsh water mixed with reed clumps and mud',
  ),
  snow: T(
    'snow', 'Snow', 'outdoor', '#e6e8eb',
    'radial-gradient(circle at 25% 35%, rgba(255,255,255,0.9) 0 6px, transparent 8px),' +
      'radial-gradient(circle at 70% 65%, rgba(220,225,232,0.95) 0 5px, transparent 7px),' +
      'linear-gradient(180deg, #e6e8eb, #d2d6dc)',
    ['snow', 'cold', 'arctic', 'difficult'],
    'overhead seamless tile of fresh white snow with subtle drift textures',
  ),
  ice: T(
    'ice', 'Ice', 'outdoor', '#a8c5d4',
    'linear-gradient(135deg, rgba(255,255,255,0.4) 25%, transparent 25% 50%, rgba(255,255,255,0.3) 50% 75%, transparent 75%),' +
      'linear-gradient(180deg, rgba(168,197,212,0.95), rgba(120,160,180,0.95))',
    ['ice', 'slippery', 'cold', 'arctic'],
    'overhead seamless tile of glassy blue ice with internal cracks',
  ),
  sand: T(
    'sand', 'Sand', 'outdoor', '#d6c79a',
    'repeating-linear-gradient(160deg, rgba(31,27,22,0.04) 0 2px, transparent 2px 8px),' +
      'radial-gradient(circle at 35% 60%, rgba(31,27,22,0.06) 0 1.5px, transparent 2.5px),' +
      '#d6c79a',
    ['sand', 'desert', 'beach', 'dune'],
    'overhead seamless tile of fine pale sand with faint wind patterns',
  ),
  dunes: T(
    'dunes', 'Sand dunes', 'outdoor', '#e0ce95',
    'repeating-linear-gradient(20deg, rgba(31,27,22,0.10) 0 2px, transparent 2px 18px),' +
      'repeating-linear-gradient(20deg, transparent 0 6px, rgba(255,255,255,0.10) 6px 8px),' +
      '#e0ce95',
    ['sand', 'desert', 'wind-swept', 'dunes'],
    'overhead seamless tile of windswept dune crests in soft golden sand',
  ),

  // ── City · urban ─────────────────────────────────────────────────────────
  cobblestone: T(
    'cobblestone', 'Cobblestone', 'urban', '#9c948a',
    'radial-gradient(ellipse 18px 14px at 25% 35%, rgba(31,27,22,0.30) 13px, transparent 14px),' +
      'radial-gradient(ellipse 20px 15px at 70% 70%, rgba(31,27,22,0.30) 14px, transparent 15px),' +
      'radial-gradient(ellipse 16px 12px at 75% 30%, rgba(31,27,22,0.30) 11px, transparent 12px),' +
      '#9c948a',
    ['city', 'street', 'cobble', 'medieval'],
    'overhead seamless tile of medieval cobblestone street, weathered',
  ),
  'brick-red': T(
    'brick-red', 'Red brick', 'urban', '#8a3a2a',
    'repeating-linear-gradient(0deg, rgba(0,0,0,0.30) 0 2px, transparent 2px 24px),' +
      'repeating-linear-gradient(90deg, transparent 0 56px, rgba(0,0,0,0.30) 56px 58px),' +
      'linear-gradient(0deg, #8a3a2a, #a8442a)',
    ['city', 'brick', 'wall', 'masonry'],
    'overhead seamless tile of red clay brick with mortar lines',
  ),
  'brick-tan': T(
    'brick-tan', 'Tan brick', 'urban', '#b89878',
    'repeating-linear-gradient(0deg, rgba(0,0,0,0.20) 0 2px, transparent 2px 24px),' +
      'repeating-linear-gradient(90deg, transparent 0 56px, rgba(0,0,0,0.20) 56px 58px),' +
      'linear-gradient(0deg, #b89878, #c8a888)',
    ['city', 'brick', 'wall', 'sandstone'],
    'overhead seamless tile of tan sandstone brick wall',
  ),
  'paved-road': T(
    'paved-road', 'Paved road', 'urban', '#6c6964',
    'repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0 1px, transparent 1px 5px),' +
      'radial-gradient(ellipse 8px 4px at 30% 40%, rgba(0,0,0,0.10) 0 3px, transparent 5px),' +
      '#6c6964',
    ['city', 'road', 'highway', 'imperial'],
    'overhead seamless tile of imperial paved road, fitted slabs, wagon ruts',
  ),
  'sewer-tile': T(
    'sewer-tile', 'Sewer tile', 'urban', '#4d4a42',
    'repeating-linear-gradient(0deg, rgba(0,0,0,0.45) 0 2px, transparent 2px 20px),' +
      'repeating-linear-gradient(90deg, rgba(0,0,0,0.45) 0 2px, transparent 2px 20px),' +
      'radial-gradient(circle at 30% 40%, rgba(77,106,58,0.30) 0 4px, transparent 6px),' +
      '#4d4a42',
    ['city', 'sewer', 'underground', 'damp'],
    'overhead seamless tile of dim sewer tile with green slime patches',
  ),
  'slate-roof': T(
    'slate-roof', 'Slate roof', 'urban', '#4a4d56',
    'repeating-linear-gradient(0deg, rgba(0,0,0,0.20) 0 2px, transparent 2px 14px),' +
      'repeating-linear-gradient(90deg, transparent 0 28px, rgba(0,0,0,0.30) 28px 30px),' +
      'linear-gradient(180deg, #4a4d56, #36383f)',
    ['city', 'roof', 'slate', 'rainy'],
    'overhead seamless tile of grey slate shingled roof tiles',
  ),
  'tile-clay-roof': T(
    'tile-clay-roof', 'Clay roof', 'urban', '#a8442a',
    'repeating-radial-gradient(circle at 50% 0%, rgba(0,0,0,0.20) 0 1px, transparent 1px 12px),' +
      'repeating-linear-gradient(90deg, transparent 0 22px, rgba(0,0,0,0.20) 22px 24px),' +
      'linear-gradient(180deg, #a8442a, #7a2f1d)',
    ['city', 'roof', 'clay', 'mediterranean'],
    'overhead seamless tile of curved terracotta clay roof tiles',
  ),
  'market-canvas': T(
    'market-canvas', 'Market canvas', 'urban', '#c8a878',
    'repeating-linear-gradient(35deg, rgba(0,0,0,0.10) 0 2px, transparent 2px 6px),' +
      'repeating-linear-gradient(125deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 5px),' +
      '#c8a878',
    ['city', 'market', 'cloth', 'awning'],
    'overhead seamless tile of woven canvas market awning, sun-bleached',
  ),

  // ── Interior · noble / refined ───────────────────────────────────────────
  'marble-white': T(
    'marble-white', 'White marble', 'interior', '#e8e3d6',
    'linear-gradient(125deg, transparent 47%, rgba(31,27,22,0.10) 47% 47.5%, transparent 47.5% 70%, rgba(31,27,22,0.08) 70% 70.4%, transparent 70.4%),' +
      'linear-gradient(60deg, transparent 30%, rgba(31,27,22,0.06) 30% 30.5%, transparent 30.5%),' +
      '#e8e3d6',
    ['interior', 'marble', 'palace', 'temple'],
    'overhead seamless tile of polished white marble with soft grey veining',
  ),
  'marble-black': T(
    'marble-black', 'Black marble', 'interior', '#1f1d22',
    'linear-gradient(125deg, transparent 47%, rgba(255,255,255,0.10) 47% 47.5%, transparent 47.5% 70%, rgba(255,255,255,0.08) 70% 70.4%, transparent 70.4%),' +
      'linear-gradient(60deg, transparent 30%, rgba(255,255,255,0.06) 30% 30.5%, transparent 30.5%),' +
      '#1f1d22',
    ['interior', 'marble', 'palace', 'sinister'],
    'overhead seamless tile of black marble with white veining, polished',
  ),
  parquet: T(
    'parquet', 'Parquet floor', 'interior', '#8a5e30',
    'repeating-linear-gradient(45deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 24px),' +
      'repeating-linear-gradient(-45deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 24px),' +
      'linear-gradient(45deg, #8a5e30 25%, #6b4624 25% 50%, #8a5e30 50% 75%, #6b4624 75%)',
    ['interior', 'wood', 'parquet', 'manor'],
    'overhead seamless tile of herringbone parquet wood floor',
  ),
  'cloth-rug': T(
    'cloth-rug', 'Cloth rug', 'interior', '#a8442a',
    'repeating-linear-gradient(90deg, rgba(0,0,0,0.10) 0 1px, transparent 1px 8px),' +
      'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 8px),' +
      'linear-gradient(180deg, #a8442a, #7a2f1d)',
    ['interior', 'rug', 'cloth', 'manor'],
    'overhead seamless tile of woven crimson rug with subtle pattern',
  ),
  'tile-mosaic': T(
    'tile-mosaic', 'Mosaic tile', 'interior', '#cdc4ad',
    'conic-gradient(from 0deg at 25% 25%, #cdc4ad 0 25%, #b08838 25% 50%, #cdc4ad 50% 75%, #3a5d7a 75% 100%),' +
      'repeating-linear-gradient(0deg, rgba(31,27,22,0.10) 0 1px, transparent 1px 16px)',
    ['interior', 'tile', 'temple', 'mosaic'],
    'overhead seamless tile of intricate four-color mosaic floor',
  ),
  'hearth-stone': T(
    'hearth-stone', 'Hearth stone', 'interior', '#5e554a',
    'radial-gradient(ellipse 20px 14px at 30% 40%, rgba(0,0,0,0.30) 14px, transparent 15px),' +
      'radial-gradient(ellipse 18px 12px at 70% 65%, rgba(0,0,0,0.30) 12px, transparent 13px),' +
      'linear-gradient(0deg, rgba(168,68,42,0.10), transparent 30%),' +
      '#5e554a',
    ['interior', 'fireplace', 'tavern', 'hearth'],
    'overhead seamless tile of soot-darkened hearth stone',
  ),

  // ── Metal · forge / industrial ──────────────────────────────────────────
  'metal-grate': T(
    'metal-grate', 'Metal grate', 'metal', '#5b5d62',
    'repeating-linear-gradient(0deg, rgba(0,0,0,0.6) 0 2px, transparent 2px 14px),' +
      'repeating-linear-gradient(90deg, rgba(0,0,0,0.6) 0 2px, transparent 2px 14px),' +
      '#5b5d62',
    ['metal', 'industrial', 'sewer', 'forge'],
    'overhead seamless tile of dark iron grating over a void',
  ),
  'metal-plate': T(
    'metal-plate', 'Metal plate', 'metal', '#7a7c80',
    'repeating-linear-gradient(45deg, rgba(0,0,0,0.10) 0 2px, transparent 2px 10px),' +
      'radial-gradient(circle at 12% 12%, rgba(0,0,0,0.45) 0 1.5px, transparent 2.5px),' +
      'radial-gradient(circle at 88% 88%, rgba(0,0,0,0.45) 0 1.5px, transparent 2.5px),' +
      '#7a7c80',
    ['metal', 'forge', 'fortress', 'mech'],
    'overhead seamless tile of riveted iron plate with bolts',
  ),

  // ── Ruins ────────────────────────────────────────────────────────────────
  'overgrown-stone': T(
    'overgrown-stone', 'Overgrown ruin', 'ruin', '#8a8a6c',
    'radial-gradient(ellipse 18px 10px at 25% 35%, rgba(77,106,58,0.50) 0 8px, transparent 11px),' +
      'radial-gradient(circle at 70% 70%, rgba(31,27,22,0.20) 0 4px, transparent 6px),' +
      'repeating-linear-gradient(0deg, rgba(31,27,22,0.05) 0 1px, transparent 1px 24px),' +
      '#8a8a6c',
    ['ruin', 'overgrown', 'abandoned', 'vines'],
    'overhead seamless tile of ruined flagstones reclaimed by ivy and roots',
  ),
  'collapsed-floor': T(
    'collapsed-floor', 'Collapsed floor', 'ruin', '#6e6553',
    'linear-gradient(125deg, transparent 35%, rgba(31,27,22,0.50) 35% 36%, transparent 36% 55%, rgba(31,27,22,0.40) 55% 56%, transparent 56%),' +
      'radial-gradient(ellipse 12px 8px at 65% 60%, rgba(0,0,0,0.40) 0 6px, transparent 8px),' +
      '#6e6553',
    ['ruin', 'collapse', 'rubble', 'damaged'],
    'overhead seamless tile of collapsed dungeon floor, rubble + holes',
  ),

  // ── Underdark ───────────────────────────────────────────────────────────
  'glowing-fungus': T(
    'glowing-fungus', 'Glowing fungus', 'underdark', '#2a2a3a',
    'radial-gradient(circle at 30% 40%, rgba(120,255,180,0.45) 0 6px, transparent 9px),' +
      'radial-gradient(circle at 70% 60%, rgba(80,180,255,0.40) 0 5px, transparent 8px),' +
      'radial-gradient(circle at 50% 80%, rgba(255,150,200,0.35) 0 4px, transparent 7px),' +
      '#2a2a3a',
    ['underdark', 'glow', 'fungus', 'cave'],
    'overhead seamless tile of dark cave floor with bioluminescent fungi clusters',
  ),
  'drow-tile': T(
    'drow-tile', 'Drow tile', 'underdark', '#1a1d2a',
    'conic-gradient(from 30deg at 50% 50%, rgba(120,80,160,0.30) 0 60deg, transparent 60deg 120deg, rgba(120,80,160,0.20) 120deg 180deg, transparent 180deg 240deg, rgba(120,80,160,0.30) 240deg 300deg, transparent 300deg),' +
      'repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 18px),' +
      '#1a1d2a',
    ['underdark', 'drow', 'spider', 'tile'],
    'overhead seamless tile of black obsidian drow tile with violet sigils',
  ),

  // ── Planar / magical ────────────────────────────────────────────────────
  'arcane-circle': T(
    'arcane-circle', 'Arcane circle', 'planar', '#1f1b16',
    'radial-gradient(circle at 50% 50%, transparent 35%, rgba(176,136,56,0.6) 36% 37%, transparent 38% 45%, rgba(176,136,56,0.4) 46% 47%, transparent 48%),' +
      'conic-gradient(from 0deg, rgba(176,136,56,0.15) 0 30deg, transparent 30deg 60deg, rgba(176,136,56,0.15) 60deg 90deg, transparent 90deg 120deg, rgba(176,136,56,0.15) 120deg 150deg, transparent 150deg 180deg, rgba(176,136,56,0.15) 180deg 210deg, transparent 210deg 240deg, rgba(176,136,56,0.15) 240deg 270deg, transparent 270deg 300deg, rgba(176,136,56,0.15) 300deg 330deg, transparent 330deg),' +
      '#1f1b16',
    ['planar', 'magic', 'ritual', 'circle'],
    'overhead seamless tile of dark stone with glowing arcane circle and runes',
  ),
  'glyph-floor': T(
    'glyph-floor', 'Glyph floor', 'planar', '#2a221c',
    'radial-gradient(circle at 30% 30%, rgba(120,180,255,0.35) 0 4px, transparent 6px),' +
      'radial-gradient(circle at 70% 70%, rgba(255,200,120,0.35) 0 4px, transparent 6px),' +
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 12px),' +
      '#2a221c',
    ['planar', 'glyph', 'rune', 'magical'],
    'overhead seamless tile of dark floor with scattered glowing runes',
  ),
  'ley-line': T(
    'ley-line', 'Ley line', 'planar', '#1c2438',
    'linear-gradient(45deg, transparent 47%, rgba(120,180,255,0.7) 47% 48%, transparent 48% 52%, rgba(120,180,255,0.4) 52% 53%, transparent 53%),' +
      'radial-gradient(circle at 50% 50%, rgba(120,180,255,0.20) 0 8px, transparent 16px),' +
      '#1c2438',
    ['planar', 'magic', 'leyline', 'arcane'],
    'overhead seamless tile of dark plane with crackling blue ley line streams',
  ),
  'ethereal-mist': T(
    'ethereal-mist', 'Ethereal mist', 'planar', '#9aa0bb',
    'radial-gradient(ellipse 30px 20px at 30% 40%, rgba(255,255,255,0.5) 0 14px, transparent 18px),' +
      'radial-gradient(ellipse 26px 18px at 70% 65%, rgba(200,210,235,0.5) 0 12px, transparent 16px),' +
      'linear-gradient(180deg, rgba(154,160,187,0.95), rgba(120,130,160,0.95))',
    ['planar', 'ethereal', 'mist', 'fog'],
    'overhead seamless tile of swirling ethereal grey-blue mist',
  ),
  'fire-plane': T(
    'fire-plane', 'Plane of Fire', 'planar', '#a8442a',
    'radial-gradient(circle at 30% 40%, rgba(255,210,80,0.7) 0 6px, transparent 9px),' +
      'radial-gradient(circle at 75% 65%, rgba(255,160,40,0.6) 0 5px, transparent 8px),' +
      'linear-gradient(180deg, rgba(168,68,42,0.95), rgba(80,20,5,0.95))',
    ['planar', 'fire', 'elemental', 'hot'],
    'overhead seamless tile of fire plane, rolling embers on darkened crust',
  ),
  lava: T(
    'lava', 'Lava', 'planar', '#a8442a',
    'radial-gradient(circle at 30% 40%, rgba(255,210,80,0.7) 0 6px, transparent 9px),' +
      'radial-gradient(circle at 75% 65%, rgba(255,210,80,0.5) 0 5px, transparent 8px),' +
      'linear-gradient(180deg, rgba(168,68,42,0.95), rgba(80,20,5,0.95))',
    ['lava', 'fire', 'hazard', 'underdark'],
    'overhead seamless tile of glowing red lava with bright cracks and dark crust',
  ),
  void: T(
    'void', 'Void', 'planar', '#0a0908',
    'radial-gradient(circle at center, rgba(255,255,255,0.04) 0 1px, transparent 2px),' +
      '#0a0908',
    ['void', 'plane', 'shadow', 'abyss'],
    'overhead seamless tile of pure black void with rare faint stars',
  ),
  'star-field': T(
    'star-field', 'Star field', 'planar', '#0a0d1a',
    'radial-gradient(circle at 20% 25%, rgba(255,255,255,0.9) 0 1px, transparent 2px),' +
      'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.7) 0 1px, transparent 2px),' +
      'radial-gradient(circle at 75% 35%, rgba(255,255,255,0.6) 0 1.5px, transparent 2.5px),' +
      'radial-gradient(circle at 30% 80%, rgba(180,200,255,0.7) 0 1.5px, transparent 2.5px),' +
      'radial-gradient(circle at 85% 80%, rgba(255,220,180,0.6) 0 1px, transparent 2px),' +
      'linear-gradient(180deg, #0a0d1a, #1a1530)',
    ['planar', 'astral', 'cosmos', 'star'],
    'overhead seamless tile of dark space with scattered stars of varied color',
  ),

  // ── Special / hazard ────────────────────────────────────────────────────
  'blood-pool': T(
    'blood-pool', 'Blood pool', 'special', '#4d1010',
    'radial-gradient(ellipse 24px 14px at 35% 45%, rgba(140,20,20,0.95) 0 10px, transparent 14px),' +
      'radial-gradient(ellipse 30px 18px at 65% 60%, rgba(80,5,5,0.85) 0 14px, transparent 18px),' +
      'linear-gradient(180deg, rgba(77,16,16,0.95), rgba(40,5,5,0.95))',
    ['hazard', 'blood', 'gore', 'aftermath'],
    'overhead seamless tile of dark glistening blood pool',
  ),
  'frost-cracked': T(
    'frost-cracked', 'Frost-cracked stone', 'special', '#a4b8c2',
    'linear-gradient(125deg, transparent 47%, rgba(255,255,255,0.6) 47% 48%, transparent 48% 60%, rgba(255,255,255,0.5) 60% 60.5%, transparent 60.5%),' +
      'linear-gradient(60deg, transparent 30%, rgba(120,160,200,0.4) 30% 30.5%, transparent 30.5%),' +
      '#a4b8c2',
    ['special', 'cold', 'frost', 'cracked'],
    'overhead seamless tile of grey stone with white frost veins and rime',
  ),
}

export function texturePattern(kind: TextureKind): TexturePattern {
  return TEXTURES[kind] ?? TEXTURES['stone-smooth']
}

export const TEXTURE_KINDS: TextureKind[] = Object.keys(TEXTURES) as TextureKind[]

/** All categories in display order. */
export const TEXTURE_CATEGORIES: TexturePattern['category'][] = [
  'dungeon', 'earth', 'water', 'outdoor', 'urban',
  'interior', 'metal', 'ruin', 'underdark', 'planar', 'special',
]

export function texturesByCategory(category: TexturePattern['category']): TexturePattern[] {
  return Object.values(TEXTURES).filter((t) => t.category === category)
}
