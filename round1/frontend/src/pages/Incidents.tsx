import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Filter, Inbox, Plus, RefreshCw, Search, Trash2, Users } from "lucide-react";
import { Button, Card, EmptyState, Input, Modal, Select, Skeleton, useToast } from "@/ui";
import { PageIntro } from "@/sections/AppShell";
import { CATEGORIES, CATEGORY_META, CategoryIcon, SeverityBadge, STATUS_TONE } from "@/sections/IncidentUI";
import { deleteIncident, getIncidents, timeAgo, updateStatus } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { cn } from "@/lib/cn";
import { SEVERITIES, STATUSES, type Incident, type Status } from "@/lib/mock";

const statusSelect: Record<string, string> = {
  gray: "bg-surface-2 text-fg", amber: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  blue: "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200", green: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

export default function Incidents() {
  const toast = useToast();
  const nav = useNavigate();
  const [list, reload] = usePoll<Incident[]>(() => getIncidents());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sev, setSev] = useState("");
  const [cat, setCat] = useState("");
  const [del, setDel] = useState<Incident | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Status>>({});

  const rows = useMemo(() => (list ?? []).filter((i) =>
    (!status || (status === "open" ? i.status !== "Resolved" : i.status === status)) && (!sev || i.severity === sev) && (!cat || i.category === cat) &&
    (!q || `${i.id} ${i.title} ${i.area} ${i.description} ${i.landmark}`.toLowerCase().includes(q.toLowerCase()))), [list, q, status, sev, cat]);

  async function changeStatus(i: Incident, s: Status) {
    setOverrides((o) => ({ ...o, [i.id]: s }));
    try { await updateStatus(i.id, s, `Status set to ${s} from queue`); toast("success", `${i.id} → ${s}`); await reload(); }
    catch (e) { toast("error", "Could not update status", "Server not reachable. " + String(e).slice(0, 60)); }
    finally { setOverrides((o) => { const n = { ...o }; delete n[i.id]; return n; }); }
  }

  async function confirmDelete() {
    if (!del) return;
    setBusy(true);
    try { await deleteIncident(del.id); toast("success", `${del.id} deleted`); setDel(null); await reload(); }
    catch (e) { toast("error", "Could not delete", "Server not reachable. " + String(e).slice(0, 60)); }
    finally { setBusy(false); }
  }

  const filtered = q || status || sev || cat;
  return (
    <>
      <PageIntro title="All incidents" text="Ranked by priority: open first, then Critical → Low, then score, then oldest."
        actions={<>
          <Button variant="outline" icon={RefreshCw} onClick={reload}>Refresh</Button>
          <Link to="/admin/report"><Button icon={Plus}>New report</Button></Link>
        </>} />

      <Card className="mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px_200px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input className="pl-9" placeholder="Search ID, title, area…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "", label: "All statuses" }, { value: "open", label: "Open (not resolved)" }, ...STATUSES.map((s) => ({ value: s, label: s }))]} />
          <Select value={sev} onChange={(e) => setSev(e.target.value)} options={[{ value: "", label: "All severities" }, ...SEVERITIES.map((s) => ({ value: s, label: s }))]} />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: "", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label }))]} />
          <div className="flex items-center justify-end gap-2 px-1 text-sm text-muted">
            <Filter className="size-4" />{rows.length} of {list?.length ?? 0}
            {filtered && <button className="text-brand-600 hover:underline dark:text-brand-300" onClick={() => { setQ(""); setStatus(""); setSev(""); setCat(""); }}>Clear</button>}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {!list ? <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
          : rows.length === 0 ? <div className="p-6"><EmptyState icon={Inbox} title="No incidents match" text="Try clearing the filters." /></div>
          : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Incident</th>
                  <th className="px-4 py-3 font-medium">Area</th>
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 text-right font-medium">People</th>
                  <th className="px-4 py-3 font-medium">Reported</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((i) => {
                  const crit = i.severity === "Critical" && i.status !== "Resolved";
                  const st = overrides[i.id] ?? i.status;
                  return (
                    <tr key={i.id} onClick={() => nav(`/admin/incidents/${i.id}`)}
                      className={cn("cursor-pointer transition-colors", crit ? "row-critical bg-red-50/70 hover:bg-red-100/70 dark:bg-red-950/30 dark:hover:bg-red-950/50" : "bg-surface hover:bg-surface-2/60", i.status === "Resolved" && "opacity-70")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <CategoryIcon category={i.category} />
                          <div className="min-w-0">
                            <p className="max-w-[300px] truncate font-medium">{i.title}</p>
                            <p className="font-mono text-xs text-muted">{i.id} · {CATEGORY_META[i.category]?.short}{i.duplicate_of ? ` · dup of ${i.duplicate_of}` : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{i.area}</td>
                      <td className="px-4 py-3"><SeverityBadge severity={i.severity} score={i.score} /></td>
                      <td className="px-4 py-3 text-right tabular-nums"><span className="inline-flex items-center gap-1"><Users className="size-3.5 text-muted" />{i.people_affected}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{timeAgo(i.created_at)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select value={st} onChange={(e) => changeStatus(i, e.target.value as Status)} aria-label="Change status"
                          className={cn("h-8 cursor-pointer rounded-lg border border-line px-2 text-xs font-medium", statusSelect[STATUS_TONE[st]])}>
                          {STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setDel(i)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" aria-label={`Delete ${i.id}`}><Trash2 className="size-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <DeleteModal inc={del} busy={busy} onClose={() => setDel(null)} onConfirm={confirmDelete} />
    </>
  );
}

export function DeleteModal({ inc, busy, onClose, onConfirm }: { inc: Incident | null; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={!!inc} onClose={onClose} title="Delete this report?">
      {inc && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Use this only for test or duplicate reports. <b className="text-fg">{inc.id}</b> “{inc.title}” will be removed permanently.</p>
          <p className="text-xs text-muted">Tip: for a real duplicate, prefer “Mark as duplicate” on the detail page — it keeps the audit trail.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="danger" icon={Trash2} loading={busy} onClick={onConfirm}>Delete</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
