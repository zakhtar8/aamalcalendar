"use client";

import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { expandAmaalEvents, MonthConfig, StandardAmaal } from "@/lib/expandAmaalEvents";

const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
  "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Shabaan",
  "Ramadan", "Shawwal", "Dhul Qa'dah", "Dhul Hijjah",
];

const LOCATIONS = {
  qatar: {
    name: "Qatar",
    timezone: "Asia/Qatar",
    coords: { lat: 25.2854, lon: 51.5310 },
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
  sections: null | {
    context_heading: string;
    context_lines: string[];
    amaal_heading: string;
    amaal_bullets: { level: number; text: string }[];
  };
  description: string;
  startISO: string;
  endISO: string;
  allDay: boolean;
};

// --- Nested bullet renderer ---
function renderNestedBullets(bullets: { level: number; text: string }[]) {
  if (!bullets || bullets.length === 0) return null;

  const validBullets = bullets.filter(b => b && b.text && b.text.trim().length > 0);
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

  const renderList = (nodes: any[]) => (
    <div style={{ marginTop: 6 }}>
      {nodes.map((n, idx) => (
        <div key={idx} style={{ marginTop: 6 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 18, flex: "0 0 18px", color: "#333" }}>{markerFor(n.level)}</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{n.text}</div>
          </div>
          {n.children?.length > 0 && (
            <div style={{ marginLeft: 28 }}>
              {renderList(n.children)}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return renderList(root.children);
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
    fetch("/monthly_amaal_fixed.json")
      .then((r) => r.json())
      .then((data) => setAmaal(data))
      .catch((err) => {
        console.error("Failed to load amaal data:", err);
        alert("Failed to load amaal data. Make sure monthly_amaal_fixed.json is in the public folder.");
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
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #f8fafc, #e2e8f0)',
      padding: '24px 16px'
    }}>
      <div style={{ maxWidth: 1250, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ 
          background: 'white',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          marginBottom: 20
        }}>
          <h1 style={{ 
            fontSize: 32, 
            fontWeight: 900,
            background: 'linear-gradient(to right, #059669, #2563eb)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 8
          }}>
            🌙 Islamic Monthly Amaal Calendar
          </h1>
          <p style={{ 
            fontSize: 15,
            color: '#64748b',
            marginTop: 8
          }}>
            Track your daily and nightly worship with accurate prayer times
          </p>
        </div>

        {/* Color Legend */}
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          boxShadow: '0 2px 4px rgb(0 0 0 / 0.05)'
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#334155' }}>
            📋 Event Color Guide
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ 
                width: 16, 
                height: 16, 
                borderRadius: 4, 
                background: '#059669' 
              }} />
              <span style={{ fontSize: 13, color: '#475569' }}>
                <strong>Day Events</strong> (Fajr to Maghrib)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ 
                width: 16, 
                height: 16, 
                borderRadius: 4, 
                background: '#2563eb' 
              }} />
              <span style={{ fontSize: 13, color: '#475569' }}>
                <strong>Night Events</strong> (Maghrib to Fajr)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ 
                width: 16, 
                height: 16, 
                borderRadius: 4, 
                background: '#8b5cf6' 
              }} />
              <span style={{ fontSize: 13, color: '#475569' }}>
                <strong>All-Day Events</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Location Settings */}
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
          boxShadow: '0 2px 4px rgb(0 0 0 / 0.05)'
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: '#1e293b' }}>
            ⚙️ Settings
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#475569' }}>
                Prayer Times Location
              </div>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value as "qatar" | "toronto")}
                style={{ 
                  padding: '10px 14px',
                  minWidth: 220,
                  fontSize: 14,
                  fontWeight: 600,
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: 'white'
                }}
              >
                <option value="qatar">🇶🇦 Qatar (GMT+3)</option>
                <option value="toronto">🇨🇦 Toronto, Canada (GMT-5)</option>
              </select>
            </div>

            <div style={{ 
              background: '#eff6ff',
              padding: "12px 16px",
              borderRadius: 8,
              border: "2px solid #bfdbfe",
              flex: 1,
              minWidth: 200
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", marginBottom: 4 }}>
                📍 CURRENT LOCATION
              </div>
              <div style={{ fontSize: 14, color: "#1e3a8a", fontWeight: 600 }}>
                {location.name}
              </div>
            </div>
          </div>
        </div>

        {/* Hijri Month Configuration */}
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
          boxShadow: '0 2px 4px rgb(0 0 0 / 0.05)'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: '#1e293b' }}>
            📅 Step 1: Enter Hijri Month Start Dates
          </h2>
          <p style={{ marginTop: 6, color: '#64748b', fontSize: 14, marginBottom: 16 }}>
            For each Hijri month, enter the <b>Gregorian date for Day 1</b> (moon-sighting) and month length (29/30).
          </p>

          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
            gap: 14
          }}>
            {HIJRI_MONTHS.map((m) => {
              const c = configs[normMonth(m)];
              return (
                <div key={m} style={{ 
                  border: "2px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 16,
                  background: '#fafafa',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15, marginBottom: 12 }}>
                    {m}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#475569' }}>
                      Gregorian date for 1st of {m}
                    </div>
                    <input
                      type="date"
                      value={c?.startDateISO ?? ""}
                      onChange={(e) => updateMonth(m, { startDateISO: e.target.value })}
                      style={{ 
                        width: "100%",
                        padding: 10,
                        border: '2px solid #e2e8f0',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 500
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#475569' }}>
                      Month length
                    </div>
                    <select
                      value={c?.length ?? 30}
                      onChange={(e) => updateMonth(m, { length: Number(e.target.value) as 29 | 30 })}
                      style={{ 
                        width: "100%",
                        padding: 10,
                        border: '2px solid #e2e8f0',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <option value={29}>29 days</option>
                      <option value={30}>30 days</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Calendar */}
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 2px 4px rgb(0 0 0 / 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              📆 Step 2: Your Amaal Calendar
            </h2>
            <div style={{ 
              background: '#f1f5f9',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              color: '#475569'
            }}>
              {amaal ? (
                <>
                  <b style={{ color: '#059669' }}>{expandedEvents.length}</b> events loaded
                </>
              ) : (
                "Loading..."
              )}
            </div>
          </div>

          <div style={{ 
            border: "2px solid #e2e8f0",
            borderRadius: 12,
            overflow: 'hidden'
          }}>
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              height="auto"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek'
              }}
              events={expandedEvents.map((e: any) => ({
                id: e.id,
                title: e.title,
                start: e.startISO,
                end: e.endISO,
                allDay: e.allDay,
                backgroundColor: e.color || '#6366f1',
                borderColor: e.color || '#6366f1',
                extendedProps: {
                  description: e.description ?? "",
                  sections: e.sections ?? null,
                  startISO: e.startISO,
                  endISO: e.endISO,
                },
              }))}
              eventClick={(info) => {
                setOpenEvent({
                  title: info.event.title,
                  sections: (info.event.extendedProps as any)?.sections ?? null,
                  description: (info.event.extendedProps as any)?.description ?? "",
                  startISO: (info.event.extendedProps as any)?.startISO ?? info.event.startStr,
                  endISO: (info.event.extendedProps as any)?.endISO ?? info.event.endStr,
                  allDay: info.event.allDay,
                });
              }}
            />
          </div>
        </div>

        {/* MODAL */}
        {openEvent && (
          <div
            onClick={() => setOpenEvent(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: 'blur(4px)',
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 9999,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "white",
                borderRadius: 16,
                maxWidth: 900,
                width: "100%",
                maxHeight: "90vh",
                overflow: "auto",
                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
              }}
            >
              {/* Modal Header */}
              <div style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                padding: 24,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16
              }}>
                <div style={{ 
                  fontWeight: 900,
                  fontSize: 22,
                  color: 'white',
                  marginBottom: 8
                }}>
                  {openEvent.title}
                </div>
                
                {/* Prayer Times Display */}
                {!openEvent.allDay && (
                  <div style={{
                    background: "rgba(255,255,255,0.95)",
                    padding: 14,
                    borderRadius: 10,
                    marginTop: 12
                  }}>
                    <div style={{ 
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#047857",
                      marginBottom: 8,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      ⏰ Prayer Times ({displayLoc.name})
                    </div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                      <div>
                        <span style={{ fontSize: 11, color: "#065f46", fontWeight: 600 }}>
                          Start: 
                        </span>
                        <span style={{ 
                          fontSize: 16,
                          fontWeight: 800,
                          color: "#064e3b",
                          marginLeft: 6
                        }}>
                          {formatTime(openEvent.startISO, displayLoc.timezone)}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: "#065f46", fontWeight: 600 }}>
                          End: 
                        </span>
                        <span style={{ 
                          fontSize: 16,
                          fontWeight: 800,
                          color: "#064e3b",
                          marginLeft: 6
                        }}>
                          {formatTime(openEvent.endISO, displayLoc.timezone)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Content */}
              <div style={{ padding: 24 }}>
                {openEvent.sections ? (
                  <div>
                    {/* Context Section */}
                    {openEvent.sections.context_lines && openEvent.sections.context_lines.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ 
                          fontWeight: 800,
                          fontSize: 14,
                          marginBottom: 10,
                          color: "#2563eb",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <span>📖</span> {openEvent.sections.context_heading || "Context"}
                        </div>
                        <div style={{ 
                          background: "#eff6ff",
                          padding: 16,
                          borderRadius: 10,
                          borderLeft: "4px solid #2563eb"
                        }}>
                          {openEvent.sections.context_lines.map((line, idx) => (
                            <div key={idx} style={{ 
                              marginBottom: idx < openEvent.sections!.context_lines.length - 1 ? 10 : 0,
                              lineHeight: 1.7,
                              color: "#1e40af",
                              fontSize: 14
                            }}>
                              • {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Amaal Section */}
                    {openEvent.sections.amaal_bullets && openEvent.sections.amaal_bullets.length > 0 ? (
                      <div>
                        <div style={{ 
                          fontWeight: 800,
                          fontSize: 14,
                          marginBottom: 10,
                          color: "#059669",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <span>🤲</span> {openEvent.sections.amaal_heading || "Amaal"}
                        </div>
                        <div style={{
                          background: "#f0fdf4",
                          padding: 16,
                          borderRadius: 10,
                          borderLeft: "4px solid #059669"
                        }}>
                          {renderNestedBullets(openEvent.sections.amaal_bullets)}
                        </div>
                      </div>
                    ) : (
                      openEvent.description && (
                        <div>
                          <div style={{ 
                            fontWeight: 800,
                            fontSize: 14,
                            marginBottom: 10,
                            color: "#059669",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}>
                            <span>🤲</span> Amaal
                          </div>
                          <pre style={{ 
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.7,
                            fontFamily: "inherit",
                            background: "#f0fdf4",
                            padding: 16,
                            borderRadius: 10,
                            borderLeft: "4px solid #059669",
                            margin: 0,
                            fontSize: 14,
                            color: '#065f46'
                          }}>
                            {openEvent.description}
                          </pre>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <pre style={{ 
                    whiteSpace: "pre-wrap",
                    marginTop: 10,
                    lineHeight: 1.7,
                    fontFamily: "inherit",
                    fontSize: 14,
                    color: '#334155'
                  }}>
                    {openEvent.description}
                  </pre>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24, paddingTop: 16, borderTop: '2px solid #f1f5f9' }}>
                  <button
                    onClick={() => setOpenEvent(null)}
                    style={{ 
                      padding: "12px 24px",
                      fontWeight: 700,
                      background: "#1e293b",
                      color: "white",
                      border: "none",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 14,
                      transition: 'all 0.2s'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
