import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@/ui";
import { AppShell } from "@/sections/AppShell";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Kit from "@/pages/Kit";
import { AssistantPage, SettingsPage, SimulatePage } from "@/pages/AppPages";

/** Routes: "/" landing, "/app/*" product dashboard, "/kit" component showcase. */
export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/kit" element={<Kit />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="simulate" element={<SimulatePage />} />
            <Route path="assistant" element={<AssistantPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
