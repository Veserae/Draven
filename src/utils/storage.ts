import type { WorldState, WorldArtifact } from '../types/world';

const STORAGE_KEY = 'draven_world_state';

export const DEFAULT_STATE: WorldState = {
  theme: 'island',
  artifacts: [],
  audioEnabled: false,
  audioVolume: 0.4,
  lastWeatherFetch: 0,
  weather: 'clear',
};

export async function loadWorldState(): Promise<WorldState> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  if (result[STORAGE_KEY]) {
    return { ...DEFAULT_STATE, ...(result[STORAGE_KEY] as WorldState) };
  }
  return { ...DEFAULT_STATE };
}

export async function saveWorldState(state: WorldState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function addArtifact(artifact: WorldArtifact): Promise<void> {
  const state = await loadWorldState();
  // Cap at 64 artifacts – oldest removed first
  const artifacts = [artifact, ...state.artifacts].slice(0, 64);
  await saveWorldState({ ...state, artifacts });
}

export async function setTheme(theme: WorldState['theme']): Promise<void> {
  const state = await loadWorldState();
  await saveWorldState({ ...state, theme });
}
