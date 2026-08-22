# WAVEORA

**Premium Local-First Music & Audio Experience Platform**

> Your Sound. Your Space.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-waveora--musicplayer-16A34A?style=for-the-badge&logo=vercel&logoColor=white)](https://waveora-musicplayer-nilusha.vercel.app)

WAVEORA is a fully working, offline-capable music player and personal audio platform built with vanilla HTML, CSS and JavaScript — created for the **CodeAlpha Frontend Development Internship — Task 4: Music Player using JavaScript**.

It intentionally goes beyond a basic "play/pause" widget: local music library management, playlists, favorites, a real-time audio visualizer, dynamic music-reactive theming, listening statistics, an equalizer, a sleep timer, a command palette, and PWA installability — all running entirely in the browser with **zero backend**.

---

## ✨ Features

- **Local Music Library** — add your own MP3/WAV/OGG/M4A files via drag-and-drop or file picker
- **IndexedDB Audio Storage** — audio blobs and cover art stored locally, never uploaded anywhere
- **Playlist Management** — create, rename, delete, reorder, shuffle, favorite
- **Favorites & Recently Played** — with play counts and listening time
- **Instant Search** — across songs, artists, albums, genres and playlists
- **Queue System** — drag-to-reorder, play next, save queue as playlist
- **Live Audio Visualizer** — Bars / Wave / Circle / Particles, built on the Web Audio API `AnalyserNode` + Canvas
- **Dynamic Music-Reactive UI** — accent colors, glows and gradients shift per track
- **6-band Equalizer** — Flat / Bass Boost / Treble Boost / Vocal / Classical / Electronic / Custom, via `BiquadFilterNode`
- **Sleep Timer**, **Playback Speed control**, **Lyrics panel** (add your own lyrics locally)
- **Listening Analytics** — total time, top tracks/artists, streaks, weekly & monthly charts
- **Light / Dark / Eye Comfort / Auto Night Mode**, full `prefers-reduced-motion` support
- **Fully Responsive** — from 375px phones to ultrawide desktops, with a dedicated mobile bottom nav and full-screen mobile player
- **Command Center** — `Ctrl/Cmd + K` to jump anywhere or run any action
- **Keyboard Shortcuts**, **Toast notifications** (no `alert()` anywhere), **PWA installable**

## 🧠 Zero-dependency demo tracks

WAVEORA ships with **no bundled copyrighted audio**. Instead, on first launch it synthesizes three short original demo tracks directly in the browser using `OfflineAudioContext` (oscillator-based chords rendered to WAV) and generates matching gradient cover art on a `<canvas>`. This means the app is instantly, fully playable out of the box, with zero external files and zero licensing concerns — and it's a genuine demonstration of the Web Audio API doing real synthesis, not just playback.

Drop your own licensed audio into `assets/music/` and cover art into `assets/covers/` any time — or just use **+ Add Music** in the sidebar to import files directly into your library.

## 🛠 Technology

HTML5 · CSS3 · Vanilla JavaScript (ES6+) · HTML5 Audio API · Web Audio API (`AnalyserNode`, `BiquadFilterNode`, `OfflineAudioContext`) · Canvas API · IndexedDB · LocalStorage · PWA (Web App Manifest + Service Worker)

No React / Vue / Angular. No Bootstrap / Tailwind. No backend.

## 🏗 Architecture

```
        Audio Engine (audio-engine.js)
                    │
   single <audio> element + Web Audio graph
   (EQ → Analyser → Gain → Destination)
                    │
        Application State + Event Bus (WV.bus)
                    │
   ┌────────────┬───────────┬───────────────┐
   Dashboard    Player     Mini Player    Visualizer
   (dashboard)  (overlay)  (persistent)   (canvas × 3)
                    │
        IndexedDB (tracks, lyrics) + LocalStorage
        (settings, playlists, favorites, history, stats)
```

Every page reads and controls playback exclusively through `WV.engine` and reacts to the same `WV.bus` events (`engine:trackchange`, `queue:changed`, `favorites:changed`, …) — so the Dashboard, Mini Player, Full Player and Visualizer never drift out of sync (see Section 36/37 of the project brief).

### Why a Single Page App instead of literal multi-page navigation?

The brief asks for a persistent mini player and continuous playback while navigating between pages. A true multi-page site (full HTML reloads) would destroy the `<audio>` element and the Web Audio graph on every navigation, stopping music mid-song. WAVEORA instead ships **one shell (`index.html`)** with instant, JS-driven view switching — the `pages/*.html` files described in the brief still exist and map 1:1 to each view, but simply redirect into the SPA shell so deep links keep working. This is the same architecture real music apps use, and it's what makes gapless, uninterrupted playback across "pages" actually possible.

## 🚀 Running locally

Because WAVEORA uses IndexedDB, a Service Worker and ES-module-free `<script>` includes, it works best served over `http(s)://` rather than opened directly as a `file://` URL (some browsers restrict IndexedDB/Service Workers on `file://`).

```bash
# any static server works, for example:
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` (or the printed port).

## 🔒 Privacy

Your music files and personal library are stored **locally in this browser** using IndexedDB and LocalStorage. WAVEORA has no server and never transmits your files or listening data anywhere. Clearing your browser's site data will remove your library — use **Settings → Data → Export Data** for a metadata backup (playlists, favorites, history, settings, statistics; large audio blobs stay in IndexedDB and are not included in the JSON export, by design).

## ⌨️ Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `→` / `←` | Seek forward / back 5s |
| `↑` / `↓` | Volume up / down |
| `M` | Mute |
| `N` / `P` | Next / Previous track |
| `S` | Toggle shuffle |
| `R` | Cycle repeat (off → all → one) |
| `Ctrl/Cmd + K` | Open Command Center |

## 📁 Project structure

```
WAVEORA/
├── index.html            ← SPA shell (all views live here)
├── pages/*.html           ← spec-mapped redirect stubs into the SPA
├── css/                   ← variables, global, layout, per-page styles, responsive, animations
├── js/                    ← audio-engine, library, playlists, favorites, history, search,
│                             visualizer, statistics, queue, player, command-center, app (router)
├── assets/music|covers|icons
├── manifest.json / sw.js  ← PWA
└── README.md
```

## ✅ Known scope notes

- Metadata is read from what the browser can tell us for free (filename + probed duration); WAVEORA does not bundle a 3rd-party ID3 tag parser, keeping it 100% dependency-free — you can edit any track's title/artist/album/genre/cover from the library at any time.
- Lyrics are user-entered and stored locally per track — WAVEORA never scrapes or bundles copyrighted lyrics.
- "Recommended" and "Popular" sections in Discover are generated only from your own local play history — there is no cloud recommendation engine.

---

**Author:** Nilusha Madhuwanthi
**Internship:** CodeAlpha Frontend Development Internship
**Task:** Task 4 — Music Player using JavaScript
