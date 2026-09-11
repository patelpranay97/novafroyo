// Weather lookup for the shop's own block, from Open-Meteo — a free, open
// API with no key and no account (CC-BY, https://open-meteo.com/).
//
// Two endpoints cover different stretches of time:
//   forecast  — a rolling ~93-day past window plus the next 16 days
//   archive   — reanalysis going back decades, but it lags a day or two
// Recent days are tried on the forecast endpoint first (it reflects what
// actually happened sooner), with the archive as the fallback for anything
// older or not yet covered.

import type { Weather } from "./portal";

/** 1047 W Madison St — Open-Meteo snaps this to its nearest grid point. */
const LAT = 41.8818;
const LON = -87.6534;

const COMMON =
  `latitude=${LAT}&longitude=${LON}` +
  "&daily=weather_code,temperature_2m_max" +
  "&temperature_unit=fahrenheit&timezone=America%2FChicago";

export type FetchedWeather = { weather: Weather; temp_f: number };

/**
 * WMO code → the four conditions the portal tracks.
 * https://open-meteo.com/en/docs — codes are grouped, not sequential, so this
 * maps by band rather than listing every value.
 */
export function weatherFromCode(code: number): Weather {
  if (code <= 1) return "sunny"; // 0 clear, 1 mainly clear
  if (code <= 3) return "cloudy"; // 2 partly cloudy, 3 overcast
  if (code <= 48) return "cloudy"; // 45/48 fog
  if (code <= 67) return "rain"; // drizzle + rain, incl. freezing
  if (code <= 77) return "snow"; // snowfall + snow grains
  if (code <= 82) return "rain"; // rain showers
  if (code <= 86) return "snow"; // snow showers
  return "rain"; // 95/96/99 thunderstorm
}

type DailyResponse = {
  daily?: { weather_code?: (number | null)[]; temperature_2m_max?: (number | null)[] };
  error?: boolean;
};

async function readDay(
  url: string,
  signal?: AbortSignal,
): Promise<FetchedWeather | null> {
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const json = (await res.json()) as DailyResponse;
  const code = json.daily?.weather_code?.[0];
  const temp = json.daily?.temperature_2m_max?.[0];
  if (code === null || code === undefined) return null;
  if (temp === null || temp === undefined) return null;
  return { weather: weatherFromCode(code), temp_f: Math.round(temp) };
}

/**
 * The day's condition and high for the West Loop, or null if it can't be
 * had — an out-of-range date, an offline browser, a bad response. Callers
 * treat null as "leave the fields alone", never as an error worth a toast.
 */
export async function fetchDayWeather(
  dateStr: string,
  signal?: AbortSignal,
): Promise<FetchedWeather | null> {
  const range = `&start_date=${dateStr}&end_date=${dateStr}`;
  const endpoints = [
    `https://api.open-meteo.com/v1/forecast?${COMMON}${range}`,
    `https://archive-api.open-meteo.com/v1/archive?${COMMON}${range}`,
  ];
  for (const url of endpoints) {
    try {
      const hit = await readDay(url, signal);
      if (hit) return hit;
    } catch (err) {
      // An aborted request means the user moved on — stop, don't fall through
      // to the next endpoint and race the day they actually opened.
      if (err instanceof DOMException && err.name === "AbortError") throw err;
    }
  }
  return null;
}
