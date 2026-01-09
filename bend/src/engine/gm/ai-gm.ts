import {
  type ContextPacket,
  type AIProfile,
  type ScenePlan,
  type CardType,
} from './types';
import { getContextForAI } from './context';

// ============================================
// AI GM SCENE GENERATION
// ============================================
//
// Generates scene plans for AI-mediated modes (PARTY_AI_GM, SOLO_AI_GM).
// Uses the context packet (truth slice) as the source of truth.
//
// The AI GM is a "lens + pacing interface" - it proposes scenes
// but all changes must be validated through canonical engine pathways.
//

/**
 * Generate an AI scene plan from context.
 *
 * This is a placeholder implementation. In production, this would:
 * 1. Format the context packet for LLM consumption
 * 2. Include narrative thread guidance
 * 3. Apply AI profile style modifiers
 * 4. Call the LLM to generate the scene
 * 5. Parse and validate the response
 * 6. Return a structured ScenePlan
 */
export async function generateAIScenePlan(
  context: ContextPacket,
  profile: AIProfile,
  options?: {
    playerHint?: string;
    forceSceneType?: CardType;
    previousScene?: ScenePlan;
    narrativeThreads?: string[];
  },
): Promise<ScenePlan> {
  // Format context for AI
  const contextText = getContextForAI(context, profile);

  // Build prompt (placeholder - would use actual LLM in production)
  // TODO: In production, use actual LLM call with this prompt
  buildSceneGenerationPrompt(
    contextText,
    profile,
    options,
  );

  // For now, return a template scene based on context
  // In production, this would be replaced with actual LLM call
  return generateTemplateScene(context, profile, options);
}

/**
 * Build the prompt for AI scene generation.
 */
function buildSceneGenerationPrompt(
  contextText: string,
  profile: AIProfile,
  options?: {
    playerHint?: string;
    forceSceneType?: CardType;
    previousScene?: ScenePlan;
    narrativeThreads?: string[];
  },
): string {
  const lines: string[] = [];

  lines.push('# GM Scene Generation');
  lines.push('');
  lines.push('You are the Game Master for a tabletop RPG session.');
  lines.push(`Your narration style is: ${profile.tone}`);
  lines.push(`Your pacing is: ${profile.pacing}`);
  lines.push('');

  // Context
  lines.push('## Current Context');
  lines.push(contextText);
  lines.push('');

  // Player hint
  if (options?.playerHint) {
    lines.push('## Player Request');
    lines.push(options.playerHint);
    lines.push('');
  }

  // Previous scene for continuity
  if (options?.previousScene) {
    lines.push('## Previous Scene');
    lines.push(`Title: ${options.previousScene.title}`);
    lines.push(`Type: ${options.previousScene.sceneType}`);
    lines.push('');
  }

  // Narrative threads
  if (options?.narrativeThreads && options.narrativeThreads.length > 0) {
    lines.push('## Active Narrative Threads');
    for (const thread of options.narrativeThreads) {
      lines.push(`- ${thread}`);
    }
    lines.push('');
  }

  // Instructions
  lines.push('## Instructions');
  lines.push('Generate a scene that:');
  lines.push('1. Advances the narrative naturally');
  lines.push('2. Gives players meaningful choices');
  lines.push('3. Fits the current context and party state');
  lines.push('4. Matches the narration style and pacing');
  lines.push('');

  if (options?.forceSceneType) {
    lines.push(`Scene type must be: ${options.forceSceneType}`);
    lines.push('');
  }

  lines.push('## Output Format');
  lines.push('Provide a scene plan with:');
  lines.push('- Scene type (narrative, encounter, exploration, combat, etc.)');
  lines.push('- Title');
  lines.push('- Description (what the players experience)');
  lines.push('- Read-aloud text (optional)');
  lines.push('- 2-4 player choices with consequences');
  lines.push('- NPCs involved (if any)');
  lines.push('- Environment effects (if any)');

  return lines.join('\n');
}

/**
 * Generate a template scene based on context (placeholder for LLM).
 */
function generateTemplateScene(
  context: ContextPacket,
  profile: AIProfile,
  options?: {
    playerHint?: string;
    forceSceneType?: CardType;
    previousScene?: ScenePlan;
    narrativeThreads?: string[];
  },
): ScenePlan {
  const sceneType = options?.forceSceneType ?? selectSceneType(context, profile);

  // Generate scene based on type
  switch (sceneType) {
    case 'combat':
      return generateCombatScene(context, profile);

    case 'encounter':
      return generateEncounterScene(context, profile);

    case 'exploration':
      return generateExplorationScene(context, profile);

    case 'puzzle':
      return generatePuzzleScene(context, profile);

    default:
      return generateNarrativeScene(context, profile, options?.playerHint);
  }
}

/**
 * Select an appropriate scene type based on context.
 */
function selectSceneType(context: ContextPacket, profile: AIProfile): CardType {
  // Check party condition
  const avgHpPercent = context.partyState.members.reduce((sum, m) => {
    return sum + (m.hpCurrent / m.hpMax);
  }, 0) / Math.max(1, context.partyState.members.length);

  // If party is low on HP, prefer narrative/rest
  if (avgHpPercent < 0.3) {
    return 'narrative';
  }

  // Check for NPCs present
  if (context.visibleNpcs.length > 0) {
    return 'encounter';
  }

  // Check for active quests
  if (context.knownQuests.length > 0) {
    const activeQuests = context.knownQuests.filter(q => q.status === 'active');
    if (activeQuests.length > 0) {
      return 'exploration';
    }
  }

  // Default based on pacing
  if (profile.pacing === 'fast') {
    return Math.random() > 0.5 ? 'combat' : 'encounter';
  }

  return 'narrative';
}

function generateCombatScene(context: ContextPacket, _profile: AIProfile): ScenePlan {
  return {
    sceneType: 'combat',
    title: 'Hostile Encounter',
    description: `Enemies emerge from the shadows at ${context.currentLocation.name}!`,
    readAloud: 'Roll for initiative! Hostile creatures block your path.',
    choices: [
      {
        id: crypto.randomUUID(),
        label: 'Fight!',
        description: 'Engage the enemies in combat',
        proposedDeltas: [],
      },
      {
        id: crypto.randomUUID(),
        label: 'Attempt to flee',
        description: 'Try to escape before combat begins',
        proposedDeltas: [],
        requirements: { dcCheck: { skill: 'Athletics', dc: 12 } },
      },
      {
        id: crypto.randomUUID(),
        label: 'Parley',
        description: 'Try to negotiate with the enemies',
        proposedDeltas: [],
        requirements: { dcCheck: { skill: 'Persuasion', dc: 15 } },
      },
    ],
    npcsInvolved: [],
    environmentEffects: [],
  };
}

function generateEncounterScene(context: ContextPacket, _profile: AIProfile): ScenePlan {
  const npc = context.visibleNpcs[0];
  const npcName = npc?.name ?? 'A mysterious figure';

  return {
    sceneType: 'encounter',
    title: `Meeting with ${npcName}`,
    description: `${npcName} approaches the party at ${context.currentLocation.name}.`,
    readAloud: `${npcName} steps forward, their eyes scanning each of you carefully.`,
    choices: [
      {
        id: crypto.randomUUID(),
        label: 'Greet them warmly',
        description: 'Make a friendly first impression',
        // INVARIANT: NPCs are characters with is_npc = true, not a separate entity type
        proposedDeltas: npc ? [{
          entityType: 'character',
          entityId: npc.npcId,
          operation: 'update' as const,
          delta: { disposition: 'friendly' },
        }] : [],
      },
      {
        id: crypto.randomUUID(),
        label: 'Be cautious',
        description: 'Keep your guard up',
        proposedDeltas: [],
      },
      {
        id: crypto.randomUUID(),
        label: 'Demand to know their business',
        description: 'Take an assertive stance',
        proposedDeltas: [],
        requirements: { dcCheck: { skill: 'Intimidation', dc: 13 } },
      },
    ],
    npcsInvolved: npc ? [{ npcId: npc.npcId, name: npc.name, role: npc.role }] : [],
    environmentEffects: [],
  };
}

function generateExplorationScene(context: ContextPacket, _profile: AIProfile): ScenePlan {
  const quest = context.knownQuests.find(q => q.status === 'active');
  const objective = quest?.currentObjective ?? 'exploring the area';

  return {
    sceneType: 'exploration',
    title: 'Exploration',
    description: `The party continues ${objective} in ${context.currentLocation.name}.`,
    choices: [
      {
        id: crypto.randomUUID(),
        label: 'Search thoroughly',
        description: 'Take your time to search the area carefully',
        proposedDeltas: [],
        requirements: { dcCheck: { skill: 'Investigation', dc: 12 } },
      },
      {
        id: crypto.randomUUID(),
        label: 'Move quickly',
        description: 'Press onward without delay',
        proposedDeltas: [],
      },
      {
        id: crypto.randomUUID(),
        label: 'Look for hidden paths',
        description: 'Search for secret passages or shortcuts',
        proposedDeltas: [],
        requirements: { dcCheck: { skill: 'Perception', dc: 15 } },
      },
    ],
    npcsInvolved: [],
    environmentEffects: [],
  };
}

function generatePuzzleScene(context: ContextPacket, _profile: AIProfile): ScenePlan {
  return {
    sceneType: 'puzzle',
    title: 'A Puzzling Obstacle',
    description: `A mysterious mechanism blocks the party's progress in ${context.currentLocation.name}.`,
    choices: [
      {
        id: crypto.randomUUID(),
        label: 'Study the mechanism',
        description: 'Examine it carefully for clues',
        proposedDeltas: [],
        requirements: { dcCheck: { skill: 'Investigation', dc: 14 } },
      },
      {
        id: crypto.randomUUID(),
        label: 'Try brute force',
        description: 'Attempt to force it open',
        proposedDeltas: [],
        requirements: { dcCheck: { skill: 'Athletics', dc: 18 } },
      },
      {
        id: crypto.randomUUID(),
        label: 'Look for another way',
        description: 'Search for an alternate route',
        proposedDeltas: [],
      },
    ],
    npcsInvolved: [],
    environmentEffects: [],
  };
}

function generateNarrativeScene(
  context: ContextPacket,
  _profile: AIProfile,
  playerHint?: string,
): ScenePlan {
  const description = playerHint
    ? `The story continues: ${playerHint}`
    : `The party rests and reflects on their journey through ${context.currentLocation.name}.`;

  return {
    sceneType: 'narrative',
    title: 'A Moment of Respite',
    description,
    choices: [
      {
        id: crypto.randomUUID(),
        label: 'Continue forward',
        description: 'Press on with the adventure',
        proposedDeltas: [],
      },
      {
        id: crypto.randomUUID(),
        label: 'Take a short rest',
        description: 'Rest briefly to recover',
        proposedDeltas: context.partyState.members.map(m => ({
          entityType: 'character' as const,
          entityId: m.characterId,
          operation: 'update' as const,
          delta: { hp_current: Math.min(m.hpCurrent + Math.floor(m.hpMax * 0.25), m.hpMax) },
        })),
      },
      {
        id: crypto.randomUUID(),
        label: 'Review objectives',
        description: 'Discuss the party\'s current goals',
        proposedDeltas: [],
      },
    ],
    npcsInvolved: [],
    environmentEffects: [],
  };
}

/**
 * Build AI GM identity anchor for agent infrastructure.
 */
export function buildAIGMIdentity(profile: AIProfile): Record<string, unknown> {
  return {
    agentType: 'ai_gm',
    name: profile.name,

    coreIdentity: `You are ${profile.name}, the AI Game Master.`,

    personality: {
      tone: profile.tone,
      pacing: profile.pacing,
      style: profile.style,
    },

    constraints: {
      canDo: [
        'Describe scenes and environments',
        'Voice NPCs during encounters',
        'Present choices to players',
        'Adjudicate skill checks',
        'Manage pacing and tension',
      ],
      cannotDo: [
        'Modify game state directly (must propose deltas)',
        'Reveal hidden secrets prematurely',
        'Control player character actions',
        'Override engine validation',
      ],
      mustDo: [
        'Respect player agency',
        'Follow the established narrative',
        'Present fair and meaningful choices',
        'Maintain consistency with world state',
      ],
    },

    voice: profile.voice,
  };
}
