# UI-R04-J — resizable focus docks (v0.1)

## Scope and baseline

- Parent: UI-R04-I Draft PR #73, commit 53fca64993f2ebaf8715fe0ed4a4019f2193487d.
- User approval: adjustable dock widths, tab-reload restoration, minimize by existing dock toggles, reset, keyboard access and narrow-screen fallback.
- Out of scope: merge, deployment, real YouTube API, inferred graph edges, account persistence, dock relocation and customer diagnostic panels.

## Interaction contract

1. On desktop (viewport >1100px), separators are shown for open docks. Dragging right increases the left dock; dragging left increases the right dock.
2. A focused separator supports Left/Right arrows (12px), Shift+Arrow (25px), Home (minimum), End (maximum).
3. List minimum 225px, detail minimum 250px, each maximum 480px. At least 360px is reserved for the graph, plus 90px for layout gaps and padding.
4. Existing list/detail buttons minimize each dock. Reset returns to original responsive fractional widths.
5. Only schema version and two integer widths are stored in sessionStorage (youtopia-focus-dock-layout-v1). Reload of this tab restores them. No URL, IDs, credentials or metrics are stored.
6. Corrupted, incompatible or blocked storage is ignored safely. Viewport recalculates applied bounds without overwriting saved preference.
7. <=1100px retains existing overlay docks, and <=720px retains sheet layout. Desktop splitters are hidden at these widths.

## Validation and QA

- Automated: bounded math, persisted schema, blocked storage, keyboard, tab restoration, reset, pointer drag, dock closure.
- Required CI: TypeScript/Vite, full React suite, extension suite, Windows offline on the exact feature HEAD.
- Chrome QA pending: 1440/1100/900/720/390/320px, light/dark, keyboard/Tab/Escape, mouse resizing, refresh and reset, reduced motion.
- No automatic merge and no live YouTube API authorization.
