import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@/ui";
import { AppShell, PageIntro } from "@/sections/AppShell";
import { ReportFlow } from "@/sections/ReportFlow";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Incidents from "@/pages/Incidents";
import IncidentDetail from "@/pages/IncidentDetail";
import ReportPage from "@/pages/Report";
import Kit from "@/pages/Kit";

function AdminReport() {
  return (
    <>
      <PageIntro title="New report" text="Call-taker mode: enter an emergency reported by phone. Severity is scored live." />
      <ReportFlow admin />
    </>
  );
}

/** Routes: "/" landing, "/report" citizen, "/app/*" control room, "/kit" component showcase. */
export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/kit" element={<Kit />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="incidents/:id" element={<IncidentDetail />} />
            <Route path="report" element={<AdminReport />} />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
