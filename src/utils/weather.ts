import type { WeatherCondition } from '../types/world';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface OpenMeteoResponse {
  current_weather?: {
    weathercode: number;
    windspeed: number;
  };
}

/** Map WMO weather codes to our simplified conditions */
function wmoToCondition(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 49) return 'fog';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rain';
  return 'storm';
}

export async function fetchWeather(
  lat: number,
  lon: number,
  lastFetch: number,
  cached: WeatherCondition,
): Promise<WeatherCondition> {
  if (Date.now() - lastFetch < CACHE_TTL) return cached;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const res = await fetch(url);
    if (!res.ok) return cached;
    const data: OpenMeteoResponse = await res.json();
    const code = data.current_weather?.weathercode ?? 0;
    return wmoToCondition(code);
  } catch {
    return cached;
  }
}

export function getTimeOfDay(): import('../types/world').TimeOfDay {
  const h = new Date().getHours();
  if (h >= 5 && h < 8)  return 'dawn';
  if (h >= 8 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}
