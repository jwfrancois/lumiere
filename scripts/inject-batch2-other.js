// Inject TV shows + Music + Podcasts in a second batch — simulates scanning another folder
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
      id, file, name, path, kind,
      size: kind === 'video' ? 800000000 : 8000000,
      url: URL.createObjectURL(file),
    })
    metadata[id] = {
      title: name.replace(/\.[^.]+$/, ''),
      durationSec: kind === 'video' ? 3600 : 240,
      ...opts,
    }
  }

  // TV shows
  const tv = [
    'Stranger Things - S01E01 - The Vanishing of Will Byers.mp4',
    'Stranger Things - S01E02 - The Weirdo on Maple Street.mp4',
    'Stranger Things - S01E03 - Holly, Jolly.mp4',
    'Stranger Things - S01E04 - The Body.mp4',
    'Breaking Bad - S01E01 - Pilot.mp4',
    'Breaking Bad - S01E02 - Cats in the Bag.mp4',
  ]
  tv.forEach((name, i) => add('tv' + i, name, 'TV/' + name, 'video'))

  // Music
  const music = [
    ['01 - Time.mp3', 'The Dark Side of the Moon', 'Pink Floyd', 1],
    ['02 - Breathe.mp3', 'The Dark Side of the Moon', 'Pink Floyd', 2],
    ['01 - Smells Like Teen Spirit.mp3', 'Nevermind', 'Nirvana', 1],
    ['02 - In Bloom.mp3', 'Nevermind', 'Nirvana', 2],
  ]
  music.forEach((m, i) => {
    add('mu' + i, m[0], `Music/${m[1]}/${m[2]}/${m[0]}`, 'audio', {
      title: m[0].replace(/^\d+\s*-\s*/, '').replace(/\.[^.]+$/, ''),
      album: m[1],
      artist: m[2],
      albumArtist: m[2],
      trackNumber: m[3],
      year: 1973 + i * 7,
    })
  })

  // Podcasts
  const pods = [
    ['Episode 1 - The Beginning.mp3', 'Tech Talk Today', 1],
    ['Episode 2 - The Future.mp3', 'Tech Talk Today', 2],
  ]
  pods.forEach((p, i) => {
    add('po' + i, p[0], `Podcasts/${p[1]}/${p[0]}`, 'audio', {
      title: p[0].replace(/\.[^.]+$/, ''),
      showName: p[1],
      episodeNumber: p[2],
      durationSec: 1800,
    })
  })

  window.dispatchEvent(new CustomEvent('lumiere:inject', {
    detail: { files, metadata, folderName: 'TV-Music-Podcasts' }
  }))
  return `Dispatched batch 2: ${files.length} files (TV + Music + Podcasts)`
})()
