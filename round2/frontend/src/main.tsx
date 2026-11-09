import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { MotionGlobalConfig } from "motion/react";
import App from "./App";
import { STATIC } from "./lib/static";

if (STATIC) MotionGlobalConfig.skipAnimations = true; // screenshot mode

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
