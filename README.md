# DRAVEN — Living New Tab Worlds

> Transform every new tab into a dynamic, evolving world that grows uniquely with your browsing.

---

## Features

### 🏝 Three Living Worlds
| Theme | Description |
|---|---|
| **Floating Island** | Serene island with trees, a glowing cottage, waterfall, and leaf particles. Reacts to time-of-day and weather. |
| **🌌 Nebula** | Deep space with orbiting bodies, glowing star clusters, and nebula clouds. |
| **🐠 Underwater** | Coral reef with fish that flee from your cursor, bioluminescent bubbles, caustic light rays, and swaying kelp. |

### 🌦 Live Time & Weather
- Sky, lighting, and atmosphere change based on real time-of-day (dawn / morning / afternoon / dusk / night)
- Optional live weather via [Open-Meteo](https://open-meteo.com/) (no API key required) — rain, storms, snow, fog all affect the scene

### ✦ Artifact Collection
- Every page you visit donates a **color artifact** to your world — harvested from the site's theme color, CSS, or favicon
- Artifacts appear as glowing, shape-coded gems floating in your world
- Up to **64 artifacts** are retained, making each world uniquely yours

### 🎵 Ambient Audio
- Procedural Web Audio API soundscapes — no file downloads
- **Island**: wind, rain (weather-dependent), distant wave tones
- **Nebula**: deep space drones with subtle LFO shimmer
- **Underwater**: resonant rumble, random bubble pings, low whale-like tones
- Volume control, persisted per session

---

## Stack

| Layer | Tech |
|---|---|
| Framework | [WXT](https://wxt.dev) v0.19 |
| UI | Vue 3 `<script setup>` |
| Rendering | HTML5 Canvas (requestAnimationFrame loop) |
| Audio | Web Audio API (procedural synthesis) |
| Weather | Open-Meteo REST API (no key) |
| Storage | `browser.storage.local` |
| Build | Vite (via WXT) |
| CI/CD | GitHub Actions |

---

## Project Structure

```
src/
  entrypoints/
    newtab/             ← Living world new tab page (Vue 3 + Canvas)
      index.html
      main.ts
      App.vue           ← Main orchestration: renders world, HUD, artifact toast
      style.css
    popup/              ← Toolbar popup (settings panel)
      index.html / main.ts / App.vue / style.css
    background.ts       ← Service worker: artifact storage, state manager
    content.ts          ← Content script: harvests color+shape from visited pages
  types/
    world.ts            ← Shared TypeScript types
  utils/
    storage.ts          ← browser.storage.local helpers
    weather.ts          ← Open-Meteo fetcher + time-of-day util
    audio.ts            ← AmbientAudio class (Web Audio API)
    renderers/
      island.ts         ← Floating island canvas renderer
      nebula.ts         ← Nebula canvas renderer
      underwater.ts     ← Underwater canvas renderer
```

---

## Development

```bash
npm install
npm run dev           # Chrome live-reload dev server
npm run dev:firefox   # Firefox dev server
```

## Build

```bash
npm run build           # Chrome production build → .output/chrome-mv3/
npm run build:firefox   # Firefox build           → .output/firefox-mv2/
npm run zip             # Chrome .zip (for Web Store)
npm run zip:firefox     # Firefox .zip (for AMO)
```

## CI/CD

Every push to `main`/`master` and every PR triggers **Build & Package**:
- Builds Chrome + Firefox in parallel
- Uploads `.output/` as GitHub Actions artifacts (30-day retention)
- On a **GitHub Release**, auto-attaches both `.zip` files as release assets

---

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Persist world state and artifact collection |
| `tabs` | Read current tab URL for artifact collection |
| `activeTab` | Access active tab context |
| `geolocation` | Optional live weather (user-prompted, never forced) |

---

## License

MIT
