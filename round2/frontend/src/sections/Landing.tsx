/**
 * Landing page sections. All text comes from src/config.ts.
 * Order on the page: Navbar, Hero, LogosStrip, Features, HowItWorks, Impact, CTA, Footer.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, Menu, X, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import { features, nav, product, stats, steps, team } from "@/config";
import { Badge, Button, Card, CountUp, Reveal, SectionHeading, Sparkline, Stagger, StaggerItem, WordsReveal } from "@/ui";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

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
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          {nav.map((n) => <a key={n.href} href={n.href} className="transition hover:text-fg">{n.label}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/app" className="hidden sm:block"><Button size="sm" iconRight={ArrowRight}>{product.primaryCta}</Button></Link>
          <button className="grid size-9 place-items-center rounded-xl border border-line md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="glass border-t border-line px-4 py-4 md:hidden">
          {nav.map((n) => <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="block py-2 text-sm">{n.label}</a>)}
          <Link to="/app"><Button className="mt-2 w-full">{product.primaryCta}</Button></Link>
        </div>
      )}
    </header>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40">
      {/* animated colour blobs + grid */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
        <div className="animate-blob absolute -top-24 left-1/2 size-[520px] -translate-x-[70%] rounded-full bg-brand-400/30 blur-3xl" />
        <div className="animate-blob absolute top-10 left-1/2 size-[420px] translate-x-[5%] rounded-full bg-accent-400/30 blur-3xl [animation-delay:-6s]" />
      </div>
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Badge tone="brand" dot pulse className="mb-6">Built by {team.name} · {team.event}</Badge>
        </motion.div>
        <h1 className="mx-auto max-w-4xl text-5xl font-semibold leading-[1.05] sm:text-7xl">
          <WordsReveal text={product.headline.before} />{" "}
          <motion.span className="text-gradient inline-block" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7 }}>
            {product.headline.highlight}
          </motion.span>
        </h1>
        <motion.p className="mx-auto mt-6 max-w-2xl text-lg text-muted sm:text-xl" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}>
          {product.subheadline}
        </motion.p>
        <motion.div className="mt-10 flex flex-wrap items-center justify-center gap-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.6 }}>
          <Link to="/app"><Button size="lg" iconRight={ArrowRight}>{product.primaryCta}</Button></Link>
          <a href="#how"><Button size="lg" variant="outline">{product.secondaryCta}</Button></a>
        </motion.div>
        <HeroPreview />
      </div>
    </section>
  );
}

/** Floating mini-dashboard under the hero: shows the product "alive". */
function HeroPreview() {
  const spark = [12, 18, 15, 22, 19, 28, 26, 34, 31, 42, 38, 47];
  return (
    <motion.div className="relative mx-auto mt-16 max-w-4xl" initial={{ opacity: 0, y: 40, rotateX: 12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: 0.8, duration: 1, ease: [0.22, 1, 0.36, 1] }} style={{ perspective: 1200 }}>
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-r from-brand-500/20 to-accent-500/20 blur-2xl" />
      <Card className="glass grid gap-4 p-4 text-left sm:grid-cols-3 sm:p-6">
        <div className="rounded-xl bg-surface p-4 ring-1 ring-line">
          <p className="flex items-center gap-1.5 text-xs text-muted"><Activity className="size-3.5" /> Live score</p>
          <p className="mt-1 font-display text-3xl font-semibold"><CountUp to={87.4} decimals={1} /></p>
          <Sparkline data={spark} className="mt-2 h-10 w-full" />
        </div>
        <div className="rounded-xl bg-surface p-4 ring-1 ring-line">
          <p className="flex items-center gap-1.5 text-xs text-muted"><TrendingUp className="size-3.5" /> Efficiency</p>
          <p className="mt-1 font-display text-3xl font-semibold"><CountUp to={42} suffix="%" /></p>
          <div className="mt-3 flex h-10 items-end gap-1">
            {[40, 55, 35, 70, 60, 85, 75, 95].map((h, i) => (
              <motion.div key={i} className="flex-1 rounded-sm bg-brand-500/80" initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 1.2 + i * 0.06, duration: 0.6 }} />
            ))}
          </div>
        </div>
        <div className="space-y-2 rounded-xl bg-surface p-4 ring-1 ring-line">
          <p className="text-xs text-muted">Alerts</p>
          {[
            { t: "Anomaly detected · Unit 4", tone: "red" as const, i: AlertTriangle },
            { t: "Forecast updated", tone: "brand" as const, i: TrendingUp },
            { t: "All checks passed", tone: "green" as const, i: CheckCircle2 },
          ].map((a, i) => (
            <motion.div key={a.t} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.4 + i * 0.15 }}
              className="flex items-center gap-2 text-sm">
              <a.i className={cn("size-4", a.tone === "red" ? "text-red-500" : a.tone === "green" ? "text-emerald-500" : "text-brand-500")} />
              <span className="truncate">{a.t}</span>
            </motion.div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
      <Reveal><SectionHeading eyebrow="Features" title="Everything you need," highlight="nothing you don't." text="Each feature solves one real part of the problem." /></Reveal>
      <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-y border-line bg-surface-2/40 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal><SectionHeading eyebrow="How it works" title="Three steps," highlight="zero friction." /></Reveal>
        <div className="relative mt-14 grid gap-8 md:grid-cols-3">
          <div className="absolute top-7 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-brand-400 to-transparent md:block" />
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.12} className="relative text-center">
              <div className="relative mx-auto grid size-14 place-items-center rounded-2xl bg-surface text-brand-600 shadow-glow ring-1 ring-line dark:text-brand-300">
                <s.icon className="size-6" />
                <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{s.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Impact() {
  return (
    <section id="impact" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
      <Reveal><SectionHeading eyebrow="Impact" title="Numbers that" highlight="matter." /></Reveal>
      <Stagger className="mt-14 grid grid-cols-2 gap-5 lg:grid-cols-4">
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

export function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-6 py-16 text-center text-white sm:px-16">
          <div className="animate-blob absolute -top-20 -right-20 size-72 rounded-full bg-accent-400/40 blur-3xl" />
          <h2 className="relative text-3xl font-semibold sm:text-5xl">{product.tagline}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/80">See it working live, right now.</p>
          <Link to="/app" className="relative mt-8 inline-block"><Button size="lg" variant="secondary" className="bg-white text-brand-700" iconRight={ArrowRight}>{product.primaryCta}</Button></Link>
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
        <p>{team.event}</p>
      </div>
    </footer>
  );
}
