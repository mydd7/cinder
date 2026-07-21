import { createRoot } from "react-dom/client";
import "./globals.css";
import { App } from "./App";
import { applyTheme, DEFAULT_THEME, type Mode } from "./lib/themes";

const savedTheme = localStorage.getItem("au-theme-id") || DEFAULT_THEME;
const savedMode: Mode = localStorage.getItem("au-mode") === "light" ? "light" : "dark";
applyTheme(savedTheme, savedMode);

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
