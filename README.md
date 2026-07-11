# MaintainIQ

A lightweight asset maintenance management platform (CMMS). Scan an asset's QR code, raise a fault ticket, and let the system triage, assign, and track it through to resolution — with photo evidence, full repair history, and preventive maintenance signals.

Built with **vanilla JavaScript** and **Supabase** — no framework, no build step.

---

## Why

A QR code is only the entry point. The real value is everything after the scan:

- **Triage** — every open ticket is surfaced on the dashboard, ready for action
- **Assignment** — auto-match tickets to the least-loaded technician in the right department
- **Workflow** — a clear lifecycle from report to resolution (`Open → Assigned → In Progress → Completed`)
- **Evidence** — before/after photos and remarks logged on every completed job
- **History** — full repair timeline per asset
- **Accountability** — every ticket and history entry is tied to a named technician
- **Preventive recommendations** — repair-count-based signals (`Healthy` / `Schedule Maintenance` / `Replace Asset`)

---

## Features

| Module | What it does |
|---|---|
| **Dashboard** | Live counts (assets, open tickets, technicians, completed work orders) + a "Needs Triage" queue |
| **Assets** | Register equipment (name, location, department); view preventive maintenance status per asset |
| **Issues** | Report faults against an asset, set priority, and move them through the workflow |
| **Technicians** | Onboard technicians by department; see live active-job load |
| **History** | Per-asset completed work order log, with before/after evidence and remarks |
| **Auth** | Email/password sign-up & sign-in via Supabase Auth |
| **Theme** | Light/dark mode toggle, saved to `localStorage` |

---

## Tech Stack

- **Frontend:** Vanilla JavaScript (no framework), HTML, CSS
- **Backend:** [Supabase](https://supabase.com) — Postgres database, Auth, and REST API via `@supabase/supabase-js`
- **Fonts:** Plus Jakarta Sans, JetBrains Mono (Google Fonts)

---

## Project Structure

```
├── inde.html      # App shell — loads fonts, styles, and index.js
└── index.js       # All application logic: state, Supabase calls, and rendering
```

There is no build step — open `inde.html` in a browser (or serve it statically) and it runs.

---

## Getting Started

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and open the **SQL Editor**.

### 2. Run the schema

```sql
-- Assets
create table assets (
  id text primary key,
  name text not null,
  location text not null,
  department text not null,
  status text default 'Working',
  total_issues integer default 0,
  qr_code text,
  created_at timestamptz default now()
);

-- Technicians
create table technicians (
  id text primary key,
  name text not null,
  department text not null,
  active_jobs integer default 0,
  created_at timestamptz default now()
);

-- Issues
create table issues (
  id text primary key,
  asset_id text references assets(id) on delete cascade,
  title text not null,
  description text,
  priority text default 'Medium',
  status text default 'Open',
  technician text,
  created_at timestamptz default now()
);

-- History (completed work orders)
create table history (
  id bigint generated always as identity primary key,
  asset_id text references assets(id) on delete cascade,
  issue_id text references issues(id) on delete cascade,
  technician text,
  remarks text,
  before_photo text,
  after_photo text,
  completed_at timestamptz default now()
);

-- Row Level Security (demo mode: open access — tighten before production)
alter table assets enable row level security;
alter table technicians enable row level security;
alter table issues enable row level security;
alter table history enable row level security;

create policy "public read/write assets" on assets for all using (true) with check (true);
create policy "public read/write technicians" on technicians for all using (true) with check (true);
create policy "public read/write issues" on issues for all using (true) with check (true);
create policy "public read/write history" on history for all using (true) with check (true);
```

> ⚠️ These RLS policies allow anyone with the anon key to read/write. Fine for a demo — replace with `auth.uid()`-based policies before going to production.

### 3. Add your credentials

In `index.js`, set your project's URL and anon key (Project Settings → API):

```js
const SUPABASE_URL = "https://juouxgqrabirdjdiveht.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BV6eD7BhN8nNO8dSV6a3Lg_U2xsqNlu";
```

### 4. Run it

Just open `inde.html` in a browser, or serve the folder statically:

```bash
npx serve .
```

Sign up with an email/password on first load, then start adding assets, technicians, and tickets.

---

## How the Workflow Works

1. **Report** — a ticket is raised against an asset (`status: Open`)
2. **Auto-assign** — the least-loaded technician in the asset's department is matched (`status: Assigned`)
3. **Accept** — the technician accepts the job (`status: In Progress`)
4. **Complete** — the technician logs before/after evidence and remarks; the ticket closes (`status: Completed`) and a row is written to `history`
5. **Preventive signal** — once an asset accumulates 3+ history entries it's flagged `Schedule Maintenance`; at 5+ it's flagged `Replace Asset`

> Technician `department` must exactly match the asset's `department` for auto-assign to find a match — keep naming consistent (e.g. `IT`, `Electrical`).

---

## Roadmap Ideas

- [ ] Real photo upload via Supabase Storage (currently filename/URL text fields)
- [ ] Role-based access (admin vs technician views)
- [ ] QR code generation & scanning flow
- [ ] Email/SMS notifications on assignment
- [ ] Tighter RLS policies scoped to `auth.uid()`

---

## License

MIT — use it, modify it, ship it.
