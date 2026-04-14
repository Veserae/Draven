<template>
  <div class="popup">

    <!-- Header -->
    <header class="header">
      <div class="header__logo">
        <span class="logo-mark">▸</span>
        <span class="logo-name">DRAVEN</span>
      </div>
      <div class="header__sub">LIVING NEW TAB WORLDS</div>
    </header>

    <!-- SEC-01: World -->
    <div class="sec-label">SEC-01 // WORLD</div>
    <div class="section">
      <div class="row">
        <span class="row__label">THEME</span>
        <div class="theme-pills">
          <button
            v-for="t in themes"
            :key="t.id"
            class="pill"
            :class="{ 'pill--active': state.theme === t.id }"
            @click="setTheme(t.id)"
          >{{ t.icon }} {{ t.label }}</button>
        </div>
      </div>
      <div class="row">
        <span class="row__label">WEATHER</span>
        <span class="row__value">
          {{ weatherIcon }} {{ state.weather.toUpperCase() }}
        </span>
      </div>
      <div class="row">
        <span class="row__label">TIME OF DAY</span>
        <span class="row__value accent">{{ tod.toUpperCase() }}</span>
      </div>
    </div>

    <!-- SEC-02: Artifacts -->
    <div class="sec-label">SEC-02 // ARTIFACTS</div>
    <div class="section">
      <div class="row">
        <span class="row__label">COLLECTED</span>
        <span class="row__value gold">✦ {{ state.artifacts.length }} / 64</span>
      </div>
      <div class="artifact-strip" v-if="state.artifacts.length > 0">
        <div
          v-for="a in state.artifacts.slice(0, 16)"
          :key="a.id"
          class="strip-gem"
          :style="{ background: a.color }"
          :title="a.source"
        />
      </div>
      <div class="empty-strip" v-else>Browse pages to grow your world</div>
      <button class="danger-btn" @click="clearArtifacts" v-if="state.artifacts.length > 0">
        CLEAR ARTIFACTS
      </button>
    </div>

    <!-- SEC-03: Audio -->
    <div class="sec-label">SEC-03 // AMBIENT AUDIO</div>
    <div class="section">
      <div class="row">
        <span class="row__label">SOUND</span>
        <button class="toggle-pill" :class="{ 'toggle-pill--on': state.audioEnabled }" @click="toggleAudio">
          {{ state.audioEnabled ? 'ON' : 'OFF' }}
        </button>
      </div>
      <div class="row" v-if="state.audioEnabled">
        <span class="row__label">VOLUME</span>
        <input
          type="range" min="0" max="1" step="0.05"
          :value="state.audioVolume"
          @input="onVolume"
          class="vol-slider"
        />
        <span class="row__value">{{ Math.round(state.audioVolume * 100) }}%</span>
      </div>
    </div>

    <!-- Footer -->
    <footer class="footer">
      <span>DRAVEN v1.0.0</span>
      <button class="open-tab-btn" @click="openNewTab">OPEN WORLD ↗</button>
    </footer>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { WorldState, WorldTheme } from '../../types/world';
import { loadWorldState, saveWorldState } from '../../utils/storage';
import { getTimeOfDay } from '../../utils/weather';

const state = ref<WorldState>({
  theme: 'island', artifacts: [], audioEnabled: false,
  audioVolume: 0.4, lastWeatherFetch: 0, weather: 'clear',
});

const themes = [
  { id: 'island'     as WorldTheme, icon: '🏝', label: 'ISLAND' },
  { id: 'nebula'     as WorldTheme, icon: '🌌', label: 'NEBULA' },
  { id: 'underwater' as WorldTheme, icon: '🐠', label: 'DEEP' },
];

const weatherIcons: Record<string, string> = {
  clear: '☀', cloudy: '☁', rain: '🌧', storm: '⛈', snow: '❄', fog: '🌫',
};
const weatherIcon = computed(() => weatherIcons[state.value.weather] ?? '');
const tod = computed(() => getTimeOfDay());

async function setTheme(t: WorldTheme) {
  state.value = { ...state.value, theme: t };
  await saveWorldState(state.value);
}

async function toggleAudio() {
  state.value = { ...state.value, audioEnabled: !state.value.audioEnabled };
  await saveWorldState(state.value);
}

async function onVolume(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value);
  state.value = { ...state.value, audioVolume: v };
  await saveWorldState(state.value);
}

async function clearArtifacts() {
  if (!confirm('Clear all artifacts from your world?')) return;
  state.value = { ...state.value, artifacts: [] };
  await saveWorldState(state.value);
}

function openNewTab() {
  browser.tabs.create({ url: 'chrome://newtab/' });
}

onMounted(async () => {
  state.value = await loadWorldState();
});
</script>

<style scoped>
.popup {
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  min-height: 420px;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px 9px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
}
.header__logo { display: flex; align-items: center; gap: 7px; }
.logo-mark { color: var(--accent); font-size: 14px; }
.logo-name {
  font-family: var(--display);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: var(--text-hi);
}
.header__sub {
  font-size: 9px;
  letter-spacing: 0.14em;
  color: var(--text-lo);
}

/* Section label */
.sec-label {
  font-size: 9px;
  letter-spacing: 0.14em;
  color: var(--accent-dim);
  padding: 7px 14px 4px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-base);
}

/* Section */
.section {
  padding: 6px 14px 10px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 7px;
}

/* Row */
.row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.row__label {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--text-lo);
  min-width: 72px;
  flex-shrink: 0;
}
.row__value { font-size: 12px; color: var(--text-mid); }
.row__value.accent { color: var(--accent-hi); }
.row__value.gold { color: var(--gold); }

/* Theme pills */
.theme-pills { display: flex; gap: 5px; flex-wrap: wrap; }
.pill {
  padding: 3px 8px;
  border: 1px solid var(--border);
  background: var(--bg-raised);
  color: var(--text-lo);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s;
}
.pill:hover { border-color: rgba(255,255,255,0.25); color: var(--text-mid); }
.pill--active {
  border-color: var(--accent);
  color: var(--accent-hi);
  background: #1c0f0f;
}

/* Artifact strip */
.artifact-strip {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.strip-gem {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  opacity: 0.85;
  cursor: default;
  transition: opacity 0.15s, transform 0.15s;
}
.strip-gem:hover { opacity: 1; transform: scale(1.2); }
.empty-strip {
  font-size: 10px;
  color: var(--text-lo);
  letter-spacing: 0.08em;
  padding: 4px 0;
}

/* Toggle pill */
.toggle-pill {
  padding: 3px 12px;
  border: 1px solid var(--border);
  background: var(--bg-raised);
  color: var(--text-lo);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s;
}
.toggle-pill--on {
  border-color: var(--accent);
  color: var(--accent-hi);
  background: #1c0f0f;
}

/* Volume slider */
.vol-slider {
  -webkit-appearance: none;
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: var(--border);
  cursor: pointer;
}
.vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 11px; height: 11px;
  border-radius: 50%;
  background: var(--accent-hi);
}

/* Danger button */
.danger-btn {
  align-self: flex-start;
  background: none;
  border: 1px solid var(--accent-dim);
  color: rgba(255,80,80,0.6);
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  padding: 3px 10px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s;
}
.danger-btn:hover { border-color: var(--accent-hi); color: var(--accent-hi); }

/* Footer */
.footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  font-size: 9px;
  color: var(--text-lo);
  letter-spacing: 0.1em;
}
.open-tab-btn {
  background: none;
  border: 1px solid var(--accent-dim);
  color: var(--accent-dim);
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  padding: 3px 10px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s;
}
.open-tab-btn:hover { border-color: var(--accent-hi); color: var(--accent-hi); }
</style>
