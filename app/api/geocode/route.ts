import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ ok: false, error: "Missing q" }, { status: 400 });
  }

  // OpenStreetMap Nominatim (simple geocode)
  // Respect usage: add a User-Agent + keep requests reasonable.
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=5&q=" +
    encodeURIComponent(q);

  const r = await fetch(url, {
    headers: {
      "User-Agent": "amaal-calendar-local-dev/1.0 (local)",
      "Accept-Language": "en",
    },
    // no-cache for dev
    cache: "no-store",
  });

  if (!r.ok) {
    return NextResponse.json({ ok: false, error: "Geocode failed" }, { status: 500 });
  }

  const data = (await r.json()) as any[];

  const results = data.map((x) => ({
    displayName: x.display_name,
    lat: Number(x.lat),
    lon: Number(x.lon),
  }));

  return NextResponse.json({ ok: true, results });
}
