#!/usr/bin/env ts-node
/**
 * EXTRACT COMPONENTS
 *
 * Run this script to extract all component definitions into:
 * - data/topology.json   - Seeds and physics for precipitation
 * - data/relations.json  - Graph structure for relational queries
 * - data/vectors.json    - Documents for semantic embedding
 *
 * Usage: npx ts-node bend/src/genesis/extract-components.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { extractAll, COMPONENT_LEVELS, type VariantConfig } from './extractor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// IMPORT DEFINITIONS FROM FEND
// We'll inline the PRIMES and DEFINITIONS here
// since we can't import TSX from a TS script easily
// ============================================

const PRIMES: Record<string, number> = {
  // Atomic
  Text: 3,
  Button: 2,
  Input: 5,
  Icon: 7,
  Avatar: 11,
  Spinner: 13,
  Badge: 21,
  Pill: 21,
  Link: 14,
  ProgressDot: 13,

  // User roles
  UserGM: 22,
  UserPlayer: 55,
  UserNPC: 77,

  // Molecular
  Surface: 9,
  Card: 6,
  Form: 15,
  RoleCard: 33,
  FlipCard: 12,

  // Organism
  Navbar: 42,
  Modal: 18,
  Sidebar: 27,
  Shell: 54,
  OnboardingContainer: 54,
  OnboardingCard: 33,

  // 3D Primitives
  Scatter3D: 77,
  CubeChart: 49,
  SurfacePlot: 63,
  Pyramid: 91,
  Prism: 35,
  Orb: 143,

  // Combat
  Token: 35,
  GridCell: 9,

  // Campaign
  CampaignIcon: 33,
  CampaignStat: 21,
  CampaignCard: 66,
  CampaignGrid: 27,
  EmptyState: 9,

  // World
  WorldBrowser: 42,
  WorldNode: 21,
  SettingsPicker: 15,
  SettingToggle: 10,

  // Alignment
  AlignmentOrb: 143,

  // Builders
  TerrainPicker: 149,
  ClimateSelector: 151,
  RegionSize: 151,
  GovernmentType: 157,
  EconomyType: 163,
  PopulationEditor: 167,
  FeatureTags: 173,
  EdgeConnector: 179,
  AbilityScoreRoller: 199,
  RacePicker: 211,
  ClassPicker: 223,
  BackgroundPicker: 227,
};

// Simplified definitions (we'll read the full ones from the actual file)
// For now, create representative samples
const DEFINITIONS: Record<string, Record<string, VariantConfig>> = {
  Button: {
    primary: {
      physics: { mass: 0.7, density: 'solid', temperature: 'hot', friction: 0.2, charge: 0.5 },
    },
    secondary: {
      physics: { mass: 0.5, density: 'solid', temperature: 'warm', friction: 0.3, charge: 0.4 },
    },
    ghost: {
      physics: { mass: 0.3, density: 'gas', temperature: 'cold', friction: 0.2, charge: 0.3 },
    },
    danger: {
      physics: { mass: 0.7, density: 'solid', temperature: 'critical', friction: 0.2, charge: 0.5 },
    },
    disabled: {
      physics: { mass: 0.2, density: 'gas', temperature: 'cold', friction: 0.8, charge: 0.3 },
    },
  },
  Card: {
    default: {
      physics: { mass: 0.6, density: 'solid', temperature: 'cold', charge: 0.5, friction: 0.3 },
    },
    elevated: {
      physics: { mass: 0.8, density: 'dense', temperature: 'cold', charge: 0.6, friction: 0.3 },
    },
    floating: {
      physics: { mass: -0.3, density: 'liquid', temperature: 'warm', charge: 0.5, friction: 0.2 },
    },
    glass: {
      physics: { mass: 0.4, density: 'liquid', temperature: 'cold', charge: 0.4, friction: 0.3 },
    },
  },
  Input: {
    default: {
      physics: { mass: 0.4, density: 'solid', temperature: 'cold', charge: 0.4, friction: 0.3 },
    },
    focused: {
      physics: { mass: 0.5, density: 'solid', temperature: 'warm', charge: 0.4, friction: 0.2 },
    },
    error: {
      physics: { mass: 0.5, density: 'solid', temperature: 'critical', charge: 0.4, friction: 0.3 },
    },
    disabled: {
      physics: { mass: 0.2, density: 'gas', temperature: 'cold', charge: 0.3, friction: 0.8 },
    },
  },
  Badge: {
    default: { physics: { mass: 0.3, density: 'solid', temperature: 'cold', charge: 0.2 } },
    success: { physics: { mass: 0.4, density: 'solid', temperature: 'warm', charge: 0.2 } },
    warning: { physics: { mass: 0.4, density: 'solid', temperature: 'hot', charge: 0.2 } },
    error: { physics: { mass: 0.4, density: 'solid', temperature: 'critical', charge: 0.2 } },
  },
  Link: {
    default: { physics: { mass: 0.382, density: 'gas', temperature: 'warm', charge: 0.3, friction: 0.2 } },
    muted: { physics: { mass: 0.3, density: 'gas', temperature: 'cold', charge: 0.2, friction: 0.3 } },
    action: { physics: { mass: 0.5, density: 'liquid', temperature: 'hot', charge: 0.4, friction: 0.2 } },
  },
  Orb: {
    default: {
      physics: { mass: 0.4, density: 'void', temperature: 'fusion', charge: 0.6, friction: 0.1 },
      prime: 143,
      material: 'void',
    },
    pulsing: {
      physics: { mass: 0.5, density: 'gas', temperature: 'critical', charge: 0.7, friction: 0.1 },
      prime: 143,
      material: 'plasma',
    },
  },
  AlignmentOrb: {
    lawful_good: {
      physics: { mass: 0.7, density: 'solid', temperature: 'hot', charge: 0.8, friction: 0.1 },
      prime: 143,
      material: 'plasma',
    },
    neutral_good: {
      physics: { mass: 0.5, density: 'liquid', temperature: 'warm', charge: 0.7, friction: 0.2 },
      prime: 143,
      material: 'liquid',
    },
    chaotic_good: {
      physics: { mass: 0.3, density: 'gas', temperature: 'hot', charge: 0.9, friction: 0.05 },
      prime: 143,
      material: 'plasma',
    },
    lawful_neutral: {
      physics: { mass: 0.6, density: 'solid', temperature: 'cold', charge: 0.5, friction: 0.3 },
      prime: 143,
      material: 'solid',
    },
    true_neutral: {
      physics: { mass: 0.5, density: 'liquid', temperature: 'cold', charge: 0.5, friction: 0.5 },
      prime: 143,
      material: 'liquid',
    },
    chaotic_neutral: {
      physics: { mass: 0.4, density: 'void', temperature: 'warm', charge: 0.6, friction: 0.1 },
      prime: 143,
      material: 'gas',
    },
    lawful_evil: {
      physics: { mass: 0.8, density: 'dense', temperature: 'critical', charge: 0.7, friction: 0.2 },
      prime: 143,
      material: 'dense',
    },
    neutral_evil: {
      physics: { mass: 0.6, density: 'liquid', temperature: 'cold', charge: 0.6, friction: 0.3 },
      prime: 143,
      material: 'liquid',
    },
    chaotic_evil: {
      physics: { mass: 0.9, density: 'void', temperature: 'critical', charge: 0.9, friction: 0.0 },
      prime: 143,
      material: 'plasma',
    },
  },
  CampaignCard: {
    default: {
      physics: { mass: 0.6, density: 'solid', temperature: 'cold', charge: 0.5, friction: 0.25 },
      prime: 66,
    },
    hover: {
      physics: { mass: -0.15, density: 'solid', temperature: 'warm', charge: 0.5, friction: 0.2 },
      prime: 66,
    },
    active: {
      physics: { mass: 0.5, density: 'solid', temperature: 'hot', charge: 0.6, friction: 0.15 },
      prime: 66,
    },
  },
  WorldNode: {
    default: {
      physics: { mass: 0.5, density: 'solid', temperature: 'cold', charge: 0.4, friction: 0.3 },
      prime: 21,
    },
    hover: {
      physics: { mass: 0.4, density: 'solid', temperature: 'warm', charge: 0.5, friction: 0.2 },
      prime: 21,
    },
    selected: {
      physics: { mass: 0.6, density: 'solid', temperature: 'hot', charge: 0.6, friction: 0.2 },
      prime: 21,
    },
    cosmic: {
      physics: { mass: 0.8, density: 'void', temperature: 'fusion', charge: 0.7, friction: 0.1 },
      prime: 21,
      material: 'plasma',
    },
  },
  UserGM: {
    default: {
      physics: { mass: 0.8, density: 'solid', temperature: 'hot', charge: 0.7, friction: 0.2 },
    },
    active: {
      physics: { mass: 0.9, density: 'dense', temperature: 'critical', charge: 0.8, friction: 0.15 },
    },
  },
  UserPlayer: {
    default: {
      physics: { mass: 0.6, density: 'solid', temperature: 'warm', charge: 0.5, friction: 0.3 },
    },
    active: {
      physics: { mass: 0.7, density: 'solid', temperature: 'hot', charge: 0.6, friction: 0.2 },
    },
  },
  UserNPC: {
    default: {
      physics: { mass: 0.4, density: 'liquid', temperature: 'cold', charge: 0.3, friction: 0.4 },
    },
    active: {
      physics: { mass: 0.5, density: 'solid', temperature: 'warm', charge: 0.4, friction: 0.3 },
    },
  },
  Token: {
    default: { physics: { mass: 0.6, density: 'solid', temperature: 'cold', friction: 0.3 } },
    selected: { physics: { mass: 0.7, density: 'solid', temperature: 'hot', friction: 0.2 } },
    targeted: { physics: { mass: 0.6, density: 'solid', temperature: 'critical', friction: 0.3 } },
    dead: { physics: { mass: 0.2, density: 'gas', temperature: 'cold', friction: 0.8 } },
  },
  Scatter3D: {
    default: {
      physics: { mass: 0.3, density: 'void', temperature: 'warm', charge: 0.2, friction: 0.1 },
      prime: 77,
      material: 'void',
    },
  },
  CubeChart: {
    default: {
      physics: { mass: 0.7, density: 'dense', temperature: 'warm', charge: 0.5, friction: 0.3 },
      prime: 49,
      material: 'dense',
    },
  },
  Prism: {
    default: {
      physics: { mass: 0.5, density: 'solid', temperature: 'warm', charge: 0.4, friction: 0.3 },
      prime: 35,
      material: 'solid',
    },
  },
};

// ============================================
// MAIN
// ============================================

function main() {
  console.log('Extracting components...\n');

  const { topologies, relations, vectors } = extractAll(DEFINITIONS, PRIMES, COMPONENT_LEVELS);

  // Ensure data directory exists
  const dataDir = path.join(__dirname, '..', '..', '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write topology JSON
  const topologyPath = path.join(dataDir, 'topology.json');
  fs.writeFileSync(topologyPath, JSON.stringify(topologies, null, 2));
  console.log(`Wrote ${topologies.length} topology records to ${topologyPath}`);

  // Write relations JSON
  const relationsPath = path.join(dataDir, 'relations.json');
  fs.writeFileSync(relationsPath, JSON.stringify(relations, null, 2));
  console.log(`Wrote ${relations.length} relation records to ${relationsPath}`);

  // Write vectors JSON
  const vectorsPath = path.join(dataDir, 'vectors.json');
  fs.writeFileSync(vectorsPath, JSON.stringify(vectors, null, 2));
  console.log(`Wrote ${vectors.length} vector documents to ${vectorsPath}`);

  console.log('\nExtraction complete!');
  console.log('\nNext steps:');
  console.log('1. Import topology.json into PostgreSQL lattice_cache');
  console.log('2. Import relations.json into PostgreSQL component graph');
  console.log('3. Generate embeddings from vectors.json and load into vector DB');
}

main();
