-- GENESIS SCHEMA
-- Component topology storage for the reality engine
--
-- Three tables:
-- 1. components - The base component definitions
-- 2. component_variants - Variant configurations with physics
-- 3. component_graph - Parent/child relationships

-- ============================================
-- COMPONENTS (Base definitions)
-- ============================================

CREATE TABLE IF NOT EXISTS components (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('atom', 'molecule', 'organism', 'world')),
    prime INTEGER NOT NULL,
    tags TEXT[] DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_components_level ON components(level);
CREATE INDEX idx_components_prime ON components(prime);
CREATE INDEX idx_components_tags ON components USING GIN(tags);

-- ============================================
-- COMPONENT VARIANTS (Physics configurations)
-- ============================================

CREATE TABLE IF NOT EXISTS component_variants (
    id TEXT PRIMARY KEY,
    component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    variant_name TEXT NOT NULL,
    seed TEXT NOT NULL,  -- BigInt as string
    prime INTEGER NOT NULL,

    -- Physics properties
    mass REAL,
    density TEXT CHECK (density IN ('void', 'gas', 'liquid', 'solid', 'dense')),
    temperature TEXT CHECK (temperature IN ('cold', 'warm', 'hot', 'critical', 'fusion')),
    charge REAL,
    friction REAL,
    pressure REAL,
    buoyancy REAL,

    -- 3D properties
    material TEXT,

    -- Element composition (JSONB for flexibility)
    composition JSONB DEFAULT '{}',
    dominant_type TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(component_id, variant_name)
);

CREATE INDEX idx_variants_component ON component_variants(component_id);
CREATE INDEX idx_variants_seed ON component_variants(seed);
CREATE INDEX idx_variants_temperature ON component_variants(temperature);
CREATE INDEX idx_variants_density ON component_variants(density);

-- ============================================
-- COMPONENT GRAPH (Relationships)
-- ============================================

CREATE TABLE IF NOT EXISTS component_graph (
    id SERIAL PRIMARY KEY,
    parent_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    child_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'contains' CHECK (relationship IN ('contains', 'variant_of', 'extends')),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(parent_id, child_id, relationship)
);

CREATE INDEX idx_graph_parent ON component_graph(parent_id);
CREATE INDEX idx_graph_child ON component_graph(child_id);

-- ============================================
-- LATTICE CACHE (Precipitated results)
-- ============================================

CREATE TABLE IF NOT EXISTS lattice_cache (
    seed TEXT PRIMARY KEY,
    html TEXT,
    css TEXT,
    physics JSONB,
    hits INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_hit TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lattice_hits ON lattice_cache(hits DESC);
CREATE INDEX idx_lattice_last_hit ON lattice_cache(last_hit DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER components_updated_at
    BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER variants_updated_at
    BEFORE UPDATE ON component_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Increment cache hits
CREATE OR REPLACE FUNCTION cache_hit(p_seed TEXT)
RETURNS TABLE(html TEXT, css TEXT, physics JSONB) AS $$
BEGIN
    UPDATE lattice_cache
    SET hits = hits + 1, last_hit = NOW()
    WHERE seed = p_seed;

    RETURN QUERY
    SELECT lc.html, lc.css, lc.physics
    FROM lattice_cache lc
    WHERE lc.seed = p_seed;
END;
$$ LANGUAGE plpgsql;

-- Get all variants of a component
CREATE OR REPLACE FUNCTION get_variants(p_component_id TEXT)
RETURNS SETOF component_variants AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM component_variants
    WHERE component_id = p_component_id
    ORDER BY variant_name;
END;
$$ LANGUAGE plpgsql;

-- Get component ancestors (recursive)
CREATE OR REPLACE FUNCTION get_ancestors(p_component_id TEXT)
RETURNS TABLE(id TEXT, name TEXT, level TEXT, depth INTEGER) AS $$
WITH RECURSIVE ancestors AS (
    SELECT c.id, c.name, c.level, 0 as depth
    FROM components c
    WHERE c.id = p_component_id

    UNION ALL

    SELECT c.id, c.name, c.level, a.depth + 1
    FROM components c
    JOIN component_graph g ON g.parent_id = c.id
    JOIN ancestors a ON g.child_id = a.id
    WHERE a.depth < 10  -- Max depth to prevent infinite loops
)
SELECT * FROM ancestors WHERE depth > 0 ORDER BY depth;
$$ LANGUAGE sql;

-- Get component descendants (recursive)
CREATE OR REPLACE FUNCTION get_descendants(p_component_id TEXT)
RETURNS TABLE(id TEXT, name TEXT, level TEXT, depth INTEGER) AS $$
WITH RECURSIVE descendants AS (
    SELECT c.id, c.name, c.level, 0 as depth
    FROM components c
    WHERE c.id = p_component_id

    UNION ALL

    SELECT c.id, c.name, c.level, d.depth + 1
    FROM components c
    JOIN component_graph g ON g.child_id = c.id
    JOIN descendants d ON g.parent_id = d.id
    WHERE d.depth < 10
)
SELECT * FROM descendants WHERE depth > 0 ORDER BY depth;
$$ LANGUAGE sql;

-- Find components by physics similarity
CREATE OR REPLACE FUNCTION find_similar_physics(
    p_temperature TEXT DEFAULT NULL,
    p_density TEXT DEFAULT NULL,
    p_mass_min REAL DEFAULT NULL,
    p_mass_max REAL DEFAULT NULL
)
RETURNS SETOF component_variants AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM component_variants
    WHERE (p_temperature IS NULL OR temperature = p_temperature)
      AND (p_density IS NULL OR density = p_density)
      AND (p_mass_min IS NULL OR mass >= p_mass_min)
      AND (p_mass_max IS NULL OR mass <= p_mass_max)
    ORDER BY mass, temperature, density;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- NOTIFY TRIGGERS (for WebSocket propagation)
-- ============================================

CREATE OR REPLACE FUNCTION notify_component_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('component_change', json_build_object(
        'operation', TG_OP,
        'table', TG_TABLE_NAME,
        'id', COALESCE(NEW.id, OLD.id)
    )::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER components_notify
    AFTER INSERT OR UPDATE OR DELETE ON components
    FOR EACH ROW EXECUTE FUNCTION notify_component_change();

CREATE TRIGGER variants_notify
    AFTER INSERT OR UPDATE OR DELETE ON component_variants
    FOR EACH ROW EXECUTE FUNCTION notify_component_change();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE components IS 'Base component definitions with prime identity';
COMMENT ON TABLE component_variants IS 'Physics configurations per component variant';
COMMENT ON TABLE component_graph IS 'Parent/child relationships forming the component hierarchy';
COMMENT ON TABLE lattice_cache IS 'Cached precipitation results for hot paths';

COMMENT ON FUNCTION cache_hit IS 'Retrieve and increment hit count for cached precipitation';
COMMENT ON FUNCTION get_ancestors IS 'Recursively get all parent components';
COMMENT ON FUNCTION get_descendants IS 'Recursively get all child components';
COMMENT ON FUNCTION find_similar_physics IS 'Find components with similar physics properties';
