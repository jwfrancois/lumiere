/**
 * Library persistence layer.
 *
 * Two storage tiers:
 *
 * 1. **localStorage** — serializable library data:
 *    - folder list (id, name, fileCount, scannedAt, hasFsaHandle)
 *    - file manifest (id, name, path, kind, size, folderId — NOT the File object)
 *    - raw metadata (title, artist, album, etc. — minus coverUrl blob URLs)
 *    - enrichment (posterUrl, imdbRating, plot, etc.)
 *    - current view
 *
 * 2. **IndexedDB** — `FileSystemDirectoryHandle` objects (one per folder
 *    scanned via the File System Access API). These survive page reloads
 *    and can be re-permissioned with a single user gesture.
 *
 * On reload, we restore everything from localStorage. Files are marked
 * `unavailable: true` until the user clicks "Reconnect" — at which point
 * we re-permission the FSA handles (or fall back to re-picking folders)
 * and rebuild the `File` + `url` fields.
 */

import type { ScannedFile, MediaKind } from './media-scanner'
import type { MediaMetadata } from './metadata'
import type { EnrichedInfo, ScannedFolderInfo } from '@/store/library'

const LS_KEY = 'lumiere:library:v1'
const IDB_DB = 'lumiere'
const IDB_STORE = 'fsa-handles'

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
  /** OMDB enrichment data — survives intact. */
  enrichment: Record<string, EnrichedInfo>
  /** Last-viewed tab. */
  currentView: string
  /** Schema version for future migrations. */
  version: 1
}

export function saveLibrary(state: PersistedLibrary): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch (err) {
    // Most likely QuotaExceededError — library too large for localStorage.
    // In that case, drop the fileManifest (heaviest field) and retry.
    console.warn('saveLibrary failed, retrying without file manifest', err)
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ ...state, fileManifest: [] }),
      )
    } catch (err2) {
      console.error('saveLibrary retry failed', err2)
    }
  }
}

export function loadLibrary(): PersistedLibrary | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedLibrary
    if (parsed.version !== 1) return null
    return parsed
  } catch (err) {
    console.warn('loadLibrary failed', err)
    return null
  }
}

export function clearLibrary(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}

/* ------------------------- IndexedDB for FSA handles ------------------- */

function openIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    const req = indexedDB.open(IDB_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      console.warn('IndexedDB open failed', req.error)
      resolve(null)
    }
  })
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
 */
export async function walkFsaHandle(
  handle: FileSystemDirectoryHandle,
  prefix = '',
): Promise<Array<{ file: File; path: string }>> {
  const out: Array<{ file: File; path: string }> = []
  // @ts-expect-error - values() is in the FSA spec
  for await (const entry of handle.values()) {
    if (entry.kind === 'file') {
      try {
        const file = await (entry as FileSystemFileHandle).getFile()
        out.push({ file, path: prefix + file.name })
      } catch {
        // skip
      }
    } else if (entry.kind === 'directory') {
      const sub = await walkFsaHandle(
        entry as FileSystemDirectoryHandle,
        prefix + entry.name + '/',
      )
      out.push(...sub)
    }
  }
  return out
}

/**
 * Request read permission for a FileSystemDirectoryHandle. Returns true if
 * permission was granted.
 */
export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  // @ts-expect-error - queryPermission/requestPermission are not in TS DOM lib yet
  if ((await handle.queryPermission?.({ mode: 'read' })) === 'granted') {
    return true
  }
  // @ts-expect-error - requestPermission not in TS DOM lib yet
  const result = await handle.requestPermission?.({ mode: 'read' })
  return result === 'granted'
}

export function isFsaSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}
