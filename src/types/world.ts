export type WorldTheme = 'island' | 'nebula' | 'underwater';

export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'night';

export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';

export interface WorldArtifact {
  id: string;
  /** Dominant color harvested from the source page, as hex */
  color: string;
  /** Shape type derived from page geometry */
  shape: 'circle' | 'triangle' | 'diamond' | 'star' | 'crystal';
  /** Source domain */
  source: string;
  /** Timestamp collected */
  collectedAt: number;
  /** Position in the world (0–1 normalized) */
  x: number;
  y: number;
  /** Size scalar 0.5–2.0 */
  scale: number;
}

export interface WorldState {
  theme: WorldTheme;
  artifacts: WorldArtifact[];
  audioEnabled: boolean;
  audioVolume: number; // 0–1
  lastWeatherFetch: number;
  weather: WeatherCondition;
  /** User's lat/lon if granted */
  lat?: number;
  lon?: number;
}

export interface WeatherData {
  condition: WeatherCondition;
  fetchedAt: number;
}
