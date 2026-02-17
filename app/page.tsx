"use client";

import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { expandAmaalEvents, MonthConfig, StandardAmaal } from "@/lib/expandAmaalEvents";

const HIJRI_MONTHS = [
  // "Muharram",
  // "Safar",
  // "Rabi al-Awwal",
  // "Rabi al-Thani",
  // "Jumada al-Awwal",
  // "Jumada al-Thani",
  // "Rajab",
  // "Shabaan",
  "Ramadan",
  // "Shawwal",
  // "Dhul Qa'dah",
  // "Dhul Hijjah",
];

const LOCATIONS = {
  qatar: {
    name: "Qatar",
    timezone: "Asia/Qatar",
    coords: { lat: 25.2854, lon: 51.531 },
  },
  toronto: {
    name: "Toronto, Canada",
    timezone: "America/Toronto",
    coords: { lat: 43.6532, lon: -79.3832 },
  },
};

function normMonth(s: string) {
  return s.trim().toLowerCase().replace(/['']/g, "'");
}

type OpenEvent = {
  title: string;
  sections: Record<string, any> | null;
  description: string;
  startISO: string;
  endISO: string;
  allDay: boolean;
};

// --- Nested bullet renderer ---
// --- Nested bullet renderer ---
function renderNestedBullets(bullets: { level: number; text: string }[]) {
  if (!bullets || bullets.length === 0) return null;

  const validBullets = bullets.filter((b) => b && b.text && b.text.trim().length > 0);
  if (validBullets.length === 0) return null;

  const root: any = { level: 0, text: "", children: [] };
  const stack: any[] = [root];

  for (const b of validBullets) {
    const node = { ...b, children: [] };
    const lvl = Math.max(1, b.level || 1);
    node.level = lvl;

    while (stack.length > lvl) stack.pop();
    if (stack.length === 0) stack.push(root);

    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  const markerFor = (level: number) => {
    if (level === 1) return "●";
    if (level === 2) return "○";
    return "■";
  };

  const renderList = (nodes: any[]): JSX.Element => (
    <div style={{ marginTop: 6 }}>
      {nodes.map((n: any, idx: number) => (
        <div key={idx} style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div
              className="bulletMarker"
              style={{ width: 18, flex: "0 0 18px", color: "#333", marginTop: 1 }}
            >
              {markerFor(n.level)}
            </div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 14 }}>{n.text}</div>
          </div>
          {n.children?.length > 0 && (
            <div style={{ marginLeft: 28 }}>{renderList(n.children)}</div>
          )}
        </div>
      ))}
    </div>
  );

  return renderList(root.children);
}

// Section colour palette — cycles through greens/blues/purples
const SECTION_COLORS = [
  { bg: "#f0fdf4", border: "#059669", text: "#065f46", heading: "#059669" },
  { bg: "#eff6ff", border: "#2563eb", text: "#1e40af", heading: "#2563eb" },
  { bg: "#faf5ff", border: "#7c3aed", text: "#4c1d95", heading: "#7c3aed" },
  { bg: "#fff7ed", border: "#ea580c", text: "#7c2d12", heading: "#ea580c" },
];

const SECTION_ICONS: Record<string, string> = {
  general: "📋",
  intro: "📋",
  context: "ℹ️",
  amaal: "🤲",
  recitations: "📖",
  dhikr: "🔤",
  supplications: "🤲",
  prayers: "🕌",
};

function getSectionIcon(key: string): string {
  const lower = key.toLowerCase();
  for (const [k, icon] of Object.entries(SECTION_ICONS)) {
    if (lower.includes(k)) return icon;
  }
  return "•";
}

// --- Generic multi-section renderer ---
// Handles any combination of *_heading + *_bullets pairs,
// context_lines, and intro_bullets found in the JSON.
function renderSections(sections: Record<string, any>, fallbackDescription: string) {
  // Collect ordered sections by scanning keys for *_heading markers.
  // For each heading key we look for a matching *_bullets or *_lines key.
  const rendered: JSX.Element[] = [];
  let colorIdx = 0;

  // Build an ordered list of section descriptors from the keys.
  // Strategy: iterate keys in insertion order; when we hit a *_heading
  // (or a standalone bullets/lines key with no heading), emit a block.
  const keys = Object.keys(sections);
  const visited = new Set<string>();

  // Pass 1: heading-anchored sections
  for (const key of keys) {
    if (!key.endsWith("_heading")) continue;
    visited.add(key);

    const prefix = key.slice(0, -"_heading".length); // e.g. "prayers"
    const headingText = (sections[key] as string || "").replace(/\*+/g, "").trim();
    const bulletsKey = `${prefix}_bullets`;
    const linesKey = `${prefix}_lines`;
    const bullets: { level: number; text: string }[] | undefined = sections[bulletsKey];
    const lines: string[] | undefined = sections[linesKey];

    if (bulletsKey in sections) visited.add(bulletsKey);
    if (linesKey in sections) visited.add(linesKey);

    const color = SECTION_COLORS[colorIdx % SECTION_COLORS.length];
    colorIdx++;

    const icon = getSectionIcon(prefix);
    const label = headingText || prefix.replace(/_/g, " ");

    // context_lines-style: render as plain blue quote lines
    if (lines && lines.length > 0 && (!bullets || bullets.length === 0)) {
      rendered.push(
        <div key={key}>
          {label && (
            <div style={{
              fontWeight: 800, fontSize: 13, marginBottom: 8,
              color: color.heading, textTransform: "uppercase",
              letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>{icon}</span> {label}
            </div>
          )}
          <div style={{ background: color.bg, padding: 14, borderRadius: 10, borderLeft: `4px solid ${color.border}` }}>
            {lines.map((line, i) => (
              <div key={i} style={{
                marginBottom: i < lines.length - 1 ? 10 : 0,
                lineHeight: 1.7, color: color.text, fontSize: 14,
              }}>
                • {line}
              </div>
            ))}
          </div>
        </div>
      );
      continue;
    }

    if (!bullets || bullets.length === 0) continue;

    rendered.push(
      <div key={key}>
        {label && (
          <div style={{
            fontWeight: 800, fontSize: 13, marginBottom: 8,
            color: color.heading, textTransform: "uppercase",
            letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>{icon}</span> {label}
          </div>
        )}
        <div style={{ background: color.bg, padding: 14, borderRadius: 10, borderLeft: `4px solid ${color.border}` }}>
          {renderNestedBullets(bullets)}
        </div>
      </div>
    );
  }

  // Pass 2: unanchored bullet/line arrays (no matching heading key)
  for (const key of keys) {
    if (visited.has(key)) continue;

    if (key.endsWith("_bullets")) {
      visited.add(key);
      const bullets: { level: number; text: string }[] = sections[key];
      if (!bullets || bullets.length === 0) continue;
      const prefix = key.slice(0, -"_bullets".length);
      const color = SECTION_COLORS[colorIdx % SECTION_COLORS.length];
      colorIdx++;
      const icon = getSectionIcon(prefix);
      const label = prefix.replace(/_/g, " ");

      rendered.push(
        <div key={key}>
          {label && (
            <div style={{
              fontWeight: 800, fontSize: 13, marginBottom: 8,
              color: color.heading, textTransform: "uppercase",
              letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>{icon}</span> {label}
            </div>
          )}
          <div style={{ background: color.bg, padding: 14, borderRadius: 10, borderLeft: `4px solid ${color.border}` }}>
            {renderNestedBullets(bullets)}
          </div>
        </div>
      );
    }
  }

  // Fallback: nothing rendered, show raw description text
  if (rendered.length === 0 && fallbackDescription) {
    return (
      <pre style={{
        whiteSpace: "pre-wrap", lineHeight: 1.7, fontFamily: "inherit",
        background: "#f0fdf4", padding: 16, borderRadius: 10,
        borderLeft: "4px solid #059669", margin: 0, fontSize: 14, color: "#065f46",
      }}>
        {fallbackDescription}
      </pre>
    );
  }

  return <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>{rendered}</div>;
}

function formatTime(isoString: string, timezone: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function pickEventColor(title: string, fallback?: string) {
  const t = (title || "").toLowerCase().trim();

  // 1️⃣ 1st day, 2nd day, 3rd day etc → FULL GREEN
  if (/\b\d{1,2}(st|nd|rd|th)\s+day\b/i.test(title || "")) {
    return "#059669"; // green
  }

  if (/\b\d{1,2}(st|nd|rd|th)\s+night\b/i.test(title || "")) {
    return "#2563eb"; // blue
  }

  // 2️⃣ Friday morning Quran recitation → FULL GREEN
  if (t.includes("friday") && t.includes("morning") && (t.includes("quran") || t.includes("qur'an"))) {
    return "#059669"; // green
  }

  // 3️⃣ Thursday night Quran recitation → FULL BLUE
  if (t.includes("thursday") && t.includes("night") && (t.includes("quran") || t.includes("qur'an"))) {
    return "#2563eb"; // blue
  }

  if (t.includes("every day")) return "#059669"; // green
  if (t.includes("every night")) return "#2563eb"; // blue

  return fallback || "#e69b00";
}

export default function Page() {
  const [selectedLocation, setSelectedLocation] = useState<"qatar" | "toronto">("qatar");
  const [displayTimezone, setDisplayTimezone] = useState<"qatar" | "toronto">("qatar");
  const [amaal, setAmaal] = useState<StandardAmaal | null>(null);
  const [openEvent, setOpenEvent] = useState<OpenEvent | null>(null);
  const [configs, setConfigs] = useState<Record<string, MonthConfig>>({});

  // Auto-update display timezone when location changes
  useEffect(() => {
    setDisplayTimezone(selectedLocation);
  }, [selectedLocation]);

  useEffect(() => {
    fetch("/ramadan_standard_amaal.json")
      .then((r) => r.json())
      .then((data) => setAmaal(data))
      .catch((err) => {
        console.error("Failed to load amaal data:", err);
        alert("Failed to load amaal data. Make sure ramadan_standard_amaal.json is in the public folder.");
      });
  }, []);

  function updateMonth(month: string, patch: Partial<MonthConfig>) {
    setConfigs((prev) => {
      const key = normMonth(month);
      const cur = prev[key] ?? { startDateISO: "", length: 30 as 29 | 30 };
      return { ...prev, [key]: { ...cur, ...patch } };
    });
  }

  const location = LOCATIONS[selectedLocation];
  const displayLoc = LOCATIONS[displayTimezone];

  const expandedEvents = useMemo(() => {
    if (!amaal) return [];
    return expandAmaalEvents({
      amaal,
      monthConfigs: configs,
      timezone: location.timezone,
      coords: location.coords,
    });
  }, [amaal, configs, location]);

  return (
    <div
      className="pageRoot"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #f8fafc, #e2e8f0)",
        padding: "24px 16px",
      }}
    >
      <div className="containerMax" style={{ maxWidth: 1250, margin: "0 auto" }}>
        {/* Header */}
        <div
          className="card headerCard"
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            marginBottom: 20,
          }}
        >
          <h1
            className="pageTitle"
            style={{
              fontSize: 32,
              fontWeight: 900,
              background: "linear-gradient(to right, #059669, #2563eb)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: 8,
              lineHeight: 1.2,
            }}
          >
            🌙 Islamic Monthly Amaal Calendar
          </h1>
          <p
            className="pageSubtitle"
            style={{
              fontSize: 15,
              color: "#64748b",
              marginTop: 8,
              lineHeight: 1.4,
            }}
          >
            Track your daily and nightly worship with accurate prayer times
          </p>
        </div>

        {/* Color Legend */}
        {/* <div
          className="card legendCard"
          style={{
            background: "white",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            boxShadow: "0 2px 4px rgb(0 0 0 / 0.05)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#334155" }}>📋 Event Color Guide</div>
          <div className="legendRow" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div className="legendItem" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: "#059669", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#475569" }}>
                <strong>Every day</strong> + <strong>1st day</strong>, <strong>2nd day</strong>…
              </span>
            </div>
            <div className="legendItem" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: "#2563eb", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#475569" }}>
                <strong>Every night</strong> + <strong>Thursday night Quran</strong>
              </span>
            </div>
            <div className="legendItem" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: "#059669", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#475569" }}>
                <strong>Friday morning Quran recitation</strong>
              </span>
            </div>
          </div>
        </div> */}

        {/* Settings */}
        <div
          className="card settingsCard"
          style={{
            background: "white",
            borderRadius: 12,
            padding: 18,
            marginBottom: 20,
            boxShadow: "0 2px 4px rgb(0 0 0 / 0.05)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#1e293b" }}>⚙️ Location & Display Settings</div>
          <div className="settingsRow" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <div className="settingsLeft" style={{ flex: "1 1 auto", minWidth: 200 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#475569" }}>
                📍 Your Location (for prayer time calculations):
              </label>
              <select
                className="controlSelect"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value as any)}
                style={{
                  width: "100%",
                  maxWidth: 280,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  cursor: "pointer",
                  background: "white",
                }}
              >
                <option value="qatar">🇶🇦 Qatar</option>
                <option value="toronto">🇨🇦 Toronto, Canada</option>
              </select>
            </div>

            <div className="settingsRight" style={{ minWidth: 220 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#475569" }}>
                🕐 Display times in:
              </label>
              <select
                className="controlSelect"
                value={displayTimezone}
                onChange={(e) => setDisplayTimezone(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  cursor: "pointer",
                  background: "white",
                }}
              >
                <option value="qatar">Qatar Timezone</option>
                <option value="toronto">Toronto Timezone</option>
              </select>
            </div>
          </div>
        </div>

        {/* Hijri Date Config */}
        <div
          className="card hijriCard"
          style={{
            background: "white",
            borderRadius: 12,
            padding: 18,
            marginBottom: 20,
            boxShadow: "0 2px 4px rgb(0 0 0 / 0.05)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#1e293b" }}>📅 Hijri Month Configuration</div>
          <div className="monthGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {HIJRI_MONTHS.map((mName) => {
              const key = normMonth(mName);
              const cfg = configs[key];
              return (
                <div
                  key={mName}
                  className="monthCard"
                  style={{
                    padding: 16,
                    background: "#f8fafc",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14, color: "#1e293b" }}>{mName}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#64748b" }}>
                        Start Date (YYYY-MM-DD):
                      </label>
                      <input
                        className="controlInput"
                        type="date"
                        value={cfg?.startDateISO || ""}
                        onChange={(e) => updateMonth(mName, { startDateISO: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                          background: "white",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#64748b" }}>
                        Length:
                      </label>
                      <select
                        className="controlSelect"
                        value={cfg?.length ?? 30}
                        onChange={(e) => updateMonth(mName, { length: +e.target.value as 29 | 30 })}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                          cursor: "pointer",
                          background: "white",
                        }}
                      >
                        <option value={29}>29 days</option>
                        <option value={30}>30 days</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Calendar */}
        <div
          className="card calendarCard"
          style={{
            background: "white",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 2px 4px rgb(0 0 0 / 0.05)",
          }}
        >
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            eventDisplay="block"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek,dayGridDay",
            }}
            buttonText={{
              today: "Today",
              month: "Month",
              week: "Week",
              day: "Day",
            }}
            events={expandedEvents.map((e) => ({
              title: e.title,
              start: e.startISO,
              end: e.endISO,
              allDay: e.allDay,
              backgroundColor: pickEventColor(e.title),
              borderColor: pickEventColor(e.title),
              extendedProps: e,
            }))}
            eventClick={(info) => {
              const evt = info.event.extendedProps as any;
              setOpenEvent({
                title: info.event.title,
                sections: evt.sections || null,
                description: evt.description || "",
                startISO: info.event.startStr,
                endISO: info.event.endStr || info.event.startStr,
                allDay: info.event.allDay,
              });
            }}
            height="auto"
            contentHeight="auto"
          />
        </div>

        {/* Modal */}
        {openEvent && (
          <div
            className="modalOverlay"
            onClick={() => setOpenEvent(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 20,
              overflowY: "auto",
            }}
          >
            <div
              className="modalBox"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "white",
                borderRadius: 16,
                maxWidth: 700,
                width: "100%",
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.3)",
              }}
            >
              <div
                className="modalHeader"
                style={{
                  background: "linear-gradient(to right, #059669, #2563eb)",
                  color: "white",
                  padding: 20,
                  borderRadius: "16px 16px 0 0",
                }}
              >
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, lineHeight: 1.3 }}>{openEvent.title}</h2>
                {!openEvent.allDay && (
                  <div className="prayerRow" style={{ display: "flex", gap: 16, fontSize: 13, flexWrap: "wrap" }}>
                    <div>
                      <strong>Start:</strong> {formatTime(openEvent.startISO, displayLoc.timezone)}
                    </div>
                    <div>
                      <strong>End:</strong> {formatTime(openEvent.endISO, displayLoc.timezone)}
                    </div>
                  </div>
                )}
              </div>

             <div className="modalBody" style={{ padding: 20, overflowY: "auto", flex: 1 }}>
                {openEvent.sections
                  ? renderSections(openEvent.sections, openEvent.description)
                  : (
                    <pre style={{
                      whiteSpace: "pre-wrap", marginTop: 10, lineHeight: 1.7,
                      fontFamily: "inherit", fontSize: 14, color: "#334155",
                    }}>
                      {openEvent.description}
                    </pre>
                  )
                }

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24, paddingTop: 16, borderTop: "2px solid #f1f5f9" }}>
                  <button
                    className="closeBtn"
                    onClick={() => setOpenEvent(null)}
                    style={{
                      padding: "12px 24px", fontWeight: 700, background: "#1e293b",
                      color: "white", border: "none", borderRadius: 10,
                      cursor: "pointer", fontSize: 14, transition: "background 0.2s",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#0f172a")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "#1e293b")}
                  >
                    Close
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Mobile + FullCalendar responsive tweaks */}
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        /* Make form controls feel better on mobile */
        .controlSelect,
        .controlInput {
          -webkit-appearance: none;
          appearance: none;
        }

        /* FullCalendar mobile-friendly toolbar */
        .fc .fc-toolbar {
          flex-wrap: wrap;
          gap: 8px;
        }
        .fc .fc-toolbar-chunk {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .fc .fc-button {
          padding: 0.4rem 0.7rem;
          font-size: 0.85rem;
        }
        .fc .fc-toolbar-title {
          font-size: 1.1rem;
          line-height: 1.3;
        }

        /* Ensure day cell text doesn't overflow badly */
        .fc .fc-daygrid-day-number {
          font-size: 0.9rem;
          padding: 4px;
        }
        .fc .fc-event-title {
          white-space: normal;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fc .fc-event {
          cursor: pointer;
        }

        /* Better touch targets */
        button,
        select,
        input {
          touch-action: manipulation;
        }

        /* Mobile button text abbreviations */
        @media (max-width: 480px) {
          .fc .fc-dayGridMonth-button {
            font-size: 0;
          }
          .fc .fc-dayGridMonth-button:after {
            content: "M";
            font-size: 0.75rem;
          }
          .fc .fc-dayGridWeek-button {
            font-size: 0;
          }
          .fc .fc-dayGridWeek-button:after {
            content: "W";
            font-size: 0.75rem;
          }
          .fc .fc-dayGridDay-button {
            font-size: 0;
          }
          .fc .fc-dayGridDay-button:after {
            content: "D";
            font-size: 0.75rem;
          }
        }

        @media (max-width: 640px) {
          .pageRoot {
            padding: 12px 8px !important;
          }

          .containerMax {
            max-width: 100% !important;
          }

          .headerCard {
            padding: 16px !important;
            margin-bottom: 16px !important;
          }

          .pageTitle {
            font-size: 20px !important;
            line-height: 1.2 !important;
          }

          .pageSubtitle {
            font-size: 12px !important;
            line-height: 1.4 !important;
          }

          .legendCard {
            padding: 12px !important;
            margin-bottom: 16px !important;
          }

          .legendRow {
            gap: 12px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
          }

          .legendItem {
            width: 100% !important;
          }

          .legendItem span {
            font-size: 12px !important;
          }

          .settingsCard {
            padding: 14px !important;
            margin-bottom: 16px !important;
          }

          .settingsRow {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }

          .settingsLeft {
            width: 100% !important;
            min-width: 0 !important;
          }

          .controlSelect {
            max-width: none !important;
            width: 100% !important;
          }

          .settingsRight {
            min-width: 0 !important;
            width: 100% !important;
          }

          .hijriCard {
            padding: 14px !important;
            margin-bottom: 16px !important;
          }

          .monthGrid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .monthCard {
            padding: 12px !important;
          }

          .calendarCard {
            padding: 12px !important;
            overflow-x: auto !important;
          }

          /* Make FullCalendar more mobile-friendly */
          .fc .fc-toolbar {
            font-size: 0.85rem;
          }

          .fc .fc-button {
            padding: 0.3rem 0.5rem;
            font-size: 0.75rem;
          }

          .fc .fc-toolbar-title {
            font-size: 0.95rem;
          }

          /* Make view switcher more compact on mobile */
          .fc .fc-toolbar .fc-toolbar-chunk:last-child {
            display: flex !important;
            width: 100%;
            justify-content: center;
            margin-top: 8px;
          }

          .fc .fc-toolbar .fc-toolbar-chunk:last-child .fc-button-group {
            display: flex;
            gap: 4px;
          }

          .fc .fc-daygrid-day-number {
            font-size: 0.8rem;
          }

          .fc .fc-event-title {
            font-size: 0.7rem;
          }

          .fc .fc-col-header-cell-cushion {
            font-size: 0.75rem;
            padding: 4px 2px;
          }

          /* Modal becomes bottom-sheet-ish */
          .modalOverlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }

          .modalBox {
            max-height: 95vh !important;
            border-radius: 16px 16px 0 0 !important;
            max-width: 100% !important;
          }

          .modalHeader {
            padding: 16px !important;
          }

          .modalHeader h2 {
            font-size: 18px !important;
          }

          .modalBody {
            padding: 14px !important;
          }

          .prayerRow {
            gap: 12px !important;
            font-size: 12px !important;
          }

          .closeBtn {
            width: 100% !important;
          }

          /* Slightly smaller bullet markers */
          .bulletMarker {
            width: 14px !important;
            flex: 0 0 14px !important;
            font-size: 12px !important;
          }
        }

        /* Extra small devices (phones in portrait, less than 375px) */
        @media (max-width: 374px) {
          .pageRoot {
            padding: 8px 6px !important;
          }

          .pageTitle {
            font-size: 18px !important;
          }

          .fc .fc-button {
            padding: 0.25rem 0.4rem;
            font-size: 0.7rem;
          }

          .fc .fc-toolbar-title {
            font-size: 0.85rem;
          }

          .fc .fc-daygrid-day-number {
            font-size: 0.75rem;
          }
        }

        /* Tablets and larger phones in landscape */
        @media (min-width: 641px) and (max-width: 1024px) {
          .monthGrid {
            grid-template-columns: repeat(2, 1fr) !important;
          }

          .settingsRow {
            flex-wrap: wrap !important;
          }
        }
      `}</style>
    </div>
  );
}
