// Weather lookup for the shop's own block, from Open-Meteo — a free, open
// API with no key and no account (CC-BY, https://open-meteo.com/).
//
// Read HOURLY and narrowed to open hours, never the daily summary. Open-Meteo's
// daily weather_code is the worst condition anywhere in the 24h window, so a
// single overcast hour before dawn labels a blue-sky evening "overcast" — on a
// sample of ten October days it called eight of them cloudy while the 3-10 PM
// cloud cover averaged under 15%. What matters here is the weather customers
// stood in, not the weather at 4 AM.
//
// Two endpoints cover different stretches of time:
//   forecast  — a rolling ~93-day past window plus the next 16 days
//   archive   — reanalysis going back decades, but it lags a day or two
// Recent days try the forecast endpoint first (it reflects what actually
// happened sooner), with the archive as the fallback for anything older.

import type { Weather } from "./portal";

/** 1047 W Madison St — Open-Meteo snaps this to its nearest grid point. */
const LAT = 41.8818;
const LON = -87.6534;

/** Open hours, 24h local. Doors are 3-10 PM; 21 is the last hour fully open. */
const OPEN_HOUR = 15;
const CLOSE_HOUR = 21;

/** Mean cloud cover at or above this reads as a cloudy evening. */
const CLOUDY_AT_PCT = 50;
/**
 * Total mm across open hours below this is a passing sprinkle, not a rainy
 * evening. 0.2mm spread over seven hours is a trace; calling that "rain" put
 * clear-ish 30%-cloud days in the rain bucket and dragged its average around.
 */
const RAIN_AT_MM = 0.5;

const COMMON =
  `latitude=${LAT}&longitude=${LON}` +
  "&hourly=weather_code,cloud_cover,precipitation,temperature_2m" +
  "&temperature_unit=fahrenheit&timezone=America%2FChicago";

export type FetchedWeather = { weather: Weather; temp_f: number };

/** WMO codes for frozen precipitation: snowfall, grains, and snow showers. */
function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}

/** WMO codes for liquid precipitation: drizzle, rain, showers, thunderstorms. */
function isRainCode(code: number): boolean {
  return (
    (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95
  );
}

/**
 * The condition a customer would have described, from the open hours only.
 * Precipitation wins over cloud cover — a rainy evening is "rain" however
 * bright the gaps were — and snow wins over rain.
 */
export function conditionFromHours(
  codes: number[],
  cloudPct: number[],
  precipMm: number[],
): Weather | null {
  if (codes.length === 0) return null;
  const precip = precipMm.reduce((a, b) => a + b, 0);
  if (codes.some(isSnowCode)) return "snow";
  if (codes.some(isRainCode) && precip >= RAIN_AT_MM) return "rain";
  // Precipitation the codes missed still counts if there was enough of it.
  if (precip >= RAIN_AT_MM) return "rain";
  const meanCloud = cloudPct.reduce((a, b) => a + b, 0) / cloudPct.length;
  return meanCloud >= CLOUDY_AT_PCT ? "cloudy" : "sunny";
}

type HourlyResponse = {
  hourly?: {
    time?: string[];
    weather_code?: (number | null)[];
    cloud_cover?: (number | null)[];
    precipitation?: (number | null)[];
    temperature_2m?: (number | null)[];
  };
};

/** Group an hourly payload into one reading per day, open hours only. */
function readHourly(json: HourlyResponse): Map<string, FetchedWeather> {
  const out = new Map<string, FetchedWeather>();
  const times = json.hourly?.time ?? [];
  const codes = json.hourly?.weather_code ?? [];
  const clouds = json.hourly?.cloud_cover ?? [];
  const precip = json.hourly?.precipitation ?? [];
  const temps = json.hourly?.temperature_2m ?? [];

  const byDay = new Map<
    string,
    { codes: number[]; cloud: number[]; precip: number[]; temps: number[] }
  >();
  times.forEach((t, i) => {
    const hour = Number(t.slice(11, 13));
    if (hour < OPEN_HOUR || hour > CLOSE_HOUR) return;
    const day = t.slice(0, 10);
    const bucket = byDay.get(day) ?? {
      codes: [], cloud: [], precip: [], temps: [],
    };
    // A null anywhere means that hour wasn't reported; skip the value, not
    // the hour, so a partial day still produces a reading from what exists.
    if (typeof codes[i] === "number") bucket.codes.push(codes[i] as number);
    if (typeof clouds[i] === "number") bucket.cloud.push(clouds[i] as number);
    if (typeof precip[i] === "number") bucket.precip.push(precip[i] as number);
    if (typeof temps[i] === "number") bucket.temps.push(temps[i] as number);
    byDay.set(day, bucket);
  });

  for (const [day, b] of byDay) {
    if (b.cloud.length === 0 || b.temps.length === 0) continue;
    const weather = conditionFromHours(b.codes, b.cloud, b.precip);
    if (!weather) continue;
    // The warmest it got while the doors were open, not the day's 2 PM peak.
    out.set(day, { weather, temp_f: Math.round(Math.max(...b.temps)) });
  }
  return out;
}

/**
 * Readings for a span of days, one request per endpoint rather than one per
 * day. Days the API has nothing for are simply absent from the map.
 */
export async function fetchRangeWeather(
  startDate: string,
  endDate: string,
  signal?: AbortSignal,
): Promise<Map<string, FetchedWeather>> {
  const range = `&start_date=${startDate}&end_date=${endDate}`;
  const out = new Map<string, FetchedWeather>();
  const endpoints = [
    `https://api.open-meteo.com/v1/forecast?${COMMON}${range}`,
    `https://archive-api.open-meteo.com/v1/archive?${COMMON}${range}`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) continue;
      const found = readHourly((await res.json()) as HourlyResponse);
      // The first endpoint to answer for a day wins; the archive only fills
      // gaps the forecast window didn't reach.
      for (const [day, reading] of found) {
        if (!out.has(day)) out.set(day, reading);
      }
    } catch (err) {
      // An aborted request means the user moved on — stop rather than falling
      // through and racing the day they actually opened.
      if (err instanceof DOMException && err.name === "AbortError") throw err;
    }
  }
  return out;
}

/**
 * The condition and high for one day's open hours, or null if it can't be
 * had — an out-of-range date, an offline browser, a bad response. Callers
 * treat null as "leave the fields alone", never as an error worth a toast.
 */
export async function fetchDayWeather(
  dateStr: string,
  signal?: AbortSignal,
): Promise<FetchedWeather | null> {
  const found = await fetchRangeWeather(dateStr, dateStr, signal);
  return found.get(dateStr) ?? null;
}
