# Lumière

A stunning, HiFi-grade local media library for movies, TV shows, music albums, and podcasts — all running entirely in your browser. No uploads, no servers, fully private.

![Lumière](public/logo.svg)

## Features

### 🎬 Netflix-Style Movies & TV (with red theme)
- **Auto-rotating hero banner** with backdrop, ratings, synopsis, and Play/More Info buttons
- **Top 10 rail** with oversized numbered posters
- **Genre filter chips** dynamically derived from enrichment data
- **Hover preview cards** that scale up and reveal quick actions (Play, Queue, Like, Details)
- **Auto-detected collections** using three strategies:
  1. **Folder-based** — movies in the same subfolder form a collection
  2. **2-word shared prefix** — catches franchises like "Die Hard", "The Matrix", "Bad Boys"
  3. **3-5 word shared prefix** — for longer franchise names
- **Manual collection management** — create, rename, add to, remove from, delete collections
- **Fanned poster stack cards** on the Collections page

### 🎵 Spotify-Style Music & Podcasts (with green theme)
- **Browse modes**: Albums, Artists, Composers, Decades, Tags
- **Roon-style Focus filter** — multi-dimensional filtering by artist, genre, decade, tag, and play count
- **Persistent Now Playing bar** with transport controls, progress, volume, and HiFi badge
- **Expanded full-screen player** with tabs:
  - **Now Playing** — track info, listening stats, tags
  - **Signal Path** — Roon-style audio chain visualization (Source → EQ → Gain → Analyser → Output)
  - **Credits** — artist/composer/genre with cross-linked related albums
  - **Queue** — upcoming tracks with jump-to-track

### 🔊 HiFi Studio Sound
- **Real WebAudio pipeline** with 4-band EQ (Bass 200Hz, Mid 1kHz, Treble 4kHz, Presence 8kHz)
- **6 EQ presets**: Flat, HiFi Studio, Bass Boost, Vocal, Cinema, Late Night
- **Live spectrum visualizer** driven by AnalyserNode
- **Signal Path visualization** showing the exact audio processing chain

### 📊 Roon-Inspired Features
- **Listening history** — play counts, first/last played, total duration (persisted)
- **Tags** — user-defined tags on tracks and albums, filterable via Focus
- **Credits browser** with cast photos from Wikipedia + filmography cross-linking
- **Browse by composer, decade, or tag**

### 🎭 Cast & Filmography
- **Actor photos** fetched from Wikipedia's REST API
- **Expandable bios** for each cast member
- **Filmography cross-linking** — see other movies/shows in your library with the same actor
- Click any filmography item to jump to its detail

### 💾 Persistence & Privacy
- **Files never leave your browser** — uses the File System Access API (Chrome/Edge) with `<input webkitdirectory>` fallback
- **Library persists across reloads** — folder manifests, metadata, enrichment, and listening history saved to `localStorage`
- **One-click reconnect** after page reload — re-grant folder access without re-scanning
- **FileSystemDirectoryHandle persistence** via IndexedDB for FSA-supported browsers

### 🎨 Metadata Enrichment
- **Embedded metadata extraction** — ID3v2 (MP3), MP4 box atoms (M4A/MP4/MOV), FLAC Vorbis comments
- **OMDB enrichment** — posters, IMDb/Rotten Tomatoes/Metacritic ratings, plots, genres, cast, directors, awards
- **Wikipedia cast photos** — actor headshots and bios
- **24-hour server-side caching** for API responses

## Tech Stack

- **Framework**: Next.js 16 with App Router (Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 with shadcn/ui (New York style)
- **State**: Zustand
- **Audio**: Web Audio API (BiquadFilter chain + AnalyserNode)
- **Storage**: localStorage (library data) + IndexedDB (FSA handles)
- **Metadata**: Custom ID3v2/MP4/FLAC parsers (zero dependencies)
- **Enrichment**: OMDB API (movies/TV) + Wikipedia REST API (cast photos)

## Getting Started

```bash
# Install dependencies
bun install

# Start the dev server
bun run dev

# Open http://localhost:3000
```

Click **"Scan My Computer"** and pick a folder containing your media. Lumière will:
1. Recursively find all movies, TV episodes, music, and podcasts
2. Extract embedded metadata (ID3 tags, MP4 atoms, FLAC comments)
3. Fetch posters, ratings, and plot synopses from OMDB
4. Fetch actor photos and bios from Wikipedia
5. Auto-detect movie collections from folder structure and naming patterns

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── enrich/    # OMDB proxy (posters, ratings, plots)
│   │   └── cast/      # Wikipedia proxy (actor photos, bios)
│   ├── globals.css    # Cinematic dark theme + Netflix/Spotify utilities
│   ├── layout.tsx     # Root layout with theme + toasters
│   └── page.tsx       # Main orchestrator (theme switching, views)
├── components/
│   ├── netflix-*.tsx  # Netflix-style UI (hero, rail, card, top10)
│   ├── spotify-*.tsx  # Spotify-style UI (card, rail, now-playing bar)
│   ├── collection-*.tsx # Collection cards + manager
│   ├── cast-browser.tsx    # Actor photos + filmography
│   ├── signal-path.tsx     # Roon-style audio chain viz
│   ├── focus-filter.tsx    # Roon-style multi-dimensional filter
│   ├── credits-browser.tsx # Album credits with cross-linking
│   ├── media-player.tsx    # Unified player (video + audio + HiFi EQ)
│   ├── detail-drawer.tsx   # Rich info panel for all media types
│   └── ...
├── lib/
│   ├── metadata.ts        # ID3v2/MP4/FLAC parsers
│   ├── media-scanner.ts   # File System Access API scanner
│   ├── categorize.ts      # Movie/TV/Album/Podcast categorization + collection detection
│   ├── persist.ts         # localStorage + IndexedDB persistence
│   ├── listening-history.ts # Play count tracking
│   └── tags.ts            # User tag system
├── store/
│   └── library.ts         # Zustand store (library, player, enrichment, history, tags)
└── hooks/
    └── use-enrichment-orchestrator.ts # Background OMDB enrichment queue
```

## License

Private project.
