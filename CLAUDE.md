# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a SolidStart + Firebase project implementing an **ICFPC 2025 Ædificium Explorer** for the International Conference on Functional Programming Contest 2025. The project provides a web interface to interact with the ICFPC 2025 API for exploring labyrinths. It combines:

- **Frontend**: Solid.js (SolidStart) with client-side rendering (SSR disabled)
- **Backend**: Firebase (Firestore, Auth, Functions, Hosting)
- **Development**: Local Firebase emulators for development
- **Contest Integration**: Firebase Functions to call ICFPC 2025 API endpoints

## Development Commands

### Primary Development Workflow

```bash
npm run dev
```

This runs the full development stack concurrently:

- SolidStart dev server (frontend)
- Firebase emulators (Firestore, Auth, Functions, Hosting)
- Firebase Functions build in watch mode

### Individual Services

- `npm run dev:server` - SolidStart development server only
- `npm run dev:firebase` - Firebase emulators only
- `npm run functions:build:watch` - Functions TypeScript compilation in watch mode

### Build and Deploy

- `npm run build` - Build the frontend application
- `firebase deploy` - Deploy to Firebase (production)

### Code Quality

- `npm run lint` - Run Biome linter with auto-fix
- `npm run format` - Run Biome formatter
- `npm run fix` - Format then lint with unsafe fixes

### Testing

- `npm test` - Run full test suite (starts emulators + Vitest)
- `npm run test:vitest` - Run Vitest tests only (requires emulators running)

## Architecture

### Frontend Structure

- **Entry Points**: `src/entry-client.tsx`, `src/entry-server.tsx`
- **App Root**: `src/app.tsx` - Sets up FirebaseProvider and router
- **Routes**: File-based routing in `src/routes/`
- **Firebase Integration**: `src/lib/firebase.ts` - Firebase app initialization and emulator connection
- **Utilities**: `src/lib/Collection.tsx`, `src/lib/Doc.tsx` - Firebase data binding components

### Firebase Configuration

- **Emulator Ports**: Firestore (8080), Auth (9099), Functions (5001), Hosting (5000)
- **Functions**: TypeScript-based in `functions/` directory
- **Database**: Firestore with anonymous authentication
- **Hosting**: Static files served from `.output/public` after build

### Key Dependencies

- **SolidJS**: `solid-js`, `@solidjs/start`, `@solidjs/router`
- **Firebase**: `firebase`, `solid-firebase` for reactive bindings
- **Build**: `vinxi` (Vite-based), `vite-plugin-solid`
- **Code Quality**: Biome for linting/formatting
- **Testing**: Vitest with `@solidjs/testing-library`

### TypeScript Configuration

- Main config: `tsconfig.json`
- Functions have separate TypeScript compilation
- Firebase module aliasing configured in `app.config.ts` to resolve ESM issues

### Development Notes

- Project requires Node.js 22+
- Firebase emulators must be running for tests
- Anonymous auth is automatically configured in development
- CSS modules are used for component styling
- Husky pre-commit hooks ensure code quality

## ICFPC 2025 Integration

### Contest Details

- **Challenge**: Explore ædificium (labyrinth) by testing route plans
- **API Base URL**: `https://31pwr5t6ij.execute-api.eu-west-2.amazonaws.com`
- **Team ID**: `info@tsg.ne.jp f0iku9r_xs5Fge6Mb5L-cw` (hard-coded in functions)
- **Documentation**: Available in `docs/task.html` and `docs/task_from_tex.html`

### API Workflow

The ICFPC API requires a **two-step process**:

1. **Problem Selection** (`POST /select`)

   - Must be called before exploring
   - Selects a problem by name (e.g., "probatio", "primus", etc.)
   - Request: `{id: teamId, problemName: string}`
   - Response: `{problemName: string}`

2. **Exploration** (`POST /explore`)
   - Only works after selecting a problem
   - Submits route plans for testing
   - Request: `{id: teamId, plans: string[]}`
   - Response: `{results: number[][], queryCount: number}`

### Route Plans Format

- Strings of digits 0-5 representing door numbers
- Example: `"0325"` means enter door 0, then 3, then 2, then 5
- Multiple plans can be submitted as comma-separated values
- Maximum length: 18n doors where n = number of rooms

### Available Problems

Problems are defined in `docs/problems.json`:

- **probatio**: 3 rooms (test problem)
- **primus**: 6 rooms
- **secundus**: 12 rooms
- **tertius**: 18 rooms
- **quartus**: 24 rooms
- **quintus**: 30 rooms

### Firebase Functions

- **`exploreAedificium`**: Callable function that handles the complete API workflow
  - Automatically selects the specified problem
  - Then explores with provided route plans
  - Located in `functions/src/index.ts`
  - Includes comprehensive error handling and logging

## Application Structure

### Route Organization

The application is organized with a clear separation between different tool categories:

- **`/`** - Landing page with navigation to available tools
- **`/submit/`** - Tools that communicate with the actual ICFPC API server
  - `/submit/explore` - Library exploration tool (implemented)
- **`/simulator/`** - Local simulation tools (planned for future implementation)
- **`/admin`** - Administrative interface

### Frontend Interface Features

- **Japanese UI**: All interface text is in Japanese
- **Problem Dropdown**: Dynamic selection from `problems.json`
- **Route Plans Input**: Comma-separated route plan strings with real-time validation
- **Results Display**: Shows exploration results with query count
- **JSON Export**: Raw JSON display with copy-to-clipboard functionality
- **Error Handling**: User-friendly error messages in Japanese
- **Real-time Validation**: Ensures route plans contain only digits 0-5

### File Structure

#### Routes
- `src/routes/index.tsx` - Landing page with tool navigation
- `src/routes/submit/explore.tsx` - ICFPC API exploration interface
- `src/routes/admin.tsx` - Administrative interface

#### Styles
- `src/routes/index.module.css` - Landing page styles
- `src/routes/submit/explore.module.css` - Exploration tool styles

#### Backend
- `functions/src/index.ts` - Firebase functions including API integration

#### Documentation & Data
- `docs/problems.json` - Available problems list
- `public/docs/problems.json` - Copy for web access
- `docs/task.html` - Contest task documentation
- `docs/task_from_tex.html` - Additional task documentation
