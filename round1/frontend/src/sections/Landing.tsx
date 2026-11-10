/**
 * ResQNet landing = the pitch. Text from src/config.ts.
 * Order: Navbar, Hero, Problem, HowItWorks, LiveDemo, Categories, Features, Impact, CTA, Footer.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Radar, Clock, EyeOff, LayoutDashboard, Menu, MessageSquareWarning, Siren, Sparkles, Users, X } from "lucide-react";
import { features, nav, product, stats, steps, team } from "@/config";
import { Badge, Button, Card, CountUp, Reveal, SectionHeading, Slider, Stagger, StaggerItem, Switch, Tabs, WordsReveal } from "@/ui";
import { cn } from "@/lib/cn";
import { STATIC } from "@/lib/static";
import { previewSeverity } from "@/lib/resq";
import { localSeverity, mockIncidents, type Category, type Hazard, type Injuries, type ReportIn, type SeverityOut } from "@/lib/mock";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { CATEGORIES, CATEGORY_META, Call112, CategoryIcon, ReasonsList, SeverityBadge, SEV_HEX } from "./IncidentUI";
import { ScoreRing } from "./ReportFlow";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={cn("fixed inset-x-0 top-0 z-40 transition-all duration-300", scrolled ? "glass border-b border-line" : "bg-transparent")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          {nav.map((n) => <a key={n.href} href={n.href} className="transition hover:text-fg">{n.label}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/track" className="hidden sm:block"><Button size="sm" variant="ghost" icon={Radar}>Track report</Button></Link>
          <Link to="/admin" className="hidden lg:block"><Button size="sm" variant="outline" icon={LayoutDashboard}>Control room</Button></Link>
          <Call112 compact />
          <button className="grid size-9 place-items-center rounded-xl border border-line md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="glass border-t border-line px-4 py-4 md:hidden">
          {nav.map((n) => <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="block py-2 text-sm">{n.label}</a>)}
          <Link to="/report"><Button className="mt-2 w-full">{product.primaryCta}</Button></Link>
          <Link to="/admin"><Button variant="outline" className="mt-2 w-full">{product.secondaryCta}</Button></Link>
          <Link to="/track"><Button variant="ghost" className="mt-2 w-full" icon={Radar}>Track report</Button></Link>
        </div>
      )}
    </header>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
        <div className="animate-blob absolute -top-24 left-1/2 size-[520px] -translate-x-[70%] rounded-full bg-brand-400/25 blur-3xl" />
        <div className="animate-blob absolute top-10 left-1/2 size-[420px] translate-x-[5%] rounded-full bg-accent-400/25 blur-3xl [animation-delay:-6s]" />
      </div>
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Badge tone="red" dot pulse className="mb-6">Emergency reporting & monitoring · Chennai pilot</Badge>
        </motion.div>
        <h1 className="mx-auto max-w-4xl text-4xl font-semibold leading-[1.06] sm:text-6xl lg:text-7xl">
          <WordsReveal text={product.headline.before} />{" "}
          <motion.span className="text-gradient inline-block" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}>
            {product.headline.highlight}
          </motion.span>
        </h1>
        <motion.p className="mx-auto mt-6 max-w-2xl text-base text-muted sm:text-lg" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.5 }}>
          {product.subheadline}
        </motion.p>
        <motion.div className="mt-9 flex flex-wrap items-center justify-center gap-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.5 }}>
          <Link to="/report"><Button size="lg" icon={Siren}>{product.primaryCta}</Button></Link>
          <Link to="/admin"><Button size="lg" variant="outline" iconRight={ArrowRight}>{product.secondaryCta}</Button></Link>
        </motion.div>
        <HeroPreview />
      </div>
    </section>
  );
}

/** Floating mini control room under the hero. */
function HeroPreview() {
  const queue = mockIncidents.slice(0, 4);
  const top = mockIncidents[0];
  return (
    <motion.div className="relative mx-auto mt-14 max-w-5xl" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-r from-brand-500/20 to-accent-500/20 blur-2xl" />
      <Card className="glass grid gap-4 p-4 text-left md:grid-cols-[1.25fr_1fr] sm:p-5">
        <div className="rounded-xl bg-surface p-4 ring-1 ring-line">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Live queue · ranked</p>
            <Badge tone="green" dot pulse>Live</Badge>
          </div>
          <div className="space-y-2">
            {queue.map((i, k) => (
              <motion.div key={i.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 + k * 0.12 }}
                className={cn("flex items-center gap-3 rounded-xl border p-2.5", i.severity === "Critical" ? "border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30" : "border-line")}>
                <CategoryIcon category={i.category} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.title}</p>
                  <p className="font-mono text-[11px] text-muted">{i.id} · {i.area}</p>
                </div>
                <SeverityBadge severity={i.severity} score={i.score} />
              </motion.div>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-surface p-4 ring-1 ring-line">
          <p className="mb-3 text-sm font-semibold">Why {top.id} is {top.severity}</p>
          <div className="mb-3 flex items-center gap-3">
            <ScoreRing score={top.score} color={SEV_HEX[top.severity]} size={58} />
            <p className="text-xs text-muted">Every point is explained. Rules decide, humans can override.</p>
          </div>
          <ReasonsList reasons={top.reasons.slice(0, 4)} compact />
        </div>
      </Card>
    </motion.div>
  );
}

const problems = [
  { icon: MessageSquareWarning, title: "Reports are scattered", text: "Calls, WhatsApp forwards and social posts — no single picture of what is happening where." },
  { icon: EyeOff, title: "Priority is a guess", text: "A flooded street and a trapped family can look the same in a queue. Triage depends on who picks up." },
  { icon: Clock, title: "Status gets lost", text: "Once reported, nobody can see whether help is pending, on the way or done." },
];

export function Problem() {
  return (
    <section id="problem" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <Reveal><SectionHeading eyebrow="The problem" title="In a disaster, the first minutes are" highlight="lost in noise." text="During monsoon floods, one city can get hundreds of reports in an hour. The control room needs order, not more noise." /></Reveal>
      <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
        {problems.map((p) => (
          <StaggerItem key={p.title}>
            <Card className="h-full p-6">
              <div className="mb-4 grid size-11 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300"><p.icon className="size-5" /></div>
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.text}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-y border-line bg-surface-2/40 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal><SectionHeading eyebrow="How it works" title="Report to rescue in" highlight="five steps." /></Reveal>
        <div className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="absolute top-7 right-[10%] left-[10%] hidden h-px bg-gradient-to-r from-transparent via-brand-400 to-transparent lg:block" />
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08} className="relative text-center">
              <div className="relative mx-auto grid size-14 place-items-center rounded-2xl bg-surface text-brand-600 shadow-glow ring-1 ring-line dark:text-brand-300">
                <s.icon className="size-6" />
                <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mx-auto mt-1.5 max-w-[200px] text-sm text-muted">{s.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Live severity demo — calls /api/severity/preview (falls back to the same rules locally). */
export function LiveDemo() {
  const [cat, setCat] = useState<Category>("building_collapse");
  const [trapped, setTrapped] = useState(STATIC);
  const [hazard, setHazard] = useState<Hazard>("medium");
  const [injuries, setInjuries] = useState<Injuries>("minor");
  const [people, setPeople] = useState(6);
  const r: ReportIn = {
    title: "Demo", description: "Live severity demo on landing page", category: cat, area: "Velachery", lat: 12.9815, lng: 80.218,
    people_affected: people, injured_count: injuries === "none" ? 0 : 1, injuries, life_threat: trapped, hazard, active: true, vulnerable: [],
  };
  const [out, setOut] = useState<SeverityOut>(() => localSeverity(r));
  useEffect(() => {
    const id = setTimeout(() => previewSeverity(r).then(setOut), 150);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, trapped, hazard, injuries, people]);

  return (
    <section id="demo" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <Reveal><SectionHeading eyebrow="Try it live" title="Severity you can" highlight="explain to anyone." text="Change the answers. The rules engine re-scores instantly and shows exactly why." /></Reveal>
      <Reveal className="mt-12">
        <Card className="grid overflow-hidden lg:grid-cols-2">
          <div className="space-y-6 border-b border-line p-6 lg:border-r lg:border-b-0">
            <div>
              <p className="mb-2 text-sm font-medium">Emergency</p>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORIES.map((c) => {
                  const m = CATEGORY_META[c];
                  return (
                    <button key={c} onClick={() => setCat(c)} title={m.label}
                      className={cn("flex flex-col items-center gap-1 rounded-xl p-2 text-[11px] font-medium ring-1 transition",
                        cat === c ? "bg-brand-600 text-white ring-brand-600" : "bg-surface-2 ring-line hover:bg-surface")}>
                      <m.icon className="size-5" /><span className="truncate">{m.short}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={cn("flex items-center justify-between rounded-xl p-3 ring-1 transition", trapped ? "bg-red-50 ring-red-200 dark:bg-red-950/50 dark:ring-red-900" : "bg-surface-2 ring-line")}>
              <span className="text-sm font-medium">Someone trapped / not breathing?</span>
              <Switch checked={trapped} onChange={setTrapped} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="mb-2 text-sm font-medium">Hazard size</p>
                <Tabs value={hazard} onChange={setHazard} className="flex w-full [&>button]:flex-1 [&>button]:px-1" tabs={[{ value: "small", label: "Small" }, { value: "medium", label: "Med" }, { value: "large", label: "Large" }, { value: "spreading", label: "Spread" }]} />
              </div>
              <div><p className="mb-2 text-sm font-medium">Injuries</p>
                <Tabs value={injuries} onChange={setInjuries} className="flex w-full [&>button]:flex-1" tabs={[{ value: "none", label: "None" }, { value: "minor", label: "Minor" }, { value: "serious", label: "Serious" }]} />
              </div>
            </div>
            <Slider label="People affected" min={0} max={150} value={people} onChange={setPeople} />
          </div>
          <div className="p-6">
            <div className="flex items-center gap-5">
              <ScoreRing score={out.score} color={SEV_HEX[out.severity]} size={104} />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Severity</p>
                <motion.div key={out.severity} initial={STATIC ? false : { scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  <SeverityBadge severity={out.severity} size="lg" className="mt-1 text-base" />
                </motion.div>
                <p className="mt-2 text-xs text-muted">Score {out.score}/100 · Critical ≥ 70 · High ≥ 45 · Medium ≥ 25</p>
              </div>
            </div>
            <p className="mt-6 mb-2 text-xs font-medium uppercase tracking-wider text-muted">Reasons</p>
            <ReasonsList reasons={out.reasons} compact />
          </div>
        </Card>
      </Reveal>
    </section>
  );
}

export function Categories() {
  return (
    <section className="scroll-mt-20 border-y border-line bg-surface-2/40 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal><SectionHeading eyebrow="8 categories" title="One tap to say" highlight="what's happening." /></Reveal>
        <Stagger className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {CATEGORIES.map((c) => {
            const m = CATEGORY_META[c];
            return (
              <StaggerItem key={c}>
                <Link to="/report" className={cn("group relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-soft transition hover:-translate-y-1 hover:shadow-lg", m.tile)}>
                  <m.icon className="absolute -right-4 -bottom-4 size-28 opacity-20 transition group-hover:scale-110" strokeWidth={1.5} />
                  <span className="grid size-10 place-items-center rounded-xl bg-white/20"><m.icon className="size-5" /></span>
                  <span className="relative font-semibold">{m.label}</span>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <Reveal><SectionHeading eyebrow="Built today" title="Everything a control room needs," highlight="nothing it doesn't." /></Reveal>
      <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <StaggerItem key={f.title}>
            <Card hover className="group h-full p-6">
              <div className="mb-4 grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:scale-110 group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-900/40 dark:text-brand-300">
                <f.icon className="size-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

export function Impact() {
  return (
    <section id="impact" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-6">
      <Stagger className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {stats.map((s) => (
          <StaggerItem key={s.label}>
            <Card className="p-6 text-center">
              <p className="font-display text-4xl font-semibold text-gradient sm:text-5xl"><CountUp to={s.value} prefix={s.prefix} suffix={s.suffix} /></p>
              <p className="mt-2 text-sm text-muted">{s.label}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

export function Team() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <Reveal>
        <Card className="flex flex-col items-center justify-between gap-6 p-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"><Users className="size-5" /></span>
            <div><p className="font-semibold">Team {team.name}</p><p className="text-sm text-muted">{team.event}</p></div>
          </div>
          <div className="flex flex-wrap gap-3">
            {team.members.map((m) => (
              <div key={m} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-semibold text-white">{m.split(" ").map((x) => x[0]).join("")}</span>
                <span className="text-sm font-medium">{m}</span>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>
    </section>
  );
}

export function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-6 py-14 text-center text-white sm:px-16">
          <div className="animate-blob absolute -top-20 -right-20 size-72 rounded-full bg-accent-400/40 blur-3xl" />
          <h2 className="relative text-3xl font-semibold sm:text-5xl">{product.tagline}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/80">Rules decide, humans manage, every incident tracked to resolution.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/report"><Button size="lg" variant="secondary" className="bg-white text-brand-700" icon={Siren}>{product.primaryCta}</Button></Link>
            <Link to="/admin"><Button size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20" icon={Sparkles}>{product.secondaryCta}</Button></Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
        <Logo />
        <p>Built by <span className="font-medium text-fg">{team.name}</span> · {team.members.join(" & ")}</p>
        <p>Supports ERSS 112 — never replaces it.</p>
      </div>
    </footer>
  );
}
