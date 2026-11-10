import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Login, { RequireRole } from "@/pages/Login";
import { ToastProvider } from "@/ui";
import { AppShell, PageIntro } from "@/sections/AppShell";
import { ReportFlow } from "@/sections/ReportFlow";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Services from "@/pages/Services";
import CitizenAlerts from "@/pages/CitizenAlerts";
import Dashboard from "@/pages/Dashboard";
import Incidents from "@/pages/Incidents";
import IncidentDetail from "@/pages/IncidentDetail";
import ReportPage from "@/pages/Report";
import Kit from "@/pages/Kit";
import Responder from "@/pages/Responder";
import Teams from "@/pages/Teams";
import TeamDetail from "@/pages/TeamDetail";
import Alerts from "@/pages/Alerts";
import Track from "@/pages/Track";
import Analytics from "@/pages/Analytics";
import Zones from "@/pages/Zones";
import GoldenHour from "@/pages/GoldenHour";
import Hero from "@/pages/Hero";
import RiskRadar from "@/pages/RiskRadar";
import Sms from "@/pages/Sms";

function AdminReport() {
  return (
    <>
      <PageIntro title="New report" text="Call-taker mode: enter an emergency reported by phone. Severity is scored live." />
      <ReportFlow admin />
    </>
  );
}

/** Old /app/* links keep working: they move to /admin/*. */
function LegacyAppRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={pathname.replace(/^\/app/, "/admin") + search} replace />;
}

/**
 * Role-based entry points:
 *   /            citizen (open to everyone, no login)
 *   /admin       control room  (login: /admin/login)
 *   /responder   field teams   (login: /responder/login)
 */
export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/alerts" element={<CitizenAlerts />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/kit" element={<Kit />} />
          <Route path="/track" element={<Track />} />
          <Route path="/track/:id" element={<Track />} />
          <Route path="/hero" element={<Hero />} />
          <Route path="/sms" element={<Sms />} />
          <Route path="/responder/login" element={<Login role="responder" />} />
          <Route path="/responder" element={<RequireRole role="responder"><Responder /></RequireRole>} />
          <Route path="/admin/login" element={<Login role="admin" />} />
          <Route path="/app/*" element={<LegacyAppRedirect />} />
          <Route path="/admin" element={<RequireRole role="admin"><AppShell /></RequireRole>}>
            <Route index element={<Dashboard />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="incidents/:id" element={<IncidentDetail />} />
            <Route path="report" element={<AdminReport />} />
            <Route path="teams" element={<Teams />} />
            <Route path="teams/:id" element={<TeamDetail />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="zones" element={<Zones />} />
            <Route path="golden-hour" element={<GoldenHour />} />
            <Route path="risk" element={<RiskRadar />} />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
