/** /kit : every UI piece on one page. Builders look here to pick components. */
import { useState } from "react";
import { Bell, Inbox, Plus, Rocket, Trash2, Upload } from "lucide-react";
import {
  AreaChartBox, Badge, BarChartBox, Button, Card, CardBody, CardHeader, DonutChartBox, EmptyState, Field, Input,
  LineChartBox, Modal, ProgressBar, RingGauge, Select, Skeleton, Slider, Spinner, StatTile, Stepper, Switch, Tabs,
  Textarea, Timeline, useToast,
} from "@/ui";
import { Navbar } from "@/sections/Landing";

const series = Array.from({ length: 12 }, (_, i) => ({ m: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i], a: 30 + i * 4 + (i % 3) * 6, b: 20 + i * 3 + (i % 4) * 5 }));

export default function Kit() {
  const toast = useToast();
  const [tab, setTab] = useState<"a" | "b" | "c">("a");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(40);
  const [sw, setSw] = useState(true);
  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-6xl space-y-6 px-4 pt-24 pb-20 sm:px-6">
        <h1 className="text-4xl font-semibold">UI kit <span className="text-gradient">showcase</span></h1>
        <Card><CardHeader title="Buttons & badges" /><CardBody className="flex flex-wrap items-center gap-3">
          <Button icon={Rocket}>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="outline" icon={Plus}>Outline</Button>
          <Button variant="ghost">Ghost</Button><Button variant="danger" icon={Trash2}>Danger</Button><Button loading>Loading</Button>
          <Badge>Brand</Badge><Badge tone="green" dot pulse>Live</Badge><Badge tone="amber" dot>Watch</Badge><Badge tone="red" dot>Critical</Badge><Badge tone="gray">Draft</Badge>
        </CardBody></Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Users" value={1284} delta={12} icon={Bell} spark={[3, 5, 4, 7, 6, 9, 8, 11]} />
          <StatTile label="Accuracy" value={94.2} decimals={1} suffix="%" delta={1.4} />
          <Card className="grid place-items-center p-4"><RingGauge value={72} label="risk" danger /></Card>
          <Card className="space-y-3 p-5"><ProgressBar value={80} /><ProgressBar value={55} tone="amber" /><ProgressBar value={20} tone="red" /><Spinner /></Card>
        </div>
        <Card><CardHeader title="Inputs" /><CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input placeholder="Type here" /></Field>
          <Field label="Choice"><Select options={[{ value: "1", label: "Option one" }, { value: "2", label: "Option two" }]} /></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea placeholder="Longer text" /></Field>
          <Slider label="Threshold" value={v} onChange={setV} unit="%" />
          <Switch checked={sw} onChange={setSw} label="Enable alerts" />
        </CardBody></Card>
        <Card><CardHeader title="Tabs, modal, toast, stepper" /><CardBody className="space-y-5">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "a", label: "Overview" }, { value: "b", label: "Details" }, { value: "c", label: "History" }]} />
          <div className="flex gap-2"><Button variant="outline" onClick={() => setOpen(true)}>Open modal</Button><Button variant="outline" onClick={() => toast("success", "Saved!", "Everything worked")}>Show toast</Button></div>
          <Stepper steps={["Upload", "Analyse", "Review", "Export"]} current={1} />
        </CardBody></Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader title="Area" /><CardBody><AreaChartBox data={series} x="m" series={[{ key: "a", label: "This year" }, { key: "b", label: "Last year" }]} /></CardBody></Card>
          <Card><CardHeader title="Bar" /><CardBody><BarChartBox data={series} x="m" series={[{ key: "a" }]} /></CardBody></Card>
          <Card><CardHeader title="Line" /><CardBody><LineChartBox data={series} x="m" series={[{ key: "a" }, { key: "b" }]} /></CardBody></Card>
          <Card><CardHeader title="Donut" /><CardBody><DonutChartBox data={[{ name: "A", value: 50 }, { name: "B", value: 30 }, { name: "C", value: 20 }]} center={{ value: "100", label: "total" }} /></CardBody></Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5"><Timeline items={[{ title: "Data received", time: "09:12" }, { title: "Model scored", time: "09:13", tone: "green" }, { title: "Alert sent", time: "09:14", tone: "red", text: "Unit 4 vibration high" }]} /></Card>
          <EmptyState icon={Inbox} title="Nothing here yet" text="Upload a file to get started." action={<Button size="sm" icon={Upload}>Upload</Button>} />
          <Card className="space-y-3 p-5"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4" /><Skeleton className="h-4 w-3/4" /></Card>
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Confirm action">
        <p className="text-sm text-muted">This is a modal. Press Esc or click outside to close.</p>
        <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => setOpen(false)}>Confirm</Button></div>
      </Modal>
    </>
  );
}
