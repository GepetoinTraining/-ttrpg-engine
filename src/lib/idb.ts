/**
 * IndexedDB wrapper — `claudedm` database.
 *
 * Native API (no `idb` library dep). One database, one version, all stores
 * declared upfront so future slices can populate them without a version
 * bump. Per `project_cert_hierarchy.md`.
 *
 * Stores:
 *   accounts        — account certs (typically 1)
 *   characterCerts  — character certs the player owns
 *   characterTpb    — per-character interaction log (local-only)
 *   flywheelSlot    — pending world-state pushes to the server
 *   partyMembers    — cert hashes the player is grouped with
 *   sessionState    — UI state (active character id, etc.)
 *   tradeLog        — pending/accepted character trades
 *
 * Server-side renders won't have IndexedDB. Callers must guard with
 * `typeof window !== 'undefined'` OR use `loadX()` helpers that return
 * `null` when running in Node.
 */

const DB_NAME = 'claudedm'
const DB_VERSION = 1

export type StoreName =
  | 'accounts'
  | 'characterCerts'
  | 'characterTpb'
  | 'flywheelSlot'
  | 'partyMembers'
  | 'sessionState'
  | 'tradeLog'

let _dbPromise: Promise<IDBDatabase> | null = null

/**
 * Open (or upgrade) the `claudedm` database. Memoized — repeated calls
 * return the same connection.
 */
export function openDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable on server'))
  }
  if (_dbPromise) return _dbPromise

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result

      // accounts — keyed by id (UUID)
      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'id' })
      }

      // characterCerts — keyed by id, indexed by accountId for owner queries
      if (!db.objectStoreNames.contains('characterCerts')) {
        const store = db.createObjectStore('characterCerts', { keyPath: 'id' })
        store.createIndex('byOwner', 'ownerChain', { multiEntry: true })
        store.createIndex('byPersona', 'personaType')
      }

      // characterTpb — auto-increment id, indexed by characterId
      if (!db.objectStoreNames.contains('characterTpb')) {
        const store = db.createObjectStore('characterTpb', {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('byCharacter', 'characterId')
        store.createIndex('byWorldDay', 'worldDay')
      }

      // flywheelSlot — auto-increment id, indexed by characterId + pushedAt
      if (!db.objectStoreNames.contains('flywheelSlot')) {
        const store = db.createObjectStore('flywheelSlot', {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('byCharacter', 'characterId')
        store.createIndex('byPending', 'pushedAt')
      }

      // partyMembers — keyed by certHash (string)
      if (!db.objectStoreNames.contains('partyMembers')) {
        db.createObjectStore('partyMembers', { keyPath: 'certHash' })
      }

      // sessionState — singleton row keyed by 'singleton'
      if (!db.objectStoreNames.contains('sessionState')) {
        db.createObjectStore('sessionState', { keyPath: 'id' })
      }

      // tradeLog — auto-increment id, indexed by characterId + status
      if (!db.objectStoreNames.contains('tradeLog')) {
        const store = db.createObjectStore('tradeLog', {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('byCharacter', 'characterId')
        store.createIndex('byStatus', 'status')
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  return _dbPromise
}

/**
 * Wrap a transaction in a promise that resolves when complete.
 */
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'))
  })
}

/**
 * Put a record into a store. Resolves once the transaction commits.
 */
export async function idbPut<T>(store: StoreName, value: T): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put(value as unknown as IDBValidKey)
  await txDone(tx)
}

/**
 * Get a record by key. Returns `null` if not found.
 */
export async function idbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | null> {
  const db = await openDB()
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve((req.result ?? null) as T | null)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Get every record in a store as an array.
 */
export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB()
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve((req.result ?? []) as T[])
    req.onerror = () => reject(req.error)
  })
}

/**
 * Delete a record by key.
 */
export async function idbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).delete(key)
  await txDone(tx)
}

/**
 * Clear an entire store.
 */
export async function idbClear(store: StoreName): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).clear()
  await txDone(tx)
}

/**
 * Test-only: reset the memoized connection so the next openDB() reopens.
 * Call after deleting the database in tests.
 */
export function _resetForTests(): void {
  _dbPromise = null
}
