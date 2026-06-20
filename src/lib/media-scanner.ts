/**
 * Media library scanner.
 *
 * Uses the File System Access API (Chrome/Edge) when available to let the user
 * grant access to a folder on their local computer. Falls back to the classic
 * <input type="file" webkitdirectory> picker in other browsers.
 */

export const VIDEO_EXTENSIONS = [
  '.mp4',
  '.m4v',
  '.mov',
  '.mkv',
  '.webm',
  '.avi',
  '.ogv',
]
export const AUDIO_EXTENSIONS = [
  '.mp3',
  '.flac',
  '.m4a',
  '.m4b',
  '.aac',
  '.wav',
  '.ogg',
  '.oga',
  '.opus',
]

export type MediaKind = 'video' | 'audio'

export interface ScannedFile {
  id: string
  file: File
  name: string
  path: string // relative path inside the scanned root
  kind: MediaKind
  size: number
  url: string // object URL for playback
  /**
   * True when the underlying File object isn't available (e.g. after a page
   * reload, before the user re-grants folder access). The library still
   * shows the item with its metadata + enrichment, but playback is blocked
   * until the folder is reconnected.
   */
  unavailable?: boolean
  /** ID of the folder this file came from (used for batch reconnect). */
  folderId?: string
}

const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

function getExt(name: string): string {
  const m = name.toLowerCase().match(/(\.[^.]+)$/)
  return m ? m[1] : ''
}

function classify(name: string): MediaKind | null {
  const ext = getExt(name)
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video'
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio'
  return null
}

/** Recursively walk a directory handle, yielding all File entries. */
async function* walkDirectory(
  dirHandle: FileSystemDirectoryHandle,
  prefix = '',
): AsyncGenerator<{ file: File; path: string }> {
  // @ts-expect-error - values() exists in the FSA spec
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      try {
        const file = await (entry as FileSystemFileHandle).getFile()
        yield { file, path: prefix + file.name }
      } catch {
        // skip files we can't read
      }
    } else if (entry.kind === 'directory') {
      yield* walkDirectory(
        entry as FileSystemDirectoryHandle,
        prefix + entry.name + '/',
      )
    }
  }
}

export interface ScanProgress {
  scanned: number
  found: number
  currentPath: string
}

export interface ScanResult {
  files: ScannedFile[]
  /** Display name of the root folder that was scanned. */
  folderName?: string
  /** The FSA directory handle (when scanned via FSA). Persistable in IndexedDB. */
  fsaHandle?: FileSystemDirectoryHandle | null
}

/** Scan using the File System Access API (preferred path). */
export async function scanWithFSAccess(
  onProgress?: (p: ScanProgress) => void,
): Promise<ScanResult | null> {
  if (!('showDirectoryPicker' in window)) return null
  let handle: FileSystemDirectoryHandle
  try {
    // @ts-expect-error - showDirectoryPicker is not in TS DOM lib yet
    handle = await window.showDirectoryPicker()
  } catch (err) {
    // user cancelled
    return null
  }
  const files: ScannedFile[] = []
  let scanned = 0
  let found = 0
  for await (const { file, path } of walkDirectory(handle)) {
    scanned++
    const kind = classify(file.name)
    onProgress?.({
      scanned,
      found,
      currentPath: path,
    })
    if (!kind) continue
    files.push({
      id: uid(),
      file,
      name: file.name,
      path,
      kind,
      size: file.size,
      url: URL.createObjectURL(file),
    })
    found++
    onProgress?.({
      scanned,
      found,
      currentPath: path,
    })
  }
  return { files, folderName: handle.name, fsaHandle: handle }
}

/**
 * Scan using a FileList from <input webkitdirectory>. This works in every
 * modern browser and is the fallback path.
 */
export function scanFromFileList(fileList: FileList): ScanResult {
  const files: ScannedFile[] = []
  let folderName: string | undefined
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]
    const kind = classify(file.name)
    if (!kind) continue
    // webkitRelativePath gives "FolderName/sub/file.mp4"
    const relPath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name
    if (!folderName && relPath.includes('/')) {
      folderName = relPath.split('/')[0]
    }
    files.push({
      id: uid(),
      file,
      name: file.name,
      path: relPath,
      kind,
      size: file.size,
      url: URL.createObjectURL(file),
    })
  }
  return { files, folderName }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function isFSAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}
