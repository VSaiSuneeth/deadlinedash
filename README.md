# DeadlineDash

A calm, responsive student productivity dashboard for keeping coursework, projects, and study habits in view. DeadlineDash runs entirely in your browser and works locally without accounts, a server, or external services.

## Features

- Create, complete, and delete deadlines with subject and color labels.
- Live deadline countdowns, a next-deadline ring, and elapsed-time progress bars.
- Summary cards for upcoming, completed, and overdue work.
- Combined title search, subject filtering, and status filtering.
- Daily study check-ins with current and best streak tracking.
- Light and dark themes, including operating-system preference on first visit.
- JSON backup export and validated import.
- Responsive layouts, keyboard focus styles, semantic controls, and screen-reader announcements.

## Technologies

HTML5, CSS3, vanilla JavaScript, inline SVG, and browser `localStorage`. No framework, build step, backend, or network connection is required.

## Screenshot

_Add a screenshot of the running dashboard here._

## Run locally

1. Download or clone this project.
2. Open `index.html` in a modern browser. For a more convenient local preview, serve this folder with any static file server.
3. Add a deadline to begin. Your data stays in that browser profile.

## Project structure

```text
deadlinedash/
├── index.html   # Semantic page structure
├── style.css    # Responsive layout and theme styling
├── script.js    # UI, countdown, filtering, and local persistence
└── README.md    # Project documentation
```

## How localStorage works

DeadlineDash stores deadlines, study check-ins, and the selected theme in separate versioned localStorage keys. Data is kept on the current browser and device; it is not synced or sent elsewhere. Use **Export data** to download a JSON backup before clearing browser data or switching devices. Import merges deadlines by their IDs and combines study-day records. Corrupted or malformed saved deadline records are ignored when the app loads.

## Built with Cursor

The initial implementation was developed with Cursor-assisted coding and refined for a framework-free, static-browser workflow.

## Future roadmap

- Optional weekly workload and calendar views.
- Recurring study goals and configurable reminders.
- More detailed subject-level progress insights.
- Optional sync between devices.

## Deploy with GitHub Pages

1. Push the project to a GitHub repository.
2. Open the repository’s **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the branch containing the project (for example, `main`) and the repository root folder, then save.
5. Wait for the Pages URL shown in the Settings page and open it. Since this is a static app, no build command is needed.

The app stores data in each visitor’s own browser; GitHub Pages does not host user data.
