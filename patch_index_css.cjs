const fs = require('fs');

const css = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
@import "tailwindcss";
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}

body {
  background-color: var(--color-slate-50);
  color: var(--color-slate-700);
}

/* Custom scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: var(--color-slate-50);
}
::-webkit-scrollbar-thumb {
  background: var(--color-slate-200);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--color-blue-600);
}

@keyframes marquee {
  0% { transform: translateX(0%); }
  100% { transform: translateX(-33.3333%); }
}
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }

/* --- High-Contrast Midnight Theme Overrides --- */
.midnight {
  background-color: #020617; /* deepest black-blue */
  color: #f1f5f9;

  /* Tailwind v4 color remapping for midnight mode */
  --color-white: #0b0f19;
  
  /* Slate Inversion */
  --color-slate-50: #0b0f19;
  --color-slate-100: #0f172a;
  --color-slate-200: #1e293b;
  --color-slate-300: #334155;
  --color-slate-400: #475569;
  --color-slate-500: #94a3b8;
  --color-slate-600: #cbd5e1;
  --color-slate-700: #e2e8f0;
  --color-slate-800: #f1f5f9;
  --color-slate-900: #f8fafc;
  --color-slate-950: #ffffff;

  /* Gray Inversion */
  --color-gray-50: #0b0f19;
  --color-gray-100: #0f172a;
  --color-gray-200: #1e293b;
  --color-gray-300: #334155;
  --color-gray-400: #475569;
  --color-gray-500: #94a3b8;
  --color-gray-600: #cbd5e1;
  --color-gray-700: #e2e8f0;
  --color-gray-800: #f1f5f9;
  --color-gray-900: #f8fafc;
  --color-gray-950: #ffffff;
}

/* Extra overrides for active components and modals */
.midnight .bg-blue-700\\/10 {
  background-color: color-mix(in srgb, var(--color-blue-600) 15%, transparent) !important;
}
.midnight .bg-slate-50\\/50 {
  background-color: color-mix(in srgb, var(--color-slate-50) 50%, transparent) !important;
}

/* Performance charts specific SVG styling */
.midnight .recharts-cartesian-grid line {
  stroke: var(--color-slate-200) !important;
}
.midnight .recharts-text {
  fill: var(--color-slate-500) !important;
}
.midnight .recharts-default-tooltip {
  background-color: var(--color-slate-50) !important;
  border: 1px solid var(--color-slate-200) !important;
  color: var(--color-slate-900) !important;
}
.midnight .recharts-legend-item-text {
  color: var(--color-slate-600) !important;
}
`;
fs.writeFileSync('src/index.css', css, 'utf8');
console.log('CSS successfully rewritten to use CSS custom properties for Tailwind v4!');
