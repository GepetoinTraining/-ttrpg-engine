/**
 * GENESIS API ROUTER
 *
 * Serves precipitated HTML/CSS to the frontend viewport.
 * The frontend doesn't compute - it displays what we send.
 *
 * Key endpoint: genesis.world
 * Returns ONE complete HTML payload - the entire precipitated world.
 */

import { router, publicProcedure, campaignProcedure } from '../trpc';
import { z } from 'zod';
import { precipitateHTML, precipitateCustom, precipitateTree } from '../../genesis/precipitate';
import { atoms, molecules, forms, UI_PRIMES, VARIANT_PHYSICS, worldSurface, precipitateDbAtom, precipitateAlignmentGrid, abilityScoresChooser } from '../../genesis/atoms';
import { CHARACTER_ELEMENTS, RACE_TOPOLOGIES, CLASS_TOPOLOGIES } from '../../genesis/character';
import { getAtomsByType } from '../../db/queries/genesis';

// ============================================
// WORLD BUILDERS - Compose atoms → molecules → organisms → world
// ============================================

/**
 * Build the character creation world - FILLS THE VIEWPORT
 * Now uses DB-backed atoms for buttons with destinations.
 */
async function buildCharacterBuilderWorld(campaignId: string): Promise<string> {
  // Fetch DB atoms for this view
  const alignmentAtoms = await getAtomsByType('button', 'character-builder', campaignId);
  const alignmentButtons = alignmentAtoms.filter(a => a.id.startsWith('atom-btn-align-'));

  // Get action buttons
  const birthButton = alignmentAtoms.find(a => a.id === 'atom-btn-birth-character');
  const cancelButton = alignmentAtoms.find(a => a.id === 'atom-btn-cancel');
  const exitButton = alignmentAtoms.find(a => a.id === 'atom-btn-exit' || a.view === '*');

  // Get races and classes
  const races = Object.entries(RACE_TOPOLOGIES).map(([id]) => ({
    id: id.toLowerCase(),
    name: id.charAt(0) + id.slice(1).toLowerCase(),
  }));

  const classes = Object.entries(CLASS_TOPOLOGIES).map(([id]) => ({
    id: id.toLowerCase(),
    name: id.charAt(0) + id.slice(1).toLowerCase(),
  }));

  // Build race options
  const raceOptions = races.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

  // Build class options
  const classOptions = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  // Backgrounds
  const backgrounds = ['Acolyte', 'Criminal', 'Folk Hero', 'Noble', 'Sage', 'Soldier', 'Outlander', 'Entertainer'];
  const backgroundOptions = backgrounds.map(b => `<option value="${b.toLowerCase()}">${b}</option>`).join('');

  // Ability scores organism - uses the new abilityScoresChooser
  const abilityScoresSection = abilityScoresChooser('standard');

  // Starting equipment packages
  const equipmentSection = `
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 4px;">
        <input type="radio" name="equipment" value="pack-a" checked /> Equipment Pack A (Dungeoneer's Pack)
      </label>
      <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 4px;">
        <input type="radio" name="equipment" value="pack-b" /> Equipment Pack B (Explorer's Pack)
      </label>
      <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 4px;">
        <input type="radio" name="equipment" value="gold" /> Starting Gold (roll 5d4 × 10)
      </label>
    </div>
  `;

  // Full character creation form - FILLS VIEWPORT
  const content = `
    <div style="display: flex; flex-direction: column; width: 100%; height: 100%; padding: 1.5rem; box-sizing: border-box;">

      <!-- Header -->
      <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-shrink: 0;">
        <h1 style="margin: 0; font-size: 1.75rem; color: #f59e0b;">Create Character</h1>
        ${exitButton
          ? precipitateDbAtom(exitButton, campaignId)
          : `<button data-dest-type="event" data-dest="genesis:exit" style="background: transparent; border: 1px solid #475569; color: #94a3b8; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">Exit</button>`
        }
      </header>

      <!-- Main form - scrollable -->
      <form id="character-birth-form" style="display: flex; flex-wrap: wrap; gap: 1.5rem; flex: 1; overflow-y: auto; align-content: flex-start;">

        <!-- Column 1: Identity -->
        <section style="flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 1rem;">
          <h2 style="margin: 0; font-size: 1rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Identity</h2>

          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="font-size: 0.875rem; color: #e2e8f0;">Name</label>
            <input type="text" name="name" placeholder="Enter character name" required style="padding: 0.75rem; border: 1px solid #475569; border-radius: 6px; background: #1e293b; color: #f8fafc;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="font-size: 0.875rem; color: #e2e8f0;">Race</label>
            <select name="race" style="padding: 0.75rem; border: 1px solid #475569; border-radius: 6px; background: #1e293b; color: #f8fafc;">
              ${raceOptions}
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="font-size: 0.875rem; color: #e2e8f0;">Class</label>
            <select name="class" style="padding: 0.75rem; border: 1px solid #475569; border-radius: 6px; background: #1e293b; color: #f8fafc;">
              ${classOptions}
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="font-size: 0.875rem; color: #e2e8f0;">Background</label>
            <select name="background" style="padding: 0.75rem; border: 1px solid #475569; border-radius: 6px; background: #1e293b; color: #f8fafc;">
              ${backgroundOptions}
            </select>
          </div>
        </section>

        <!-- Column 2: Ability Scores - uses the organism -->
        <section style="flex: 1; min-width: 320px; display: flex; flex-direction: column; gap: 1rem;">
          <h2 style="margin: 0; font-size: 1rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Ability Scores</h2>
          ${abilityScoresSection}
        </section>

        <!-- Column 3: Equipment & Options -->
        <section style="flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 1rem;">
          <h2 style="margin: 0; font-size: 1rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Equipment</h2>

          ${equipmentSection}

          <h2 style="margin: 1rem 0 0; font-size: 1rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Alignment</h2>

          ${alignmentButtons.length > 0
            ? precipitateAlignmentGrid(alignmentButtons, campaignId)
            : `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
                <button type="button" data-dest-type="action" data-dest="setAlignment" data-dest-params='{"alignment":"lawful-good"}' style="padding: 0.5rem; border: 1px solid #475569; border-radius: 4px; background: #1e293b; color: #94a3b8; font-size: 0.7rem; cursor: pointer;">Lawful Good</button>
                <button type="button" data-dest-type="action" data-dest="setAlignment" data-dest-params='{"alignment":"neutral-good"}' style="padding: 0.5rem; border: 1px solid #475569; border-radius: 4px; background: #1e293b; color: #94a3b8; font-size: 0.7rem; cursor: pointer;">Neutral Good</button>
                <button type="button" data-dest-type="action" data-dest="setAlignment" data-dest-params='{"alignment":"chaotic-good"}' style="padding: 0.5rem; border: 1px solid #475569; border-radius: 4px; background: #1e293b; color: #94a3b8; font-size: 0.7rem; cursor: pointer;">Chaotic Good</button>
                <button type="button" data-dest-type="action" data-dest="setAlignment" data-dest-params='{"alignment":"lawful-neutral"}' style="padding: 0.5rem; border: 1px solid #475569; border-radius: 4px; background: #1e293b; color: #94a3b8; font-size: 0.7rem; cursor: pointer;">Lawful Neutral</button>
                <button type="button" data-dest-type="action" data-dest="setAlignment" data-dest-params='{"alignment":"true-neutral"}' style="padding: 0.5rem; border: 1px solid #f59e0b; border-radius: 4px; background: rgba(245,158,11,0.2); color: #f59e0b; font-size: 0.7rem; cursor: pointer;">True Neutral</button>
                <button type="button" data-dest-type="action" data-dest="setAlignment" data-dest-params='{"alignment":"chaotic-neutral"}' style="padding: 0.5rem; border: 1px solid #475569; border-radius: 4px; background: #1e293b; color: #94a3b8; font-size: 0.7rem; cursor: pointer;">Chaotic Neutral</button>
                <button type="button" data-dest-type="action" data-dest="setAlignment" data-dest-params='{"alignment":"lawful-evil"}' style="padding: 0.5rem; border: 1px solid #475569; border-radius: 4px; background: #1e293b; color: #94a3b8; font-size: 0.7rem; cursor: pointer;">Lawful Evil</button>
                <button type="button" data-dest-type="action" data-dest="setAlignment" data-dest-params='{"alignment":"neutral-evil"}' style="padding: 0.5rem; border: 1px solid #475569; border-radius: 4px; background: #1e293b; color: #94a3b8; font-size: 0.7rem; cursor: pointer;">Neutral Evil</button>
                <button type="button" data-dest-type="action" data-dest="setAlignment" data-dest-params='{"alignment":"chaotic-evil"}' style="padding: 0.5rem; border: 1px solid #475569; border-radius: 4px; background: #1e293b; color: #94a3b8; font-size: 0.7rem; cursor: pointer;">Chaotic Evil</button>
              </div>`
          }
        </section>

        <!-- Column 4: Backstory & Personality -->
        <section style="flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 1rem;">
          <h2 style="margin: 0; font-size: 1rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Personality</h2>

          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="font-size: 0.875rem; color: #e2e8f0;">Personality Traits</label>
            <textarea name="personality" rows="2" placeholder="Two personality traits..." style="padding: 0.75rem; border: 1px solid #475569; border-radius: 6px; background: #1e293b; color: #f8fafc; resize: vertical;"></textarea>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="font-size: 0.875rem; color: #e2e8f0;">Ideals</label>
            <textarea name="ideals" rows="2" placeholder="What drives you..." style="padding: 0.75rem; border: 1px solid #475569; border-radius: 6px; background: #1e293b; color: #f8fafc; resize: vertical;"></textarea>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="font-size: 0.875rem; color: #e2e8f0;">Bonds</label>
            <textarea name="bonds" rows="2" placeholder="Connections to people, places..." style="padding: 0.75rem; border: 1px solid #475569; border-radius: 6px; background: #1e293b; color: #f8fafc; resize: vertical;"></textarea>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="font-size: 0.875rem; color: #e2e8f0;">Flaws</label>
            <textarea name="flaws" rows="2" placeholder="Weaknesses, vices..." style="padding: 0.75rem; border: 1px solid #475569; border-radius: 6px; background: #1e293b; color: #f8fafc; resize: vertical;"></textarea>
          </div>
        </section>

      </form>

      <!-- Footer with submit -->
      <footer style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #334155; flex-shrink: 0;">
        ${cancelButton
          ? precipitateDbAtom(cancelButton, campaignId)
          : `<button type="button" data-dest-type="event" data-dest="genesis:exit" style="padding: 0.75rem 1.5rem; border: 1px solid #475569; border-radius: 6px; background: transparent; color: #94a3b8; cursor: pointer;">Cancel</button>`
        }
        ${birthButton
          ? precipitateDbAtom(birthButton, campaignId)
          : `<button type="submit" form="character-birth-form" data-dest-type="mutation" data-dest="character.birth" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: #f59e0b; color: #0f172a; font-weight: 600; cursor: pointer;">Birth Character</button>`
        }
      </footer>

    </div>
  `;

  // Wrap in WorldSurface - the timespace container
  return worldSurface(content, campaignId, 'character-builder');
}

/**
 * Build the main campaign world view
 */
function buildCampaignWorld(campaignId: string): string {
  // Build content with data-dest wiring for navigation
  const content = `
    <div style="max-width: 1200px; margin: 0 auto; padding: 2rem;">
      <header style="margin-bottom: 2rem;">
        ${atoms.heading('Campaign Dashboard', 1)}
      </header>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
        ${molecules.card([
          atoms.heading('Characters', 3),
          atoms.text('Manage your party members', 'muted'),
          atoms.button('View Characters', 'secondary', { 'data-dest-type': 'route', 'data-dest': 'campaign-characters' })
        ], 'elevated')}

        ${molecules.card([
          atoms.heading('World', 3),
          atoms.text('Explore regions and locations', 'muted'),
          atoms.button('View World', 'secondary', { 'data-dest-type': 'route', 'data-dest': 'campaign-world' })
        ], 'elevated')}

        ${molecules.card([
          atoms.heading('Session', 3),
          atoms.text('Start or continue a session', 'muted'),
          atoms.button('Enter Session', 'primary', { 'data-dest-type': 'route', 'data-dest': 'campaign-session' })
        ], 'elevated')}
      </div>

      <footer style="margin-top: 3rem; text-align: center;">
        <button data-dest-type="event" data-dest="genesis:exit" style="background: transparent; border: 1px solid #475569; color: #94a3b8; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer;">
          Exit to Campaigns
        </button>
      </footer>
    </div>
  `;

  // Wrap in WorldSurface
  return worldSurface(content, campaignId, 'campaign');
}

/**
 * Build the session world (gameplay viewport)
 */
function buildSessionWorld(campaignId: string): string {
  // Build content
  const content = `
    <div style="display: flex; flex-direction: column; min-height: 100vh;">
      <header style="padding: 1rem 2rem; border-bottom: 1px solid #475569; display: flex; justify-content: space-between; align-items: center;">
        ${atoms.heading('Session', 2)}
        <button data-dest-type="event" data-dest="genesis:exit" style="background: transparent; border: 1px solid #475569; color: #94a3b8; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">
          Exit
        </button>
      </header>

      <main style="flex: 1; padding: 2rem; max-width: 800px; margin: 0 auto;">
        ${molecules.card([
          atoms.heading('The Yawning Portal', 2),
          atoms.text('The famous tavern in Waterdeep. Adventurers gather around tables, and the massive well in the center descends into Undermountain.'),
          atoms.text('Warm firelight, the clink of mugs, and distant rumbles from below.', 'muted'),
        ], 'glass')}

        <div style="margin-top: 2rem;">
          ${atoms.heading('Present', 4)}
          <ul style="list-style: none; padding: 0; margin: 0.5rem 0;">
            <li style="padding: 0.5rem 0; color: #94a3b8;">Durnan</li>
            <li style="padding: 0.5rem 0; color: #94a3b8;">A mysterious cloaked figure</li>
          </ul>
        </div>
      </main>

      <footer style="padding: 1rem 2rem; border-top: 1px solid #1e293b; background: linear-gradient(to top, #0a0a0f, transparent);">
        <div style="max-width: 800px; margin: 0 auto; display: flex; gap: 1rem;">
          ${atoms.input('What do you do?', 'default', { name: 'action', style: 'flex: 1;' })}
          ${atoms.button('Act', 'primary', { 'data-dest-type': 'mutation', 'data-dest': 'session.act' })}
        </div>
      </footer>
    </div>
  `;

  // Wrap in WorldSurface
  return worldSurface(content, campaignId, 'session');
}

// ============================================
// GENESIS ROUTER
// ============================================

export const genesisRouter = router({
  /**
   * THE WORLD ENDPOINT
   * Returns ONE complete precipitated HTML payload.
   * This is what the viewport receives and displays.
   */
  world: publicProcedure
    .input(z.object({
      campaignId: z.string(),
      view: z.enum(['world', 'character-builder', 'session']).optional().default('world'),
    }))
    .query(async ({ input }) => {
      const { campaignId, view } = input;

      let html: string;

      switch (view) {
        case 'character-builder':
          html = await buildCharacterBuilderWorld(campaignId);
          break;
        case 'session':
          html = buildSessionWorld(campaignId);
          break;
        case 'world':
        default:
          html = buildCampaignWorld(campaignId);
          break;
      }

      return { html, view, campaignId };
    }),

  /**
   * Precipitate a single atom
   */
  atom: publicProcedure
    .input(z.object({
      component: z.string(),
      content: z.string().optional().default(''),
      variant: z.string().optional().default('default'),
    }))
    .query(({ input }) => {
      const { component, content, variant } = input;

      const seed = UI_PRIMES[component as keyof typeof UI_PRIMES];
      if (!seed) {
        return { html: '', error: `Unknown component: ${component}` };
      }

      const html = atoms.atom(component as keyof typeof UI_PRIMES, content, { variant });
      return { html, seed: seed.toString() };
    }),

  /**
   * Precipitate a button
   */
  button: publicProcedure
    .input(z.object({
      label: z.string(),
      variant: z.enum(['primary', 'secondary', 'ghost', 'danger', 'disabled']).optional().default('primary'),
    }))
    .query(({ input }) => {
      const html = atoms.button(input.label, input.variant);
      return { html };
    }),

  /**
   * Precipitate an input field
   */
  input: publicProcedure
    .input(z.object({
      placeholder: z.string().optional().default(''),
      name: z.string(),
      type: z.string().optional().default('text'),
      label: z.string().optional(),
    }))
    .query(({ input }) => {
      if (input.label) {
        const html = atoms.field(input.label, input.name, {
          type: input.type,
          placeholder: input.placeholder,
        });
        return { html };
      }

      const html = atoms.input(input.placeholder, 'default', {
        name: input.name,
        type: input.type,
      });
      return { html };
    }),

  /**
   * Precipitate a card
   */
  card: publicProcedure
    .input(z.object({
      content: z.union([z.string(), z.array(z.string())]),
      variant: z.enum(['default', 'elevated', 'floating', 'glass']).optional().default('default'),
    }))
    .query(({ input }) => {
      const html = molecules.card(input.content, input.variant);
      return { html };
    }),

  /**
   * Get available components and their primes
   */
  components: publicProcedure
    .query(() => {
      const components = Object.entries(UI_PRIMES).map(([name, seed]) => ({
        name,
        seed: seed.toString(),
        variants: Object.keys(VARIANT_PHYSICS[name] || { default: {} }),
      }));

      return { components };
    }),

  /**
   * Get available races for character creation
   */
  races: publicProcedure
    .query(() => {
      const races = Object.entries(RACE_TOPOLOGIES).map(([id, topology]) => ({
        id: id.toLowerCase(),
        name: id.charAt(0) + id.slice(1).toLowerCase(),
        prime: CHARACTER_ELEMENTS[id as keyof typeof CHARACTER_ELEMENTS],
        topology,
      }));

      return { races };
    }),

  /**
   * Get available classes for character creation
   */
  classes: publicProcedure
    .query(() => {
      const classes = Object.entries(CLASS_TOPOLOGIES).map(([id, topology]) => ({
        id: id.toLowerCase(),
        name: id.charAt(0) + id.slice(1).toLowerCase(),
        prime: CHARACTER_ELEMENTS[id as keyof typeof CHARACTER_ELEMENTS],
        topology,
      }));

      return { classes };
    }),

  /**
   * Precipitate the character builder form
   */
  characterBuilder: campaignProcedure
    .query(async ({ ctx }) => {
      // Get races and classes
      const races = Object.entries(RACE_TOPOLOGIES).map(([id]) => ({
        id: id.toLowerCase(),
        name: id.charAt(0) + id.slice(1).toLowerCase(),
      }));

      const classes = Object.entries(CLASS_TOPOLOGIES).map(([id]) => ({
        id: id.toLowerCase(),
        name: id.charAt(0) + id.slice(1).toLowerCase(),
      }));

      const html = forms.characterBuilder(races, classes);

      return {
        html,
        campaignId: ctx.campaignId,
      };
    }),

  /**
   * Precipitate a custom seed
   */
  precipitate: publicProcedure
    .input(z.object({
      seed: z.string(), // BigInt as string
      content: z.string().optional().default(''),
      tag: z.string().optional().default('div'),
      physics: z.object({
        mass: z.number().optional(),
        density: z.number().optional(),
        temperature: z.number().optional(),
        charge: z.number().optional(),
        friction: z.number().optional(),
        pressure: z.number().optional(),
        buoyancy: z.number().optional(),
      }).optional(),
    }))
    .query(({ input }) => {
      const seed = BigInt(input.seed);

      if (input.physics) {
        const html = precipitateCustom(seed, input.physics, input.content, input.tag);
        return { html, seed: seed.toString() };
      }

      const html = precipitateHTML(seed, input.tag, input.content);
      return { html, seed: seed.toString() };
    }),

  /**
   * Precipitate a tree of components
   */
  tree: publicProcedure
    .input(z.object({
      rootSeed: z.string(),
      children: z.array(z.object({
        seed: z.string(),
        content: z.string(),
      })),
    }))
    .query(({ input }) => {
      const rootSeed = BigInt(input.rootSeed);
      const children = input.children.map(c => ({
        seed: BigInt(c.seed),
        content: c.content,
      }));

      const html = precipitateTree(rootSeed, children);
      return { html, rootSeed: rootSeed.toString() };
    }),
});
