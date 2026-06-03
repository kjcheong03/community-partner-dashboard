## Shared Filter State, Modal Behaviour, and Map Geometry

Fix the dashboard so the map, request table, and modal all behave like one coordinated system.

---

### 1. Shared Filter State

Create a single shared source of truth for all dashboard filters and selections.

This state should include:

* selected topic
* selected area
* selected urgency
* selected status
* selected request type
* selected request or summary row

The map, request queue, area summary, and modal must all derive from the same filtered dataset.

Do not implement separate filtering logic for the map and the table.

When any filter changes:

* update the shared state
* update the map immediately
* update the request table immediately
* update the area summary immediately

When a request row is clicked:

* open the detail drawer or modal
* set the selected request in shared state
* highlight the corresponding area on the map
* keep the table and map aligned to the same context

---

### 2. Modal Behaviour

The request detail view should behave like a true overlay.

Use:

* backdrop overlay
* high z-index
* scroll locking behind the modal
* no layout reflow of the map or table beneath it

Do not let the modal push the map out of position or make the map appear cropped in the background.

A side drawer is acceptable if it is cleaner than a centered modal.

---

### 3. Map Geometry and Polygon Rendering

The current map overlays are too overlapping and visually awkward.

Fix the map so it uses clean geographic geometry rather than stacked translucent boxes.

Do NOT use:

* hand-drawn SVG shapes
* approximate rectangular overlays
* manually placed transparent polygons that overlap heavily
* fake Singapore outlines with randomly positioned regions

Instead use one of these approaches:

#### Preferred

A real Singapore planning-area GeoJSON layer rendered in MapLibre or Leaflet.

Each area should be a proper polygon boundary and should not overlap other areas in a confusing way.

#### Acceptable fallback

If real planning-area polygons are not available quickly:

* simplify the map into a cleaner regional breakdown
* use fewer, larger regions
* avoid trying to force many small polygons into Singapore’s compact geography
* prefer area centroids or cluster markers over overlapping polygons

---

### 4. Polygon Visual Rules

If polygons are used:

* each region must be visually distinct
* polygon borders should be thin and clear
* fill opacity should be low
* selected area should be clearly highlighted
* unselected areas should remain subtle
* overlapping translucent shapes should be avoided

The map should feel like an operational map, not a stack of boxes.

---

### 5. Click / Deselect Behaviour

Clicking an area should select it.

Clicking the same area again should deselect it.

Use toggle logic so selection behaves naturally.

Example:

```ts
setSelectedArea((current) => (current === areaId ? null : areaId))
```

---

### 6. Map and Table Synchronisation

The map must always reflect the current filters.

Examples:

* filtering to Dengue should update visible areas and counts on the map
* filtering to High Priority should update the highlighted areas
* selecting a row should highlight the matching area on the map
* clearing filters should restore the full overview

The dashboard should feel like one linked operational system.

---

### 7. Practical Design Rule

If clean planning-area polygons are hard to source or make look good, do not force the polygon approach.

Prefer a cleaner and more usable alternative over a crowded or misleading map.

The goal is:

* geographic awareness
* useful filtering
* clear operational interpretation
* no visual clutter
* no confusing overlap
