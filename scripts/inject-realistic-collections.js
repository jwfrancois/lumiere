// Inject movies organized in franchise folders — tests path-based detection
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

  // Star Wars — in a franchise folder, different subtitles
  add('sw1', 'A New Hope.mp4', 'Star Wars/A New Hope.mp4', { year: 1977 })
  add('sw2', 'The Empire Strikes Back.mp4', 'Star Wars/The Empire Strikes Back.mp4', { year: 1980 })
  add('sw3', 'Return of the Jedi.mp4', 'Star Wars/Return of the Jedi.mp4', { year: 1983 })
  add('sw4', 'The Force Awakens.mp4', 'Star Wars/The Force Awakens.mp4', { year: 2015 })
  add('sw5', 'The Last Jedi.mp4', 'Star Wars/The Last Jedi.mp4', { year: 2017 })
  add('sw6', 'The Rise of Skywalker.mp4', 'Star Wars/The Rise of Skywalker.mp4', { year: 2019 })

  // Die Hard — 2-word prefix, numbered
  add('dh1', 'Die Hard.mp4', 'Die Hard/Die Hard.mp4', { year: 1988 })
  add('dh2', 'Die Hard 2.mp4', 'Die Hard/Die Hard 2.mp4', { year: 1990 })
  add('dh3', 'Die Hard With a Vengeance.mp4', 'Die Hard/Die Hard With a Vengeance.mp4', { year: 1995 })
  add('dh4', 'Live Free or Die Hard.mp4', 'Die Hard/Live Free or Die Hard.mp4', { year: 2007 })
  add('dh5', 'A Good Day to Die Hard.mp4', 'Die Hard/A Good Day to Die Hard.mp4', { year: 2013 })

  // The Matrix — 2-word prefix
  add('m1', 'The Matrix.mp4', 'The Matrix/The Matrix.mp4', { year: 1999 })
  add('m2', 'The Matrix Reloaded.mp4', 'The Matrix/The Matrix Reloaded.mp4', { year: 2003 })
  add('m3', 'The Matrix Revolutions.mp4', 'The Matrix/The Matrix Revolutions.mp4', { year: 2003 })
  add('m4', 'The Matrix Resurrections.mp4', 'The Matrix/The Matrix Resurrections.mp4', { year: 2021 })

  // Bad Boys — 2-word prefix
  add('bb1', 'Bad Boys.mp4', 'Bad Boys/Bad Boys.mp4', { year: 1995 })
  add('bb2', 'Bad Boys II.mp4', 'Bad Boys/Bad Boys II.mp4', { year: 2003 })
  add('bb3', 'Bad Boys for Life.mp4', 'Bad Boys/Bad Boys for Life.mp4', { year: 2020 })
  add('bb4', 'Bad Boys Ride or Die.mp4', 'Bad Boys/Bad Boys Ride or Die.mp4', { year: 2024 })

  // Jurassic Park — 3-word prefix
  add('jp1', 'Jurassic Park.mp4', 'Jurassic Park/Jurassic Park.mp4', { year: 1993 })
  add('jp2', 'Jurassic Park The Lost World.mp4', 'Jurassic Park/The Lost World.mp4', { year: 1997 })
  add('jp3', 'Jurassic Park III.mp4', 'Jurassic Park/Jurassic Park III.mp4', { year: 2001 })
  add('jp4', 'Jurassic World.mp4', 'Jurassic Park/Jurassic World.mp4', { year: 2015 })
  add('jp5', 'Jurassic World Fallen Kingdom.mp4', 'Jurassic Park/Jurassic World Fallen Kingdom.mp4', { year: 2018 })
  add('jp6', 'Jurassic World Dominion.mp4', 'Jurassic Park/Jurassic World Dominion.mp4', { year: 2022 })

  // Mission Impossible — 2-word prefix
  add('mi1', 'Mission Impossible.mp4', 'Mission Impossible/Mission Impossible.mp4', { year: 1996 })
  add('mi2', 'Mission Impossible II.mp4', 'Mission Impossible/Mission Impossible 2.mp4', { year: 2000 })
  add('mi3', 'Mission Impossible III.mp4', 'Mission Impossible/Mission Impossible 3.mp4', { year: 2006 })
  add('mi4', 'Mission Impossible Ghost Protocol.mp4', 'Mission Impossible/Ghost Protocol.mp4', { year: 2011 })
  add('mi5', 'Mission Impossible Rogue Nation.mp4', 'Mission Impossible/Rogue Nation.mp4', { year: 2015 })
  add('mi6', 'Mission Impossible Fallout.mp4', 'Mission Impossible/Fallout.mp4', { year: 2018 })
  add('mi7', 'Mission Impossible Dead Reckoning.mp4', 'Mission Impossible/Dead Reckoning.mp4', { year: 2023 })

  // John Wick — 2-word prefix
  add('jw1', 'John Wick.mp4', 'John Wick/John Wick.mp4', { year: 2014 })
  add('jw2', 'John Wick Chapter 2.mp4', 'John Wick/John Wick Chapter 2.mp4', { year: 2017 })
  add('jw3', 'John Wick Chapter 3 Parabellum.mp4', 'John Wick/John Wick Chapter 3.mp4', { year: 2019 })
  add('jw4', 'John Wick Chapter 4.mp4', 'John Wick/John Wick Chapter 4.mp4', { year: 2023 })

  // Fast and Furious — 3-word prefix
  add('ff1', 'The Fast and the Furious.mp4', 'Fast and Furious/The Fast and the Furious.mp4', { year: 2001 })
  add('ff2', '2 Fast 2 Furious.mp4', 'Fast and Furious/2 Fast 2 Furious.mp4', { year: 2003 })
  add('ff3', 'The Fast and the Furious Tokyo Drift.mp4', 'Fast and Furious/Tokyo Drift.mp4', { year: 2006 })
  add('ff4', 'Fast and Furious.mp4', 'Fast and Furious/Fast and Furious.mp4', { year: 2009 })
  add('ff5', 'Fast Five.mp4', 'Fast and Furious/Fast Five.mp4', { year: 2011 })
  add('ff6', 'Fast and Furious 6.mp4', 'Fast and Furious/Fast and Furious 6.mp4', { year: 2013 })
  add('ff7', 'Furious 7.mp4', 'Fast and Furious/Furious 7.mp4', { year: 2015 })
  add('ff8', 'The Fate of the Furious.mp4', 'Fast and Furious/The Fate of the Furious.mp4', { year: 2017 })
  add('ff9', 'F9 The Fast Saga.mp4', 'Fast and Furious/F9.mp4', { year: 2021 })
  add('ff10', 'Fast X.mp4', 'Fast and Furious/Fast X.mp4', { year: 2023 })

  // Standalone movies (should NOT be in collections)
  add('s1', 'Inception.mp4', 'Inception.mp4', { year: 2010 })
  add('s2', 'Interstellar.mp4', 'Interstellar.mp4', { year: 2014 })
  add('s3', 'The Dark Knight.mp4', 'The Dark Knight.mp4', { year: 2008 })
  add('s4', 'Pulp Fiction.mp4', 'Pulp Fiction.mp4', { year: 1994 })
  add('s5', 'The Godfather.mp4', 'The Godfather.mp4', { year: 1972 })

  window.dispatchEvent(new CustomEvent('lumiere:inject', {
    detail: { files, metadata, folderName: 'Movies' }
  }))
  return `Dispatched: ${files.length} files, expected ~7 collections`
})()
