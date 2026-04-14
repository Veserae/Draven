import { loadWorldState, saveWorldState, addArtifact } from '../utils/storage';
import type { WorldArtifact } from '../types/world';

export default defineBackground(() => {
  console.log('[DRAVEN] Background worker started.');

  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      await saveWorldState({
        theme: 'island',
        artifacts: [],
        audioEnabled: false,
        audioVolume: 0.4,
        lastWeatherFetch: 0,
        weather: 'clear',
      });
      console.log('[DRAVEN] Default world state initialised.');
    }
  });

  browser.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
    if (!message?.type) return;

    switch (message.type) {
      case 'ARTIFACT_COLLECTED': {
        const artifact = message.payload as WorldArtifact;
        await addArtifact(artifact);
        sendResponse({ ok: true });
        break;
      }
      case 'GET_WORLD_STATE': {
        const state = await loadWorldState();
        sendResponse({ ok: true, state });
        break;
      }
      case 'SET_THEME': {
        const state = await loadWorldState();
        await saveWorldState({ ...state, theme: message.payload });
        sendResponse({ ok: true });
        break;
      }
      case 'SET_AUDIO': {
        const state = await loadWorldState();
        await saveWorldState({ ...state, ...message.payload });
        sendResponse({ ok: true });
        break;
      }
      case 'SET_WEATHER_CACHE': {
        const state = await loadWorldState();
        await saveWorldState({
          ...state,
          weather: message.payload.weather,
          lastWeatherFetch: message.payload.ts,
          lat: message.payload.lat,
          lon: message.payload.lon,
        });
        sendResponse({ ok: true });
        break;
      }
    }

    return true;
  });
});
