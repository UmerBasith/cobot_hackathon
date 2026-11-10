/** /responder — field team app (mobile-first, no sidebar). */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, LayoutDashboard, MapPin, Navigation, RefreshCw, Siren, Timer, Users, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, Select, Skeleton, Textarea, useToast } from "@/ui";
import { Logo } from "@/sections/Logo";
import { ThemeToggle } from "@/sections/ThemeToggle";
import { CATEGORY_META, CategoryIcon, ReasonsList, SeverityBadge } from "@/sections/IncidentUI";
import { ASG_META, TeamIcon } from "@/sections/Dispatch";
import { LazyMap } from "@/sections/LazyMap";
import { assignmentStatus, errText, getResponderJobs, getTeams, respondAssignment, timeAgo } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ResponderJob, Team } from "@/lib/mock";

const REASONS = ["No equipment", "Too far", "Already busy", "Other"];
const KEY = "resq-team";

export default function Responder() {
  const [params, setParams] = useSearchParams();
  const [teams] = usePoll<Team[]>(getTeams, 15000);
  const stored = (() => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } })();
  const team = params.get("team") ?? stored;
  const [jobs, reload, at] = usePoll<ResponderJob[]>(() => (team ? getResponderJobs(team) : Promise.resolve([])), 5000, [team]);

  function pick(id: string) {
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
    const p = new URLSearchParams(params); if (id) p.set("team", id); else p.delete("team"); setParams(p, { replace: true });
  }
  const me = teams?.find((t) => t.id === team);

  return (
    <div className="min-h-screen bg-bg">
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2"><Logo /><Badge tone="blue" className="hidden sm:inline-flex">Responder</Badge></div>
          <div className="flex items-center gap-2">
            <Link to="/app" className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:text-fg sm:inline-flex"><LayoutDashboard className="size-4" />Control room</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-5 pb-12">
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Your team</p>
          <div className="flex gap-2">
            <Select className="min-w-0 flex-1" value={team} onChange={(e) => pick(e.target.value)}
              options={[{ value: "", label: teams ? "Select your team…" : "Loading teams…" }, ...(teams ?? []).map((t) => ({ value: t.id, label: `${t.name} (${t.status})` }))]} />
            <Button variant="outline" icon={RefreshCw} onClick={reload} aria-label="Refresh" />
          </div>
          {me && (
            <div className="mt-3 flex items-center gap-3">
              <TeamIcon type={me.type} />
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{me.type_label} · {me.station}</p><p className="text-xs text-muted">{at ? `Live · checked ${fmtTime(at)} · every 5 s` : "Connecting…"}</p></div>
              <Badge tone={me.status === "available" ? "green" : me.status === "busy" ? "brand" : "gray"} dot pulse={me.status === "busy"}>{me.status}</Badge>
            </div>
          )}
        </Card>

        {!team ? <EmptyState icon={Users} title="Pick your team" text="Jobs assigned by the control room appear here instantly." />
          : !jobs ? <Skeleton className="h-80 rounded-2xl" />
          : jobs.length === 0 ? <EmptyState icon={CheckCircle2} title="No active jobs" text="Standing by. New dispatches appear here within 5 seconds." />
          : jobs.map((j) => <JobCard key={j.assignment.id} job={j} onChange={reload} />)}
      </main>
    </div>
  );
}

function JobCard({ job, onChange }: { job: ResponderJob; onChange: () => void }) {
  const toast = useToast();
  const { assignment: a, incident: i } = job;
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setRejecting(false); setReason(""); }, [a.status]);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try { await fn(); toast("success", ok, `${i.id} · ${a.team_name}`); onChange(); }
    catch (e) { toast("error", "Action failed", errText(e)); }
    finally { setBusy(null); }
  }
  const crit = i.severity === "Critical";
  const nav = i.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${i.lat},${i.lng}` : null;

  return (
    <Card className={cn("overflow-hidden", crit && "border-red-300 dark:border-red-900")}>
      <div className={cn("flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium", crit ? "bg-red-600 text-white" : "bg-surface-2")}>
        <span className="flex items-center gap-2"><Siren className="size-4" />{a.status === "assigned" ? "New dispatch" : "Active job"} · {a.id}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs", crit ? "bg-white/20" : "bg-surface")}>{ASG_META[a.status].label}</span>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <CategoryIcon category={i.category} className="size-11" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold leading-tight">{i.title}</p>
            <p className="mt-0.5 text-xs text-muted">{i.id} · {CATEGORY_META[i.category]?.label} · reported {timeAgo(i.created_at)}</p>
          </div>
          <SeverityBadge severity={i.severity} score={i.score} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat icon={Timer} label="ETA" value={`${Math.round(a.eta_min)} min`} />
          <Stat icon={Navigation} label="Distance" value={`${a.distance_km} km`} />
          <Stat icon={Users} label="People" value={String(i.people_affected)} />
        </div>
        <p className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" /><span><b>{i.area}</b>{i.landmark ? ` · ${i.landmark}` : ""}</span></p>
        {i.lat != null && i.lng != null && <LazyMap height={180} points={[{ id: i.id, lat: i.lat, lng: i.lng, severity: i.severity, title: i.title }]} />}
        <p className="rounded-xl bg-surface-2 p-3 text-sm">{i.description}</p>
        <div><p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">Why {i.severity}</p><ReasonsList reasons={i.reasons.slice(0, 4)} compact /></div>

        {/* actions */}
        {a.status === "assigned" && !rejecting && (
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="outline" icon={X} onClick={() => setRejecting(true)}>Reject</Button>
            <Button size="lg" icon={CheckCircle2} className="bg-emerald-600 shadow-none hover:bg-emerald-500" loading={busy === "acc"}
              onClick={() => run("acc", () => respondAssignment(a.id, true), "Job accepted")}>Accept</Button>
          </div>
        )}
        {a.status === "assigned" && rejecting && (
          <div className="space-y-3 rounded-xl border border-line p-3">
            <p className="text-sm font-medium">Why are you rejecting?</p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)} className={cn("rounded-full px-3.5 py-1.5 text-sm ring-1 transition", reason === r ? "bg-red-600 text-white ring-red-600" : "bg-surface ring-line")}>{r}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setRejecting(false)}>Cancel</Button>
              <Button variant="danger" disabled={!reason} loading={busy === "rej"} onClick={() => run("rej", () => respondAssignment(a.id, false, reason), "Job rejected — control room notified")}>Confirm reject</Button>
            </div>
          </div>
        )}
        {a.status === "accepted" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {nav && <a href={nav} target="_blank" rel="noreferrer"><Button size="lg" variant="outline" icon={Navigation} className="w-full">Navigate</Button></a>}
            <Button size="lg" icon={Navigation} loading={busy === "er"} className={cn(!nav && "sm:col-span-2")} onClick={() => run("er", () => assignmentStatus(a.id, "en_route"), "Marked en route")}>Start — en route</Button>
          </div>
        )}
        {a.status === "en_route" && (
          <Button size="lg" icon={MapPin} className="w-full" loading={busy === "os"} onClick={() => run("os", () => assignmentStatus(a.id, "on_scene"), "Arrived on scene")}>Arrived — on scene</Button>
        )}
        {a.status === "on_scene" && (
          <div className="space-y-2">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Completion note (required) e.g. 2 people rescued, shifted to GH" className="min-h-20" />
            <Button size="lg" icon={CheckCircle2} className="w-full bg-emerald-600 shadow-none hover:bg-emerald-500" disabled={note.trim().length < 3} loading={busy === "done"}
              onClick={() => run("done", () => assignmentStatus(a.id, "completed", note.trim()), "Job completed")}>Complete job</Button>
          </div>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted"><Clock className="size-3.5" />Assigned {fmtTime(a.assigned_at)} · updated {fmtTime(a.updated_at)}</p>
      </div>
    </Card>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-2.5">
      <p className="flex items-center justify-center gap-1 text-[11px] text-muted"><Icon className="size-3" />{label}</p>
      <p className="font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
