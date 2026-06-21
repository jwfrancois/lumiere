// Inject movies with subtitle-based sequels (NO sequel numbers) —
// these should now be detected as a collection via shared-prefix strategy 2
(function() {
  const files = []
  const metadata = {}

  function makeFile(name) {
    return new File([new ArrayBuffer(100)], name, { type: 'video/mp4' })
  }

  function add(id, name, path, opts = {}) {
    const file = makeFile(name)
    files.push({
      id, file, name, path, kind: 'video',
      size: 1000000000,
      url: URL.createObjectURL(file),
    })
    metadata[id] = {
      title: name.replace(/\.[^.]+$/, ''),
      durationSec: 7200,
      ...opts,
    }
  }

  // Star Wars original trilogy — subtitle-based, NO numbers
  add('sw1', 'Star Wars A New Hope.mp4', 'Movies/Star Wars/A New Hope.mp4', { year: 1977 })
  add('sw2', 'Star Wars The Empire Strikes Back.mp4', 'Movies/Star Wars/Empire.mp4', { year: 1980 })
  add('sw3', 'Star Wars Return of the Jedi.mp4', 'Movies/Star Wars/Jedi.mp4', { year: 1983 })

  // Hunger Games — mix of numbered and subtitle
  add('hg1', 'The Hunger Games.mp4', 'Movies/Hunger Games/Hunger Games.mp4', { year: 2012 })
  add('hg2', 'The Hunger Games Catching Fire.mp4', 'Movies/Hunger Games/Catching Fire.mp4', { year: 2013 })
  add('hg3', 'The Hunger Games Mockingjay Part 1.mp4', 'Movies/Hunger Games/Mockingjay 1.mp4', { year: 2014 })
  add('hg4', 'The Hunger Games Mockingjay Part 2.mp4', 'Movies/Hunger Games/Mockingjay 2.mp4', { year: 2015 })

  // Standalone movies
  add('s1', 'Inception.mp4', 'Movies/Inception.mp4', { year: 2010 })
  add('s2', 'The Matrix.mp4', 'Movies/The Matrix.mp4', { year: 1999 })
  add('s3', 'Interstellar.mp4', 'Movies/Interstellar.mp4', { year: 2014 })

  window.dispatchEvent(new CustomEvent('lumiere:inject', {
    detail: { files, metadata, folderName: 'Movies' }
  }))
  return `Dispatched: ${files.length} files`
})()
