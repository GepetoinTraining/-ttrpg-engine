/**
 * COMMON GENERATOR — HOF for entity generator pattern
 * =====================================================
 *
 * Extracted from sectors-without-number's `commonGenerator` pattern.
 * See: docs/sectors-without-number-analysis.md
 *
 * Every entity generator wraps a specific function inside this common one.
 * The common one handles id generation and base-field wiring;
 * the specific one only adds the entity's distinct attributes.
 *
 *   const generateMyEntity = commonGenerator('my', (base, config) => ({
 *     ...base,
 *     specificField: config.value,
 *   }))
 *
 * The returned generator carries a reset function for tests.
 */

// ============================================================
// GENERATOR BASE CONFIG
// ============================================================

export interface BaseEntityConfig {
  name?: string
  parentId?: string
}

export interface BaseEntity {
  id: string
  name: string
  parentId?: string
}

export interface EntityGenerator<Config extends BaseEntityConfig, Entity> {
  (config: Config): Entity
  reset: () => void
}

// ============================================================
// HOF
// ============================================================

/**
 * Wrap a specific entity factory with common id generation + name/parent linking.
 * The specific factory receives the base entity (id + name + parentId) and the
 * full config; it should spread base and add type-specific fields.
 *
 * @param idPrefix   Prefix for generated ids, e.g. `'planet'` → `'planet_1'`
 * @param specificFn Specific factory — receives (base, config) and returns the entity
 */
export function commonGenerator<Config extends BaseEntityConfig, Entity>(
  idPrefix: string,
  specificFn: (base: BaseEntity, config: Config) => Entity,
): EntityGenerator<Config, Entity> {
  let counter = 0

  const generator = (config: Config): Entity => {
    const id = `${idPrefix}_${++counter}`
    const base: BaseEntity = {
      id,
      name: config.name ?? `${idPrefix}_${counter}`,
      parentId: config.parentId,
    }
    return specificFn(base, config)
  }

  generator.reset = (): void => { counter = 0 }

  return generator as EntityGenerator<Config, Entity>
}
