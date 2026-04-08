# 3D Model Builder — Claude Project Guide

## Project Overview
A browser-based 3D panel/model builder. Users create projects, add panels with dimensions and materials, and visualize them in a Three.js 3D scene. Projects are persisted in IndexedDB via Dexie.

## Tech Stack
- **Vue 2** — UI reactivity and component logic
- **Three.js 0.134** — 3D scene rendering with OrbitControls
- **Dexie 3** — IndexedDB wrapper for local project persistence
- **jsTree** — panel hierarchy/tree view in the sidebar
- **jQuery** — used by jsTree only; do not use it for new code

No build system, no bundler, no npm. All source is inline in `index.html`.

---

## File & Folder Structure

When the project grows beyond a single comfortable file, split it using this layout:

```
3dmodel/
├── index.html              # Entry point — markup and <script>/<link> imports only
│
├── css/
│   └── main.css            # All styles (split into layout.css / components.css / theme.css if it grows large)
│
├── js/
│   ├── constants.js        # DEFAULT_PANEL, SCENE_CONFIG — no dependencies
│   ├── db.js               # Dexie init — depends on constants
│   ├── repositories.js     # ProjectRepository, PanelRepository — depends on db
│   ├── domain.js           # createPanel, deg2rad, formatDate — pure, no dependencies
│   ├── EventBus.js         # EventBus singleton — depends on Vue being loaded
│   ├── SceneManager.js     # Three.js revealing module — depends on constants, domain
│   └── app.js              # Vue instance — loaded last, depends on everything above
│
├── images/
│   └── (static textures, icons — user-uploaded textures are stored in IndexedDB as base64)
│
└── CLAUDE.md
```

### Load order in index.html
Classic scripts share a global scope — load order is the dependency graph:

```html
<link rel="stylesheet" href="css/main.css" />

<!-- vendor -->
<script src="https://cdn.jsdelivr.net/npm/vue@2.7.16/dist/vue.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js"></script>
<script src="...three.min.js"></script>
<script src="...OrbitControls.js"></script>
<script src="...RoomEnvironment.js"></script>
<script src="...jquery.min.js"></script>
<script src="...jstree.min.js"></script>

<!-- app — order matches dependency direction -->
<script src="js/constants.js"></script>
<script src="js/db.js"></script>
<script src="js/repositories.js"></script>
<script src="js/domain.js"></script>
<script src="js/EventBus.js"></script>
<script src="js/SceneManager.js"></script>
<script src="js/app.js"></script>
```

### Rules when splitting files
- Each file declares only what its name says — `SceneManager.js` contains only `SceneManager`.
- No `import`/`export` — everything is a `const`/`function` assigned to the global scope.
- Do not add `type="module"` unless the project deliberately moves to ES modules (which requires a server for local dev due to CORS on `file://`).
- Keep `index.html` markup-only once split; no inline `<script>` blocks.

---

## Architecture Principles

### Separation of Concerns
Keep distinct layers clearly separated even within a single file:
- **Data layer** — Dexie repositories: all DB reads/writes go through dedicated repository objects, never inline in Vue methods.
- **Domain layer** — pure business logic functions: validation, transformations, calculations. No DOM, no Vue, no DB access.
- **Presentation layer** — Vue instance and template: only responsible for rendering state and delegating user actions to the domain/data layers.
- **3D layer** — Three.js scene management isolated in a dedicated `SceneManager` object, not mixed into Vue methods.

### Single Responsibility
Each function, method, or object does one thing. If a method name contains "and", it should be split.

### Dependency Direction
Presentation → Domain → Data. The domain layer must not depend on Vue or the DB. The data layer must not contain business logic.

---

## Design Patterns to Apply

### Repository Pattern
All IndexedDB access is encapsulated in repository objects:
```js
const ProjectRepository = {
  getAll: () => db.projects.toArray(),
  getById: (id) => db.projects.get(id),
  save: (project) => db.projects.put(project),
  remove: (id) => db.projects.delete(id),
};
const PanelRepository = {
  getByProject: (projectId) => db.panels.where('projectId').equals(projectId).toArray(),
  save: (panel) => db.panels.put(panel),
  remove: (id) => db.panels.delete(id),
};
```
Vue methods call repositories, never `db.*` directly.

### Factory Pattern
Use factory functions to construct domain objects with defaults and validation:
```js
function createPanel(overrides = {}) {
  return { id: null, name: 'Panel', width: 100, height: 100, depth: 18, material: 'wood', ...overrides };
}
```

### Observer / Event Bus
Use a simple event bus for cross-concern communication (e.g., scene reacting to data changes) rather than tight coupling:
```js
const EventBus = new Vue();
EventBus.$emit('panel:added', panel);
EventBus.$on('panel:added', (panel) => sceneManager.addPanel(panel));
```

### Module / Revealing Module
Group related logic into plain objects that expose only what is needed:
```js
const SceneManager = (() => {
  let scene, camera, renderer;
  function init(container) { ... }
  function addPanel(panel) { ... }
  function removePanel(id) { ... }
  return { init, addPanel, removePanel };
})();
```

---

## Clean Code Rules

### Naming
- Variables and functions: `camelCase`, descriptive, intention-revealing (`getPanelsByProject`, not `getData`).
- Boolean variables/props: prefix with `is`, `has`, or `can` (`isLoading`, `hasUnsavedChanges`).
- Constants: `UPPER_SNAKE_CASE` for true constants (`MAX_PANELS`, `DEFAULT_MATERIAL`).
- Avoid abbreviations unless universally understood (`id`, `url` are fine; `p`, `tmp`, `mgr` are not).

### Functions
- Do one thing. Aim for under 20 lines.
- No side effects unless the function name makes it explicit (`savePanel`, not `getPanel` that also saves).
- Prefer pure functions for domain logic — same input always produces same output.
- Max 3 parameters; use an options object for more.

### Variables & State
- Declare variables as close to their use as possible.
- Avoid magic numbers — extract to named constants.
- Minimize mutable state; derive values where possible instead of storing them.

### Error Handling
- Handle errors at the boundary (Vue methods, event handlers). Domain functions may throw.
- Always handle promise rejections — use `async/await` with `try/catch`.
- Never silently swallow errors (`catch (e) {}`).

### Comments
- Do not comment what the code does — write code that explains itself.
- Comment *why* when the reason is not obvious (workarounds, constraints, business rules).
- Remove dead code instead of commenting it out.

---

## Data Model (Dexie / IndexedDB)
- `projects` table: `{ id, name, createdAt }`
- `panels` table: `{ id, projectId, name, width, height, depth, material, position, ... }`
- Always scope panel queries to the current `projectId`.

---

## Slash Commands

**Git workflow**
- `/commit` — stage and commit changes with a conventional message
- `/push` — push current branch to origin
- `/merge-to-main` — merge current branch into main and push
- `/new-feature <name>` — create a new feature branch from latest main
- `/sync` — rebase current branch onto latest main
- `/changelog` — generate a changelog from commits since the last tag
- `/tag-release <version>` — create an annotated semver tag and push it

**Code quality**
- `/review` — review index.html against clean code and architecture rules; produces a prioritized issue list
- `/audit-architecture` — scan for architecture violations (layer breaches, missing patterns, error handling gaps); produces a health score
- `/refactor <section>` — refactor a named section to follow the architecture patterns

**Feature development**
- `/add-feature <description>` — scaffold a new feature across all architecture layers
- `/add-panel-property <name>` — add a new panel property end-to-end (factory, DB, form, scene)

## Git Branches
Feature branches: `feature/<description>`. Step branches: `step-<n>/<description>`.
Commit messages follow Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `style:`.
