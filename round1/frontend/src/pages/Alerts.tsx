import { useState } from "react";
import { BellRing, Clock, Megaphone, MapPin, Send } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Select, Skeleton, Textarea, useToast } from "@/ui";
import { PageIntro } from "@/sections/AppShell";
import { AREAS } from "@/lib/geo";
import { createAlert, errText, getActiveAlerts, timeAgo } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Alert, AlertLevel } from "@/lib/mock";

export const ALERT_STYLE: Record<AlertLevel, string> = {
  danger: "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-100",
  warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100",
  info: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-100",
};
const TONE = { danger: "red", warning: "amber", info: "blue" } as const;
const TEMPLATES = [
  "Heavy flooding reported. Move to upper floors and avoid low-lying roads.",
  "Gas leak in the area. Do not use flames or switches; keep windows open.",
  "Road closed due to accident. Use alternate routes.",
];

export default function Alerts() {
  const toast = useToast();
  const [list, reload] = usePoll<Alert[]>(() => getActiveAlerts());
  const [area, setArea] = useState("All Chennai");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<AlertLevel>("warning");
  const [hours, setHours] = useState(6);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (message.trim().length < 5) { toast("warning", "Write the alert message", "At least 5 characters."); return; }
    setBusy(true);
    try { const a = await createAlert({ area, message: message.trim(), level, hours }); toast("success", `Alert ${a.id} is live`, `${a.area} · ${hours} h`); setMessage(""); await reload(); }
    catch (e) { toast("error", "Could not publish alert", errText(e)); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageIntro title="Public alerts" text="Warn citizens in an area. Active alerts show on top of the citizen report page." />
      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="New alert" subtitle="Published instantly" icon={Megaphone} />
          <CardBody className="space-y-4">
            <Field label="Area">
              <Select value={area} onChange={(e) => setArea(e.target.value)} options={[{ value: "All Chennai", label: "All Chennai" }, ...AREAS.map((a) => ({ value: a.name, label: a.name }))]} />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium">Level</p>
              <div className="grid grid-cols-3 gap-2">
                {(["info", "warning", "danger"] as AlertLevel[]).map((l) => (
                  <button key={l} type="button" onClick={() => setLevel(l)} className={cn("h-10 rounded-xl text-sm font-medium capitalize ring-1 transition",
                    level === l ? (l === "danger" ? "bg-red-600 text-white ring-red-600" : l === "warning" ? "bg-amber-500 text-white ring-amber-500" : "bg-sky-600 text-white ring-sky-600") : "bg-surface-2 ring-line")}>{l}</button>
                ))}
              </div>
            </div>
            <Field label="Message" hint={`${message.length}/300`}>
              <Textarea value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} placeholder="What should people do?" />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => <button key={t} onClick={() => setMessage(t)} className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted ring-1 ring-line hover:text-fg">{t.split(".")[0]}</button>)}
            </div>
            <Field label="Valid for">
              <Select value={String(hours)} onChange={(e) => setHours(Number(e.target.value))} options={[1, 3, 6, 12, 24].map((h) => ({ value: String(h), label: `${h} hour${h > 1 ? "s" : ""}` }))} />
            </Field>
            <div className={cn("rounded-xl border p-3 text-sm", ALERT_STYLE[level])}>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider opacity-80"><BellRing className="size-3.5" />Preview · {area}</p>
              <p className="mt-1">{message || "Your message appears here."}</p>
            </div>
            <Button size="lg" className="w-full" icon={Send} loading={busy} onClick={send}>Publish alert</Button>
          </CardBody>
        </Card>
        <Card className="min-w-0 xl:col-span-3">
          <CardHeader title="Active alerts" subtitle="Auto-expire after their time window" icon={BellRing} action={list ? <Badge tone="brand">{list.length}</Badge> : undefined} />
          <CardBody className="space-y-3">
            {!list ? <Skeleton className="h-40" /> : list.length === 0 ? <EmptyState icon={BellRing} title="No active alerts" text="Publish one when an area needs a warning." /> :
              list.map((a) => (
                <div key={a.id} className={cn("rounded-xl border p-4", ALERT_STYLE[a.level])}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[a.level]} dot pulse={a.level === "danger"}>{a.level}</Badge>
                    <span className="flex items-center gap-1 text-sm font-semibold"><MapPin className="size-3.5" />{a.area}</span>
                    <span className="ml-auto font-mono text-xs opacity-70">{a.id}</span>
                  </div>
                  <p className="mt-2 text-sm">{a.message}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs opacity-70"><Clock className="size-3" />Sent {timeAgo(a.created_at)} · until {fmtTime(a.expires_at)}</p>
                </div>
              ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/** Citizen-facing banner (used on /report). */
export function AlertBanner({ area }: { area?: string }) {
  const [list] = usePoll<Alert[]>(() => getActiveAlerts(area ?? ""), 15000, [area]);
  if (!list?.length) return null;
  return (
    <div className="mb-4 space-y-2">
      {list.slice(0, 3).map((a) => (
        <div key={a.id} className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm", ALERT_STYLE[a.level])}>
          <BellRing className="mt-0.5 size-4 shrink-0" />
          <p><b>{a.area} alert:</b> {a.message}</p>
        </div>
      ))}
    </div>
  );
}
