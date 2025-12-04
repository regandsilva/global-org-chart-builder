# Copilot Instructions for Global Org Chart Builder

## 🔭 Project Overview
This is a **React 19 + Vite** application for building and visualizing organizational charts. It uses a client-side architecture with `localStorage` persistence.

## 🏗 Architecture & State
- **State Management**: Centralized in `App.tsx`. Data (`people`, `departments`, `settings`) is initialized from `localStorage` or constants.
- **Data Model**: Defined in `types.ts`.
  - Core entity: `Person` (supports `managerId` for hierarchy and `secondaryManagerIds` for dotted-line reports).
  - Settings: `LineSettings`, `CardSettings` control visual customization.
- **Visualization**:
  - `components/OrgChart.tsx`: The primary component. It is **monolithic** (~2500 lines) and handles:
    - Canvas rendering (zoom/pan logic).
    - Node layout and connections.
    - Settings modals and interaction handlers.
  - `components/Card.tsx`: Renders individual employee nodes.
  - `components/Lines.tsx`: Draws SVG connections between nodes.

## 🎨 Styling & UI
- **Tailwind CSS**: Used via **CDN** in `index.html`.
  - ⚠️ **Do not** look for `tailwind.config.js`. Configuration is inline in `index.html`.
  - Use standard Tailwind utility classes.
- **Icons**: `lucide-react` is the standard icon library.
- **Fonts**: Inter (via Google Fonts).

## 🛠 Key Workflows
- **Development**: `npm run dev` (Vite).
- **Persistence**: All changes are automatically saved to `localStorage` keys (`org-chart-people`, `org-chart-settings`, etc.).
- **Export**: Uses `html-to-image` to generate PNG downloads of the chart.

## 📝 Coding Conventions
- **Components**: Functional components with TypeScript interfaces.
- **Props**: Define explicit interfaces for all component props (e.g., `OrgChartProps`).
- **Constants**: Use `constants.ts` for initial data (`INITIAL_PEOPLE`) and configuration options (`DEPARTMENTS`, `LOCATIONS`).
- **Large Files**: Be cautious when editing `OrgChart.tsx`. It contains mixed concerns (UI, logic, layout). Prefer extracting logic into hooks or smaller components if refactoring is requested.

## ⚠️ Important Implementation Details
- **Dotted Lines**: Secondary reporting lines are rendered based on `secondaryManagerIds`.
- **Zoom/Pan**: Implemented manually in `OrgChart.tsx` using transform styles on a container div.
- **Drag & Drop**: Custom implementation for moving nodes within the chart.
