/**
 * ONE place for all product text (ResQNet).
 * Icons are names from lucide-react (https://lucide.dev/icons).
 */
import {
  Smartphone, Gauge, ListOrdered, MapPinned, ClipboardCheck, PhoneCall,
  Send, Scale, Siren, Wrench, CheckCircle2, type LucideIcon,
} from "lucide-react";

export const team = {
  name: "Ctrl.Alt.Elite",
  members: ["Umer Basith", "Muizzur Rahman"],
  event: "Cobot-Ex Hackathon 2026",
};

export const product = {
  name: "ResQNet",
  tagline: "From report to rescue — every second counts.",
  headline: { before: "Report it in seconds.", highlight: "Rescue it in minutes.", after: "" },
  subheadline:
    "Citizens report an emergency with a few taps. A transparent rules engine sets the severity and explains why. The control room sees a live, ranked queue and map — and tracks every incident to resolution.",
  primaryCta: "Report an emergency",
  secondaryCta: "Open control room",
};

/** Honest numbers: these describe the product as built today (not field results). */
export const stats: { value: number; suffix?: string; prefix?: string; label: string }[] = [
  { value: 8, label: "Emergency categories" },
  { value: 4, label: "Severity levels, rule-based" },
  { value: 30, prefix: "< ", suffix: " s", label: "To file a report" },
  { value: 5, suffix: " s", label: "Control-room refresh" },
];

export const features: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Smartphone, title: "Picture-first reporting", text: "Big category tiles, yes/no questions and a map tap. No login, works on any phone." },
  { icon: Gauge, title: "Explainable severity", text: "Score 0–100 with every reason shown, e.g. “People trapped +35”. No black box." },
  { icon: ListOrdered, title: "Ranked live queue", text: "Critical first, then score, then oldest. Critical incidents pulse red at the top." },
  { icon: MapPinned, title: "Live incident map", text: "Every report on a Chennai map, coloured by severity. Click a dot to act." },
  { icon: ClipboardCheck, title: "Track to resolution", text: "Reported → Pending → Assigned → In Progress → Resolved, with notes and a full timeline." },
  { icon: PhoneCall, title: "Supports 112, never replaces it", text: "A red “Call 112” button is always one tap away on every screen." },
];

export const steps: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Send, title: "Report", text: "Tap a category, answer 3 questions, drop a pin." },
  { icon: Scale, title: "Classify", text: "Rules score severity and list the reasons." },
  { icon: Siren, title: "Prioritise", text: "Critical jumps to the top of the live queue." },
  { icon: Wrench, title: "Manage", text: "Control room updates status with notes." },
  { icon: CheckCircle2, title: "Resolve", text: "Closed, timestamped, fully auditable." },
];

export const nav = [
  { label: "Problem", href: "/#problem" },
  { label: "How it works", href: "/#how" },
  { label: "Live demo", href: "/#demo" },
  { label: "Features", href: "/#features" },
];
