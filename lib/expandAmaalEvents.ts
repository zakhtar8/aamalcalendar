import { DateTime } from "luxon";
import { Coordinates, CalculationMethod, PrayerTimes } from "adhan";

export type StandardItem = {
  id: string;
  hijri_month: string;
  label: string;
  period: "day" | "night" | "day_and_night";
  rule_kind:
    | "specific"
    | "range"
    | "month_all"
    | "month_any_time"
    | "weekday"
    | "weekday_multi"
    | "night_general"
    | "unspecified";
  start_day: number | null;
  end_day: number | null;
  weekdays: string[] | null; // ["MON","THU"]
  text: string;
  sections?: Record<string, any> | null;
};

export type StandardAmaal = {
  meta: any;
  items: StandardItem[];
};

export type MonthConfig = {
  startDateISO: string; // Gregorian date for Hijri Day 1
  length: 29 | 30;
};

export type Coords = { lat: number; lon: number };

export type ExpandedEvent = {
  id: string;
  title: string;
  startISO: string;
  endISO: string;
  allDay: boolean;
  description: string;
  sections?: StandardItem["sections"] | null;
  color?: string;
};

function normMonth(s: string) {
  return s.trim().toLowerCase().replace(/['']/g, "'").replace(/\s+/g, " ");
}

function hijriDayToGregorian(cfg: MonthConfig, hijriDay: number, tz: string): DateTime {
  return DateTime.fromISO(cfg.startDateISO, { zone: tz }).startOf("day").plus({ days: hijriDay - 1 });
}

function weekdayToLuxon(weekday: string): number {
  const map: Record<string, number> = {
    MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7,
  };
  return map[weekday] ?? 0;
}

// Accurate prayer times with adhan:
function getPrayerTimesAccurate(gregDate: DateTime, tz: string, coords: Coords) {
  const dateJS = gregDate.setZone(tz).toJSDate();
  const c = new Coordinates(coords.lat, coords.lon);

  // Choose a method you prefer:
  // Options include: CalculationMethod.MoonsightingCommittee(), .Tehran(), .Karachi(), etc.
  const params = CalculationMethod.Tehran();

  const pt = new PrayerTimes(c, dateJS, params);

  const fajr = DateTime.fromJSDate(pt.fajr).setZone(tz);
  const maghrib = DateTime.fromJSDate(pt.maghrib).setZone(tz);

  return { fajr, maghrib };
}

export function expandAmaalEvents(opts: {
  amaal: StandardAmaal;
  monthConfigs: Record<string, MonthConfig>;
  timezone: string;
  coords: Coords; // required for accurate prayer times
}): ExpandedEvent[] {
  const { amaal, monthConfigs, timezone: tz, coords } = opts;
  const events: ExpandedEvent[] = [];

  for (const item of amaal.items) {
    const cfg = monthConfigs[normMonth(item.hijri_month)];
    if (!cfg) continue;

    const monthLen = cfg.length;
    
    // Helper to get ordinal suffix (1st, 2nd, 3rd, etc.)
    const getOrdinal = (n: number): string => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    // Month-wide: single all-day spanning event
    if (item.rule_kind === "month_all" || item.rule_kind === "month_any_time") {
        const start = hijriDayToGregorian(cfg, 1, tz);
        const endExclusive = hijriDayToGregorian(cfg, monthLen, tz).plus({ days: 1 });

        // Create a single month-spanning event
        events.push({
          id: item.id,
          title: item.label || item.hijri_month,
          startISO: start.toISO()!,
          endISO: endExclusive.toISO()!,
          allDay: true,
          description: item.text,
          sections: item.sections ?? null,
          color: '#8b5cf6', // Purple for month-wide events
        });

        continue;
      }

    // Weekday rules: expand across the month (day window)
    if (item.rule_kind === "weekday" || item.rule_kind === "weekday_multi") {
      const weekdays = item.weekdays ?? [];
      const target = new Set(weekdays.map(weekdayToLuxon));

      for (let d = 1; d <= monthLen; d++) {
        const g = hijriDayToGregorian(cfg, d, tz);
        if (!target.has(g.weekday)) continue;

        const { fajr, maghrib } = getPrayerTimesAccurate(g, tz, coords);

        events.push({
          id: `${item.id}_d${d}`,
          title: item.label || `${getOrdinal(d)} Day`,
          startISO: fajr.toISO()!,
          endISO: maghrib.toISO()!,
          allDay: false,
          description: item.text,
          sections: item.sections ?? null,
          color: '#059669', // Green for day events
        });
      }
      continue;
    }

    // Range/specific
    const sd = item.start_day;
    if (!sd) continue;

    const startDay = Math.max(1, Math.min(sd, monthLen));
    const endDay =
      item.end_day == null ? monthLen : Math.max(startDay, Math.min(item.end_day, monthLen));

    // NIGHT: Show as all-day event on the specific Hijri day
    // No time spans - just appears on that calendar date
    if (item.period === "night") {
      for (let d = startDay; d <= endDay; d++) {
        const gDay = hijriDayToGregorian(cfg, d, tz);
        const eveDay = gDay.minus({ days: 1 });
        // Night event shows as all-day on the calendar date it belongs to
        events.push({
          id: `${item.id}_night_${d}`,
          title: item.label || `${getOrdinal(d)} Night`,
          startISO: eveDay.startOf("day").toISO()!,
          endISO: eveDay.endOf("day").toISO()!,
          allDay: true, // Changed to all-day so it doesn't span dates
          description: item.text,
          sections: item.sections ?? null,
          color: '#2563eb', // Blue for night events
        });
      }
      continue;
    }

    // DAY: Fajr → Maghrib (same day)
    if (item.period === "day") {
      for (let d = startDay; d <= endDay; d++) {
        const gDay = hijriDayToGregorian(cfg, d, tz);
        const { fajr, maghrib } = getPrayerTimesAccurate(gDay, tz, coords);

        events.push({
          id: `${item.id}_day_${d}`,
          title: item.label || `${getOrdinal(d)} Day`,
          startISO: fajr.toISO()!,
          endISO: maghrib.toISO()!,
          allDay: false,
          description: item.text,
          sections: item.sections ?? null,
          color: '#059669', // Green for day events
        });
      }
      continue;
    }

    // day_and_night fallback: all-day blocks per day
    for (let d = startDay; d <= endDay; d++) {
      const gDay = hijriDayToGregorian(cfg, d, tz);
      events.push({
        id: `${item.id}_allday_${d}`,
        title: item.label || `${getOrdinal(d)} Day`,
        startISO: gDay.startOf("day").toISO()!,
        endISO: gDay.plus({ days: 1 }).startOf("day").toISO()!,
        allDay: true,
        description: item.text,
        sections: item.sections ?? null,
        color: '#8b5cf6', // Purple for all-day events
      });
    }
  }

  // REMOVE DUPLICATES (safety net)
  const seen = new Set<string>();
  const uniqueEvents = events.filter(ev => {
    const key = `${ev.title}|${ev.startISO}|${ev.endISO}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueEvents;
}
