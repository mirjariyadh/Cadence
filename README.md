# Cadence

Cadence is a personal working hours tracker, project task workspace, live focus timer, and automated weekly productivity reporting web application backed by Firebase Authentication and Cloud Firestore.

## Features

- **Workspace Overview**: Quick-start focus timer strip, daily and weekly hour goal progress, 7-day stacked working hours chart, recent session logs, and a priority task queue with one-click timer launch.
- **Live Focus Timer & Time Ledger**: Synchronized stopwatch and countdown focus intervals (`25m Focus` and `50m Deep Focus`) with pause/resume/discard controls, manual hour logging, and a searchable, filterable timesheet grouped by day.
- **Projects & Tasks**: Organize work by client, hourly rate, color swatch, and hour budget with live budget-burn indicators; manage tasks with status, priority, estimates, due dates, quick-add, and per-task tracked time.
- **Automated Weekly Productivity Reports**: Week-by-week navigation with automatic KPIs (total hours, week-over-week delta, deep-work ratio, completed tasks, and billable value), stacked daily charts by category or project, deterministic pacing and focus insights, CSV export, print/PDF formatting, and immutable saved weekly snapshots.
- **Customizable Targets**: Configure personal weekly and daily working hour goals, default hourly rate, and workweek start day (`Monday` or `Sunday`).

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **Charts & Utilities**: Recharts, date-fns, Lucide React
- **Backend & Persistence**: Firebase Authentication (Google Sign-In) and Cloud Firestore with owner-scoped security rules (`firestore.rules`)

## Project Structure

```text
├── firebase-blueprint.json   # Data model schema & Firestore collection blueprint
├── firestore.rules           # Owner-isolated Firestore security rules
├── security_spec.md          # Security invariants and adversarial test cases
├── index.html                # HTML entry point & font setup
└── src/
    ├── App.tsx               # Application shell, navigation header & routing
    ├── context/
    │   └── WorkspaceContext.tsx  # Auth state, Firestore subscriptions & timer ticker
    ├── lib/
    │   ├── firebase.ts           # Firebase SDK initialization & structured error handler
    │   ├── firestoreService.ts   # Validated Firestore CRUD operations & sample seeder
    │   ├── analytics.ts          # Automated weekly productivity report engine & CSV export
    │   └── formatters.ts         # Duration, clock, currency, and date formatters
    ├── types/
    │   └── models.ts             # TypeScript models & schema field limits
    └── components/
        ├── AuthScreen.tsx
        ├── ErrorBoundary.tsx
        ├── Sidebar.tsx
        ├── OverviewView.tsx
        ├── TimerLogsView.tsx
        ├── ProjectsTasksView.tsx
        ├── WeeklyReportView.tsx
        ├── ManualEntryModal.tsx
        └── SettingsModal.tsx
```

## Firestore Data Model

All collections are isolated per authenticated user (`userId == request.auth.uid`):

- `users/{userId}` — Personal working hour targets, default hourly rate, and workweek preferences
- `projects/{projectId}` — Active and archived work projects
- `tasks/{taskId}` — Project-linked work tasks with priority, status, estimates, and completion timestamps
- `timeEntries/{entryId}` — Logged working hour sessions with work category (`deep_work`, `meetings`, `planning`, `admin`) and billable flags
- `activeTimers/{userId}` — Single live running timer per user synced across tabs and devices
- `weeklyReports/{reportId}` — Finalized immutable snapshots of weekly productivity reports

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server on port `3000`:
   ```bash
   npm run dev
   ```
3. Run TypeScript checks and build for production:
   ```bash
   npm run lint
   npm run build
   ```
4. Validate Firestore security rules with ESLint:
   ```bash
   npx eslint firestore.rules
   ```

## Deploying to GitHub Pages

This repository includes `.github/workflows/deploy.yml` and a relative Vite `base: './'` configuration for automatic GitHub Pages deployment.

1. Push the repository to GitHub (`main` or `master` branch).
2. In your GitHub repository, go to **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
3. Wait for the **Deploy to GitHub Pages** workflow under the **Actions** tab to finish (or trigger it manually via **Run workflow**).
4. In the **Firebase Console**, go to **Authentication → Settings → Authorized domains** and add `<your-github-username>.github.io` so Google Sign-In works on your live GitHub Pages URL.

## Security Note

Ensure `firebase-applet-config.json` is configured for your Firebase project and review `firestore.rules` before deploying or sharing the application broadly.
