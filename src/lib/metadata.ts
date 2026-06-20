/**
 * Lightweight embedded metadata extraction for media files.
 *
 * - ID3v2 parser for MP3 (title, artist, album, year, track, cover art)
 * - MP4 box parser for M4A/MP4/MOV (title, artist, album, year, track, cover art)
 * - FLAC parser for native FLAC (vorbis comments + picture)
 *
 * Runs entirely client-side. No external dependencies.
 */

export interface MediaMetadata {
  title?: string
  artist?: string
  album?: string
  albumArtist?: string
  year?: number
  trackNumber?: number
  trackTotal?: number
  durationSec?: number
  genre?: string
  showName?: string
  seasonNumber?: number
  episodeNumber?: number
  episodeTotal?: number
  description?: string
  composer?: string
  copyright?: string
  coverUrl?: string // object URL for embedded artwork
  container?: string
  audioCodec?: string
  videoCodec?: string
  width?: number
  height?: number
  bitrate?: number
  sampleRate?: number
  channels?: number
}

const textDecoder = new TextDecoder('utf-8')
const utf16Decoder = new TextDecoder('utf-16')

function readUint32BE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] << 24) |
    (buf[offset + 1] << 16) |
    (buf[offset + 2] << 8) |
    buf[offset + 3]
  ) >>> 0
}

function readUint16BE(buf: Uint8Array, offset: number): number {
  return ((buf[offset] << 8) | buf[offset + 1]) >>> 0
}

function readSyncSafeInt(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] << 21) |
    (buf[offset + 1] << 14) |
    (buf[offset + 2] << 7) |
    buf[offset + 3]
  ) >>> 0
}

function decodeString(buf: Uint8Array, encoding: number): string {
  switch (encoding) {
    case 0: // ISO-8859-1
      return new TextDecoder('iso-8859-1').decode(buf)
    case 1: // UTF-16 with BOM
      return utf16Decoder.decode(buf)
    case 2: // UTF-16BE without BOM
      return new TextDecoder('utf-16be').decode(buf)
    case 3: // UTF-8
      return textDecoder.decode(buf)
    default:
      return textDecoder.decode(buf)
  }
}

/** Parse ID3v2 frames from an MP3 file. */
async function parseID3v2(file: File): Promise<Partial<MediaMetadata>> {
  const header = new Uint8Array(await file.slice(0, 10).arrayBuffer())
  if (
    header[0] !== 0x49 || // I
    header[1] !== 0x44 || // D
    header[2] !== 0x33 // 3
  ) {
    return {}
  }
  const versionMajor = header[3]
  const flags = header[5]
  const tagSize = readSyncSafeInt(header, 6)
  const tagBytes = new Uint8Array(
    await file.slice(10, 10 + tagSize).arrayBuffer(),
  )

  const meta: Partial<MediaMetadata> = {}
  let offset = 0
  const hasFooter = (flags & 0x10) !== 0
  const endOffset = hasFooter ? tagBytes.length - 10 : tagBytes.length

  while (offset + 10 < endOffset) {
    const frameId = String.fromCharCode(
      tagBytes[offset],
      tagBytes[offset + 1],
      tagBytes[offset + 2],
      tagBytes[offset + 3],
    )
    if (frameId === '\0\0\0\0') break

    let frameSize: number
    if (versionMajor === 4) {
      frameSize = readSyncSafeInt(tagBytes, offset + 4)
    } else {
      frameSize = readUint32BE(tagBytes, offset + 4)
    }
    const frameFlags = readUint16BE(tagBytes, offset + 8)
    offset += 10

    if (frameSize <= 0 || offset + frameSize > endOffset) break

    const frameData = tagBytes.subarray(offset, offset + frameSize)
    offset += frameSize

    // Skip compressed/encrypted frames (we don't support them)
    if (frameFlags & 0x0080) continue

    try {
      switch (frameId) {
        case 'TIT2': // Title
          meta.title = decodeTextFrame(frameData)
          break
        case 'TPE1': // Artist
          meta.artist = decodeTextFrame(frameData)
          break
        case 'TPE2': // Band / album artist
          meta.albumArtist = decodeTextFrame(frameData)
          break
        case 'TALB': // Album
          meta.album = decodeTextFrame(frameData)
          break
        case 'TYER':
        case 'TDRC': {
          const y = decodeTextFrame(frameData)
          const m = y.match(/(\d{4})/)
          if (m) meta.year = parseInt(m[1], 10)
          break
        }
        case 'TRCK': {
          const v = decodeTextFrame(frameData)
          const m = v.match(/^(\d+)(?:\/(\d+))?/)
          if (m) {
            meta.trackNumber = parseInt(m[1], 10)
            if (m[2]) meta.trackTotal = parseInt(m[2], 10)
          }
          break
        }
        case 'TPOS': {
          const v = decodeTextFrame(frameData)
          const m = v.match(/^(\d+)(?:\/(\d+))?/)
          if (m) {
            meta.seasonNumber = parseInt(m[1], 10)
            if (m[2]) meta.episodeTotal = parseInt(m[2], 10)
          }
          break
        }
        case 'TCON': // Genre
          meta.genre = decodeTextFrame(frameData)
          break
        case 'TCOM': // Composer
          meta.composer = decodeTextFrame(frameData)
          break
        case 'TCOP': // Copyright
          meta.copyright = decodeTextFrame(frameData)
          break
        case 'TDESC':
        case 'COMM': {
          // COMM frame: encoding(1) + language(3) + short desc + \0 + text
          if (frameId === 'COMM' && frameData.length > 4) {
            const enc = frameData[0]
            // skip language + description
            const desc = decodeString(frameData.subarray(4), enc)
            // description ends with null — but we just take whole decoded string
            meta.description = desc
          } else {
            meta.description = decodeTextFrame(frameData)
          }
          break
        }
        case 'APIC': // Picture
        case 'PIC': {
          if (!meta.coverUrl) {
            const cover = extractPicture(frameData, frameId === 'PIC')
            if (cover) {
              const blob = new Blob([cover.data], { type: cover.mime })
              meta.coverUrl = URL.createObjectURL(blob)
            }
          }
          break
        }
      }
    } catch {
      // ignore malformed frames
    }
  }

  return meta
}

function decodeTextFrame(frameData: Uint8Array): string {
  if (frameData.length < 1) return ''
  const encoding = frameData[0]
  const text = frameData.subarray(1)
  // Strip trailing nulls / BOMs
  let end = text.length
  while (end > 0 && (text[end - 1] === 0 || text[end - 1] === 0xff)) end--
  return decodeString(text.subarray(0, end), encoding).replace(/\0.*$/, '')
}

function extractPicture(
  frameData: Uint8Array,
  isLegacyPic: boolean,
): { mime: string; data: Uint8Array } | null {
  const encoding = frameData[0]
  let offset = 1
  let mime: string
  if (isLegacyPic) {
    // PIC: 3-char image format
    mime = 'image/' + textDecoder.decode(frameData.subarray(1, 4)).toLowerCase()
    offset = 4
  } else {
    // APIC: null-terminated MIME
    let mimeEnd = offset
    while (mimeEnd < frameData.length && frameData[mimeEnd] !== 0) mimeEnd++
    mime = textDecoder.decode(frameData.subarray(offset, mimeEnd))
    offset = mimeEnd + 1
  }
  // picture type (1 byte)
  offset += 1
  // description (null-terminated, encoding dependent)
  if (encoding === 1 || encoding === 2) {
    // UTF-16 — null terminator is 2 bytes
    while (offset + 1 < frameData.length) {
      if (frameData[offset] === 0 && frameData[offset + 1] === 0) {
        offset += 2
        break
      }
      offset++
    }
  } else {
    while (offset < frameData.length && frameData[offset] !== 0) offset++
    offset++
  }
  const data = frameData.subarray(offset)
  return { mime: mime || 'image/jpeg', data }
}

/**
 * Parse MP4 / M4A / MOV boxes. Looks for the `moov` atom and reads
 * `ilst` items (metadata) plus `mvhd` (duration) and `trak` (codec info).
 */
async function parseMP4(file: File): Promise<Partial<MediaMetadata>> {
  const meta: Partial<MediaMetadata> = { container: 'mp4' }
  const size = file.size
  // We'll iterate top-level atoms. For very large files, we only read
  // what we need. The moov atom can be at the start or end.
  let offset = 0
  // First, scan top-level atoms to find moov position
  let moovPos = -1
  let moovSize = 0
  // Limit scan to first/last 64MB for safety
  const headerBuf = new Uint8Array(
    await file.slice(0, Math.min(size, 8 * 1024 * 1024)).arrayBuffer(),
  )
  let p = 0
  while (p + 8 <= headerBuf.length) {
    const atomSize = readUint32BE(headerBuf, p)
    const atomType = String.fromCharCode(
      headerBuf[p + 4],
      headerBuf[p + 5],
      headerBuf[p + 6],
      headerBuf[p + 7],
    )
    let actualSize = atomSize
    if (atomSize === 1) {
      // 64-bit size
      if (p + 16 > headerBuf.length) break
      const hi = readUint32BE(headerBuf, p + 8)
      const lo = readUint32BE(headerBuf, p + 12)
      actualSize = hi * 2 ** 32 + lo
    }
    if (atomType === 'moov') {
      moovPos = p
      moovSize = actualSize
      break
    }
    if (actualSize < 8) break
    p += actualSize
    if (p >= headerBuf.length) break
  }

  if (moovPos === -1) return meta

  // Read moov fully (capped at 64MB)
  const moovBuf = new Uint8Array(
    await file
      .slice(moovPos, moovPos + Math.min(moovSize, 64 * 1024 * 1024))
      .arrayBuffer(),
  )

  // Walk moov children
  let m = 8
  while (m + 8 <= moovBuf.length) {
    const sz = readUint32BE(moovBuf, m)
    const type = String.fromCharCode(
      moovBuf[m + 4],
      moovBuf[m + 5],
      moovBuf[m + 6],
      moovBuf[m + 7],
    )
    let actual = sz
    if (sz === 1 && m + 16 <= moovBuf.length) {
      actual = readUint32BE(moovBuf, m + 8) * 2 ** 32 + readUint32BE(moovBuf, m + 12)
    }
    if (type === 'mvhd') {
      parseMvhd(moovBuf.subarray(m + 8, m + actual), meta)
    } else if (type === 'trak') {
      parseTrak(moovBuf.subarray(m + 8, m + actual), meta)
    } else if (type === 'udta') {
      parseUdta(moovBuf.subarray(m + 8, m + actual), meta)
    } else if (type === 'ilst' || type === 'meta') {
      // meta has 4 bytes version/flags before children
      const childStart = type === 'meta' ? m + 12 : m + 8
      parseIlst(moovBuf.subarray(childStart, m + actual), meta)
    }
    if (actual < 8) break
    m += actual
  }

  return meta
}

function parseMvhd(buf: Uint8Array, meta: Partial<MediaMetadata>) {
  if (buf.length < 20) return
  const version = buf[0]
  let offset = 4
  let timescale: number
  let duration: number
  if (version === 1) {
    if (buf.length < 32) return
    offset += 8 + 8 // creation + modification (64-bit)
    timescale = readUint32BE(buf, offset)
    offset += 4
    const hi = readUint32BE(buf, offset)
    const lo = readUint32BE(buf, offset + 4)
    duration = hi * 2 ** 32 + lo
    offset += 8
  } else {
    offset += 4 + 4 // creation + modification (32-bit)
    timescale = readUint32BE(buf, offset)
    offset += 4
    duration = readUint32BE(buf, offset)
    offset += 4
  }
  if (timescale > 0 && duration > 0) {
    meta.durationSec = duration / timescale
  }
}

function parseTrak(buf: Uint8Array, meta: Partial<MediaMetadata>) {
  // Find mdia → hdlr + minf → stbl → stsd to detect codec
  let p = 0
  let isVideo = false
  let isAudio = false
  while (p + 8 <= buf.length) {
    const sz = readUint32BE(buf, p)
    const type = String.fromCharCode(
      buf[p + 4],
      buf[p + 5],
      buf[p + 6],
      buf[p + 7],
    )
    let actual = sz
    if (sz === 1 && p + 16 <= buf.length) {
      actual = readUint32BE(buf, p + 8) * 2 ** 32 + readUint32BE(buf, p + 12)
    }
    if (type === 'mdia') {
      // Look for hdlr inside
      const mdia = buf.subarray(p + 8, p + actual)
      let q = 0
      while (q + 8 <= mdia.length) {
        const sz2 = readUint32BE(mdia, q)
        const t2 = String.fromCharCode(
          mdia[q + 4],
          mdia[q + 5],
          mdia[q + 6],
          mdia[q + 7],
        )
        let a2 = sz2
        if (sz2 === 1 && q + 16 <= mdia.length) {
          a2 = readUint32BE(mdia, q + 8) * 2 ** 32 + readUint32BE(mdia, q + 12)
        }
        if (t2 === 'hdlr' && q + 16 <= mdia.length) {
          const subtype = String.fromCharCode(
            mdia[q + 12],
            mdia[q + 13],
            mdia[q + 14],
            mdia[q + 15],
          )
          if (subtype === 'vide') isVideo = true
          if (subtype === 'soun') isAudio = true
        }
        if (t2 === 'minf' && (isVideo || isAudio)) {
          const minf = mdia.subarray(q + 8, q + a2)
          parseMinf(minf, meta, isVideo, isAudio)
        }
        if (a2 < 8) break
        q += a2
      }
    }
    if (actual < 8) break
    p += actual
  }
}

function parseMinf(
  buf: Uint8Array,
  meta: Partial<MediaMetadata>,
  isVideo: boolean,
  isAudio: boolean,
) {
  let p = 0
  while (p + 8 <= buf.length) {
    const sz = readUint32BE(buf, p)
    const type = String.fromCharCode(
      buf[p + 4],
      buf[p + 5],
      buf[p + 6],
      buf[p + 7],
    )
    let actual = sz
    if (sz === 1 && p + 16 <= buf.length) {
      actual = readUint32BE(buf, p + 8) * 2 ** 32 + readUint32BE(buf, p + 12)
    }
    if (type === 'stbl') {
      const stbl = buf.subarray(p + 8, p + actual)
      let q = 0
      while (q + 8 <= stbl.length) {
        const sz2 = readUint32BE(stbl, q)
        const t2 = String.fromCharCode(
          stbl[q + 4],
          stbl[q + 5],
          stbl[q + 6],
          stbl[q + 7],
        )
        let a2 = sz2
        if (sz2 === 1 && q + 16 <= stbl.length) {
          a2 = readUint32BE(stbl, q + 8) * 2 ** 32 + readUint32BE(stbl, q + 12)
        }
        if (t2 === 'stsd') {
          const stsd = stbl.subarray(q + 8, q + a2)
          parseStsd(stsd, meta, isVideo, isAudio)
        }
        if (a2 < 8) break
        q += a2
      }
    }
    if (actual < 8) break
    p += actual
  }
}

function parseStsd(
  buf: Uint8Array,
  meta: Partial<MediaMetadata>,
  isVideo: boolean,
  isAudio: boolean,
) {
  // stsd: version/flags(4) + entry count(4) + entries
  if (buf.length < 8) return
  const entryCount = readUint32BE(buf, 4)
  if (entryCount < 1) return
  let off = 8
  for (let i = 0; i < entryCount && off + 16 <= buf.length; i++) {
    const entrySize = readUint32BE(buf, off)
    const codec = String.fromCharCode(
      buf[off + 4],
      buf[off + 5],
      buf[off + 6],
      buf[off + 7],
    )
    if (isVideo && !meta.videoCodec) {
      meta.videoCodec = codec
      // For video samples, the visual sample entry has width/height at fixed offset
      // Skip: 6 reserved + 2 data_ref_index + 16 reserved + 4 width + 4 height
      if (off + 36 <= buf.length) {
        meta.width = readUint16BE(buf, off + 32)
        meta.height = readUint16BE(buf, off + 34)
      }
    }
    if (isAudio && !meta.audioCodec) {
      meta.audioCodec = codec
      // Audio sample entry: 6 reserved + 2 data_ref_index + 8 reserved + 2 channels + 2 sample size + 2 compression id + 2 packet size + 4 sample rate (16.16)
      if (off + 28 <= buf.length) {
        meta.channels = readUint16BE(buf, off + 24)
        meta.sampleRate = readUint32BE(buf, off + 32) >>> 16
      }
    }
    if (entrySize < 8) break
    off += entrySize
  }
}

function parseUdta(buf: Uint8Array, meta: Partial<MediaMetadata>) {
  // Look for meta atom inside udta
  let p = 0
  while (p + 8 <= buf.length) {
    const sz = readUint32BE(buf, p)
    const type = String.fromCharCode(
      buf[p + 4],
      buf[p + 5],
      buf[p + 6],
      buf[p + 7],
    )
    let actual = sz
    if (sz === 1 && p + 16 <= buf.length) {
      actual = readUint32BE(buf, p + 8) * 2 ** 32 + readUint32BE(buf, p + 12)
    }
    if (type === 'meta') {
      // meta has 4 bytes version/flags before children
      parseIlst(buf.subarray(p + 12, p + actual), meta)
    }
    if (actual < 8) break
    p += actual
  }
}

function parseIlst(buf: Uint8Array, meta: Partial<MediaMetadata>) {
  let p = 0
  while (p + 8 <= buf.length) {
    const sz = readUint32BE(buf, p)
    const type = String.fromCharCode(
      buf[p + 4],
      buf[p + 5],
      buf[p + 6],
      buf[p + 7],
    )
    let actual = sz
    if (sz === 1 && p + 16 <= buf.length) {
      actual = readUint32BE(buf, p + 8) * 2 ** 32 + readUint32BE(buf, p + 12)
    }
    if (actual < 8) break
    const item = buf.subarray(p + 8, p + actual)
    try {
      switch (type) {
        case '\xa9nam': // ©nam
          meta.title = parseIlstValue(item)
          break
        case '\xa9ART':
          meta.artist = parseIlstValue(item)
          break
        case 'aART':
          meta.albumArtist = parseIlstValue(item)
          break
        case '\xa9alb':
          meta.album = parseIlstValue(item)
          break
        case '\xa9day': {
          const v = parseIlstValue(item)
          const m = v.match(/(\d{4})/)
          if (m) meta.year = parseInt(m[1], 10)
          break
        }
        case '\xa9gen':
          meta.genre = parseIlstValue(item)
          break
        case '\xa9wrt':
          meta.composer = parseIlstValue(item)
          break
        case '\xa9cmt':
        case 'desc':
          meta.description = parseIlstValue(item)
          break
        case 'trkn': {
          // trkn: data type 0, flags, 4 bytes (track #, total) for track, plus disk
          const data = findDataAtom(item)
          if (data && data.length >= 4) {
            meta.trackNumber = readUint16BE(data, 2)
            meta.trackTotal = readUint16BE(data, 4)
          }
          break
        }
        case 'tvsh':
          meta.showName = parseIlstValue(item)
          break
        case 'tvsn': {
          const data = findDataAtom(item)
          if (data && data.length >= 4) {
            meta.seasonNumber = readUint32BE(data, 0)
          }
          break
        }
        case 'tves':
        case 'tven': {
          const data = findDataAtom(item)
          if (data && data.length >= 4) {
            meta.episodeNumber = readUint32BE(data, 0)
          }
          break
        }
        case 'covr': {
          if (!meta.coverUrl) {
            const data = findDataAtom(item, true)
            if (data) {
              const blob = new Blob([data.bytes], { type: data.mime })
              meta.coverUrl = URL.createObjectURL(blob)
            }
          }
          break
        }
      }
    } catch {
      // ignore
    }
    p += actual
  }
}

function findDataAtom(
  item: Uint8Array,
  isPicture = false,
): Uint8Array | { bytes: Uint8Array; mime: string } | null {
  // Inside item, find 'data' atom
  let q = 0
  while (q + 8 <= item.length) {
    const sz = readUint32BE(item, q)
    const type = String.fromCharCode(
      item[q + 4],
      item[q + 5],
      item[q + 6],
      item[q + 7],
    )
    let actual = sz
    if (sz === 1 && q + 16 <= item.length) {
      actual = readUint32BE(item, q + 8) * 2 ** 32 + readUint32BE(item, q + 12)
    }
    if (type === 'data') {
      // 4 bytes type indicator + 4 bytes locale + data
      const typeIndicator = readUint32BE(item, q + 8)
      const dataBytes = item.subarray(q + 16, q + actual)
      if (isPicture) {
        let mime = 'image/jpeg'
        if (typeIndicator === 14) mime = 'image/png'
        else if (typeIndicator === 27) mime = 'image/jpeg'
        else if (typeIndicator === 13) mime = 'image/jpeg'
        return { bytes: dataBytes, mime }
      }
      return dataBytes
    }
    if (actual < 8) break
    q += actual
  }
  return null
}

function parseIlstValue(item: Uint8Array): string {
  const data = findDataAtom(item)
  if (!data) return ''
  // UTF-8 by default; for type indicator 1, UTF-16
  return textDecoder.decode(data).replace(/\0+$/, '')
}

/** Parse Vorbis comments from FLAC files. */
async function parseFLAC(file: File): Promise<Partial<MediaMetadata>> {
  const meta: Partial<MediaMetadata> = { container: 'flac' }
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  if (
    header[0] !== 0x66 || // f
    header[1] !== 0x4c || // L
    header[2] !== 0x61 || // a
    header[3] !== 0x43 // C
  ) {
    return meta
  }
  // Read metadata blocks
  let offset = 4
  let isLast = false
  let safety = 0
  while (!isLast && safety < 100) {
    safety++
    const blockHeader = new Uint8Array(await file.slice(offset, offset + 4).arrayBuffer())
    if (blockHeader.length < 4) break
    const blockType = blockHeader[0] & 0x7f
    isLast = (blockHeader[0] & 0x80) !== 0
    const blockSize = (blockHeader[1] << 16) | (blockHeader[2] << 8) | blockHeader[3]
    const blockData = new Uint8Array(
      await file.slice(offset + 4, offset + 4 + blockSize).arrayBuffer(),
    )
    offset += 4 + blockSize

    if (blockType === 0) {
      // STREAMINFO — sample rate is at bits 80..100
      if (blockData.length >= 18) {
        const sampleRate =
          (blockData[10] << 12) |
          (blockData[11] << 4) |
          (blockData[12] >> 4)
        meta.sampleRate = sampleRate
        meta.channels = ((blockData[12] >> 1) & 0x07) + 1
      }
    } else if (blockType === 4) {
      // VORBIS_COMMENT
      parseVorbisComment(blockData, meta)
    } else if (blockType === 6) {
      // PICTURE
      parseFlacPicture(blockData, meta)
    }
  }
  return meta
}

function parseVorbisComment(buf: Uint8Array, meta: Partial<MediaMetadata>) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  if (buf.length < 4) return
  const vendorLen = dv.getUint32(0, true)
  let off = 4 + vendorLen
  if (off + 4 > buf.length) return
  const count = dv.getUint32(off, true)
  off += 4
  for (let i = 0; i < count && off + 4 <= buf.length; i++) {
    const len = dv.getUint32(off, true)
    off += 4
    if (off + len > buf.length) break
    const str = textDecoder.decode(buf.subarray(off, off + len))
    off += len
    const eq = str.indexOf('=')
    if (eq < 0) continue
    const key = str.substring(0, eq).toUpperCase()
    const val = str.substring(eq + 1)
    switch (key) {
      case 'TITLE':
        meta.title = val
        break
      case 'ARTIST':
        meta.artist = val
        break
      case 'ALBUM':
        meta.album = val
        break
      case 'ALBUMARTIST':
      case 'ALBUM ARTIST':
        meta.albumArtist = val
        break
      case 'DATE':
      case 'YEAR': {
        const m = val.match(/(\d{4})/)
        if (m) meta.year = parseInt(m[1], 10)
        break
      }
      case 'TRACKNUMBER':
        meta.trackNumber = parseInt(val, 10)
        break
      case 'TRACKTOTAL':
      case 'TOTALTRACKS':
        meta.trackTotal = parseInt(val, 10)
        break
      case 'GENRE':
        meta.genre = val
        break
      case 'COMPOSER':
        meta.composer = val
        break
      case 'DESCRIPTION':
      case 'COMMENT':
        meta.description = val
        break
      case 'SHOW':
      case 'TVSHOW':
        meta.showName = val
        break
      case 'EPISODE':
      case 'EPISODENUMBER':
        meta.episodeNumber = parseInt(val, 10)
        break
      case 'SEASON':
      case 'SEASONNUMBER':
        meta.seasonNumber = parseInt(val, 10)
        break
    }
  }
}

function parseFlacPicture(buf: Uint8Array, meta: Partial<MediaMetadata>) {
  if (meta.coverUrl || buf.length < 32) return
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const picType = dv.getUint32(0, true)
  if (picType !== 3 && picType !== 0) return // only front cover / other
  const mimeLen = dv.getUint32(4, true)
  if (8 + mimeLen > buf.length) return
  const mime = textDecoder.decode(buf.subarray(8, 8 + mimeLen))
  let off = 8 + mimeLen
  const descLen = dv.getUint32(off, true)
  off += 4 + descLen
  off += 16 // width, height, depth, colors
  if (off + 4 > buf.length) return
  const dataLen = dv.getUint32(off, true)
  off += 4
  if (off + dataLen > buf.length) return
  const bytes = buf.subarray(off, off + dataLen)
  const blob = new Blob([bytes], { type: mime || 'image/jpeg' })
  meta.coverUrl = URL.createObjectURL(blob)
}

/**
 * Get duration by probing with HTMLMediaElement.
 * Used as a fallback when metadata doesn't include duration.
 *
 * Never throws — all errors are caught and resolved as `undefined`.
 */
export function probeDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    let url: string | undefined
    try {
      url = URL.createObjectURL(file)
    } catch (err) {
      // File is invalid or empty (e.g. a placeholder after reload) — bail.
      console.warn('probeDuration: could not create object URL', file.name, err)
      resolve(undefined)
      return
    }
    const isAudio =
      file.type.startsWith('audio') ||
      /\.(mp3|flac|m4a|aac|wav|ogg)$/i.test(file.name)
    const el = document.createElement(
      isAudio ? 'audio' : 'video',
    ) as HTMLMediaElement
    el.preload = 'metadata'
    // Safety timeout — if the browser can't decode the file, neither
    // onloadedmetadata nor onerror may fire. Resolve after 8s.
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url!)
      resolve(undefined)
    }, 8000)
    el.onloadedmetadata = () => {
      clearTimeout(timeout)
      const d = el.duration
      URL.revokeObjectURL(url!)
      if (isFinite(d) && d > 0) resolve(d)
      else resolve(undefined)
    }
    el.onerror = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url!)
      resolve(undefined)
    }
    try {
      el.src = url
    } catch (err) {
      clearTimeout(timeout)
      URL.revokeObjectURL(url!)
      console.warn('probeDuration: could not set src', file.name, err)
      resolve(undefined)
    }
  })
}

/**
 * Extract metadata from a media file.
 * Detects container by extension / mime type.
 */
export async function extractMetadata(file: File): Promise<MediaMetadata> {
  const name = file.name.toLowerCase()
  let meta: MediaMetadata = {}

  try {
    if (name.endsWith('.mp3')) {
      meta = { ...(await parseID3v2(file)), container: 'mp3' }
    } else if (
      name.endsWith('.m4a') ||
      name.endsWith('.m4b') ||
      name.endsWith('.m4p') ||
      name.endsWith('.mp4') ||
      name.endsWith('.m4v') ||
      name.endsWith('.mov')
    ) {
      meta = await parseMP4(file)
    } else if (name.endsWith('.flac')) {
      meta = await parseFLAC(file)
    }
  } catch (err) {
    console.warn('metadata parse failed for', file.name, err)
  }

  if (!meta.durationSec) {
    try {
      const d = await probeDuration(file)
      if (d) meta.durationSec = d
    } catch (err) {
      // probeDuration shouldn't throw, but guard anyway.
      console.warn('probeDuration failed for', file.name, err)
    }
  }

  // Infer title from filename if not embedded
  if (!meta.title) {
    meta.title = file.name.replace(/\.[^.]+$/, '').replace(/[._]/g, ' ').trim()
  }

  return meta
}

/** Format seconds as M:SS or H:MM:SS. */
export function formatDuration(seconds?: number): string {
  if (!seconds || !isFinite(seconds)) return '--:--'
  const s = Math.floor(seconds % 60)
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Format seconds as a human-friendly long string, e.g. "1 hr 42 min". */
export function formatRuntimeLong(seconds?: number): string {
  if (!seconds || !isFinite(seconds)) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} hr ${m} min`
  return `${m} min`
}
