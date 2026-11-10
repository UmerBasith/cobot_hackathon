/** /services — helplines (tap to call), relief shelters with occupancy, hospitals & stations. Search filters by area. */
import { useEffect, useMemo, useState } from "react";
import { Ambulance, Building2, Flame, HeartPulse, Home, LifeBuoy, MapPin, Phone, Search, ShieldHalf, Siren, Train, type LucideIcon } from "lucide-react";
import { CitizenShell, RED } from "@/sections/CitizenShell";
import { getShelters } from "@/lib/resq";
import { mockShelters, type Shelter } from "@/lib/mock";
import { cn } from "@/lib/cn";

const NUMBERS: { n: string; t: string; d: string; i: LucideIcon; c: string }[] = [
  { n: "112", t: "All emergencies", d: "Police · Fire · Ambulance", i: Siren, c: "bg-red-50 text-red-600" },
  { n: "101", t: "Fire & Rescue", d: "TN Fire and Rescue Services", i: Flame, c: "bg-orange-50 text-orange-600" },
  { n: "108", t: "Ambulance", d: "Emergency medical (also 102)", i: Ambulance, c: "bg-rose-50 text-rose-600" },
  { n: "100", t: "Police", d: "Greater Chennai Police", i: ShieldHalf, c: "bg-blue-50 text-blue-700" },
  { n: "1070", t: "Disaster helpline", d: "State Emergency Operations", i: LifeBuoy, c: "bg-sky-50 text-sky-600" },
  { n: "1913", t: "GCC helpline", d: "Greater Chennai Corporation", i: Building2, c: "bg-emerald-50 text-emerald-700" },
];

const PLACES: { name: string; area: string; kind: string; i: LucideIcon; phone: string }[] = [
  { name: "Rajiv Gandhi Govt General Hospital", area: "Park Town", kind: "Hospital · 24x7 trauma", i: HeartPulse, phone: "04425305000" },
  { name: "Stanley Medical College Hospital", area: "Royapuram", kind: "Hospital · burns unit", i: HeartPulse, phone: "04425281351" },
  { name: "Govt Kilpauk Medical College Hospital", area: "Kilpauk", kind: "Hospital · 24x7", i: HeartPulse, phone: "04428364951" },
  { name: "MIOT International", area: "Manapakkam", kind: "Hospital · trauma centre", i: HeartPulse, phone: "04442002288" },
  { name: "Tambaram Govt Hospital", area: "Tambaram", kind: "Hospital · 24x7", i: HeartPulse, phone: "04422265250" },
  { name: "Chennai Central (Puratchi Thalaivar Dr. M.G.R.)", area: "Park Town", kind: "Railway station · help desk", i: Train, phone: "139" },
];

export default function Services() {
  const [q, setQ] = useState("");
  const [shelters, setShelters] = useState<Shelter[]>(mockShelters);
  useEffect(() => { getShelters().then(setShelters); }, []);
  useEffect(() => {
    if (window.location.hash === "#shelters") setTimeout(() => document.getElementById("shelters")?.scrollIntoView({ behavior: "smooth" }), 200);
  }, []);
  const f = q.trim().toLowerCase();
  const sh = useMemo(() => shelters.filter((s) => !f || s.area.toLowerCase().includes(f) || s.name.toLowerCase().includes(f)), [shelters, f]);
  const pl = PLACES.filter((p) => !f || p.area.toLowerCase().includes(f) || p.name.toLowerCase().includes(f));

  return (
    <CitizenShell>
      <section className="border-b border-red-100 bg-gradient-to-br from-red-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <h1 className="font-display text-3xl font-bold md:text-4xl">Emergency Services</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">Helplines, relief shelters and hospitals across Chennai. Tap a number to call.</p>
          <div className="relative mt-5 max-w-xl">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by area, e.g. Velachery, Tambaram" aria-label="Search by area"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-4 pl-12 text-base shadow-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 md:px-6 md:py-10">
        <section>
          <h2 className="mb-3 font-display text-xl font-bold">Emergency numbers</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {NUMBERS.map((x) => (
              <a key={x.n} href={`tel:${x.n}`} className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                <span className={cn("grid size-10 place-items-center rounded-xl", x.c)}><x.i className="size-5" /></span>
                <p className="mt-3 font-display text-2xl font-bold" style={x.n === "112" ? { color: RED } : undefined}>{x.n}</p>
                <p className="text-sm font-semibold">{x.t}</p>
                <p className="text-xs text-slate-500">{x.d}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: RED }}><Phone className="size-3.5" />Tap to call</span>
              </a>
            ))}
          </div>
        </section>

        <section id="shelters" className="scroll-mt-20">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl font-bold">Nearby shelters</h2>
            <span className="text-xs text-slate-500">{sh.length} open · live occupancy</span>
          </div>
          {sh.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">No shelters match “{q}”.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {sh.map((s) => {
                const pct = Math.round((s.occupancy / Math.max(1, s.capacity)) * 100);
                const bar = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <div key={s.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Home className="size-5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-tight">{s.name}</p>
                        <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="size-3" />{s.area}</p>
                      </div>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", pct >= 90 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700")}>{pct >= 90 ? "Almost full" : "Open"}</span>
                    </div>
                    <div className="mt-3 flex justify-between text-xs text-slate-500"><span>{s.occupancy} / {s.capacity} people</span><span className="font-semibold">{pct}% full</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                    <div className="mt-3 flex flex-wrap gap-1.5">{s.facilities.slice(0, 4).map((x) => <span key={x} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{x}</span>)}</div>
                    <a href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=16/${s.lat}/${s.lng}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-800 dark:text-blue-300"><MapPin className="size-3.5" />Directions</a>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-bold">Hospitals &amp; stations</h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {pl.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Nothing matches “{q}”.</p>}
            {pl.map((p) => (
              <div key={p.name} className="flex items-center gap-3 p-4">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", p.i === Train ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-600")}><p.i className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.kind} · {p.area}</p>
                </div>
                <a href={`tel:${p.phone}`} className="grid size-10 place-items-center rounded-full border-2 border-blue-800 text-blue-900 dark:text-blue-200" aria-label={`Call ${p.name}`}><Phone className="size-4" /></a>
              </div>
            ))}
          </div>
        </section>
      </div>
    </CitizenShell>
  );
}
