# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project

**CARA Community Dashboard** — a responder-facing case management and community response operations platform used by approved partner organisations (SG Cares Volunteer Centres, Silver Generation Office teams, eldercare/pharmacy/transport partners) during public health emergencies in Singapore.

GitHub: https://github.com/happyweijie/cara-community-dashboard

The dashboard converts individual caregiver support requests into coordinated community response. It is **not** an analytics dashboard — it is a case management and operational workflow tool. Optimise for action, not analysis.

---

## Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** for all styling
- **ESLint** for linting
- Recommended libraries: `lucide-react`, `recharts`, `clsx`, `tailwind-merge`
- No backend — local state only, mock data only

---

## Commands

```bash
npm run dev        # start dev server
npm run build      # production build (run before deploying)
npm run lint       # lint check (must pass before deployment)
```

Deploy to **Vercel**. Always run `npm run lint && npm run build` before deploying and resolve all issues.

---

## Architecture

```
src/
├── app/           # Next.js App Router — layout.tsx, page.tsx, globals.css
├── components/    # All UI components (see below)
├── data/          # mockRequests.ts — ~20 realistic HelpRequest objects
└── lib/           # types.ts (HelpRequest, ActivityLogEntry, etc.), utils.ts
```

### Key data type

```ts
type HelpRequest = {
  id: string;
  area: string;
  topic: "COVID-19" | "Dengue" | "Haze";
  helpType: string;
  urgency: "Low" | "Medium" | "High";
  status: string;           // New | Received | Accepted | In Progress | Fulfilled | Unable To Fulfil | Rerouted
  riskFactors: string[];
  assignedOrganisation: string;
  assignedTeam?: string;
  submittedAt: string;
  notes: string;
  activityLog: ActivityLogEntry[];
};
```

Mock data must not include names, phone numbers, exact addresses, NRIC, or any real personal information. Use area-level location only (e.g. "Tampines", "Bedok").

### Component map

| Component | Responsibility |
|---|---|
| `Sidebar` | Logo, nav links (Dashboard active, others placeholder) |
| `Header` | Title, org name, last-updated timestamp, Export Summary button |
| `TopicSwitcher` | Segmented control — COVID-19 / Dengue / Haze; drives data filter |
| `KpiRow` | Four stat cards: Open Requests, High Priority, Fulfilled Today, Unable To Fulfil |
| `RequestQueue` | Primary feature — filterable table/list of requests; dominates the layout |
| `RequestDetailDrawer` | Right-side drawer or split-screen — case management detail for selected request |
| `ActivityTimeline` | Timestamped log inside the detail panel |
| `AssignmentCard` | Team assignment display and picker |
| `CommunityInsights` | Lightweight insight cards (not charts) below the queue |
| `PrivacyNotice` | Safeguarding card — minimum info, role-based access, 995 warning |

### Status workflow

```
New → Received → Accepted → In Progress → Fulfilled
New → Rerouted
In Progress → Unable To Fulfil
```

All status transitions and assignments use local React state — no API calls.

---

## Design constraints

- Desktop-first responsive layout with a fixed sidebar
- Background: soft blue-grey; cards: white + rounded corners; accents: blue
- No dark mode
- No heat maps, geographic maps, or complex visualisations in Insights
- Minimum necessary information visible at all times (privacy-by-design)

---

## Git conventions

Commit after each meaningful milestone. Use imperative mood, max 72 chars subject line. Avoid: `wip`, `update`, `fixes`, `misc`.
