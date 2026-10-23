# Roza

Roza is a web app for writing and organizing books, keeping reading reviews, and collecting references. It combines a rich text writing workspace with structured book planning and supports English and Hebrew, including right-to-left layouts.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment configuration](#environment-configuration)
- [Running locally](#running-locally)
- [Using the app](#using-the-app)
- [Development commands](#development-commands)
- [Testing](#testing)
- [Production build](#production-build)
- [Docker](#docker)
- [Application routes and API](#application-routes-and-api)
- [Development guide](#development-guide)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

### Book writing and organization

- Create and edit books with chapters, characters, themes, plotlines, and notes.
- Write chapter text and descriptions in a Slate rich text editor.
- Format text with bold, italic, underline, headings, quotations, lists, and alignment.
- Read chapters in a dedicated reading mode and download individual chapters as PDFs.
- Search and sort the book collection, and archive books and their content.

### Reviews and references

- Create separate book review collections with review entries, references, and structure notes.
- Record reference text, page information, and uploaded images.
- Reorder supported lists through drag and drop, and collapse longer entries.
- Search, sort, and archive review collections.

### Accounts and interface

- Sign up, log in, log out, edit profile details, and change passwords.
- Authenticate with JWTs and an HTTP-only login cookie.
- Use English or Hebrew; Hebrew switches the document to a right-to-left layout.
- Restore the last visited page for a signed-in user.
- Install the production app as a PWA in supported browsers. The service worker caches static assets and uses network-first API caching; this does not provide offline editing or synchronization.

## Technology

| Area | Technologies |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 5, React Router 6 |
| Data and forms | TanStack Query, Axios, React Hook Form |
| Editing and exports | Slate, dnd-kit, jsPDF |
| Styling and translation | Tailwind CSS, Sass, i18next |
| Backend | Node.js, Express 4, TypeScript |
| Database | MongoDB with Mongoose |
| Authentication | JSON Web Tokens, bcryptjs, cookies |
| Image uploads | Cloudinary |
| Testing | Jest, ts-jest, Supertest; frontend Cloudinary test source also exists |
| Packaging | Vite PWA plugin, Docker multi-stage build |

## Project structure

```text
Roza/
├── backend/
│   ├── src/
│   │   ├── controllers/       # Request handlers
│   │   ├── middlewares/       # Authentication, sanitization, logging
│   │   ├── models/            # Mongoose models and schemas
│   │   ├── routers/           # API routes
│   │   ├── services/          # Business logic and test helpers
│   │   ├── app.ts            # Express setup
│   │   └── server.ts         # Database connection and HTTP listener
│   ├── .env                  # Backend environment (not committed)
│   ├── jest.config.ts
│   └── package.json
├── frontend/
│   ├── public/locales/        # English and Hebrew translations
│   ├── src/
│   │   ├── components/        # Shared UI and rich text editor
│   │   ├── contexts/          # Page and entity state
│   │   ├── hooks/             # Query/mutation hooks and UI hooks
│   │   ├── pages/             # Screens
│   │   ├── services/          # API clients, uploads, PDF generation
│   │   ├── styles/
│   │   └── routes.ts          # Frontend route definitions
│   ├── vite.config.ts         # Vite and PWA configuration
│   └── package.json
├── shared/
│   ├── types/                 # Shared entity and response types
│   ├── services/
│   └── tsconfig.json
├── .env                       # Root environment (not committed)
├── Dockerfile                 # Full application build
└── package.json               # Development orchestration
```

## Prerequisites

- Node.js and npm. The repository does not pin a Node.js version with an `engines` field or version file; use a version compatible with the dependencies.
- A running MongoDB instance, either local or hosted, with access credentials if required.
- Git to clone the repository.
- VS Code with the `code` command on PATH if using the root `npm run dev` shortcut.
- Docker only if using the container workflow.

The existing backend npm scripts use Windows `set` syntax, except `prod-linux`. Windows PowerShell instructions are provided below; a Unix development alternative is included.

## Installation

Clone the repository and install the three sets of dependencies. The folders are separate packages; a root install alone does not install the frontend or backend.

```powershell
git clone https://github.com/EshelEyni/Roza.git
cd Roza
npm install
npm --prefix backend install
npm --prefix frontend install
```

For the existing checkout on this PC, start with `cd C:\dev\Roza` and run the install commands. The `shared` directory has no separate package installation step.

## Environment configuration

Create these two files and populate both with the same keys:

1. `Roza/.env` in the repository root.
2. `Roza/backend/.env` in the backend directory.

Example values for a local development setup:

```dotenv
DB_URL=mongodb://127.0.0.1:27017
LOCAL_DB_URL=mongodb://127.0.0.1:27017/roza_test
DEV_DB_NAME=roza_dev
PROD_DB_NAME=roza_prod
TEST_DB_NAME=roza_test
JWT_SECRET_CODE=replace-with-a-long-random-secret
JWT_EXPIRATION_TIME=7d
```

| Key | Purpose |
| --- | --- |
| `DB_URL` | MongoDB URL used by the application and remote test connections. Replace it with your hosted connection string if applicable. |
| `LOCAL_DB_URL` | Local test database URL. Include a dedicated test database name in the URL. |
| `DEV_DB_NAME` | Database selected when `NODE_ENV=development`. |
| `PROD_DB_NAME` | Database selected when `NODE_ENV=production`. |
| `TEST_DB_NAME` | Database selected for test mode and remote test connections. |
| `JWT_SECRET_CODE` | Private secret used to sign and verify authentication tokens. |
| `JWT_EXPIRATION_TIME` | JWT lifetime, such as `7d`. |

The application uses `dotenv.config()` without an explicit path, so it reads `.env` from the process working directory. The documented npm scripts launch the backend from `backend/` and load `backend/.env`; the root copy applies to launches from the repository root. Two files are the documented local convention, but a single backend process reads only the file in its working directory. Keep their settings in sync.

`NODE_ENV` is supplied by the backend scripts and need not be placed in these files when using those scripts. The server port is hardcoded to `3030`; there is no `PORT` environment setting. The frontend currently has no custom environment variables and does not require a frontend `.env`.

Both `.env` files are ignored by Git and excluded from the root Docker build context. Do not commit real credentials. There is currently no committed `.env.example`.

### Cloudinary configuration

Image uploads use the cloud name and upload preset defined in `frontend/src/services/cloudinary/cloudinaryService.ts`. These are currently hardcoded, rather than read from environment variables. To use your own Cloudinary account, configure an appropriate unsigned upload preset and update those two settings. Do not put a Cloudinary API secret in browser code.

## Running locally

Ensure MongoDB is available and the environment files are configured.

### Start frontend and backend separately

From the repository root, use two terminals:

```powershell
# Terminal 1: backend
npm --prefix backend run dev
```

```powershell
# Terminal 2: frontend
npm --prefix frontend run dev
```

Open `http://localhost:5173`. The backend listens at `http://localhost:3030`, with API routes under `/api/`. The backend uses nodemon to reload TypeScript changes, and Vite provides frontend hot reload.

Use `localhost` consistently: the development frontend API client explicitly calls `http://localhost:3030/api/`. The backend permits the configured development origins, including `http://localhost:5173`. If Vite chooses a different port because 5173 is occupied, free that port or update the backend CORS configuration.

### Start with the root shortcut

```powershell
npm run dev
```

This runs frontend and backend concurrently and opens VS Code windows for the backend, frontend, and translation directory. It requires the `code` command on PATH. Use the separate terminal commands if you do not want those editor windows.

### Unix backend development alternative

The Windows backend `dev` script is not portable to Unix shells. From `backend/`, use:

```bash
NODE_ENV=development npx nodemon
```

Run the frontend with `npm run dev` from `frontend/` in another terminal.

## Using the app

1. Open the home page and create an account, or log in with an existing account.
2. Open **Books** to create a writing project. Add chapters and supporting characters, themes, plotlines, or notes.
3. Edit rich text, switch to reading mode, or open a chapter to download its PDF.
4. Open **Reviews** to create a review collection. Add review text, references with page information, images, and structure notes.
5. Open **Profile** to edit account details, language preferences, or your password.

No seeded account is documented in the repository. Create an account through the signup form for a fresh database.

## Development commands

Run each command in the directory shown.

| Directory | Command | Purpose |
| --- | --- | --- |
| Root | `npm run dev` | Start both apps and open VS Code windows. |
| Root | `npm run dev:backend` | Open the backend in VS Code and start it. |
| Root | `npm run dev:frontend` | Open the frontend in VS Code and start it. |
| Root | `npm run dev:translate` | Open the locale directory in VS Code. |
| Frontend | `npm run build` | Type-check and build to `frontend/dist/`. |
| Frontend | `npm run lint` | Run ESLint. |
| Frontend | `npm run preview` | Preview a built frontend; this does not start the backend. |
| Backend | `npm run build` | Compile TypeScript to `backend/build/`. |
| Backend | `npm run server:main` | Start the explicit nodemon/ts-node development command. |
| Backend | `npm test` | Run Jest in watch mode, serially, with open handle detection. |
| Backend | `npm run prod` | Run compiled backend in production mode on Windows. |
| Backend | `npm run prod-linux` | Run compiled backend in production mode on Unix. |

The backend also defines `data-manipulation`, but its target `data/manipulation.ts` is not present in the checked-in source and should not be treated as a setup or seed command.

## Testing

Backend tests live alongside the services, models, middleware, controllers, and routers they cover. Some tests connect to MongoDB and delete collection contents during cleanup. Point test settings at a dedicated disposable database, never a development or production database containing real data.

The test helper requires `DB_URL`, `LOCAL_DB_URL`, and `TEST_DB_NAME`, even when using its default local connection. Local tests connect directly to `LOCAL_DB_URL`, so the database name in that URL determines which local database is used. Remote helper connections use `DB_URL` with `TEST_DB_NAME`.

```powershell
# From the repository root: one complete backend run
npm --prefix backend test -- --watchAll=false

# Include coverage
npm --prefix backend test -- --watchAll=false --coverage

# Frontend lint
npm --prefix frontend run lint
```

On Unix, run `NODE_ENV=test npx jest --runInBand --detectOpenHandles` from `backend/`, because the npm test script uses Windows syntax.

The frontend contains a Cloudinary test file but has no configured `test` script. There is no root-wide test command. These instructions describe existing commands; they do not imply that a fresh installation has passed all checks.

## Production build

Production Express serves frontend files from `backend/build/public/`, while Vite emits to `frontend/dist/`. Build the shared TypeScript project first and copy the frontend output into the backend static directory.

From the repository root on Windows PowerShell:

```powershell
# Use the backend's installed TypeScript compiler for shared types
.\backend\node_modules\.bin\tsc.cmd -b shared
npm --prefix backend run build
npm --prefix frontend run build
New-Item -ItemType Directory -Force backend/build/public
Copy-Item -Path frontend/dist/* -Destination backend/build/public -Recurse -Force
npm --prefix backend run prod
```

Use a clean output directory for a release so stale assets from earlier builds are not retained. The commands above copy new assets but do not remove old ones.

The production server serves both the UI and `/api/` on port 3030. The frontend uses relative `/api/` requests in production. Configure `PROD_DB_NAME` and production credentials before starting it. Production login cookies use the `secure` flag, so serve the deployed app through HTTPS, commonly using a reverse proxy.

`vite preview` is a frontend preview server, not the full production deployment. Production service worker and API behavior should be checked through the assembled application.

## Docker

The root `Dockerfile` builds the frontend and backend and copies frontend assets into the final server image. Run from the repository root:

```powershell
docker build -t roza .
docker run --rm --name roza -p 3030:3030 --env-file backend/.env roza
```

The image starts the backend with `NODE_ENV=production`; it uses `PROD_DB_NAME`. Supply production-appropriate environment values at runtime. MongoDB is external to the image; there is no checked-in Compose setup. Inside a container, `127.0.0.1` refers to that container. With Docker Desktop, a host MongoDB service can typically be reached through `host.docker.internal`, subject to its network settings.

The root Dockerfile uses a floating Node image tag and performs dependency installation during the build. Validate the image build and runtime before release. The separate `backend/Dockerfile` is not the full application workflow described here.

## Application routes and API

### Browser routes

| Route | Screen |
| --- | --- |
| `/home` | Home, login, and signup. |
| `/profile` | Profile and password settings. |
| `/books` | Book collection. |
| `/book/:id/:dataItemType?/:dataItemId?` | Book or individual content details. |
| `/book-edit/:id/:dataItemType?/:dataItemId?` | Book and content editor. |
| `/reviews` | Review collections. |
| `/review/:id` | Review collection details. |
| `/review-edit/:id` | Review collection editor. |

The root browser route redirects to `/home`. All listed screens except `/home` use the frontend authentication guard. Unknown routes render a page-not-found screen.

### API overview

| Base path | Main operations |
| --- | --- |
| `/api/auth` | Login, signup, logout, token login, profile update, password update, and token-based password reset route. |
| `/api/user` | User lookup, current-user updates/removal, and admin user management. |
| `/api/book` | List, retrieve, create, and update books. |
| `/api/book-review` | List, retrieve, create, and update review collections. |

Book and review updates use `PATCH /:id`. Archiving is represented by entity fields rather than dedicated delete routes. Consult `backend/src/routers/` and controllers for exact payloads and access checks; a frontend route guard does not establish API authorization. Responses use shared JSend-style response types in `shared/types/system.ts`.

## Development guide

- **Add a page:** create the page in `frontend/src/pages/`, then register it in `frontend/src/routes.ts`. Choose `authRequired` and a context provider if needed. Update navigation in `frontend/src/components/App/AppHeader.tsx` when the page needs a menu entry.
- **Add server behavior:** define routes, controllers, services, and models under their corresponding backend folders. Mount a new router in `backend/src/app.ts` and apply the required access checks.
- **Share data contracts:** update `shared/types/` when frontend and backend entity or response shapes change.
- **Add translations:** update both `frontend/public/locales/en/translation.json` and `frontend/public/locales/he/translation.json`. Check both layout directions.
- **Change API connectivity:** development and production base URLs are defined in `frontend/src/services/httpService.ts`; allowed development origins are in `backend/src/app.ts`.
- **Change caching:** edit `frontend/vite.config.ts`. API caching currently uses a network-first strategy with a 10-second timeout and a one-day maximum cache age. Consider account changes and sensitive responses when modifying this behavior.
- **Validate changes:** run the relevant backend tests, frontend lint, and affected builds. Check the user flow manually for UI changes.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `DB_URL URL is not defined` | Ensure `backend/.env` exists, has a nonempty `DB_URL`, and the backend starts from `backend/`. Restart after changing env files. |
| MongoDB connection fails | Check the URL, credentials, database service, network access rules, and selected database name. |
| Login or token errors | Set `JWT_SECRET_CODE` and a valid `JWT_EXPIRATION_TIME`. Changing the signing secret invalidates existing tokens. |
| `code` command is missing | Use the separate startup commands or add VS Code's CLI to PATH. |
| Frontend API/CORS errors | Ensure the backend runs on 3030 and the browser uses `http://localhost:5173`. Check the configured CORS origins. |
| Production UI is missing | Build the frontend and copy `frontend/dist/` into `backend/build/public/`. Start the server from `backend/`. |
| Production login does not persist over HTTP | Production cookies require HTTPS. |
| Image uploads fail | Check the Cloudinary cloud name, unsigned upload preset, and browser network response. |
| Tests affect unexpected data | Stop the tests and check the database name in `LOCAL_DB_URL` and remote test settings. |
| Old UI appears after a deployment | Check the browser service worker and cached assets; reload or clear the site's service worker/cache during diagnosis. |
| Shared project output is missing during a build | Compile `shared/` using the backend TypeScript compiler before building the backend. |

## License

The backend package declares `ISC`, but the repository does not include a standalone license file defining terms for the entire application. Confirm the intended repository-wide license with the owner before redistribution.

## EPUB Reader preview

The private Reader library supports DRM-free reflowable EPUBs up to 25 MiB. Files are stored in MongoDB GridFS; no S3 credentials or AI API key are required for upload and reading.

Enable it in `backend/.env` (and keep the root copy in sync if used):

```dotenv
READER_ENABLED=true
READER_ALLOWED_USER_IDS=your-roza-user-object-id
```

The feature is disabled by default. Use the relevant account IDs for each environment; multiple IDs can be comma-separated. These are Roza MongoDB user IDs, not usernames or GitHub IDs. Restart the backend after changing environment settings. The backend checks both the flag and user allowlist for every Reader operation and checks file/state ownership. Unauthorized users do not see Reader navigation.

Open **Reader** to upload an EPUB, then open a library card to read. The reader supports contents navigation, page buttons/arrow keys, continuous scrolling, text size, fonts, spacing, width, page colors, and fullscreen. Reading location and settings save to the database; an unsynced indicator offers retry, with browser-local recovery for pending changes. Original uploads and sanitized reading copies are kept private. Hebrew dictionary lookup and automatic vocabulary saves are available; AI chat is a future step.

Use the reader search button to find words or phrases across the book. The search panel shows the total number of matches and loads excerpts in batches of 25 as you scroll. Selecting a result opens and highlights its exact text location. Where the EPUB supplies published page numbers, those are shown; otherwise results use stable book locations and chapter names.

Drag the footer progress thumb to jump through the book, or focus it and use the arrow keys, Home, or End. Seeking becomes available after the book location map is ready, works in both reading modes, and saves the resulting reading position.

See [the Reader PRD](docs/epub-reader-prd.md) for the complete product scope.

### Hebrew dictionary and vocabulary

Select one English word in the reading text, then choose **Look up in Hebrew** from the compact selection menu. The dictionary card shows the English word, Hebrew meanings and a pronunciation button. Expand **More meanings, explanations & examples** for the information available in the dataset. Press Escape, use the close button, or click back in the book to dismiss it.

Lookups use bundled Wiktionary data as the primary source and Princeton WordNet 3.0 / Hebrew WordNet as a fallback: 17,558 supported English headwords in total, plus attested inflected forms. Source attribution, licenses and the snapshot checksum are retained. Coverage is still incomplete: some words and literary senses have no Hebrew translation. Missing words are explicitly reported and are not saved; there is no paid translation or AI fallback. Meanings are dictionary senses, not automatic context-specific translations. Pronunciation uses the browser's speech synthesis and an installed English voice; an unavailable-voice message appears when speech cannot be provided. No new environment variables or API keys are required.

Each successful deliberate lookup saves a private vocabulary entry in MongoDB. Entries are grouped by normalized English headword and retain the observed forms, book IDs, dictionary senses, first/last lookup dates and lookup count. Lookup events retain the book and selected EPUB CFI. Attested irregular forms and verified regular stems can share a headword. Request IDs make retries idempotent; expanding details and playing pronunciation do not increase the count. Vocabulary browsing, export and AI chat remain future steps.

Dictionary assets and full third-party notices live in `backend/dictionary/`; see its [source and rebuilding notes](backend/dictionary/README.md). Keep that directory alongside `backend/build/` in deployments. The production Docker image copies it automatically. The dictionary is loaded once by the backend, and the browser receives only the requested entry. Restart the backend after replacing the dataset.
