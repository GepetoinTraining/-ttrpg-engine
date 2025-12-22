import {
  createClient,
  type Client,
  type ResultSet,
  type InStatement,
} from "@libsql/client";

// ============================================
// TURSO DATABASE CLIENT
// ============================================
//
// Connection to Turso (libSQL) database.
//
// Features:
//   - Connection pooling (via Turso's edge)
//   - Transaction support
//   - Prepared statements
//   - JSON column helpers
//

// ============================================
// CONFIGURATION
// ============================================

export interface TursoConfig {
  url: string; // Database URL
  authToken?: string; // Auth token (for remote)

  // Optional settings
  syncUrl?: string; // Sync URL for embedded replicas
  syncInterval?: number; // Sync interval in seconds

  // Logging
  debug?: boolean;
}

/**
 * Get config from environment
 */
export function getTursoConfig(): TursoConfig {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("TURSO_DATABASE_URL environment variable is required");
  }

  return {
    url,
    authToken,
    debug: process.env.NODE_ENV === "development",
  };
}

// ============================================
// CLIENT SINGLETON
// ============================================

let _client: Client | null = null;

/**
 * Get or create Turso client
 */
export function getClient(config?: TursoConfig): Client {
  if (_client) return _client;

  const cfg = config || getTursoConfig();

  _client = createClient({
    url: cfg.url,
    authToken: cfg.authToken,
    syncUrl: cfg.syncUrl,
    syncInterval: cfg.syncInterval,
  });

  return _client;
}

/**
 * Close client connection
 */
export async function closeClient(): Promise<void> {
  if (_client) {
    _client.close();
    _client = null;
  }
}

// ============================================
// QUERY HELPERS
// ============================================

export type QueryParams = Record<string, any> | any[];

/**
 * Execute a single query
 */
export async function query(
  sql: string,
  params?: QueryParams,
): Promise<ResultSet> {
  const client = getClient();
  return client.execute({ sql, args: params || [] });
}

/**
 * Execute a single query and return first row
 */
export async function queryOne<T = any>(
  sql: string,
  params?: QueryParams,
): Promise<T | null> {
  const result = await query(sql, params);
  if (result.rows.length === 0) return null;
  return rowToObject<T>(result.rows[0], result.columns);
}

/**
 * Execute a single query and return all rows
 */
export async function queryAll<T = any>(
  sql: string,
  params?: QueryParams,
): Promise<T[]> {
  const result = await query(sql, params);
  return result.rows.map((row) => rowToObject<T>(row, result.columns));
}

/**
 * Execute multiple queries in a batch
 */
export async function batch(statements: InStatement[]): Promise<ResultSet[]> {
  const client = getClient();
  return client.batch(statements, "deferred");
}

// ============================================
// TRANSACTION SUPPORT
// ============================================

export interface Transaction {
  query: (sql: string, params?: QueryParams) => Promise<ResultSet>;
  queryOne: <T = any>(sql: string, params?: QueryParams) => Promise<T | null>;
  queryAll: <T = any>(sql: string, params?: QueryParams) => Promise<T[]>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

/**
 * Execute queries in a transaction
 */
export async function transaction<T>(
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const client = getClient();
  const tx = await client.transaction("deferred");

  const txWrapper: Transaction = {
    query: async (sql, params) => tx.execute({ sql, args: params || [] }),
    queryOne: async <T>(sql: string, params?: QueryParams) => {
      const result = await tx.execute({ sql, args: params || [] });
      if (result.rows.length === 0) return null;
      return rowToObject<T>(result.rows[0], result.columns);
    },
    queryAll: async <T>(sql: string, params?: QueryParams) => {
      const result = await tx.execute({ sql, args: params || [] });
      return result.rows.map((row) => rowToObject<T>(row, result.columns));
    },
    commit: () => tx.commit(),
    rollback: () => tx.rollback(),
  };

  try {
    const result = await fn(txWrapper);
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

// ============================================
// ROW HELPERS
// ============================================

/**
 * Convert libSQL row to plain object
 */
export function rowToObject<T>(row: any, columns: string[]): T {
  const obj: any = {};
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const value = row[i] ?? row[col];

    // Convert snake_case to camelCase
    const key = snakeToCamel(col);
    obj[key] = value;
  }
  return obj as T;
}

/**
 * Convert camelCase to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// ============================================
// JSON COLUMN HELPERS
// ============================================

/**
 * Parse JSON column (safely)
 */
export function parseJson<T = any>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Stringify for JSON column
 */
export function toJson(value: any): string {
  return JSON.stringify(value);
}

/**
 * SQLite JSON extract helper
 * Usage: jsonExtract('data_static', '$.physics.gravity.type')
 */
export function jsonExtract(column: string, path: string): string {
  return `json_extract(${column}, '${path}')`;
}

/**
 * SQLite JSON set helper
 * Usage: jsonSet('data_static', '$.physics.gravity.type', '"low"')
 */
export function jsonSet(column: string, path: string, value: string): string {
  return `json_set(${column}, '${path}', ${value})`;
}

// ============================================
// QUERY BUILDER HELPERS
// ============================================

export interface WhereClause {
  sql: string;
  params: any[];
}

/**
 * Build WHERE clause from conditions
 */
export function buildWhere(
  conditions: Record<string, any>,
  operator: "AND" | "OR" = "AND",
): WhereClause {
  const clauses: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(conditions)) {
    if (value === undefined) continue;

    const column = camelToSnake(key);

    if (value === null) {
      clauses.push(`${column} IS NULL`);
    } else if (Array.isArray(value)) {
      const placeholders = value.map(() => "?").join(", ");
      clauses.push(`${column} IN (${placeholders})`);
      params.push(...value);
    } else {
      clauses.push(`${column} = ?`);
      params.push(value);
    }
  }

  return {
    sql: clauses.length > 0 ? clauses.join(` ${operator} `) : "1=1",
    params,
  };
}

/**
 * Build INSERT statement
 */
export function buildInsert(
  table: string,
  data: Record<string, any>,
): { sql: string; params: any[] } {
  const columns: string[] = [];
  const placeholders: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    columns.push(camelToSnake(key));
    placeholders.push("?");
    params.push(
      typeof value === "object" && value !== null ? toJson(value) : value,
    );
  }

  return {
    sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`,
    params,
  };
}

/**
 * Build UPDATE statement
 */
export function buildUpdate(
  table: string,
  data: Record<string, any>,
  where: Record<string, any>,
): { sql: string; params: any[] } {
  const setClauses: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    setClauses.push(`${camelToSnake(key)} = ?`);
    params.push(
      typeof value === "object" && value !== null ? toJson(value) : value,
    );
  }

  const whereClause = buildWhere(where);
  params.push(...whereClause.params);

  return {
    sql: `UPDATE ${table} SET ${setClauses.join(", ")} WHERE ${whereClause.sql}`,
    params,
  };
}

/**
 * Build pagination
 */
export function buildPagination(
  page: number = 1,
  pageSize: number = 20,
): { sql: string; offset: number } {
  const offset = (page - 1) * pageSize;
  return {
    sql: `LIMIT ${pageSize} OFFSET ${offset}`,
    offset,
  };
}

// ============================================
// UUID HELPER
// ============================================

/**
 * Generate UUID v4
 */
export function uuid(): string {
  return crypto.randomUUID();
}

// ============================================
// DATE HELPERS
// ============================================

/**
 * Current ISO timestamp
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Parse date from database
 */
export function parseDate(value: string | null): Date | null {
  if (!value) return null;
  return new Date(value);
}

// ============================================
// ERROR TYPES
// ============================================

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class NotFoundError extends DatabaseError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DatabaseError {
  constructor(message: string) {
    super(message, "CONFLICT");
    this.name = "ConflictError";
  }
}
