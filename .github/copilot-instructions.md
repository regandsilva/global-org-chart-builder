# Copilot Instructions for Global Org Chart Builder

## Project Overview
React 19 + Vite application for interactive org chart visualization. Client-side only with `localStorage` persistence—no backend.

## Architecture

### State Flow
`App.tsx` is the single source of truth. State uses `useHistoryState` hook (in `hooks/`) for undo/redo support:
```
App.tsx (AppState) → OrgChart.tsx (visualization) → Card.tsx / Lines.tsx (rendering)
```
All state mutations go through setter wrappers in App.tsx that update the unified `AppState` object.

### Key Data Structures (`types.ts`)
- `Person`: Core entity. Hierarchy via `managerId`. Dotted-line reports via `secondaryManagerIds[]`.
- `CardSettings` / `LineSettings`: Visual customization (colors, sizes, styles).

### Component Responsibilities
| Component | Purpose | Notes |
|-----------|---------|-------|
| `OrgChart.tsx` | Main canvas (~1800 lines) | Zoom/pan, drag-drop, modals, layout. **Monolithic**—changes require care. |
| `Card.tsx` | Employee node rendering | Receives `CardSettings` for dynamic styling |
| `Lines.tsx` | SVG connection paths | Creates elbow paths with `createElbowPath()` / `createTreePath()` |
| `components/settings/` | Settings panel UI | Modular: `CardSettingsTab`, `LineSettingsTab`, shared controls |

### localStorage Keys
```
org-chart-people, org-chart-departments, org-chart-locations,
org-chart-job-titles, org-chart-colors, org-chart-location-colors,
org-chart-line-settings, org-chart-card-settings
```

## Styling
- **Tailwind via CDN** in `index.html`—no `tailwind.config.js` file. Config is inline `<script>` in HTML.
- **Icons**: `lucide-react` exclusively.
- **Fonts**: Inter from Google Fonts.

## Development
```bash
npm install
npm run dev    # Vite dev server
npm run build  # Production build (base: /global-org-chart-builder/)
```

## Patterns & Conventions

### Adding New Person Fields
1. Update `Person` interface in `types.ts`
2. Add to edit modal in `OrgChart.tsx` (search for `editingPerson`)
3. Update `Card.tsx` rendering if visible on card
4. Consider adding to `CardSettings` if user-togglable

### Adding New Settings
1. Add to `CardSettings` or `LineSettings` in `types.ts`
2. Add default in `DEFAULT_CARD_SETTINGS` or `DEFAULT_LINE_SETTINGS` in `App.tsx`
3. Add UI control in `components/settings/CardSettingsTab.tsx` or `LineSettingsTab.tsx`
4. Use setting value in `Card.tsx` or `Lines.tsx`

### Drag & Drop
Custom implementation in `OrgChart.tsx`. Moving a person:
- Updates their `managerId` to the drop target
- Cascades department changes to all descendants via `handleMovePerson()`

## Gotchas
- **No tests configured**—`tests/` folder exists but is empty
- **Import/Export**: Supports both legacy array format and full AppState JSON
- **Zoom**: Manual transform-based implementation with `MIN_ZOOM=0.25` / `MAX_ZOOM=2`
- **Country flags**: `countries.ts` has 200+ countries with emoji flags via `getLocationFlag()`
