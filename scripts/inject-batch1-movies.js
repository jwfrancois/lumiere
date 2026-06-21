// Inject only movies first — simulates scanning a Movies folder
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
      size: kind === 'video' ? 1000000000 : 8000000,
      url: URL.createObjectURL(file),
    })
    metadata[id] = {
      title: name.replace(/\.[^.]+$/, ''),
      durationSec: kind === 'video' ? 3600 : 240,
      ...opts,
    }
  }

  add('m1', 'Lord of the Rings - Fellowship of the Ring 1.mp4', 'Movies/LOTR1.mp4', 'video', { year: 2001 })
  add('m2', 'Lord of the Rings - The Two Towers 2.mp4', 'Movies/LOTR2.mp4', 'video', { year: 2002 })
  add('m3', 'Lord of the Rings - Return of the King 3.mp4', 'Movies/LOTR3.mp4', 'video', { year: 2003 })
  add('m4', 'Inception.mp4', 'Movies/Inception.mp4', 'video', { year: 2010 })
  add('m5', 'The Matrix.mp4', 'Movies/The Matrix.mp4', 'video', { year: 1999 })

  window.dispatchEvent(new CustomEvent('lumiere:inject', {
    detail: { files, metadata, folderName: 'Movies' }
  }))
  return `Dispatched batch 1: ${files.length} movie files`
})()
