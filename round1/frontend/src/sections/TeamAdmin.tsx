/** Official Round 2 "Team management": add / edit / delete teams and set availability (POST/PATCH/DELETE /api/teams). */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Modal, Select, useToast } from "@/ui";
import { cn } from "@/lib/cn";
import { AREAS, areaByName } from "@/lib/geo";
import { createTeam, deleteTeam, errText, patchTeam } from "@/lib/resq";
import type { Team, TeamStatus, TeamType } from "@/lib/mock";

export const TEAM_TYPE_LABEL: Record<TeamType, string> = {
  fire: "Fire", ambulance_als: "ALS (advanced ambulance)", ambulance_bls: "BLS (basic ambulance)", police: "Police", ndrf: "NDRF rescue", boat: "Rescue boat",
};
const TYPE_SHORT: Record<TeamType, string> = { fire: "Fire Engine", ambulance_als: "ALS Ambulance", ambulance_bls: "BLS Ambulance", police: "Police Patrol", ndrf: "NDRF Team", boat: "Rescue Boat" };
export const AVAIL_LABEL: Record<TeamStatus, string> = { available: "Available", busy: "Busy", offline: "Offline" };
const AVAIL_CLS: Record<TeamStatus, string> = {
  available: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900",
  busy: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900",
  offline: "bg-surface-2 text-muted ring-line",
};

export const crewSize = (t: Team) => t.crew ?? 4;

/** Availability select (Available / Busy / Offline) → PATCH /api/teams/{id}. Shows 409 messages as a toast. */
export function AvailabilitySelect({ team, onDone, className }: { team: Team; onDone: () => void; className?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function change(status: TeamStatus) {
    if (status === team.status) return;
    setBusy(true);
    try { await patchTeam(team.id, { status }); toast("success", `${team.name} → ${AVAIL_LABEL[status]}`); onDone(); }
    catch (e) { toast("error", "Could not change availability", errText(e)); }
    finally { setBusy(false); }
  }
  return (
    <select value={team.status} disabled={busy} onChange={(e) => change(e.target.value as TeamStatus)} onClick={(e) => e.stopPropagation()} aria-label={`Availability of ${team.name}`}
      className={cn("h-8 cursor-pointer rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset outline-none disabled:opacity-60", AVAIL_CLS[team.status], className)}>
      {(Object.keys(AVAIL_LABEL) as TeamStatus[]).map((s) => <option key={s} value={s}>{AVAIL_LABEL[s]}</option>)}
    </select>
  );
}

/** Add (team = null) or edit a team. */
export function TeamFormModal({ open, team, onClose, onSaved }: { open: boolean; team: Team | null; onClose: () => void; onSaved: (t: Team) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<TeamType>("fire");
  const [station, setStation] = useState(AREAS[0].name);
  const [crew, setCrew] = useState("4");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [busy, setBusy] = useState(false);
  const [touchedName, setTouchedName] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(team?.name ?? ""); setType(team?.type ?? "fire"); setStation(team?.station ?? AREAS[0].name);
    setCrew(String(team?.crew ?? 4)); setLat(team ? String(team.lat) : ""); setLng(team ? String(team.lng) : ""); setTouchedName(!!team);
  }, [open, team]);

  const suggested = `${TYPE_SHORT[type]} · ${station}`;
  const finalName = (touchedName ? name : name || suggested).trim();

  async function save() {
    if (!finalName) { toast("warning", "Team name is required"); return; }
    const c = Math.max(1, Math.min(50, parseInt(crew, 10) || 4));
    const la = parseFloat(lat), ln = parseFloat(lng);
    const coords = Number.isFinite(la) && Number.isFinite(ln) ? { lat: la, lng: ln } : {};
    setBusy(true);
    try {
      let out: Team;
      if (team) {
        const stationChanged = station !== team.station;
        const a = areaByName(station);
        const loc = Object.keys(coords).length && !stationChanged ? coords : stationChanged && a ? { lat: a.lat, lng: a.lng } : {};
        out = await patchTeam(team.id, { name: finalName, station, crew: c, ...loc });
        toast("success", `${out.name} updated`, `${out.station} · ${crewSize(out)} crew`);
      } else {
        out = await createTeam({ name: finalName, type, station, crew: c, ...coords });
        toast("success", `Team ${out.id} created`, `${out.name} · ${out.type_label} · ${out.station}`);
      }
      onSaved(out); onClose();
    } catch (e) { toast("error", team ? "Could not update team" : "Could not create team", errText(e)); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={team ? `Edit team ${team.id}` : "Add response team"}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Team name">
          <Input value={touchedName ? name : name || ""} placeholder={suggested} onChange={(e) => { setName(e.target.value); setTouchedName(true); }} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" hint={team ? "Category is fixed after creation" : undefined}>
            <Select value={type} disabled={!!team} onChange={(e) => setType(e.target.value as TeamType)}
              options={(Object.keys(TEAM_TYPE_LABEL) as TeamType[]).map((t) => ({ value: t, label: TEAM_TYPE_LABEL[t] }))} />
          </Field>
          <Field label="Station area">
            <Select value={station} onChange={(e) => { setStation(e.target.value); const a = areaByName(e.target.value); if (a) { setLat(String(a.lat)); setLng(String(a.lng)); } }}
              options={AREAS.map((a) => ({ value: a.name, label: a.name }))} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Crew"><Input type="number" min={1} max={50} value={crew} onChange={(e) => setCrew(e.target.value)} /></Field>
          <Field label="Latitude"><Input inputMode="decimal" placeholder="auto" value={lat} onChange={(e) => setLat(e.target.value)} /></Field>
          <Field label="Longitude"><Input inputMode="decimal" placeholder="auto" value={lng} onChange={(e) => setLng(e.target.value)} /></Field>
        </div>
        <p className="text-xs text-muted">Location defaults to the station area. The team starts as <b>Available</b> and is immediately considered for nearest-team assignment.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" icon={team ? Pencil : Plus} loading={busy}>{team ? "Save changes" : "Add team"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function DeleteTeamModal({ team, onClose, onDeleted }: { team: Team | null; onClose: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!team) return;
    setBusy(true);
    try { await deleteTeam(team.id); toast("success", `${team.name} deleted`); onDeleted(); onClose(); }
    catch (e) { toast("error", "Could not delete team", errText(e)); }
    finally { setBusy(false); }
  }
  return (
    <Modal open={!!team} onClose={onClose} title="Delete this team?">
      {team && (
        <div className="space-y-4">
          <p className="text-sm text-muted"><b className="text-fg">{team.name}</b> ({team.id}) will be removed from the roster.</p>
          {team.status === "busy" && <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">This team is on {team.current_incident ?? "an incident"} — busy teams cannot be deleted. Complete or reassign first.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="danger" icon={Trash2} loading={busy} onClick={run}>Delete team</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Official team management table: Name/ID, Category, Current location, Availability, Assigned incident, actions. */
export function TeamAdminTable({ teams, eta, onOpen, onEdit, onDelete, onChanged }: {
  teams: Team[]; eta: Map<string, number>; onOpen: (id: string) => void; onEdit: (t: Team) => void; onDelete: (t: Team) => void; onChanged: () => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Team name / ID</th><th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Current location</th><th className="px-4 py-3 font-medium">Availability</th>
            <th className="px-4 py-3 font-medium">Assigned incident</th><th className="px-3 py-3 text-right font-medium">Manage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {teams.map((t) => (
            <tr key={t.id} onClick={() => onOpen(t.id)} className="cursor-pointer bg-surface hover:bg-surface-2/60">
              <td className="px-4 py-2.5"><p className="font-medium">{t.name}</p><p className="font-mono text-xs text-muted">{t.id} · {crewSize(t)} crew</p></td>
              <td className="whitespace-nowrap px-4 py-2.5">{t.type_label}</td>
              <td className="px-4 py-2.5"><p className="whitespace-nowrap">{t.station}</p><p className="font-mono text-[11px] text-muted">{t.lat.toFixed(4)}, {t.lng.toFixed(4)}</p></td>
              <td className="px-4 py-2.5"><AvailabilitySelect team={t} onDone={onChanged} /></td>
              <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                {t.current_incident
                  ? <Link to={`/admin/incidents/${t.current_incident}`} className="font-mono text-xs font-semibold text-red-600 hover:underline dark:text-red-400">{t.current_incident}{eta.has(t.id) ? <span className="ml-1 font-sans font-normal text-muted">· ETA {Math.round(eta.get(t.id)!)} min</span> : null}</Link>
                  : <span className="text-xs text-muted">—</span>}
              </td>
              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <button onClick={() => onEdit(t)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label={`Edit ${t.name}`}><Pencil className="size-4" /></button>
                  <button onClick={() => onDelete(t)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" aria-label={`Delete ${t.name}`}><Trash2 className="size-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
