/**
 * Library persistence layer.
 *
 * THREE storage tiers:
 *
 * 1. **localStorage** — lightweight library data (kept small to avoid quota):
 *    - folder list (id, name, fileCount, scannedAt, hasFsaHandle)
 *    - file manifest (id, name, path, kind, size, folderId)
 *    - raw metadata (title, artist, album, etc. — minus coverUrl blob URLs)
 *    - current view
 *
 * 2. **IndexedDB (enrichment store)** — enrichment data (posters, ratings,
 *    plots, cast, artist bios, album art URLs). This is the largest field
 *    and would blow localStorage's ~5MB quota with large libraries.
 *    IndexedDB has 50MB+ quota.
 *
 * 3. **IndexedDB (FSA handles)** — FileSystemDirectoryHandle objects.
 *
 * On reload, we restore from both localStorage + IndexedDB. Files are marked
 * `unavailable: true` until the user clicks "Reconnect".
 */

import type { ScannedFile, MediaKind } from './media-scanner'
import type { MediaMetadata } from './metadata'
import type { EnrichedInfo, ScannedFolderInfo } from '@/store/library'

const LS_KEY = 'lumiere:library:v2'
const IDB_DB = 'lumiere'
const IDB_STORE = 'fsa-handles'
const IDB_ENRICHMENT_STORE = 'enrichment'

/* ------------------------- localStorage helpers ------------------------- */

export interface PersistedLibrary {
  scannedFolders: ScannedFolderInfo[]
  /** Manifest of files — same as ScannedFile minus the File object + blob URL. */
  fileManifest: Array<{
    id: string
    name: string
    path: string
    kind: MediaKind
    size: number
    folderId?: string
  }>
  /** Metadata without coverUrl (those are blob: URLs that don't survive reload). */
  rawMetadata: Record<string, Omit<MediaMetadata, 'coverUrl'>>
  /** Last-viewed tab. */
  currentView: string
  /** Schema version for future migrations. */
  version: 2
}

export function saveLibrary(state: PersistedLibrary): void {
  if (typeof window === 'undefined') return
  // Enrichment is NOT stored here — it goes to IndexedDB via saveEnrichment().
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch (err) {
    // QuotaExceededError — progressively strip data
    console.warn('saveLibrary: full save failed, trying without fileManifest', err)
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ ...state, fileManifest: [] }),
      )
    } catch (err2) {
      console.warn('saveLibrary: still too large, trying without rawMetadata', err2)
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({
            ...state,
            fileManifest: [],
            rawMetadata: {},
          }),
        )
      } catch (err3) {
        console.error('saveLibrary: all retries failed', err3)
      }
    }
  }
}

export function loadLibrary(): PersistedLibrary | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedLibrary
      if (parsed.version !== 2) return null
      return parsed
    }
    // No v2 data — try migrating from v1 key
    const old = localStorage.getItem('lumiere:library:v1')
    if (old) {
      console.log('[persist] Migrating from v1 to v2 format...')
      const parsed = JSON.parse(old) as PersistedLibrary & {
        enrichment?: Record<string, EnrichedInfo>
        version: number
      }
      // If old data has enrichment, save it to IndexedDB
      if (parsed.enrichment && Object.keys(parsed.enrichment).length > 0) {
        void saveEnrichment(parsed.enrichment)
      }
      const { enrichment: _, ...rest } = parsed
      void _
      const migrated: PersistedLibrary = { ...rest, version: 2 }
      // Immediately save the migrated data to v2 key so it persists
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(migrated))
        console.log('[persist] Migration complete — v2 data saved')
      } catch {
        console.warn('[persist] Could not save migrated v2 data (quota?)')
      }
      return migrated
    }
    return null
  } catch (err) {
    console.warn('loadLibrary failed', err)
    return null
  }
}

export function clearLibrary(): void {
  if (typeof window === 'undefined') return
  // Remove v2 key but KEEP v1 as a backup (in case of accidental clear).
  // The v1 key will be ignored on load since we check v2 first.
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
  // Also clear enrichment from IndexedDB
  void clearEnrichment()
}

/* --------------------- Enrichment IndexedDB storage ------------------- *
 *
 * Enrichment data (OMDB plots, cast strings, artist bios, album art URLs)
 * can be very large — easily 5-10MB for a library of 200+ items. localStorage
 * has a ~5MB quota, so we store enrichment in IndexedDB which has 50MB+.
 */

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
      console.warn('IndexedDB open failed', req.error)
      resolve(null)
    }
  })
}

export async function saveEnrichment(
  enrichment: Record<string, EnrichedInfo>,
): Promise<void> {
  const db = await openIdbWithEnrichment()
  if (!db) {
    // Fallback: try localStorage with a separate key (may fail for large data)
    try {
      localStorage.setItem('lumiere:enrichment', JSON.stringify(enrichment))
    } catch {
      console.warn('saveEnrichment: localStorage fallback also failed')
    }
    return
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_ENRICHMENT_STORE, 'readwrite')
      // Clear old data and store new
      tx.objectStore(IDB_ENRICHMENT_STORE).clear()
      tx.objectStore(IDB_ENRICHMENT_STORE).put(
        enrichment,
        'all',
      )
      tx.oncomplete = () => resolve()
      tx.onerror = () => {
        console.warn('saveEnrichment IDB failed', tx.error)
        resolve()
      }
    } catch {
      resolve()
    }
  })
}

export async function loadEnrichment(): Promise<
  Record<string, EnrichedInfo> | null
> {
  const db = await openIdbWithEnrichment()
  if (!db) {
    // Fallback: try localStorage
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

/* ------------------------- IndexedDB for FSA handles ------------------- */

function openIdb(): Promise<IDBDatabase | null> {
  // Reuse openIdbWithEnrichment — it creates both object stores at version 2.
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

/* --------------------- Re-hydrating ScannedFile objects ----------------- */

/**
 * Strip out the coverUrl from metadata before persistence (blob URLs don't
 * survive reload). We keep everything else.
 */
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

/**
 * Build "unavailable" ScannedFile stubs from a persisted manifest. These
 * let the UI render all the cards / posters / ratings, but block playback
 * until `reconnectFolder` re-attaches real File objects.
 */
export function manifestToUnavailableFiles(
  manifest: PersistedLibrary['fileManifest'],
): ScannedFile[] {
  return manifest.map((m) => ({
    id: m.id,
    // Placeholder File — never actually read; playback is blocked.
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

/* ---------------- FSA re-permission + re-walk on reconnect ------------- */

/**
 * Re-walk a FileSystemDirectoryHandle to rebuild File objects for every
 * media file. Returns a map of `path → File` so callers can match against
 * the persisted manifest.
 *
 * Every step is guarded against NotFoundError — files/folders may have
 * been moved, renamed, or deleted since the original scan.
 */
export async function walkFsaHandle(
  handle: FileSystemDirectoryHandle,
  prefix = '',
): Promise<Array<{ file: File; path: string }>> {
  const out: Array<{ file: File; path: string }> = []
  // The directory iteration itself can throw NotFoundError if the directory
  // was moved/deleted since the handle was stored.
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
          // File was deleted/moved between listing and read — skip it.
          console.warn(
            'walkFsaHandle: could not read file',
            entry.name,
            err,
          )
        }
      } else if (entry.kind === 'directory') {
        // Guard the recursive call — subdirectory may be unreadable.
        try {
          const sub = await walkFsaHandle(
            entry as FileSystemDirectoryHandle,
            prefix + entry.name + '/',
          )
          out.push(...sub)
        } catch (err) {
          console.warn(
            'walkFsaHandle: could not recurse into',
            entry.name,
            err,
          )
        }
      }
    }
  } catch (err) {
    // Iteration itself failed mid-walk (e.g. permission revoked, directory
    // moved). Log and return what we've collected so far.
    console.warn('walkFsaHandle: iteration failed for', handle.name, err)
  }
  return out
}

/**
 * Request read permission for a FileSystemDirectoryHandle. Returns true if
 * permission was granted. Never throws — all errors are caught and reported
 * as `false` so callers can fall back gracefully.
 */
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
    // Handle was invalidated (folder moved/deleted) — can't request permission.
    console.warn('ensurePermission: failed for', handle.name, err)
    return false
  }
}

export function isFsaSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}
