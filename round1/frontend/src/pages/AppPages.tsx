import { useCallback, useState } from "react";
import { Bot, CheckCircle2, Clock, Network, Save, Timer } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, CardBody, CardHeader, ChatPanel, Field, GridSim, Input, Select, StatTile, Switch, useToast, type ChatMsg } from "@/ui";
import { PageIntro } from "@/sections/AppShell";

const robots = [
  { id: "R1", start: [0, 0] as [number, number], goal: [23, 13] as [number, number] },
  { id: "R2", start: [23, 0] as [number, number], goal: [0, 13] as [number, number] },
  { id: "R3", start: [0, 13] as [number, number], goal: [23, 0] as [number, number] },
  { id: "R4", start: [12, 0] as [number, number], goal: [12, 13] as [number, number] },
];

export function SimulatePage() {
  const [s, setS] = useState({ delivered: 0, totalSteps: 0, waits: 0, tick: 0 });
  const onStats = useCallback((x: typeof s) => setS(x), []);
  return (
    <>
      <PageIntro title="Simulation" text="Robots plan collision-free routes with A* and re-plan when blocked." />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Delivered" value={s.delivered} suffix={`/${robots.length}`} icon={CheckCircle2} />
        <StatTile label="Total steps" value={s.totalSteps} icon={Network} />
        <StatTile label="Waits (conflicts)" value={s.waits} icon={Clock} />
        <StatTile label="Ticks" value={s.tick} icon={Timer} />
      </div>
      <Card><CardBody><GridSim robots={robots} onStats={onStats} /></CardBody></Card>
    </>
  );
}

export function AssistantPage() {
  const ask = async (question: string, history: ChatMsg[]) =>
    (await api.post<{ answer: string }>("/assistant", { question, history })).answer;
  return (
    <>
      <PageIntro title="AI Assistant" text="Ask in plain English. Answers use the live data." />
      <div className="grid gap-4 lg:grid-cols-3">
        <ChatPanel className="h-[600px] lg:col-span-2" ask={ask}
          suggestions={["What is the current risk?", "Which items need attention?", "How accurate is the model?"]} />
        <Card>
          <CardHeader title="What it can do" icon={Bot} />
          <CardBody className="space-y-3 text-sm text-muted">
            <p>• Summarise the live status.</p>
            <p>• Explain why an item is high risk.</p>
            <p>• Suggest the next best action.</p>
            <p className="rounded-xl bg-surface-2 p-3 text-xs">Works without an API key using built-in rules. Add <code>GEMINI_API_KEY</code> to use a real LLM.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export function SettingsPage() {
  const toast = useToast();
  const [alerts, setAlerts] = useState(true);
  const [auto, setAuto] = useState(false);
  return (
    <>
      <PageIntro title="Settings" text="Tune thresholds and notifications." />
      <Card className="max-w-2xl">
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site name"><Input defaultValue="Plant 1 · Chennai" /></Field>
            <Field label="Alert level" hint="When to notify the team">
              <Select defaultValue="medium" options={[{ value: "low", label: "Low and above" }, { value: "medium", label: "Medium and above" }, { value: "high", label: "High only" }]} />
            </Field>
          </div>
          <div className="flex flex-col gap-3">
            <Switch checked={alerts} onChange={setAlerts} label="Send instant alerts" />
            <Switch checked={auto} onChange={setAuto} label="Auto-schedule maintenance" />
          </div>
          <Button icon={Save} onClick={() => toast("success", "Settings saved")}>Save changes</Button>
        </CardBody>
      </Card>
    </>
  );
}
