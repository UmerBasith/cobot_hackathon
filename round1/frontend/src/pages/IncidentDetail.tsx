import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Baby, Clock, Copy, FileText, Flag, History, MapPin, Phone, ShieldAlert, Trash2, User, Users, Activity,
} from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Select, Skeleton, Timeline, useToast } from "@/ui";
import { CATEGORY_META, CategoryIcon, ReasonsList, SEV_HEX, SeverityBadge, StatusBadge } from "@/sections/IncidentUI";
import { ScoreRing } from "@/sections/ReportFlow";
import { LazyMap } from "@/sections/LazyMap";
import { DeleteModal } from "./Incidents";
import { deleteIncident, getIncident, getIncidents, markDuplicate, timeAgo, updateStatus } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { fmtDate, fmtTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { STATUSES, type Incident, type Status } from "@/lib/mock";

const ACTION: Record<Status, string> = { Reported: "Mark reported", Pending: "Verify → Pending", "In Progress": "Dispatch → In Progress", Resolved: "Resolve" };

export default function IncidentDetail() {
  const { id = "" } = useParams();
  const toast = useToast();
  const nav = useNavigate();
  const [inc, reload] = usePoll<Incident | null>(() => getIncident(id), 5000, [id]);
  const [all] = usePoll<Incident[]>(() => getIncidents(), 15000);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dup, setDup] = useState("");
  const [del, setDel] = useState(false);

  if (inc === null && all) {
    return <EmptyState icon={FileText} title={`Incident ${id} not found`} text="It may have been deleted." action={<Link to="/app/incidents"><Button variant="outline" icon={ArrowLeft}>Back to incidents</Button></Link>} />;
  }
  if (!inc) return <div className="space-y-4"><Skeleton className="h-20" /><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-96 lg:col-span-2" /><Skeleton className="h-96" /></div></div>;

  const idx = STATUSES.indexOf(inc.status);
  const crit = inc.severity === "Critical" && inc.status !== "Resolved";

  async function setStatus(s: Status) {
    setBusy(s);
    try { await updateStatus(inc!.id, s, note.trim() || undefined); setNote(""); toast("success", `${inc!.id} → ${s}`, note || undefined); await reload(); }
    catch (e) { toast("error", "Could not update status", "Server not reachable. " + String(e).slice(0, 60)); }
    finally { setBusy(null); }
  }
  async function doDup() {
    if (!dup) return;
    setBusy("dup");
    try { await markDuplicate(inc!.id, dup); toast("success", `Marked as duplicate of ${dup}`, "Status set to Resolved"); setDup(""); await reload(); }
    catch (e) { toast("error", "Could not mark duplicate", String(e).slice(0, 80)); }
    finally { setBusy(null); }
  }
  async function doDelete() {
    setBusy("del");
    try { await deleteIncident(inc!.id); toast("success", `${inc!.id} deleted`); nav("/app/incidents"); }
    catch (e) { toast("error", "Could not delete", "Server not reachable. " + String(e).slice(0, 60)); setBusy(null); }
  }

  const fields: { icon: typeof User; label: string; value: React.ReactNode }[] = [
    { icon: MapPin, label: "Location", value: <>{inc.area}{inc.landmark ? <span className="text-muted"> · {inc.landmark}</span> : null}</> },
    { icon: Users, label: "People affected", value: inc.people_affected },
    { icon: Activity, label: "Injuries", value: <span className="capitalize">{inc.injuries}{inc.injured_count ? ` · ${inc.injured_count} injured` : ""}</span> },
    { icon: ShieldAlert, label: "Life threat (trapped / not breathing)", value: inc.life_threat ? <Badge tone="red">Yes</Badge> : "No" },
    { icon: Flag, label: "Hazard", value: <span className="capitalize">{inc.hazard}{inc.active ? " · still active" : " · over"}</span> },
    { icon: Baby, label: "Vulnerable people", value: inc.vulnerable.length ? <span className="capitalize">{inc.vulnerable.join(", ")}</span> : "None reported" },
    { icon: User, label: "Contact name", value: inc.contact_name || <span className="text-muted">Not given</span> },
    { icon: Phone, label: "Contact phone", value: inc.contact_phone ? <a className="text-brand-600 hover:underline dark:text-brand-300" href={`tel:${inc.contact_phone}`}>{inc.contact_phone}</a> : <span className="text-muted">Not given</span> },
  ];

  const others = (all ?? []).filter((x) => x.id !== inc.id);

  return (
    <>
      <Link to="/app/incidents" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" />All incidents</Link>
      <Card className={cn("mb-4 p-5", crit && "row-critical border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20")}>
        <div className="flex flex-wrap items-start gap-4">
          <CategoryIcon category={inc.category} className="size-12 [&_svg]:size-6" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-fg" onClick={() => { navigator.clipboard?.writeText(inc.id); toast("info", "Copied", inc.id); }}>{inc.id}<Copy className="size-3" /></button>
              <span className="text-xs text-muted">· {CATEGORY_META[inc.category]?.label}</span>
              {inc.flags.includes("needs_verification") && <Badge tone="amber">Needs verification</Badge>}
              {inc.duplicate_of && <Badge tone="gray">Duplicate of {inc.duplicate_of}</Badge>}
            </div>
            <h2 className="mt-1 text-2xl font-semibold">{inc.title}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Clock className="size-3.5" />Reported {timeAgo(inc.created_at)} · {fmtDate(inc.created_at)} {fmtTime(inc.created_at)}</p>
          </div>
          <div className="flex items-center gap-2"><SeverityBadge severity={inc.severity} score={inc.score} size="lg" /><StatusBadge status={inc.status} /></div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Why this severity" subtitle="Transparent rules — every point is explained" icon={ShieldAlert} action={<Badge tone="gray">rules engine</Badge>} />
            <CardBody className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <div className="text-center"><ScoreRing score={inc.score} color={SEV_HEX[inc.severity]} size={130} /><p className="mt-1 text-xs text-muted">score / 100</p></div>
              <div className="w-full flex-1"><ReasonsList reasons={inc.reasons} /></div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Report" subtitle="As submitted" icon={FileText} />
            <CardBody>
              <p className="rounded-xl bg-surface-2 p-4 text-sm leading-relaxed">{inc.description}</p>
              <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {fields.map((f) => (
                  <div key={f.label} className="flex items-start gap-3">
                    <f.icon className="mt-0.5 size-4 shrink-0 text-muted" />
                    <div className="min-w-0"><dt className="text-xs text-muted">{f.label}</dt><dd className="text-sm font-medium">{f.value}</dd></div>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Timeline" subtitle="Every update, timestamped" icon={History} />
            <CardBody>
              <Timeline items={[...inc.timeline].reverse().map((t) => ({
                title: t.status, time: `${fmtTime(t.at)}`,
                text: <>{t.note}<span className="ml-1 text-xs">· {t.actor}</span></>,
                tone: t.status === "Resolved" ? "green" : t.status === "In Progress" ? "brand" : t.status === "Pending" ? "amber" : "red",
              }))} />
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Manage status" subtitle="Add a note, then move it forward" icon={Activity} />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-4 gap-1.5">
                {STATUSES.map((s, k) => (
                  <div key={s}>
                    <div className={cn("h-1.5 rounded-full", k < idx || inc.status === "Resolved" ? "bg-emerald-500" : k === idx ? "bg-brand-500" : "bg-line")} />
                    <p className={cn("mt-1.5 truncate text-[11px]", k === idx ? "font-semibold text-fg" : "text-muted")}>{s}</p>
                  </div>
                ))}
              </div>
              <Input placeholder="Note (optional) e.g. Fire tender 2 dispatched" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="grid gap-2">
                {STATUSES.filter((s) => s !== "Reported").map((s) => {
                  const done = STATUSES.indexOf(s) <= idx;
                  const nextOne = STATUSES.indexOf(s) === idx + 1;
                  return (
                    <Button key={s} variant={nextOne ? "primary" : "outline"} disabled={inc.status === s} loading={busy === s}
                      className={cn(s === "Resolved" && nextOne && "bg-emerald-600 hover:bg-emerald-500 shadow-none")} onClick={() => setStatus(s)}>
                      {done && inc.status !== s ? `Back to ${s}` : inc.status === s ? `${s} (current)` : ACTION[s]}
                    </Button>
                  );
                })}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Location" subtitle={`${inc.area}${inc.lat != null ? ` · ${inc.lat.toFixed(4)}, ${inc.lng?.toFixed(4)}` : ""}`} icon={MapPin} />
            <CardBody>
              {inc.lat != null && inc.lng != null
                ? <LazyMap height={240} points={[{ id: inc.id, lat: inc.lat, lng: inc.lng, severity: inc.severity, title: inc.title, resolved: inc.status === "Resolved" }]} />
                : <EmptyState icon={MapPin} title="No map pin" text={`Area: ${inc.area}`} />}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Duplicate or test?" subtitle="Keep the queue clean" icon={Copy} />
            <CardBody className="space-y-3">
              <div className="flex gap-2">
                <Select value={dup} onChange={(e) => setDup(e.target.value)} className="min-w-0 flex-1"
                  options={[{ value: "", label: "Duplicate of…" }, ...others.map((o) => ({ value: o.id, label: `${o.id} · ${o.title.slice(0, 32)}` }))]} />
                <Button variant="outline" disabled={!dup} loading={busy === "dup"} onClick={doDup}>Mark</Button>
              </div>
              <Button variant="ghost" icon={Trash2} className="w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => setDel(true)}>Delete report</Button>
            </CardBody>
          </Card>
        </div>
      </div>
      <DeleteModal inc={del ? inc : null} busy={busy === "del"} onClose={() => setDel(false)} onConfirm={doDelete} />
    </>
  );
}
