// ===============================
// Theme Types
// ===============================

export type ThemeCategory =
  | "all"
  | "base"
  | "colors"
  | "nature"
  | "kawaii"
  | "aesthetic";

export interface Theme {
  id: string;
  name: string;
  category: ThemeCategory[];
  sidebarColor: string;
  accentColor: string;
  contentColor: string;
  isNew?: boolean;
}

// ===============================
// Themes
// ===============================

export const themes: Theme[] = [
  // ---------- Base ----------
  { id: "really-dark", name: "Really Dark", category: ["all", "base"], sidebarColor: "#0d0d0d", accentColor: "#ffffff", contentColor: "#111111" },
  { id: "dark", name: "Dark", category: ["all", "base"], sidebarColor: "#111111", accentColor: "#e5e5e5", contentColor: "#161616" },
  { id: "light-dark", name: "Light Dark", category: ["all", "base"], sidebarColor: "#111111", accentColor: "#d4d4d4", contentColor: "#1c1c1c" },
  { id: "eighth", name: "Eighth", category: ["all", "base"], sidebarColor: "#111111", accentColor: "#a3a3a3", contentColor: "#1c1c1c" },

  // ---------- Colors ----------
  { id: "pink", name: "Pink", category: ["all", "colors", "kawaii"], sidebarColor: "#0d0d0d", accentColor: "#ff69b4", contentColor: "#111111" },
  { id: "sherbet-dark", name: "Sherbet", category: ["all", "colors", "kawaii"], sidebarColor: "#0d0d0d", accentColor: "#f9a8d4", contentColor: "#111111" },
  { id: "blue", name: "Blue", category: ["all", "colors"], sidebarColor: "#0d0d0d", accentColor: "#3b82f6", contentColor: "#111111" },
  { id: "green", name: "Green", category: ["all", "colors", "nature"], sidebarColor: "#0d0d0d", accentColor: "#22c55e", contentColor: "#111111" },
  { id: "forest", name: "Forest", category: ["all", "nature"], sidebarColor: "#0d0d0d", accentColor: "#16a34a", contentColor: "#111111" },
  { id: "ocean", name: "Ocean", category: ["all", "nature", "colors"], sidebarColor: "#0d0d0d", accentColor: "#06b6d4", contentColor: "#111111" },
  { id: "purple", name: "Purple", category: ["all", "colors", "aesthetic"], sidebarColor: "#0d0d0d", accentColor: "#8b5cf6", contentColor: "#111111" },
  { id: "red", name: "Red", category: ["all", "colors"], sidebarColor: "#0d0d0d", accentColor: "#ef4444", contentColor: "#111111" },
  { id: "orange", name: "Orange", category: ["all", "colors"], sidebarColor: "#0d0d0d", accentColor: "#f97316", contentColor: "#111111" },

  // ---------- Hacker / Tech ----------
  { id: "hacker", name: "Hacker", category: ["all", "aesthetic"], sidebarColor: "#020202", accentColor: "#22ff55", contentColor: "#0b0b0b", isNew: true },
  { id: "terminal", name: "Terminal", category: ["all", "aesthetic"], sidebarColor: "#000000", accentColor: "#00ff9c", contentColor: "#050505", isNew: true },
  { id: "matrix", name: "Matrix", category: ["all", "aesthetic"], sidebarColor: "#020202", accentColor: "#00ff00", contentColor: "#060606", isNew: true },

  // ---------- Kawaii ----------
  { id: "kawaii-pink", name: "Kawaii Pink", category: ["all", "kawaii", "colors"], sidebarColor: "#0d0d0d", accentColor: "#ffb7d5", contentColor: "#111111", isNew: true },
  { id: "bubblegum", name: "Bubblegum", category: ["all", "kawaii", "colors"], sidebarColor: "#0d0d0d", accentColor: "#ff8acb", contentColor: "#111111", isNew: true },
  { id: "lavender-milk", name: "Lavender Milk", category: ["all", "kawaii", "aesthetic"], sidebarColor: "#0f0f14", accentColor: "#d8b4fe", contentColor: "#14141c", isNew: true },
  { id: "strawberry-milk", name: "Strawberry Milk", category: ["all", "kawaii", "colors"], sidebarColor: "#0f0f0f", accentColor: "#ff9ebc", contentColor: "#141414", isNew: true },
  { id: "peach-cream", name: "Peach Cream", category: ["all", "kawaii", "colors"], sidebarColor: "#0f0e0d", accentColor: "#ffb38a", contentColor: "#141312", isNew: true },
  { id: "sky-cotton", name: "Sky Cotton", category: ["all", "kawaii", "colors"], sidebarColor: "#0e0f12", accentColor: "#a5d8ff", contentColor: "#13151a", isNew: true },
  { id: "mint-candy", name: "Mint Candy", category: ["all", "kawaii", "colors"], sidebarColor: "#0d0f0e", accentColor: "#7cf5c4", contentColor: "#121514", isNew: true },

  // ---------- Nature ----------
  { id: "sage", name: "Sage", category: ["all", "nature"], sidebarColor: "#0d0d0d", accentColor: "#86efac", contentColor: "#111111" },
  { id: "moss", name: "Moss", category: ["all", "nature"], sidebarColor: "#0b0f0b", accentColor: "#4ade80", contentColor: "#0f140f" },
  { id: "earth", name: "Earth", category: ["all", "nature", "aesthetic"], sidebarColor: "#0f0c0a", accentColor: "#a16207", contentColor: "#14110f" },
  { id: "jungle", name: "Jungle", category: ["all", "nature"], sidebarColor: "#0d0d0d", accentColor: "#16a34a", contentColor: "#111111", isNew: true },

  // ---------- Aesthetic ----------
  { id: "midnight", name: "Midnight", category: ["all", "aesthetic"], sidebarColor: "#0a0a0f", accentColor: "#6366f1", contentColor: "#0f0f18" },
  { id: "rose-night", name: "Rose Night", category: ["all", "aesthetic"], sidebarColor: "#0d0b0f", accentColor: "#fb7185", contentColor: "#120f16" },
  { id: "neon-dream", name: "Neon Dream", category: ["all", "aesthetic", "colors"], sidebarColor: "#080808", accentColor: "#22d3ee", contentColor: "#0d0d0d", isNew: true },
  { id: "mocha", name: "Mocha", category: ["all", "aesthetic"], sidebarColor: "#0e0c0a", accentColor: "#c08457", contentColor: "#14110f", isNew: true },
  { id: "slate", name: "Slate", category: ["all", "aesthetic"], sidebarColor: "#0c0e11", accentColor: "#94a3b8", contentColor: "#11141a", isNew: true },
  { id: "amethyst", name: "Amethyst", category: ["all", "aesthetic"], sidebarColor: "#0d0b10", accentColor: "#a78bfa", contentColor: "#13111a", isNew: true },
  { id: "aurora", name: "Aurora", category: ["all", "aesthetic", "colors"], sidebarColor: "#0a0f12", accentColor: "#5eead4", contentColor: "#0f1418", isNew: true },
];

// ===============================
// Defaults & Helpers
// ===============================

export const DEFAULT_THEME_ID = "really-dark";

export const categoryLabels: Record<ThemeCategory, string> = {
  all: "All",
  base: "Base",
  colors: "Colors",
  nature: "Nature",
  kawaii: "Kawaii",
  aesthetic: "Aesthetic",
};

export function getThemeById(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes.find((t) => t.id === DEFAULT_THEME_ID)!;
}