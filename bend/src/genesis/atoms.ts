/**
 * ATOMS - UI Component Factory
 *
 * Creates UI atoms from topology seeds.
 * Each atom is a prime number. Composites are products.
 *
 * Usage:
 *   const button = atom('Button', 'primary', 'Click me');
 *   const form = molecule('Form', [racePickerAtom, classPickerAtom]);
 */

import { precipitateHTML, precipitateTree, precipitateCustom, type PhysicsState } from './precipitate';
import type { GenesisAtom } from '../db/queries/genesis';

// ============================================
// UI COMPONENT PRIMES
// ============================================

export const UI_PRIMES = {
  // Atomic (base primes)
  Button: 2n,
  Text: 3n,
  Input: 5n,
  Icon: 7n,
  Avatar: 11n,
  Spinner: 13n,
  Divider: 17n,
  Badge: 19n,
  Label: 23n,

  // Molecules (products of atomic primes)
  // AbilityScore = Label × Input × Text = 23 × 5 × 3 = 345 (label + editable value + derived modifier)
  AbilityScore: 345n,
  // DicePool = Text × Badge = 3 × 19 = 57 (shows dice results)
  DicePool: 57n,

  // Organisms (products of molecules)
  // AbilityChooser = Card × Form = 6 × 15 = 90 (tabbed card with form)
  AbilityChooser: 90n,

  // Character builder primes (higher primes - legacy)
  RacePicker: 211n,
  ClassPicker: 223n,
  BackgroundPicker: 227n,
  AlignmentOrb: 229n,
  EquipmentSelector: 233n,
  SpellSelector: 239n,
  SkillPicker: 241n,

  // World builder primes
  TerrainPicker: 251n,
  ClimatePicker: 257n,
  GovernmentPicker: 263n,
  EconomyPicker: 269n,
  PopulationEditor: 271n,
  FactionSeeder: 277n,
  SettlementSeeder: 281n,

  // Layout primes
  Surface: 9n,      // Text² = 3×3 - THE TIMESPACE CONTAINER
  Card: 6n,         // Button×Text = 2×3
  Form: 15n,        // Text×Input = 3×5
  Modal: 18n,       // Button×Surface = 2×9
  Sidebar: 27n,     // Text³ = 3×3×3
  Navbar: 42n,      // Button×Text×Icon = 2×3×7

  // The World Surface - where reality precipitates
  // Surface × Surface = 9 × 9 = 81 (timespace²)
  WorldSurface: 81n,
} as const;

// ============================================
// VARIANT PHYSICS DEFINITIONS
// ============================================

export const VARIANT_PHYSICS: Record<string, Record<string, Partial<PhysicsState>>> = {
  // THE WORLD SURFACE - timespace container (handled separately, not precipitated)
  WorldSurface: {
    default: { mass: 0, density: 0, temperature: 0.1, charge: 0, friction: 0, pressure: 1, buoyancy: 1 },
  },
  // Surface - transparent container, stacks children vertically, fills width
  Surface: {
    default: { mass: 0.08, density: 0.3, temperature: 0.2, friction: 0.1, pressure: 0.8, buoyancy: 1 },
    void: { mass: 0, density: 0, temperature: 0, friction: 0, pressure: 1, buoyancy: 1 },
  },
  // Buttons - compact inline elements (pressure < 0.5)
  // All variants specify density to prevent bloated padding from seed factorization
  Button: {
    primary:  { mass: 0.8, density: 0.7, temperature: 0.8, friction: 0.2, pressure: 0.3, buoyancy: 0 },
    secondary:{ mass: 0.45, density: 0.7, temperature: 0.4, friction: 0.3, pressure: 0.3, buoyancy: 0 },
    ghost:    { mass: 0, density: 0.7, temperature: 0.3, friction: 0.2, pressure: 0.3, buoyancy: 0 },
    danger:   { mass: 0.8, density: 0.7, temperature: 0.95, friction: 0.2, pressure: 0.3, buoyancy: 0 },
    disabled: { mass: 0.15, density: 0.7, temperature: 0.2, friction: 0.8, pressure: 0.3, buoyancy: 0 },
    selected: { mass: 0.7, density: 0.7, temperature: 0.7, friction: 0.2, pressure: 0.3, buoyancy: 0 },
  },
  // Inputs - fill width (pressure > 0.5), row layout
  Input: {
    default:  { mass: 0.3, density: 0.65, temperature: 0.2, friction: 0.3, pressure: 0.8, buoyancy: 0 },
    focused:  { mass: 0.4, density: 0.65, temperature: 0.4, friction: 0.2, pressure: 0.8, buoyancy: 0 },
    error:    { mass: 0.4, density: 0.65, temperature: 0.9, friction: 0.3, pressure: 0.8, buoyancy: 0 },
    disabled: { mass: 0.15, density: 0.65, temperature: 0.2, friction: 0.8, pressure: 0.8, buoyancy: 0 },
  },
  // Cards - stack children vertically (buoyancy > 0.5), fill width
  Card: {
    default:  { mass: 0.5, density: 0.5, temperature: 0.25, pressure: 0.8, buoyancy: 1 },
    elevated: { mass: 0.7, density: 0.5, temperature: 0.25, pressure: 0.8, buoyancy: 1 },
    floating: { mass: 0.2, density: 0.45, temperature: 0.2, pressure: 0.8, buoyancy: 1 },
    glass:    { mass: 0.15, density: 0.45, temperature: 0.2, friction: 0.3, pressure: 0.8, buoyancy: 1 },
  },
  // Badges - compact inline, visible background
  Badge: {
    default:  { mass: 0.5, density: 0.8, temperature: 0.3, pressure: 0.5, buoyancy: 0 },
    success:  { mass: 0.5, density: 0.8, temperature: 0.45, pressure: 0.5, buoyancy: 0 },
    warning:  { mass: 0.5, density: 0.8, temperature: 0.7, pressure: 0.5, buoyancy: 0 },
    error:    { mass: 0.5, density: 0.8, temperature: 0.95, pressure: 0.5, buoyancy: 0 },
    info:     { mass: 0.4, density: 0.8, temperature: 0.35, pressure: 0.5, buoyancy: 0 },
  },
  // Text - transparent (mass 0), minimal padding (high density)
  // Temperature < 0.25 → muted color, >= 0.25 → bright color
  Text: {
    default:  { mass: 0, density: 0.95, temperature: 0.3, pressure: 0.3, buoyancy: 0 },
    heading:  { mass: 0, density: 0.9, temperature: 0.4, pressure: 0.8, buoyancy: 0 },
    muted:    { mass: 0, density: 0.95, temperature: 0.2, pressure: 0.3, buoyancy: 0 },
    label:    { mass: 0, density: 0.9, temperature: 0.2, pressure: 0.3, buoyancy: 0 },
  },
  // Form - transparent horizontal container, wraps children
  Form: {
    default: { mass: 0, density: 0.5, temperature: 0.2, charge: 0, pressure: 1, buoyancy: 0 },
  },
  // Field - transparent vertical container for label + input
  Field: {
    default: { mass: 0, density: 0.6, temperature: 0.2, charge: 0, pressure: 0.4, buoyancy: 1 },
  },
  // AbilityScore molecule (345 = 23×5×3) - vertical stack
  AbilityScore: {
    default: { mass: 0.3, density: 0.6, temperature: 0.25, charge: 0, pressure: 0.3, buoyancy: 1 },
  },
  // DicePool molecule (57 = 3×19) - horizontal row of dice badges
  DicePool: {
    default: { mass: 0, density: 0.55, temperature: 0.3, charge: 0, pressure: 0.4, buoyancy: 0 },
  },
  // AbilityChooser organism (90 = 6×15) - tabbed card, fills width
  AbilityChooser: {
    default: { mass: 0.4, density: 0.5, temperature: 0.25, charge: 0, pressure: 0.9, buoyancy: 1 },
  },
};

// ============================================
// ATOM FACTORY
// ============================================

export interface AtomOptions {
  variant?: string;
  tag?: string;
  physics?: Partial<PhysicsState>;
  attrs?: Record<string, string>;
}

/**
 * Create a single UI atom
 */
export function atom(
  component: keyof typeof UI_PRIMES,
  content: string = '',
  options: AtomOptions = {}
): string {
  const seed = UI_PRIMES[component];
  const { variant = 'default', tag = 'div', physics: customPhysics, attrs = {} } = options;

  // Get variant physics
  const variantPhysics = VARIANT_PHYSICS[component]?.[variant] ?? {};
  const mergedPhysics = { ...variantPhysics, ...customPhysics };

  // Build attributes string
  const attrString = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

  // Precipitate with custom physics
  if (Object.keys(mergedPhysics).length > 0) {
    const html = precipitateCustom(seed, mergedPhysics, content, tag);
    // Inject additional attributes
    if (attrString) {
      return html.replace(`<${tag}`, `<${tag} ${attrString}`);
    }
    return html;
  }

  const html = precipitateHTML(seed, tag, content);
  if (attrString) {
    return html.replace(`<${tag}`, `<${tag} ${attrString}`);
  }
  return html;
}

/**
 * Create a button atom
 */
export function button(label: string, variant: string = 'primary', attrs: Record<string, string> = {}): string {
  return atom('Button', label, { variant, tag: 'button', attrs });
}

/**
 * Create an input atom
 */
export function input(placeholder: string = '', variant: string = 'default', attrs: Record<string, string> = {}): string {
  return atom('Input', '', {
    variant,
    tag: 'input',
    attrs: { placeholder, type: 'text', ...attrs }
  });
}

/**
 * Create a text atom
 */
export function text(content: string, variant: string = 'default', tag: string = 'span'): string {
  return atom('Text', content, { variant, tag });
}

/**
 * Create a label atom
 */
export function label(content: string, forId?: string): string {
  const attrs: Record<string, string> = forId ? { for: forId } : {};
  return atom('Label', content, { tag: 'label', attrs });
}

/**
 * Create a heading
 */
export function heading(content: string, level: 1 | 2 | 3 | 4 | 5 | 6 = 1): string {
  return atom('Text', content, { variant: 'heading', tag: `h${level}` });
}

/**
 * Create a badge atom
 */
export function badge(content: string, variant: string = 'default'): string {
  return atom('Badge', content, { variant });
}

// ============================================
// MOLECULE FACTORY
// ============================================

export interface MoleculeChild {
  seed: bigint;
  content: string;
  physics?: Partial<PhysicsState>;
}

/**
 * Create a molecule from multiple atoms
 */
export function molecule(
  component: keyof typeof UI_PRIMES,
  children: (string | MoleculeChild)[],
  _options: AtomOptions = {}
): string {
  const seed = UI_PRIMES[component];

  // Normalize children
  const normalizedChildren: MoleculeChild[] = children.map(child => {
    if (typeof child === 'string') {
      return { seed: 3n, content: child }; // Default to Text prime
    }
    return child;
  });

  return precipitateTree(seed, normalizedChildren.map(c => ({
    seed: c.seed,
    content: c.content
  })));
}

/**
 * Create a card molecule
 */
export function card(content: string | string[], variant: string = 'default'): string {
  const children = Array.isArray(content) ? content : [content];
  return molecule('Card', children, { variant });
}

/**
 * Create a form molecule
 */
export function form(fields: string[], attrs: Record<string, string> = {}): string {
  const children = fields.map(f => ({ seed: 5n, content: f }));
  const html = precipitateTree(UI_PRIMES.Form, children);

  // Wrap in form tag with attributes
  const attrString = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

  return `<form ${attrString}>${html}</form>`;
}

// ============================================
// FORM FIELD HELPERS
// ============================================

/**
 * Create a labeled input field
 */
export function field(
  labelText: string,
  inputName: string,
  options: {
    type?: string;
    placeholder?: string;
    required?: boolean;
    variant?: string;
  } = {}
): string {
  const { type = 'text', placeholder = '', required = false, variant = 'default' } = options;
  const id = `field-${inputName}`;

  const labelHtml = label(labelText, id);
  const inputHtml = input(placeholder, variant, {
    id,
    name: inputName,
    type,
    ...(required ? { required: 'required' } : {})
  });

  // Wrap in field container
  return precipitateCustom(
    15n, // Form prime
    { mass: 0.3, density: 0.4, charge: 0.3 },
    `${labelHtml}\n${inputHtml}`,
    'div'
  );
}

/**
 * Create a select dropdown
 */
export function select(
  name: string,
  options: { value: string; label: string }[],
  attrs: Record<string, string> = {}
): string {
  const optionsHtml = options
    .map(opt => `<option value="${opt.value}">${opt.label}</option>`)
    .join('\n');

  const attrString = Object.entries({ name, ...attrs })
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

  return precipitateCustom(
    5n, // Input prime
    { mass: 0.4, density: 0.6, temperature: 0.3 },
    optionsHtml,
    'select'
  ).replace('<select', `<select ${attrString}`);
}

// ============================================
// CHARACTER BUILDER ATOMS
// ============================================

/**
 * Create a race picker atom
 */
export function racePicker(races: { id: string; name: string }[]): string {
  const options = races.map(r => ({ value: r.id, label: r.name }));
  const selectHtml = select('race', options);

  return precipitateCustom(
    UI_PRIMES.RacePicker,
    { mass: 0.5, density: 0.6, temperature: 0.4 },
    `${label('Race', 'race')}\n${selectHtml}`,
    'div'
  );
}

/**
 * Create a class picker atom
 */
export function classPicker(classes: { id: string; name: string }[]): string {
  const options = classes.map(c => ({ value: c.id, label: c.name }));
  const selectHtml = select('class', options);

  return precipitateCustom(
    UI_PRIMES.ClassPicker,
    { mass: 0.6, density: 0.6, temperature: 0.6 },
    `${label('Class', 'class')}\n${selectHtml}`,
    'div'
  );
}

// ============================================
// ABILITY SCORE SYSTEM
// Atoms → Molecules → Organisms
// ============================================

/**
 * Derive modifier from ability value
 * This is THE formula: floor((value - 10) / 2)
 */
export function deriveModifier(value: number): number {
  return Math.floor((value - 10) / 2);
}

/**
 * Format modifier as string (+2, -1, +0)
 */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * ATOM: Ability modifier display
 * Seed: Text (3) - it's just derived text
 */
export function abilityModifier(value: number): string {
  const mod = deriveModifier(value);
  const modStr = formatModifier(mod);

  // Color based on modifier: negative=cold, zero=neutral, positive=warm
  const temp = mod < 0 ? 0.2 : mod === 0 ? 0.5 : 0.8;

  return precipitateCustom(
    UI_PRIMES.Text,
    { mass: 0.4, density: 0.6, temperature: temp, pressure: 0.2 },
    modStr,
    'span'
  );
}

/**
 * MOLECULE: Complete ability score display
 * Seed: 345 = Label(23) × Input(5) × Text(3)
 * Shows: [STR] [15] [+2] in vertical stack
 *
 * NOT using precipitateCustom for the container - we need precise control
 * to avoid the Φ tensor applying unwanted backgrounds
 */
export function abilityScore(
  ability: string,
  value: number = 10,
  options: { editable?: boolean; name?: string } = {}
): string {
  const { editable = true, name } = options;
  const abbrev = ability.substring(0, 3).toUpperCase();
  const fieldName = name || ability.toLowerCase();
  const mod = deriveModifier(value);
  const modStr = formatModifier(mod);

  // Color modifier based on value: negative=red, zero=gray, positive=green
  const modColor = mod < 0 ? '#ef4444' : mod === 0 ? '#64748b' : '#22c55e';

  // Build molecule with inline styles - vertical stack, centered
  return `
    <div data-seed="345" data-ability="${ability.toLowerCase()}"
         style="display: flex; flex-direction: column; align-items: center; padding: 0.75rem; background: rgba(0,0,0,0.3); border-radius: 8px; gap: 0.25rem;">
      <span style="font-size: 0.75rem; font-weight: 600; color: #94a3b8; letter-spacing: 0.05em;">${abbrev}</span>
      ${editable
        ? `<input type="number" name="${fieldName}" value="${value}" min="3" max="20"
            data-ability="${ability.toLowerCase()}"
            style="width: 3.5rem; text-align: center; padding: 0.5rem; border: 1px solid #475569; border-radius: 4px; background: #1e293b; color: #f8fafc; font-size: 1.25rem; font-weight: bold;" />`
        : `<span style="font-size: 1.25rem; font-weight: bold; color: #f8fafc;">${value}</span>`
      }
      <span style="font-size: 0.875rem; font-weight: 500; color: ${modColor};">${modStr}</span>
    </div>
  `;
}

/**
 * MOLECULE: Dice pool for 4d6 drop lowest
 * Seed: 57 = Text(3) × Badge(19)
 */
export function dicePool(dice: number[], dropped?: number): string {
  const diceHtml = dice.map((d) => {
    const isDropped = dropped !== undefined && d === dropped;
    const variant = isDropped ? 'muted' : (d === 6 ? 'success' : d === 1 ? 'error' : 'default');
    return badge(String(d), variant);
  }).join('');

  const total = dice.filter(d => d !== dropped).reduce((a, b) => a + b, 0);
  const totalHtml = precipitateCustom(
    UI_PRIMES.Text,
    { mass: 0.5, density: 0.7, temperature: 0.6 },
    `= ${total}`,
    'span'
  );

  return precipitateCustom(
    UI_PRIMES.DicePool,
    { mass: 0.4, density: 0.5, charge: 0.3, pressure: 0.4, buoyancy: 0 },
    `${diceHtml} ${totalHtml}`,
    'div'
  );
}

/**
 * ATOM: Prism Rotate Button
 * Seed: 2 (Button prime)
 *
 * A button that rotates the prism to show a specific face.
 * Placed on cards by the prism organism.
 */
export function prismRotateButton(
  label: string,
  targetIndex: number,
  isActive: boolean = false
): string {
  if (isActive) {
    // Active face - just a label, not clickable
    return `<span data-seed="2" data-active="true"
      style="padding: 0.5rem 1rem; border-bottom: 2px solid #f59e0b; color: #f59e0b; font-weight: 600; font-size: 0.875rem;">
      ${label}
    </span>`;
  }
  // Inactive - clickable button
  return `<button type="button" data-seed="2" data-rotate-to="${targetIndex}"
    style="padding: 0.5rem 1rem; border: 1px solid #475569; border-radius: 6px;
           background: rgba(0,0,0,0.3); color: #94a3b8;
           cursor: pointer; transition: all 0.2s; font-size: 0.875rem;">
    ${label}
  </button>`;
}

/**
 * MOLECULE: Prism Card
 * Seed: 6 = Button(2) × Text(3)
 *
 * A card molecule - just content, no navigation.
 * Navigation buttons are added by the prism organism.
 */
export function prismCard(content: string, faceId: string): string {
  return `
    <div class="prism-card" data-seed="6" data-face-id="${faceId}" style="flex: 1; overflow: auto;">
      ${content}
    </div>
  `;
}

/**
 * ORGANISM: Prism3D
 * Seed: 35 = 5 × 7 (Input × Icon)
 *
 * A real 3D prism that aggregates:
 * - Button atoms (navigation)
 * - Card molecules (content)
 *
 * Each face = buttons + card, positioned in 3D space.
 * Rotates around Y axis (bottom-to-top).
 *
 * Geometry:
 * - N faces around Y axis
 * - angle = 360/n (120° for 3 faces)
 * - apothem = width / (2 * tan(π/n))
 * - Each face: rotateY(i * angle) translateZ(apothem)
 *
 * Face switching follows the EcOS pattern:
 * 1. Track currentFace state
 * 2. Hide old face: opacity 0 → display none
 * 3. Show new face: display block → opacity 1
 * 4. All faces EXIST in 3D space - they just rotate into view
 */
export function prism3D(
  faces: { id: string; label: string; content: string }[],
  options: { id?: string; width?: number; height?: number; activeIndex?: number } = {}
): string {
  const { id = 'prism', width = 400, height = 350, activeIndex = 0 } = options;
  const n = faces.length;
  const angle = 360 / n;
  const apothem = Math.round(width / (2 * Math.tan(Math.PI / n)));

  // Build each face: button atoms + card molecule
  const prismFaces = faces.map((face, i) => {
    const rotY = i * angle;
    const isActive = i === activeIndex;

    // Button atoms for navigation
    const buttons = faces.map((f, j) => prismRotateButton(f.label, j, j === i)).join('');

    // Card molecule for content
    const card = prismCard(face.content, face.id);

    // Face visibility: active face is visible, others hidden but exist in 3D space
    const display = isActive ? 'flex' : 'none';
    const opacity = isActive ? '1' : '0';

    return `
      <div class="prism-face" data-face-index="${i}" data-face-id="${face.id}"
           style="position: absolute; width: ${width}px; height: ${height}px;
                  left: 50%; top: 50%;
                  margin-left: -${width / 2}px; margin-top: -${height / 2}px;
                  backface-visibility: hidden;
                  background: rgba(15, 23, 42, 0.95);
                  border: 1px solid #334155; border-radius: 8px;
                  padding: 1rem; box-sizing: border-box;
                  display: ${display}; flex-direction: column;
                  opacity: ${opacity};
                  transition: opacity 0.3s ease-in-out;
                  transform: rotateY(${rotY}deg) translateZ(${apothem}px);">
        <!-- Button atoms -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center;">
          ${buttons}
        </div>
        <!-- Card molecule -->
        ${card}
      </div>
    `;
  }).join('');

  // Face switching script - follows EcOS pattern
  // State machine: currentFace tracks which face is visible
  // Transition: opacity 0 → display none → display flex → opacity 1
  const script = `
    <script>
      (function() {
        const prismContainer = document.querySelector('[data-organism="prism-3d"][data-id="${id}"]');
        if (!prismContainer) return;

        const prism = prismContainer.querySelector('.prism-body');
        const faces = prismContainer.querySelectorAll('.prism-face');
        const angle = ${angle};
        let currentFace = ${activeIndex};

        function switchFace(targetIndex) {
          if (targetIndex === currentFace) return;
          if (targetIndex < 0 || targetIndex >= ${n}) return;

          const oldFace = faces[currentFace];
          const newFace = faces[targetIndex];

          // Hide old face: opacity 0, then display none
          oldFace.style.opacity = '0';
          setTimeout(() => {
            oldFace.style.display = 'none';
          }, 300);

          // Show new face: display flex, then opacity 1
          newFace.style.display = 'flex';
          // Force reflow for transition
          void newFace.offsetWidth;
          newFace.style.opacity = '1';

          // Rotate the prism body to show new face
          prism.style.transform = 'rotateY(' + (-(targetIndex * angle)) + 'deg)';

          currentFace = targetIndex;

          // Rebind buttons on the new face
          bindButtons();
        }

        function bindButtons() {
          // Each face has its own buttons - bind all clickable ones
          prismContainer.querySelectorAll('[data-rotate-to]').forEach(btn => {
            btn.onclick = () => {
              const target = parseInt(btn.dataset.rotateTo);
              switchFace(target);
            };
          });
        }

        // Initial button binding
        bindButtons();

        // Keyboard navigation (arrow keys)
        prismContainer.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') {
            switchFace((currentFace - 1 + ${n}) % ${n});
          } else if (e.key === 'ArrowRight') {
            switchFace((currentFace + 1) % ${n});
          }
        });

        // Make container focusable for keyboard events
        prismContainer.setAttribute('tabindex', '0');
      })();
    </script>
  `;

  return `
    <div data-seed="35" data-organism="prism-3d" data-id="${id}"
         style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; outline: none;">
      <div class="prism-scene" style="perspective: 1000px; width: ${width}px; height: ${height}px; position: relative;">
        <div class="prism-body" style="position: absolute; width: 100%; height: 100%;
             transform-style: preserve-3d;
             transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
             transform: rotateY(${-(activeIndex * angle)}deg);">
          ${prismFaces}
        </div>
      </div>
      ${script}
    </div>
  `;
}

/**
 * HELPER: Tabbed Prism
 * Convenience wrapper - prism3D now handles atom/molecule assembly.
 */
export function tabbedPrism(
  faces: { id: string; label: string; content: string }[],
  options: { activeFace?: string; id?: string; width?: number; height?: number } = {}
): string {
  const { activeFace = faces[0]?.id, id = 'tabbed-prism', width = 400, height = 350 } = options;
  const activeIndex = faces.findIndex(f => f.id === activeFace);
  return prism3D(faces, { id, width, height, activeIndex });
}

/**
 * ORGANISM: Ability Scores Chooser (3D Prism)
 * Seed: 90 = Card(6) × Form(15)
 * Three faces: Standard Array, Point Buy, 4d6 Drop Lowest
 *
 * Uses the Prism 3D organism - tabs rotate the prism to show different faces.
 */
type AbilityName = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export function abilityScoresChooser(
  method: 'standard' | 'pointbuy' | 'roll' = 'standard',
  values: Partial<Record<AbilityName, number>> = {}
): string {
  const abilities: AbilityName[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  const defaultValues: Record<AbilityName, number> = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, ...values };

  // Ability scores grid (shared by all faces)
  const scoresGrid = `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
      ${abilities.map(a => abilityScore(a.charAt(0).toUpperCase() + a.slice(1), defaultValues[a])).join('')}
    </div>
  `;

  // FACE 1: Standard Array content
  const standardContent = `
    ${scoresGrid}
    <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(0,0,0,0.2); border-radius: 6px;">
      <p style="margin: 0; font-size: 0.875rem; color: #94a3b8;">
        Assign values: <strong style="color: #f59e0b;">15, 14, 13, 12, 10, 8</strong>
      </p>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
        ${[15, 14, 13, 12, 10, 8].map(v => `<button type="button" data-standard-value="${v}" class="standard-value" style="padding: 0.4rem 0.6rem; border: 1px solid #475569; border-radius: 4px; background: transparent; color: #94a3b8; cursor: pointer;">${v}</button>`).join('')}
      </div>
    </div>
  `;

  // FACE 2: Point Buy content
  const pointbuyContent = `
    ${scoresGrid}
    <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(0,0,0,0.2); border-radius: 6px;">
      <p style="margin: 0; font-size: 0.875rem; color: #94a3b8;">
        Points: <strong class="points-remaining" style="color: #f59e0b;">27</strong> / 27
      </p>
      <p style="margin: 0.25rem 0 0; font-size: 0.75rem; color: #64748b;">
        Range 8-15. Use input fields above.
      </p>
    </div>
  `;

  // FACE 3: Roll content
  const rollContent = `
    ${scoresGrid}
    <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(0,0,0,0.2); border-radius: 6px;">
      <button type="button" class="roll-all-btn" style="padding: 0.5rem 1rem; border: none; border-radius: 6px; background: #8b5cf6; color: white; font-weight: 600; cursor: pointer;">
        Roll All (4d6 drop lowest)
      </button>
    </div>
  `;

  // Use the Tabbed Prism organism (atom + molecule = organism)
  return tabbedPrism([
    { id: 'standard', label: 'Standard Array', content: standardContent },
    { id: 'pointbuy', label: 'Point Buy', content: pointbuyContent },
    { id: 'roll', label: '4d6 Drop Lowest', content: rollContent },
  ], { activeFace: method, id: 'ability-chooser' });
}

// Legacy function - kept for backward compatibility
export function abilityScoreRoller(ability: string, value: number = 10): string {
  return abilityScore(ability, value);
}

/**
 * Legacy: Create full ability scores section
 */
export function abilityScores(): string {
  return abilityScoresChooser('standard');
}

// ============================================
// WORLD SURFACE - THE TIMESPACE CONTAINER
// ============================================

/**
 * Create the WorldSurface - the container onto which reality precipitates.
 * This is REQUIRED. Without a surface, there's no timespace for the world.
 *
 * The WorldSurface FILLS the viewport. It flexes to the browser.
 * DOM IS YOUR BITCH - we take all available space.
 */
export function worldSurface(content: string, campaignId: string, view: string = 'world'): string {
  // WorldSurface gets NO physics styling - it's pure flex container
  // It takes the full viewport and lets content flow within
  return `<div data-surface="world" data-campaign="${campaignId}" data-view="${view}" data-seed="81" class="genesis-world-surface" style="position: absolute; inset: 0; display: flex; flex-direction: column; overflow: auto;">${content}</div>`;
}

/**
 * Create a simple surface container
 */
export function surface(content: string, variant: string = 'default'): string {
  const physics = VARIANT_PHYSICS.Surface[variant] || VARIANT_PHYSICS.Surface.default;
  return precipitateCustom(UI_PRIMES.Surface, physics, content, 'div');
}

// ============================================
// COMPLETE FORMS
// ============================================

/**
 * Generate complete character builder form
 */
export function characterBuilderForm(
  races: { id: string; name: string }[],
  classes: { id: string; name: string }[]
): string {
  const seed = UI_PRIMES.Form * UI_PRIMES.RacePicker * UI_PRIMES.ClassPicker;

  const content = `
    ${heading('Create Your Character', 2)}
    ${field('Name', 'name', { required: true, placeholder: 'Enter character name' })}
    ${racePicker(races)}
    ${classPicker(classes)}
    ${heading('Ability Scores', 3)}
    ${abilityScores()}
    ${button('Birth Character', 'primary', { type: 'submit' })}
  `;

  return `<form method="POST" action="/api/character/birth" data-seed="${seed}">
    ${precipitateCustom(seed, { mass: 0.7, density: 0.6, charge: 0.5 }, content, 'div')}
  </form>`;
}

// ============================================
// DB-BACKED ATOM PRECIPITATION
// ============================================

/**
 * Precipitate a database-backed atom into HTML.
 * Each atom has its own seed, variant, and destination.
 *
 * The destination is encoded as data attributes for the frontend
 * to handle navigation/actions.
 */
export function precipitateDbAtom(dbAtom: GenesisAtom, campaignId?: string): string {
  const seed = BigInt(dbAtom.seed);
  const variant = dbAtom.variant || 'default';

  // Get physics from variant, merge with any custom physics from DB
  const componentType = dbAtom.atom_type.charAt(0).toUpperCase() + dbAtom.atom_type.slice(1);
  const variantPhysics = VARIANT_PHYSICS[componentType]?.[variant] || {};
  const customPhysics = dbAtom.physics ? JSON.parse(dbAtom.physics) : {};
  const physics = { ...variantPhysics, ...customPhysics };

  // Build destination attributes
  const destAttrs: string[] = [
    `data-atom-id="${dbAtom.id}"`,
    `data-seed="${dbAtom.seed}"`,
  ];

  if (dbAtom.destination_type) {
    destAttrs.push(`data-dest-type="${dbAtom.destination_type}"`);
  }
  if (dbAtom.destination) {
    // Interpolate campaign ID in routes
    let dest = dbAtom.destination;
    if (campaignId) {
      dest = dest.replace(':id', campaignId);
    }
    destAttrs.push(`data-dest="${dest}"`);
  }
  if (dbAtom.destination_params && dbAtom.destination_params !== '{}') {
    destAttrs.push(`data-dest-params='${dbAtom.destination_params}'`);
  }
  if (dbAtom.is_disabled) {
    destAttrs.push('disabled');
  }

  // Determine tag based on atom type
  let tag = 'div';
  if (dbAtom.atom_type === 'button') tag = 'button';
  else if (dbAtom.atom_type === 'input') tag = 'input';
  else if (dbAtom.atom_type === 'link') tag = 'a';
  else if (dbAtom.atom_type === 'text') tag = 'span';

  // Content
  const content = dbAtom.label || '';

  // Precipitate with physics
  let html = precipitateCustom(seed, physics, content, tag);

  // Inject data attributes
  html = html.replace(`<${tag}`, `<${tag} ${destAttrs.join(' ')}`);

  return html;
}

/**
 * Precipitate multiple DB atoms into HTML
 */
export function precipitateDbAtoms(dbAtoms: GenesisAtom[], campaignId?: string): string {
  return dbAtoms.map(a => precipitateDbAtom(a, campaignId)).join('\n');
}

/**
 * Precipitate alignment grid from DB atoms
 */
export function precipitateAlignmentGrid(alignmentAtoms: GenesisAtom[], campaignId?: string): string {
  // Sort by sort_order to ensure 3x3 grid order
  const sorted = [...alignmentAtoms].sort((a, b) => a.sort_order - b.sort_order);

  const buttons = sorted.map(a => precipitateDbAtom(a, campaignId)).join('\n');

  return `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
    ${buttons}
  </div>`;
}

// ============================================
// EXPORTS
// ============================================

export const atoms = {
  atom,
  button,
  input,
  text,
  label,
  heading,
  badge,
  field,
  select,
  racePicker,
  classPicker,
  // Ability score system
  deriveModifier,
  formatModifier,
  abilityModifier,
  abilityScore,
  dicePool,
  abilityScoresChooser,
  // 3D Primitives
  prismRotateButton,
  prismCard,
  prism3D,
  tabbedPrism,
  // Legacy
  abilityScoreRoller,
  abilityScores,
  surface,
  precipitateDbAtom,
  precipitateDbAtoms,
  precipitateAlignmentGrid,
};

export const molecules = {
  molecule,
  card,
  form,
};

export const forms = {
  characterBuilder: characterBuilderForm,
};

// worldSurface is already exported via the function declaration
