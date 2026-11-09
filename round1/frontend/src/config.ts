/**
 * ONE place for all product text. Builders edit this first for a new problem.
 * Icons are names from lucide-react (https://lucide.dev/icons).
 */
import {
  Brain, Zap, ShieldCheck, LineChart, Cpu, Workflow, Sparkles, Gauge, type LucideIcon,
} from "lucide-react";

export const team = {
  name: "Ctrl.Alt.Elite",
  members: ["Umer Basith", "Muizzur Rahman"],
  event: "Cobot-Ex Hackathon 2026",
};

export const product = {
  name: "NovaSense",
  tagline: "Turn raw signals into decisions in seconds.",
  /** Headline is split so one phrase can get the gradient. */
  headline: { before: "Smarter decisions,", highlight: "in real time.", after: "" },
  subheadline:
    "An AI-powered platform that watches your data, predicts problems before they happen and tells you exactly what to do next.",
  primaryCta: "Launch dashboard",
  secondaryCta: "See how it works",
};

export const stats: { value: number; suffix?: string; prefix?: string; label: string }[] = [
  { value: 94, suffix: "%", label: "Prediction accuracy" },
  { value: 3, suffix: "x", label: "Faster response" },
  { value: 40, suffix: "%", label: "Lower cost" },
  { value: 24, suffix: "/7", label: "Live monitoring" },
];

export const features: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Brain, title: "AI predictions", text: "A trained model scores every new reading and flags risk early." },
  { icon: Zap, title: "Real-time alerts", text: "Instant, prioritised alerts so the right person acts first." },
  { icon: LineChart, title: "Live analytics", text: "Clear charts that show trends, not just numbers." },
  { icon: ShieldCheck, title: "Safe by design", text: "Validated inputs, clear limits and an audit trail." },
  { icon: Workflow, title: "Fits your workflow", text: "Upload a CSV or connect a sensor stream. No setup pain." },
  { icon: Sparkles, title: "AI assistant", text: "Ask questions in plain English and get grounded answers." },
];

export const steps: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Cpu, title: "Collect", text: "Data comes in from sensors, uploads or forms." },
  { icon: Brain, title: "Analyse", text: "The model scores it and finds patterns." },
  { icon: Gauge, title: "Decide", text: "The dashboard shows risk and the best next action." },
];

export const nav = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how" },
  { label: "Impact", href: "/#impact" },
];
