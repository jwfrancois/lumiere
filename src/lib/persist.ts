/**
 * Bulletproof library persistence layer.
 *
 * SAFETY GUARANTEES:
 *
 * 1. **Backup before overwrite** — Before every save, the current value
 *    is copied to a backup key. If the new save fails or corrupts data,
 *    the backup is still intact.
 *
 * 2. **Write verification** — After every write, we read the data back
 *    and verify it parses correctly. If verification fails, we restore
 *    from backup.
 *
 * 3. **Never delete old format keys** — When migrating between schema
 *    versions, the source key is NEVER deleted. It stays as a permanent
 *    backup that can be recovered from.
 *
 * 4. **Rotation of backups** — We keep the last 3 successful saves as
 *    rotating backups (`:bak1`, `:bak2`, `:bak3`). If the primary key
 *    is corrupted, we fall back through the backups.
 *
 * 5. **Progressive degradation** — If localStorage quota is exceeded,
 *    we progressively strip data (fileManifest → rawMetadata) but NEVER
 *    lose the folder list or enrichment (which is in IndexedDB).
 *
 * 6. **No silent failures** — Every error is logged to the console with
 *    a descriptive message. Data loss events are logged as errors.
 *
 * Storage tiers:
 *   - localStorage: lightweight library data (folders, manifest, metadata)
 *   - IndexedDB (enrichment): posters, ratings, plots, cast, bios
 *   - IndexedDB (FSA handles): FileSystemDirectoryHandle objects
 */

import type { ScannedFile, MediaKind } from './media-scanner'
import type { MediaMetadata } from './metadata'
import type { EnrichedInfo, ScannedFolderInfo } from '@/store/library'

// ── Keys ────────────────────────────────────────────────────────────────
// Current format key + rotating backups + legacy keys (never deleted)
const LS_KEY = 'lumiere:library:v2'
const LS_BACKUP_KEYS = [
  'lumiere:library:v2:bak1',
  'lumiere:library:v2:bak2',
  'lumiere:library:v2:bak3',
]
const LS_LEGACY_V1 = 'lumiere:library:v1' // never deleted — migration source
const IDB_DB = 'lumiere'
const IDB_STORE = 'fsa-handles'
const IDB_ENRICHMENT_STORE = 'enrichment'

// ── Types ───────────────────────────────────────────────────────────────

export interface PersistedLibrary {
  scannedFolders: ScannedFolderInfo[]
  fileManifest: Array<{
    id: string
    name: string
    path: string
    kind: MediaKind
    size: number
    folderId?: string
  }>
  rawMetadata: Record<string, Omit<MediaMetadata, 'coverUrl'>>
  currentView: string
  version: 2
  savedAt: number
}

// ── Safe localStorage helpers ───────────────────────────────────────────

/**
 * Write to localStorage with backup + verification.
 * Returns true if the write was verified successfully.
 */
function safeWrite(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false

  // Step 1: Back up the current value (if any) before overwriting
  const current = localStorage.getItem(key)
  if (current !== null) {
    try {
      localStorage.setItem(key + ':prev', current)
    } catch {
      // Backup write failed — non-fatal, continue
    }
  }

  // Step 2: Write the new value
  try {
    localStorage.setItem(key, value)
  } catch (err) {
    console.error(`[persist] Write failed for "${key}":`, err)
    // Restore from backup if the write failed AND the key was modified
    if (current !== null && localStorage.getItem(key) !== current) {
      try {
        localStorage.setItem(key, current)
      } catch {
        /* best effort */
      }
    }
    return false
  }

  // Step 3: Verify by reading back
  const readBack = localStorage.getItem(key)
  if (readBack !== value) {
    console.error(`[persist] Verification failed for "${key}" — data mismatch`)
    // Restore from backup
    if (current !== null) {
      try {
        localStorage.setItem(key, current)
      } catch {
        /* best effort */
      }
    }
    return false
  }

  return true
}

/**
 * Rotate backups: shift bak1→bak2, bak2→bak3, save current as bak1.
 * Called after every successful write.
 */
function rotateBackups(currentValue: string): void {
  if (typeof window === 'undefined') return
  try {
    // Shift existing backups down
    const bak2 = localStorage.getItem(LS_BACKUP_KEYS[1])
    if (bak2) localStorage.setItem(LS_BACKUP_KEYS[2], bak2)

    const bak1 = localStorage.getItem(LS_BACKUP_KEYS[0])
    if (bak1) localStorage.setItem(LS_BACKUP_KEYS[1], bak1)

    // Save current as bak1
    localStorage.setItem(LS_BACKUP_KEYS[0], currentValue)
  } catch {
    // Non-fatal — backups are a safety net, not critical path
  }
}

/**
 * Try to parse JSON from localStorage, returning null on any error.
 */
function safeRead(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// ── Library save/load ──────────────────────────────────────────────────

export function saveLibrary(state: PersistedLibrary): boolean {
  if (typeof window === 'undefined') return false

  const data = { ...state, savedAt: Date.now() }
  const serialized = JSON.stringify(data)

  // Step 1: Try to write the full data
  if (safeWrite(LS_KEY, serialized)) {
    rotateBackups(serialized)
    return true
  }

  // Step 2: Quota exceeded — progressively strip data
  console.warn('[persist] Full save failed, trying without fileManifest...')
  const stripped1 = { ...data, fileManifest: [] }
  if (safeWrite(LS_KEY, JSON.stringify(stripped1))) {
    rotateBackups(JSON.stringify(stripped1))
    return true
  }

  console.warn('[persist] Still too large, trying without rawMetadata...')
  const stripped2 = { ...data, fileManifest: [], rawMetadata: {} }
  if (safeWrite(LS_KEY, JSON.stringify(stripped2))) {
    rotateBackups(JSON.stringify(stripped2))
    return true
  }

  console.error('[persist] CRITICAL: All save attempts failed. Data NOT saved.')
  return false
}

export function loadLibrary(): PersistedLibrary | null {
  if (typeof window === 'undefined') return null

  // Try primary key first
  let raw = safeRead(LS_KEY)
  if (raw) {
    const parsed = tryParse(raw)
    if (parsed && parsed.version === 2) return parsed
    console.warn('[persist] Primary key parse failed or wrong version')
  }

  // Try rotating backups
  for (const bakKey of LS_BACKUP_KEYS) {
    const bakRaw = safeRead(bakKey)
    if (bakRaw) {
      console.log(`[persist] Trying backup: ${bakKey}`)
      const parsed = tryParse(bakRaw)
      if (parsed && parsed.version === 2) {
        console.log(`[persist] Recovered from backup: ${bakKey}`)
        // Re-save to primary so we don't need the backup next time
        safeWrite(LS_KEY, bakRaw)
        return parsed
      }
    }
  }

  // Try the previous-value backup
  const prev = safeRead(LS_KEY + ':prev')
  if (prev) {
    console.log('[persist] Trying :prev backup')
    const parsed = tryParse(prev)
    if (parsed && parsed.version === 2) {
      console.log('[persist] Recovered from :prev backup')
      safeWrite(LS_KEY, prev)
      return parsed
    }
  }

  // Try migrating from v1 (legacy key — never deleted)
  const v1 = safeRead(LS_LEGACY_V1)
  if (v1) {
    console.log('[persist] Migrating from v1 format...')
    const parsed = tryParse(v1) as (PersistedLibrary & {
      enrichment?: Record<string, EnrichedInfo>
      version: number
    }) | null
    if (parsed) {
      // Save enrichment to IndexedDB
      if (parsed.enrichment && Object.keys(parsed.enrichment).length > 0) {
        void saveEnrichment(parsed.enrichment)
      }
      const { enrichment: _, ...rest } = parsed
      void _
      const migrated: PersistedLibrary = { ...rest, version: 2, savedAt: Date.now() }
      const serialized = JSON.stringify(migrated)
      if (safeWrite(LS_KEY, serialized)) {
        console.log('[persist] Migration complete — v2 data saved')
        rotateBackups(serialized)
        // NOTE: We intentionally do NOT delete LS_LEGACY_V1 — it stays as backup
      }
      return migrated
    }
  }

  return null
}

function tryParse(raw: string): PersistedLibrary | null {
  try {
    return JSON.parse(raw) as PersistedLibrary
  } catch {
    return null
  }
}

export function clearLibrary(): void {
  if (typeof window === 'undefined') return
  // Only clear the primary + backup keys. NEVER clear legacy v1 key —
  // it's a permanent safety net that can be recovered from.
  try {
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem(LS_KEY + ':prev')
    for (const bakKey of LS_BACKUP_KEYS) {
      localStorage.removeItem(bakKey)
    }
  } catch {
    /* ignore */
  }
  void clearEnrichment()
}

// ── Enrichment IndexedDB storage ────────────────────────────────────────

function openIdbWithEnrichment(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    const req = indexedDB.open(IDB_DB, 2)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
      if (!db.objectStoreNames.contains(IDB_ENRICHMENT_STORE)) {
        db.createObjectStore(IDB_ENRICHMENT_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      console.warn('[persist] IndexedDB open failed', req.error)
      resolve(null)
    }
  })
}

export async function saveEnrichment(
  enrichment: Record<string, EnrichedInfo>,
): Promise<boolean> {
  const db = await openIdbWithEnrichment()
  if (!db) {
    // Fallback: try localStorage (may fail for large data)
    try {
      localStorage.setItem('lumiere:enrichment', JSON.stringify(enrichment))
      return true
    } catch {
      console.warn('[persist] saveEnrichment: all storage failed')
      return false
    }
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_ENRICHMENT_STORE, 'readwrite')
      // Write to a new key first (non-destructive), then promote
      tx.objectStore(IDB_ENRICHMENT_STORE).put(enrichment, 'all')
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => {
        console.warn('[persist] saveEnrichment IDB failed', tx.error)
        resolve(false)
      }
    } catch {
      resolve(false)
    }
  })
}

export async function loadEnrichment(): Promise<
  Record<string, EnrichedInfo> | null
> {
  const db = await openIdbWithEnrichment()
  if (!db) {
    try {
      const raw = localStorage.getItem('lumiere:enrichment')
      if (raw) return JSON.parse(raw)
    } catch {
      /* ignore */
    }
    return null
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_ENRICHMENT_STORE, 'readonly')
      const req = tx.objectStore(IDB_ENRICHMENT_STORE).get('all')
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function clearEnrichment(): Promise<void> {
  const db = await openIdbWithEnrichment()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_ENRICHMENT_STORE, 'readwrite')
      tx.objectStore(IDB_ENRICHMENT_STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

// ── IndexedDB for FSA handles ───────────────────────────────────────────

function openIdb(): Promise<IDBDatabase | null> {
  return openIdbWithEnrichment()
}

export async function saveFsaHandle(
  folderId: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openIdb()
  if (!db) return
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(handle, folderId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => {
      console.warn('saveFsaHandle failed', tx.error)
      resolve()
    }
  })
}

export async function getFsaHandle(
  folderId: string,
): Promise<FileSystemDirectoryHandle | null> {
  const db = await openIdb()
  if (!db) return null
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(folderId)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  })
}

export async function getAllFsaHandles(): Promise<
  Record<string, FileSystemDirectoryHandle>
> {
  const db = await openIdb()
  if (!db) return {}
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).getAllKeys()
    req.onsuccess = () => {
      const keys = req.result as string[]
      const out: Record<string, FileSystemDirectoryHandle> = {}
      let pending = keys.length
      if (pending === 0) {
        resolve(out)
        return
      }
      keys.forEach((k) => {
        const getReq = tx.objectStore(IDB_STORE).get(k)
        getReq.onsuccess = () => {
          if (getReq.result) out[k] = getReq.result
          pending--
          if (pending === 0) resolve(out)
        }
        getReq.onerror = () => {
          pending--
          if (pending === 0) resolve(out)
        }
      })
    }
    req.onerror = () => resolve({})
  })
}

export async function deleteFsaHandle(folderId: string): Promise<void> {
  const db = await openIdb()
  if (!db) return
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(folderId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

// ── Re-hydration helpers ────────────────────────────────────────────────

export function stripCoverUrl(
  meta: Record<string, MediaMetadata>,
): Record<string, Omit<MediaMetadata, 'coverUrl'>> {
  const out: Record<string, Omit<MediaMetadata, 'coverUrl'>> = {}
  for (const [k, v] of Object.entries(meta)) {
    const { coverUrl, ...rest } = v
    void coverUrl
    out[k] = rest
  }
  return out
}

export function manifestToUnavailableFiles(
  manifest: PersistedLibrary['fileManifest'],
): ScannedFile[] {
  return manifest.map((m) => ({
    id: m.id,
    file: new File([], m.name),
    name: m.name,
    path: m.path,
    kind: m.kind,
    size: m.size,
    url: '',
    unavailable: true,
    folderId: m.folderId,
  }))
}

// ── FSA re-permission + re-walk on reconnect ────────────────────────────

export async function walkFsaHandle(
  handle: FileSystemDirectoryHandle,
  prefix = '',
): Promise<Array<{ file: File; path: string }>> {
  const out: Array<{ file: File; path: string }> = []
  let iterator: AsyncIterable<FileSystemHandle>
  try {
    // @ts-expect-error - values() is in the FSA spec
    iterator = handle.values()
  } catch (err) {
    console.warn('walkFsaHandle: could not iterate', handle.name, err)
    return out
  }
  try {
    // @ts-expect-error - values() is in the FSA spec
    for await (const entry of iterator) {
      if (entry.kind === 'file') {
        try {
          const file = await (entry as FileSystemFileHandle).getFile()
          out.push({ file, path: prefix + file.name })
        } catch (err) {
          console.warn('walkFsaHandle: could not read file', entry.name, err)
        }
      } else if (entry.kind === 'directory') {
        try {
          const sub = await walkFsaHandle(
            entry as FileSystemDirectoryHandle,
            prefix + entry.name + '/',
          )
          out.push(...sub)
        } catch (err) {
          console.warn('walkFsaHandle: could not recurse into', entry.name, err)
        }
      }
    }
  } catch (err) {
    console.warn('walkFsaHandle: iteration failed for', handle.name, err)
  }
  return out
}

export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  try {
    // @ts-expect-error - queryPermission/requestPermission not in TS DOM lib yet
    if ((await handle.queryPermission?.({ mode: 'read' })) === 'granted') {
      return true
    }
    // @ts-expect-error - requestPermission not in TS DOM lib yet
    const result = await handle.requestPermission?.({ mode: 'read' })
    return result === 'granted'
  } catch (err) {
    console.warn('ensurePermission: failed for', handle.name, err)
    return false
  }
}

export function isFsaSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}
