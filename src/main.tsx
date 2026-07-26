import { createRoot } from "react-dom/client";
import "./globals.css";
import { App } from "./App";
import { readPref } from "./lib/prefs";
import { applyTheme, DEFAULT_THEME } from "./lib/themes";

applyTheme(readPref("theme-id") || DEFAULT_THEME, readPref("mode") === "light" ? "light" : "dark");

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
