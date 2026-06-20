// IIFE to inject test data via the lumiere:inject event
(function() {
  const files = []
  const metadata = {}

  function makeFile(name, kind) {
    return new File([new ArrayBuffer(100)], name, {
      type: kind === 'audio' ? 'audio/mpeg' : 'video/mp4',
    })
  }

  function add(id, name, path, kind, opts = {}) {
    const file = makeFile(name, kind)
    files.push({
      id,
      file,
      name,
      path,
      kind,
      size: kind === 'video' ? 1000000000 : 8000000,
      url: URL.createObjectURL(file),
    })
    metadata[id] = {
      title: name.replace(/\.[^.]+$/, ''),
      durationSec: kind === 'video' ? 3600 : 240,
      ...opts,
    }
  }

  // Movies — LOTR trilogy (collection), standalone Matrix and Inception
  add('m1', 'Lord of the Rings - Fellowship of the Ring 1.mp4', 'Movies/LOTR1.mp4', 'video', { year: 2001 })
  add('m2', 'Lord of the Rings - The Two Towers 2.mp4', 'Movies/LOTR2.mp4', 'video', { year: 2002 })
  add('m3', 'Lord of the Rings - Return of the King 3.mp4', 'Movies/LOTR3.mp4', 'video', { year: 2003 })
  add('m4', 'Inception.mp4', 'Movies/Inception.mp4', 'video', { year: 2010 })
  add('m5', 'The Matrix.mp4', 'Movies/The Matrix.mp4', 'video', { year: 1999 })

  // TV shows
  const tv = [
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
  tv.forEach((name, i) => add('tv' + i, name, 'TV/' + name, 'video'))

  // Music
  const music = [
    ['01 - Time.mp3', 'The Dark Side of the Moon', 'Pink Floyd', 1],
    ['02 - Breathe.mp3', 'The Dark Side of the Moon', 'Pink Floyd', 2],
    ['03 - On the Run.mp3', 'The Dark Side of the Moon', 'Pink Floyd', 3],
    ['04 - The Great Gig in the Sky.mp3', 'The Dark Side of the Moon', 'Pink Floyd', 4],
    ['01 - Smells Like Teen Spirit.mp3', 'Nevermind', 'Nirvana', 1],
    ['02 - In Bloom.mp3', 'Nevermind', 'Nirvana', 2],
    ['03 - Come As You Are.mp3', 'Nevermind', 'Nirvana', 3],
    ['01 - Yellow.mp3', 'Parachutes', 'Coldplay', 1],
    ['02 - Shiver.mp3', 'Parachutes', 'Coldplay', 2],
    ['03 - Sparks.mp3', 'Parachutes', 'Coldplay', 3],
  ]
  music.forEach((m, i) => {
    add('mu' + i, m[0], `Music/${m[1]}/${m[2]}/${m[0]}`, 'audio', {
      title: m[0].replace(/^\d+\s*-\s*/, '').replace(/\.[^.]+$/, ''),
      album: m[1],
      artist: m[2],
      albumArtist: m[2],
      trackNumber: m[3],
      year: 1973 + (i % 3) * 7,
    })
  })

  // Podcasts
  const pods = [
    ['Episode 1 - The Beginning.mp3', 'Tech Talk Today', 1],
    ['Episode 2 - The Future.mp3', 'Tech Talk Today', 2],
    ['Episode 3 - The End.mp3', 'Tech Talk Today', 3],
    ['Episode 50 - Long Form Interview.mp3', 'The Daily Long', 50],
    ['Episode 51 - Politics Roundup.mp3', 'The Daily Long', 51],
  ]
  pods.forEach((p, i) => {
    add('po' + i, p[0], `Podcasts/${p[1]}/${p[0]}`, 'audio', {
      title: p[0].replace(/\.[^.]+$/, ''),
      showName: p[1],
      episodeNumber: p[2],
      durationSec: 1800,
    })
  })

  window.dispatchEvent(new CustomEvent('lumiere:inject', { detail: { files, metadata } }))
  return `Dispatched: ${files.length} files, ${Object.keys(metadata).length} metadata`
})()
