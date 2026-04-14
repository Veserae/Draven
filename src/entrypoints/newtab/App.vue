<template>
  <div class="world-container" @mousemove="onMouseMove" @click="onCanvasClick">

    <!-- Main canvas -->
    <canvas ref="canvas" class="world-canvas" />

    <!-- Clock overlay -->
    <div class="clock">
      <div class="clock__time">{{ clockTime }}</div>
      <div class="clock__date">{{ clockDate }}</div>
    </div>

    <!-- Weather badge -->
    <div class="weather-badge" v-if="state.weather !== 'clear'">
      <span class="weather-icon">{{ weatherIcon }}</span>
      <span class="weather-label">{{ state.weather.toUpperCase() }}</span>
    </div>

    <!-- Artifact toast -->
    <Transition name="artifact-toast">
      <div class="artifact-toast" v-if="toastArtifact">
        <div class="artifact-toast__gem" :style="{ background: toastArtifact.color }" />
        <div class="artifact-toast__text">
          <span class="artifact-toast__label">ARTIFACT COLLECTED</span>
          <span class="artifact-toast__source">{{ toastArtifact.source }}</span>
        </div>
      </div>
    </Transition>

    <!-- Bottom HUD -->
    <div class="hud">

      <!-- Theme switcher -->
      <div class="theme-switcher">
        <button
          v-for="t in themes"
          :key="t.id"
          class="theme-btn"
          :class="{ 'theme-btn--active': state.theme === t.id }"
          @click.stop="switchTheme(t.id)"
          :title="t.label"
        >
          <span class="theme-btn__icon">{{ t.icon }}</span>
        </button>
      </div>

      <!-- Artifact count -->
      <div class="artifact-counter" @click.stop="showPanel = !showPanel">
        <span class="artifact-counter__icon">✦</span>
        <span class="artifact-counter__count">{{ state.artifacts.length }}</span>
        <span class="artifact-counter__label">ARTIFACTS</span>
      </div>

      <!-- Audio controls -->
      <div class="audio-controls">
        <button class="audio-btn" @click.stop="toggleAudio" :title="state.audioEnabled ? 'Mute' : 'Unmute'">
          {{ state.audioEnabled ? '♪' : '♩' }}
        </button>
        <input
          v-if="state.audioEnabled"
          type="range" min="0" max="1" step="0.05"
          :value="state.audioVolume"
          @input="onVolumeChange"
          @click.stop
          class="volume-slider"
        />
      </div>

    </div>

    <!-- Artifact panel (click to open) -->
    <Transition name="panel">
      <div class="artifact-panel" v-if="showPanel" @click.stop>
        <div class="artifact-panel__header">
          <span>✦ WORLD ARTIFACTS</span>
          <button class="panel-close" @click="showPanel = false">✕</button>
        </div>
        <div class="artifact-panel__grid">
          <div
            v-for="a in state.artifacts.slice(0, 32)"
            :key="a.id"
            class="artifact-gem"
            :style="{ '--gem-color': a.color }"
            :title="`${a.source}\n${new Date(a.collectedAt).toLocaleDateString()}`"
          >
            <div class="artifact-gem__shape" :data-shape="a.shape" />
          </div>
          <div v-if="state.artifacts.length === 0" class="artifact-panel__empty">
            Browse the web to collect artifacts
          </div>
        </div>
        <div class="artifact-panel__footer">
          <button class="clear-btn" @click="clearArtifacts">CLEAR ALL</button>
        </div>
      </div>
    </Transition>

    <!-- Location permission prompt -->
    <Transition name="fade">
      <div class="location-prompt" v-if="showLocationPrompt">
        <span>Enable location for live weather?</span>
        <button @click="requestLocation">YES</button>
        <button @click="showLocationPrompt = false">NO</button>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import type { WorldState, WorldTheme, WorldArtifact } from '../../types/world';
import { loadWorldState, saveWorldState } from '../../utils/storage';
import { fetchWeather, getTimeOfDay } from '../../utils/weather';
import { AmbientAudio } from '../../utils/audio';
import { IslandRenderer } from '../../utils/renderers/island';
import { NebulaRenderer } from '../../utils/renderers/nebula';
import { UnderwaterRenderer } from '../../utils/renderers/underwater';

// ── Refs ──────────────────────────────────────────────────────────────────────
const canvas = ref<HTMLCanvasElement | null>(null);
const state = ref<WorldState>({
  theme: 'island', artifacts: [], audioEnabled: false,
  audioVolume: 0.4, lastWeatherFetch: 0, weather: 'clear',
});
const clockTime = ref('');
const clockDate = ref('');
const toastArtifact = ref<WorldArtifact | null>(null);
const showPanel = ref(false);
const showLocationPrompt = ref(false);

const themes = [
  { id: 'island'     as WorldTheme, icon: '🏝', label: 'Floating Island' },
  { id: 'nebula'     as WorldTheme, icon: '🌌', label: 'Nebula' },
  { id: 'underwater' as WorldTheme, icon: '🐠', label: 'Underwater' },
];

const weatherIcons: Record<string, string> = {
  clear: '☀', cloudy: '☁', rain: '🌧', storm: '⛈', snow: '❄', fog: '🌫',
};
const weatherIcon = ref('');

// ── Renderers & audio ─────────────────────────────────────────────────────────
const islandR = new IslandRenderer();
const nebulaR = new NebulaRenderer();
const underwaterR = new UnderwaterRenderer();
const audio = new AmbientAudio();

// ── Canvas loop ───────────────────────────────────────────────────────────────
let animId = 0;
let lastTime = 0;
let ctx2d: CanvasRenderingContext2D | null = null;

function resizeCanvas() {
  if (!canvas.value) return;
  canvas.value.width = window.innerWidth;
  canvas.value.height = window.innerHeight;
  const w = canvas.value.width, h = canvas.value.height;
  islandR.init(w, h);
  nebulaR.init(w, h);
  underwaterR.init(w, h);
}

function tick(ts: number) {
  animId = requestAnimationFrame(tick);
  const dt = Math.min(ts - lastTime, 50); // cap at 50ms (~20fps min)
  lastTime = ts;
  if (!canvas.value || !ctx2d) return;

  const w = canvas.value.width, h = canvas.value.height;
  const tod = getTimeOfDay();
  const { theme, weather, artifacts } = state.value;

  if (theme === 'island') {
    islandR.render(ctx2d, w, h, tod, weather, artifacts, dt);
  } else if (theme === 'nebula') {
    nebulaR.render(ctx2d, w, h, tod, artifacts, dt);
  } else {
    underwaterR.render(ctx2d, w, h, tod, weather, artifacts, dt);
  }

  updateClock();
}

// ── Mouse ─────────────────────────────────────────────────────────────────────
function onMouseMove(e: MouseEvent) {
  const nx = e.clientX / window.innerWidth;
  const ny = e.clientY / window.innerHeight;
  islandR.setMouse(nx, ny);
  nebulaR.setMouse(nx, ny);
  underwaterR.setMouse(nx, ny);
}

function onCanvasClick() {
  showPanel.value = false;
}

// ── Clock ─────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  clockTime.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  clockDate.value = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Theme ─────────────────────────────────────────────────────────────────────
async function switchTheme(t: WorldTheme) {
  state.value = { ...state.value, theme: t };
  await saveWorldState(state.value);
  if (state.value.audioEnabled) {
    audio.stop();
    await audio.start(t, state.value.weather, state.value.audioVolume);
  }
}

// ── Audio ─────────────────────────────────────────────────────────────────────
async function toggleAudio() {
  const enabled = !state.value.audioEnabled;
  state.value = { ...state.value, audioEnabled: enabled };
  await saveWorldState(state.value);
  if (enabled) {
    await audio.start(state.value.theme, state.value.weather, state.value.audioVolume);
  } else {
    audio.stop();
  }
}

function onVolumeChange(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value);
  state.value = { ...state.value, audioVolume: v };
  audio.setVolume(v);
  saveWorldState(state.value);
}

// ── Artifacts ─────────────────────────────────────────────────────────────────
async function clearArtifacts() {
  state.value = { ...state.value, artifacts: [] };
  await saveWorldState(state.value);
  showPanel.value = false;
}

// ── Weather ───────────────────────────────────────────────────────────────────
async function loadWeather() {
  if (state.value.lat && state.value.lon) {
    const condition = await fetchWeather(
      state.value.lat, state.value.lon,
      state.value.lastWeatherFetch, state.value.weather,
    );
    state.value = { ...state.value, weather: condition, lastWeatherFetch: Date.now() };
    await saveWorldState(state.value);
    weatherIcon.value = weatherIcons[condition] ?? '';
  }
}

async function requestLocation() {
  showLocationPrompt.value = false;
  navigator.geolocation.getCurrentPosition(async pos => {
    state.value = { ...state.value, lat: pos.coords.latitude, lon: pos.coords.longitude };
    await loadWeather();
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  // Load state
  state.value = await loadWorldState();
  weatherIcon.value = weatherIcons[state.value.weather] ?? '';

  // Init canvas
  ctx2d = canvas.value!.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Start loop
  lastTime = performance.now();
  animId = requestAnimationFrame(tick);

  // Weather prompt if no location stored
  if (!state.value.lat && !state.value.lon) {
    setTimeout(() => { showLocationPrompt.value = true; }, 2000);
  } else {
    loadWeather();
  }

  // Listen for new artifacts from content scripts
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['draven_world_state']) {
      const newState = changes['draven_world_state'].newValue as WorldState;
      if (newState.artifacts.length > state.value.artifacts.length) {
        const newest = newState.artifacts[0];
        // Show toast
        toastArtifact.value = newest;
        setTimeout(() => { toastArtifact.value = null; }, 3500);
      }
      state.value = newState;
    }
  });
});

onUnmounted(() => {
  cancelAnimationFrame(animId);
  audio.stop();
  window.removeEventListener('resize', resizeCanvas);
});
</script>

<style scoped>
.world-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.world-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* ── Clock ───────────────────────────────────────────────────── */
.clock {
  position: absolute;
  top: 28px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  pointer-events: none;
  user-select: none;
}

.clock__time {
  font-family: 'Cinzel', serif;
  font-size: clamp(42px, 6vw, 80px);
  font-weight: 400;
  color: rgba(255,255,255,0.92);
  text-shadow: 0 2px 24px rgba(0,0,0,0.6), 0 0 60px rgba(255,255,255,0.1);
  letter-spacing: 0.08em;
  line-height: 1;
}

.clock__date {
  font-family: 'Share Tech Mono', monospace;
  font-size: clamp(12px, 1.5vw, 16px);
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin-top: 8px;
  text-shadow: 0 1px 8px rgba(0,0,0,0.5);
}

/* ── Weather badge ──────────────────────────────────────────── */
.weather-badge {
  position: absolute;
  top: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 5px 12px;
  color: rgba(255,255,255,0.75);
  font-size: 11px;
  letter-spacing: 0.12em;
}
.weather-icon { font-size: 14px; }

/* ── Artifact toast ─────────────────────────────────────────── */
.artifact-toast {
  position: absolute;
  bottom: 90px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 10px 16px;
  pointer-events: none;
}
.artifact-toast__gem {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  box-shadow: 0 0 10px currentColor;
  flex-shrink: 0;
}
.artifact-toast__text { display: flex; flex-direction: column; }
.artifact-toast__label {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: rgba(255,255,255,0.45);
}
.artifact-toast__source {
  font-size: 12px;
  color: rgba(255,255,255,0.85);
  font-family: 'Cinzel', serif;
}

.artifact-toast-enter-active, .artifact-toast-leave-active { transition: all 0.4s ease; }
.artifact-toast-enter-from, .artifact-toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }

/* ── HUD ─────────────────────────────────────────────────────── */
.hud {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  background: linear-gradient(to top, rgba(0,0,0,0.5), transparent);
}

/* Theme switcher */
.theme-switcher {
  display: flex;
  gap: 6px;
}
.theme-btn {
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(6px);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.2s;
}
.theme-btn:hover { border-color: rgba(255,255,255,0.35); background: rgba(255,255,255,0.1); }
.theme-btn--active {
  border-color: rgba(255,255,255,0.6);
  background: rgba(255,255,255,0.15);
  box-shadow: 0 0 16px rgba(255,255,255,0.15);
}

/* Artifact counter */
.artifact-counter {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 20px;
  padding: 7px 14px;
  cursor: pointer;
  transition: all 0.2s;
  color: rgba(255,255,255,0.7);
  font-size: 11px;
  letter-spacing: 0.12em;
}
.artifact-counter:hover { border-color: rgba(255,255,255,0.3); color: rgba(255,255,255,0.95); }
.artifact-counter__icon { color: #ffd700; font-size: 12px; }
.artifact-counter__count { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.9); }
.artifact-counter__label { font-size: 9px; letter-spacing: 0.15em; }

/* Audio controls */
.audio-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.audio-btn {
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(6px);
  border-radius: 8px;
  cursor: pointer;
  color: rgba(255,255,255,0.7);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.audio-btn:hover { border-color: rgba(255,255,255,0.35); color: rgba(255,255,255,0.95); }
.volume-slider {
  -webkit-appearance: none;
  width: 80px;
  height: 3px;
  border-radius: 2px;
  background: rgba(255,255,255,0.2);
  outline: none;
  cursor: pointer;
}
.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(255,255,255,0.85);
  cursor: pointer;
}

/* ── Artifact panel ─────────────────────────────────────────── */
.artifact-panel {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  width: 380px;
  max-width: calc(100vw - 40px);
  background: rgba(8,8,16,0.88);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  overflow: hidden;
  z-index: 10;
}
.artifact-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 11px;
  letter-spacing: 0.18em;
  color: rgba(255,255,255,0.6);
}
.panel-close {
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 6px;
  transition: color 0.15s;
}
.panel-close:hover { color: rgba(255,255,255,0.9); }
.artifact-panel__grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
  padding: 12px;
  max-height: 200px;
  overflow-y: auto;
}
.artifact-gem {
  aspect-ratio: 1;
  border-radius: 4px;
  background: var(--gem-color);
  opacity: 0.85;
  transition: opacity 0.2s, transform 0.2s;
  cursor: default;
  display: flex;
  align-items: center;
  justify-content: center;
}
.artifact-gem:hover { opacity: 1; transform: scale(1.15); }
.artifact-panel__empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 24px;
  color: rgba(255,255,255,0.3);
  font-size: 12px;
  letter-spacing: 0.1em;
}
.artifact-panel__footer {
  padding: 8px 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
  display: flex;
  justify-content: flex-end;
}
.clear-btn {
  background: none;
  border: 1px solid rgba(255,80,80,0.3);
  color: rgba(255,120,120,0.7);
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}
.clear-btn:hover { border-color: rgba(255,80,80,0.7); color: rgba(255,150,150,0.95); }

.panel-enter-active, .panel-leave-active { transition: all 0.25s ease; }
.panel-enter-from, .panel-leave-to { opacity: 0; transform: translateX(-50%) translateY(16px); }

/* ── Location prompt ────────────────────────────────────────── */
.location-prompt {
  position: absolute;
  top: 24px;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  letter-spacing: 0.08em;
}
.location-prompt button {
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.85);
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}
.location-prompt button:hover { background: rgba(255,255,255,0.22); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
