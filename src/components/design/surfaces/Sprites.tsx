// @ts-nocheck
'use client'

import React from 'react'

// surfaces/Sprites.jsx — Surface 34. Tile sprite library browser.
// Shows every SVG sprite in /public/sprites/ on a 5ft grid backdrop,
// grouped by category with usage notes.

const SPRITE_GROUPS = [
  {
    id: 'objects',
    label: 'Objects',
    note: 'interactable furniture · loot · pillars · puzzle pieces',
    items: [
      {kind: 'chest-closed', variants: 3, role: 'loot · locked', color: 'gold'},
      {kind: 'chest-open',   variants: 2, role: 'looted · keep visible after'},
      {kind: 'altar',        variants: 2, role: 'shrine · ritual focus'},
      {kind: 'statue',       variants: 3, role: 'warrior · robed · animal'},
      {kind: 'pillar',       variants: 2, role: 'round · square · cover'},
      {kind: 'table',        variants: 3, role: 'round · banquet · small square'},
      {kind: 'chair',        variants: 2, role: 'wooden · throne'},
      {kind: 'bed',          variants: 2, role: 'cot · four-poster'},
      {kind: 'bookshelf',    variants: 2, role: 'full · ransacked'},
      {kind: 'brazier-lit',  variants: 2, role: 'lit · light source 20ft', color: 'gold'},
      {kind: 'brazier-cold', variants: 1, role: 'cold · ash'},
      {kind: 'fountain',     variants: 2, role: 'plain · tiered'},
      {kind: 'lever-up',     variants: 1, role: 'state: up'},
      {kind: 'lever-down',   variants: 1, role: 'state: down'},
      {kind: 'button',       variants: 1, role: 'press / trigger'},
      {kind: 'rune',         variants: 3, role: 'arcane sigil — annotate effect', color: 'blue'},
      {kind: 'rubble',       variants: 2, role: 'stone pile · collapsed beam · difficult terrain'},
      {kind: 'corpse',       variants: 2, role: 'fresh · skeletal — investigate'},
      {kind: 'cage',         variants: 1, role: 'imprisons · interactive'},
      {kind: 'crate',        variants: 2, role: 'crate · barrel'},
    ],
  },
  {
    id: 'hazards',
    label: 'Hazards',
    note: 'traps · glyphs · environmental — usually red, hidden until perception',
    items: [
      {kind: 'pressure-plate', variants: 1, role: 'pressure trigger', color: 'red'},
      {kind: 'tripwire',       variants: 1, role: 'cross-line trigger', color: 'red'},
      {kind: 'dart-trap',      variants: 1, role: 'wall slit · darts on trigger', color: 'red'},
      {kind: 'falling-block',  variants: 1, role: 'overhead · ceiling drop', color: 'red'},
      {kind: 'pit-open',       variants: 1, role: 'open pit'},
      {kind: 'spike-pit',      variants: 1, role: 'spiked pit', color: 'red'},
      {kind: 'arrow-slit',     variants: 1, role: 'cover behind · enemy fires through'},
      {kind: 'glyph',          variants: 3, role: 'magic glyph of warding', color: 'red'},
      {kind: 'symbol',         variants: 2, role: 'rune of effect (charm, fear, …)', color: 'gold'},
      {kind: 'gas',            variants: 1, role: 'gas cloud · vol AOE', color: 'green'},
      {kind: 'fire-jet',       variants: 1, role: 'fire jet · vent + plume', color: 'red'},
      {kind: 'ice-floor',      variants: 1, role: 'difficult terrain · DEX save', color: 'blue'},
      {kind: 'web',            variants: 1, role: 'spider web · restrained'},
      {kind: 'illusion-floor', variants: 1, role: 'illusory · DC 14 INV to disbelieve'},
    ],
  },
  {
    id: 'doors',
    label: 'Doors',
    note: 'span 2 tiles · slot into walls · open / closed states',
    items: [
      {kind: 'door-wood',    variants: 2, role: 'closed · open'},
      {kind: 'door-iron',    variants: 2, role: 'closed · open'},
      {kind: 'door-secret',  variants: 1, role: 'hidden · DC investigation'},
      {kind: 'portcullis',   variants: 1, role: 'mechanical lattice gate'},
      {kind: 'door-magical', variants: 1, role: 'sealed · arcane key', color: 'blue'},
    ],
  },
  {
    id: 'lighting',
    label: 'Lighting',
    note: 'light sources — DM ring on the bright edge, fog beyond',
    items: [
      {kind: 'torch',        variants: 2, role: 'sconce · handheld', color: 'gold'},
      {kind: 'candle',       variants: 1, role: 'dim · 5ft', color: 'gold'},
      {kind: 'lantern',      variants: 1, role: 'bright 30 / dim 60', color: 'gold'},
      {kind: 'magical-orb',  variants: 1, role: 'always-on · cool light', color: 'blue'},
      {kind: 'sunshaft',     variants: 1, role: 'natural light cone'},
    ],
  },
  {
    id: 'decoration',
    label: 'Decoration',
    note: 'flavor only — no mechanical effect, but reveal tone',
    items: [
      {kind: 'mushroom',         variants: 2, role: 'red · glowing blue'},
      {kind: 'crystal-cluster',  variants: 2, role: 'blue · purple', color: 'blue'},
      {kind: 'bones',            variants: 1, role: 'skull + scattered'},
      {kind: 'rug-pattern',      variants: 2, role: 'red bordered · blue medallion'},
      {kind: 'flower-patch',     variants: 2, role: 'wild · tame'},
      {kind: 'tree-stump',       variants: 1, role: 'rings — woodland'},
      {kind: 'sign-post',        variants: 1, role: 'directional · text overlay'},
      {kind: 'cobweb',           variants: 1, role: 'corner · long-abandoned'},
    ],
  },
];

// expand kind+variants into individual sprite paths
function expandSprite(group, item) {
  if (item.variants === 1) {
    return [{label: item.kind, path: `public/sprites/${group.id}/${item.kind}.svg`, role: item.role, color: item.color}];
  }
  return Array.from({length: item.variants}).map((_, i) => ({
    label: `${item.kind}-${i+1}`,
    path: `public/sprites/${group.id}/${item.kind}-${i+1}.svg`,
    role: item.role,
    color: item.color,
  }));
}

function GridCell({sprite, scale = 2}) {
  // 5ft grid backdrop · sprite occupies one tile (50px) at scale=1
  const tile = 50 * scale;
  return (
    <div className="sprite-cell" style={{width: tile, height: tile}}>
      <div className="sprite-grid-bg" />
      <img src={sprite.path} alt={sprite.label}
           style={{width: tile, height: tile, position: 'relative'}} />
    </div>
  );
}

function SpriteCard({sprite}) {
  const dot = sprite.color ? <span className={`dot ${sprite.color}`} /> : null;
  return (
    <div className="sprite-card">
      <GridCell sprite={sprite} scale={1.3} />
      <div className="sprite-meta">
        <div className="sprite-name">{dot}{sprite.label}</div>
        <div className="sprite-role">{sprite.role}</div>
        <div className="sprite-path">{sprite.path.replace('public/sprites/', '')}</div>
      </div>
    </div>
  );
}

function SpriteGroup({group}) {
  const flat = group.items.flatMap(item => expandSprite(group, item));
  return (
    <div className="sprite-group">
      <div className="section-title">{group.label} · {flat.length} sprites</div>
      <p style={{maxWidth: 760, color: 'var(--ink-2)', margin: '4px 0 14px'}}>{group.note}</p>
      <div className="sprite-grid">
        {flat.map(s => <SpriteCard key={s.path} sprite={s} />)}
      </div>
    </div>
  );
}

export default function Sprites() {
  const total = SPRITE_GROUPS.reduce((n, g) => n + g.items.flatMap(i => expandSprite(g, i)).length, 0);

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">34 · Map sprites library</div>
          <h2>Tile sprite kit</h2>
        </div>
        <span className="who">drop on the dungeon grid →</span>
      </div>

      <p style={{maxWidth: 820, color:'var(--ink-2)', marginTop: 0}}>
        Mid-fidelity ink-line sprites for the <span className="kbd">26 · Dungeon runner</span> and any
        place a 5ft grid shows up — encounter prep, location pages, scene cards. Each sprite is a
        100×100 SVG on transparent ground; the outer silhouette uses <code>currentColor</code> so it
        inherits ink color from the parent (DM dark mode flips white). Interior detail uses the four
        accent colors so red / blue / gold / green still read at a glance.
      </p>

      <div className="row" style={{gap: 14, marginTop: 14, flexWrap:'wrap', alignItems: 'center'}}>
        <span className="chip solid">{total} sprites</span>
        <span className="chip"><span className="dot" /> Neutral · paper · ink</span>
        <span className="chip red"><span className="dot red" /> Hazard · destructive</span>
        <span className="chip blue"><span className="dot blue" /> Magical · cold · arcane</span>
        <span className="chip gold"><span className="dot gold" /> Loot · light · commit</span>
        <span className="chip green"><span className="dot green" /> Vegetation · gas</span>
      </div>

      <div className="row" style={{gap: 24, marginTop: 12, flexWrap:'wrap'}}>
        <div className="tiny" style={{maxWidth: 240}}>
          <b>Naming</b><br/>
          <code>kind.svg</code> · single variant<br/>
          <code>kind-1.svg</code>, <code>-2</code>, … · multiple
        </div>
        <div className="tiny" style={{maxWidth: 240}}>
          <b>Sizing</b><br/>
          1 tile = 5ft = 50px at base zoom.<br/>
          Sprites render at <code>1×1</code> tile by default;<br/>
          large objects (table-2, fountain-2) span <code>2×2</code>.
        </div>
        <div className="tiny" style={{maxWidth: 280}}>
          <b>Coverage gaps still open</b><br/>
          mounts (horse, ox), siege engines (catapult, ballista), watercraft (rowboat, raft), tradesman tools (anvil, forge, loom). flag if you want any of these next.
        </div>
      </div>

      {SPRITE_GROUPS.map(g => <SpriteGroup key={g.id} group={g} />)}

      <div className="section-title" style={{marginTop: 40}}>Anatomy &amp; rules of thumb</div>
      <div className="row" style={{gap: 14, alignItems: 'flex-start', flexWrap: 'wrap'}}>
        <div className="box" style={{flex: '1 1 280px', minWidth: 280}}>
          <div className="box-title">Stroke + fill conventions</div>
          <ul style={{margin: '8px 0 0 18px', padding: 0, lineHeight: 1.7, fontSize: 14}}>
            <li><b>Outer silhouette</b> · <code>stroke="currentColor"</code> · 2u stroke</li>
            <li><b>Interior detail</b> · paper fill + ink-2 hatching at 0.6–0.8u</li>
            <li><b>Accent</b> · red/blue/gold/green only when semantic</li>
            <li><b>Glow</b> · paper or color at 6–10% opacity, never blur filter</li>
          </ul>
        </div>
        <div className="box" style={{flex: '1 1 280px', minWidth: 280}}>
          <div className="box-title">When to make a new sprite</div>
          <ul style={{margin: '8px 0 0 18px', padding: 0, lineHeight: 1.7, fontSize: 14}}>
            <li>Reused in <b>3+ encounters</b> across all of your dungeon prep</li>
            <li>Has a <b>top-down silhouette</b> that's legible at 50px</li>
            <li>Otherwise drop a labeled circle &amp; let the DM annotate</li>
          </ul>
        </div>
        <div className="box" style={{flex: '1 1 280px', minWidth: 280}}>
          <div className="box-title">What the runner adds on top</div>
          <ul style={{margin: '8px 0 0 18px', padding: 0, lineHeight: 1.7, fontSize: 14}}>
            <li>Tokens for <b>monsters</b> &amp; <b>party</b> (out-of-scope for this kit)</li>
            <li><b>Fog of war</b> overlay — 3 tones</li>
            <li><b>Light radius</b> ring around any sprite tagged <code>data-light="N"</code></li>
            <li><b>Auras</b> for spells, gas, fear — drawn at runtime, not as sprites</li>
          </ul>
        </div>
      </div>

      <div className="aside" style={{marginTop: 28}}>
        ↳ next: place a sample 30×20 dungeon room using ~12 of these sprites so you can
        sanity-check legibility at the actual table size. say the word and I'll add it to surface 26.
      </div>
    </div>
  );
}

