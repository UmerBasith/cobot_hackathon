/**
 * Role-based demo login.
 *   "/"           citizen  — no login (anyone must be able to report an emergency instantly)
 *   "/admin"      control room — Admin ID + PIN
 *   "/responder"  field team   — team + PIN
 *
 * DEMO ONLY: sessions live in this browser (localStorage) and the PINs are in the code.
 * Production: server-side login (OIDC/Keycloak + MFA) and role checks on every API call.
 */
export type Role = "admin" | "responder";

export interface Session { role: Role; name: string; team?: string; at: number }

/** Demo credentials shown on the login pages. */
export const DEMO = {
  admin: { id: "admin", pin: "1111" },
  responder: { pin: "2222" },
} as const;

const key = (r: Role) => `resq-session-${r}`;

export function getSession(role: Role): Session | null {
  try {
    const raw = localStorage.getItem(key(role));
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    // sessions expire after 12 hours (one shift)
    return s.role === role && Date.now() - s.at < 12 * 3600_000 ? s : null;
  } catch { return null; }
}

export function login(role: Role, creds: { id?: string; pin: string; team?: string; teamName?: string }): Session | null {
  const ok = role === "admin"
    ? creds.id?.trim().toLowerCase() === DEMO.admin.id && creds.pin === DEMO.admin.pin
    : !!creds.team && creds.pin === DEMO.responder.pin;
  if (!ok) return null;
  const s: Session = { role, name: role === "admin" ? "Control Room Admin" : creds.teamName ?? "Responder", team: creds.team, at: Date.now() };
  try {
    localStorage.setItem(key(role), JSON.stringify(s));
    if (role === "responder" && creds.team) localStorage.setItem("resq-team", creds.team); // the responder page reads this
  } catch { /* private mode: session lasts until reload */ }
  return s;
}

export function logout(role: Role) {
  try { localStorage.removeItem(key(role)); if (role === "responder") localStorage.removeItem("resq-team"); } catch { /* ignore */ }
}
