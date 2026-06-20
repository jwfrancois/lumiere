/**
 * Quick test: simulate a scan by injecting fake File objects into the store,
 * to verify the categorization + UI rendering pipeline works end-to-end.
 *
 * Run in browser console via agent-browser eval.
 */
const files = []

// Helper to create a fake File with embedded ID3-like metadata we hand-craft
function makeFile(name, contents, type = 'video/mp4') {
  return new File([contents], name, { type })
}

// Movies (some in collections, some standalone)
files.push({
  id: 'm1',
  file: makeFile('Lord of the Rings - Fellowship of the Ring 1.mp4', new ArrayBuffer(1000)),
  name: 'Lord of the Rings - Fellowship of the Ring 1.mp4',
  path: 'Movies/Lord of the Rings - Fellowship of the Ring 1.mp4',
  kind: 'video',
  size: 4500000000,
  url: URL.createObjectURL(makeFile('x', new ArrayBuffer(100))),
})
files.push({
  id: 'm2',
  file: makeFile('Lord of the Rings - The Two Towers 2.mp4', new ArrayBuffer(1000)),
  name: 'Lord of the Rings - The Two Towers 2.mp4',
  path: 'Movies/Lord of the Rings - The Two Towers 2.mp4',
  kind: 'video',
  size: 4800000000,
  url: URL.createObjectURL(makeFile('x', new ArrayBuffer(100))),
})
files.push({
  id: 'm3',
  file: makeFile('Lord of the Rings - Return of the King 3.mp4', new ArrayBuffer(1000)),
  name: 'Lord of the Rings - Return of the King 3.mp4',
  path: 'Movies/Lord of the Rings - Return of the King 3.mp4',
  kind: 'video',
  size: 5100000000,
  url: URL.createObjectURL(makeFile('x', new ArrayBuffer(100))),
})
files.push({
  id: 'm4',
  file: makeFile('Inception.mp4', new ArrayBuffer(1000)),
  name: 'Inception.mp4',
  path: 'Movies/Inception.mp4',
  kind: 'video',
  size: 3000000000,
  url: URL.createObjectURL(makeFile('x', new ArrayBuffer(100))),
})
files.push({
  id: 'm5',
  file: makeFile('The Matrix.mp4', new ArrayBuffer(1000)),
  name: 'The Matrix.mp4',
  path: 'Movies/The Matrix.mp4',
  kind: 'video',
  size: 2800000000,
  url: URL.createObjectURL(makeFile('x', new ArrayBuffer(100))),
})

// TV episodes
const tvFiles = [
  'Stranger Things - S01E01 - The Vanishing of Will Byers.mp4',
  'Stranger Things - S01E02 - The Weirdo on Maple Street.mp4',
  'Stranger Things - S01E03 - Holly, Jolly.mp4',
  'Stranger Things - S01E04 - The Body.mp4',
  'Stranger Things - S02E01 - MADMAX.mp4',
  'Stranger Things - S02E02 - Trick or Treat, Freak.mp4',
  'Breaking Bad - S01E01 - Pilot.mp4',
  'Breaking Bad - S01E02 - Cats in the Bag.mp4',
  'Breaking Bad - S02E01 - Seven Thirty-Seven.mp4',
]
tvFiles.forEach((name, i) => {
  files.push({
    id: 'tv' + i,
    file: makeFile(name, new ArrayBuffer(1000)),
    name,
    path: 'TV/' + name,
    kind: 'video',
    size: 800000000,
    url: URL.createObjectURL(makeFile('x', new ArrayBuffer(100))),
  })
})

// Music tracks (3 albums)
const musicFiles = [
  { name: '01 - Time.mp3', album: 'The Dark Side of the Moon', artist: 'Pink Floyd', track: 1 },
  { name: '02 - Breathe.mp3', album: 'The Dark Side of the Moon', artist: 'Pink Floyd', track: 2 },
  { name: '03 - On the Run.mp3', album: 'The Dark Side of the Moon', artist: 'Pink Floyd', track: 3 },
  { name: '04 - The Great Gig in the Sky.mp3', album: 'The Dark Side of the Moon', artist: 'Pink Floyd', track: 4 },
  { name: '01 - Smells Like Teen Spirit.mp3', album: 'Nevermind', artist: 'Nirvana', track: 1 },
  { name: '02 - In Bloom.mp3', album: 'Nevermind', artist: 'Nirvana', track: 2 },
  { name: '03 - Come As You Are.mp3', album: 'Nevermind', artist: 'Nirvana', track: 3 },
  { name: '01 - Yellow.mp3', album: 'Parachutes', artist: 'Coldplay', track: 1 },
  { name: '02 - Shiver.mp3', album: 'Parachutes', artist: 'Coldplay', track: 2 },
  { name: '03 - Sparks.mp3', album: 'Parachutes', artist: 'Coldplay', track: 3 },
]
musicFiles.forEach((m, i) => {
  files.push({
    id: 'mu' + i,
    file: makeFile(m.name, new ArrayBuffer(1000)),
    name: m.name,
    path: `Music/${m.artist}/${m.album}/${m.name}`,
    kind: 'audio',
    size: 8000000,
    url: URL.createObjectURL(makeFile('x', new ArrayBuffer(100))),
  })
})

// Podcasts
const podcastFiles = [
  { name: 'Episode 1 - The Beginning.mp3', show: 'Tech Talk Today', ep: 1 },
  { name: 'Episode 2 - The Future.mp3', show: 'Tech Talk Today', ep: 2 },
  { name: 'Episode 3 - The End.mp3', show: 'Tech Talk Today', ep: 3 },
  { name: 'Episode 50 - Long Form Interview.mp3', show: 'The Daily Long', ep: 50 },
  { name: 'Episode 51 - Politics Roundup.mp3', show: 'The Daily Long', ep: 51 },
]
podcastFiles.forEach((p, i) => {
  files.push({
    id: 'po' + i,
    file: makeFile(p.name, new ArrayBuffer(1000)),
    name: p.name,
    path: `Podcasts/${p.show}/${p.name}`,
    kind: 'audio',
    size: 50000000,
    url: URL.createObjectURL(makeFile('x', new ArrayBuffer(100))),
  })
})

// Build metadata map — simulate what extractMetadata would return
const metadata = {}
for (const f of files) {
  metadata[f.id] = {
    title: f.name.replace(/\.[^.]+$/, ''),
    durationSec: f.kind === 'video' ? 3600 : 240,
  }
}
// Music metadata
for (let i = 0; i < musicFiles.length; i++) {
  const m = musicFiles[i]
  metadata['mu' + i] = {
    title: m.name.replace(/^\d+\s*-\s*/, '').replace(/\.[^.]+$/, ''),
    album: m.album,
    artist: m.artist,
    albumArtist: m.artist,
    trackNumber: m.track,
    durationSec: 240,
  }
}
// Podcast metadata
for (let i = 0; i < podcastFiles.length; i++) {
  const p = podcastFiles[i]
  metadata['po' + i] = {
    title: p.name.replace(/\.[^.]+$/, ''),
    showName: p.show,
    episodeNumber: p.ep,
    durationSec: 1800 + i * 100,
  }
}

// Push to the store
window.__lumiereDebug = { files, metadata }
JSON.stringify({
  files: files.length,
  metadata: Object.keys(metadata).length,
})
