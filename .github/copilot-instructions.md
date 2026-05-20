# Memory Atlas — Copilot Instructions

## Project Overview

**Memory Atlas** is a cinematic 3D travel memory app. Users explore a glowing interactive Earth, click on cities they've visited, and unlock personal memories (photos, videos, notes). It is NOT a map/GIS app — it is a memory experience built around a globe.

Every detail matters. We need to implement things the right way from the start to achieve the immersive, magical feeling of "holding your travel memories as a glowing planet."
---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Vue 3.6 with **Vapor mode** |
| 3D rendering | Three.js |
| Animations / transitions | GSAP |
| Post-processing | `postprocessing` library — Bloom only (initially) |
| Styling | SCSS / scoped component styles |
| Mobile shell *(later)* | Capacitor |
| Backend *(later)* | Node.js, PostGIS (optional) |

---

## Architecture

### 3D Scene Structure
- **Earth**: `SphereGeometry` with high-quality day/night texture, atmosphere rim shader, optional cloud layer
- **Starfield**: Background particle system with realistic star textures and solar system anatomy
- **Markers**: `InstancedMesh` — never DOM elements
- **Camera**: Smooth orbital controls with inertia; GSAP-driven cinematic transitions (globe → continent → city → marker zoom)

### Interaction Flow
1. User clicks/taps the globe
2. Raycaster converts 3D hit point → lat/lng
3. Check if a memory marker exists at that location
4. If yes → trigger GSAP camera zoom → open Memory Scene UI

### Memory Data Model
```ts
interface Memory {
  id: string
  lat: number
  lng: number
  city: string
  country: string
  media: string[]   // URLs to photos/videos
  notes: string
  visitedAt: string // ISO date
}
```

---

## Performance Rules

These are non-negotiable constraints:

- Keep **draw calls low** — batch geometry where possible
- Use **texture compression** — no raw uncompressed PNGs
- Use **`InstancedMesh`** for all globe markers
- **Bloom only** for post-processing initially — do not stack effects
- Avoid **unnecessary Vue re-renders** inside the animation loop
- No **8K textures** — use 4K max, compressed

---

## Code Conventions

- Vue components use **Composition API** + `<script setup>` + TypeScript
- Styles use **SCSS** — always `<style lang="scss" scoped>` in components
- SCSS variables and mixins live in `src/styles/` and are auto-imported via `vite.config.ts` (`additionalData`)
- Three.js scene logic lives in **composables** (`use*.ts`), not in components
- GSAP timelines are created in composables, not inline in templates
- No business logic inside `.vue` template blocks
- Styles use **rem units** (1rem = 16px)
- Always write `<template>` first, then `<script setup>`, then `<style>`
- Never define interfaces or types inside `.vue` files — place them in the domain's `types/` folder or `src/shared/types/`
- NEVER write shorthands for variables or functions — be explicit for readability (e.g., `const globeScene = useGlobeScene()`, not `const gs = useGlobeScene()`)

---

## Global Architecture: Domain-Driven Folder Structure

Each business domain (e.g., `Globe`, `Memory`) is fully self-contained under `/src/modules`. A module holds everything related to that domain: views, components, composables, types, services, stores, utils, assets, and tests — all colocated for easy navigation and refactoring.

Teams can own specific domains. Domains can be removed without cross-cutting surgery. Similar to micro-frontends, but separated by folders, not packages.

`/src/shared` is for code used by 2+ modules: reusable components, composables, helpers, interfaces, enums, and services. If a module needs another module's file, import it directly (e.g., `@/modules/Memory/types/memory.types`). Keep dependencies explicit.

```
/src
├─ /modules
│
│  ├─ /Globe
│  │  ├─ /components
│  │  │  └─ GlobeMarker.vue
│  │  ├─ /composables
│  │  │  ├─ useGlobeScene.ts
│  │  │  ├─ useGlobeCamera.ts
│  │  │  └─ useGlobeRaycaster.ts
│  │  ├─ /services
│  │  │  └─ GlobeRenderer.ts
│  │  ├─ /types
│  │  │  └─ globe.types.ts
│  │  ├─ /utils
│  │  │  └─ latLngTo3D.ts
│  │  ├─ /assets
│  │  └─ /tests
│  │     ├─ latLngTo3D.spec.ts
│  │     └─ useGlobeScene.spec.ts
│  │
│  └─ /Memory
│     ├─ /views
│     │  └─ MemoryView.vue
│     ├─ /components
│     │  ├─ MemoryCard.vue
│     │  ├─ MemoryModal.vue
│     │  ├─ MemoryTimeline.vue
│     │  └─ MemoryMediaGrid.vue
│     ├─ /composables
│     │  └─ useMemoryScene.ts
│     ├─ /stores
│     │  └─ memoryStore.ts
│     ├─ /types
│     │  └─ memory.types.ts
│     ├─ /utils
│     │  └─ memoryHelpers.ts
│     ├─ /assets
│     └─ /tests
│        ├─ memoryHelpers.spec.ts
│        └─ memoryStore.spec.ts
│
├─ /shared
│  ├─ /components
│  │  └─ AppLoader.vue
│  ├─ /composables
│  ├─ /services
│  ├─ /stores
│  ├─ /types
│  ├─ /utils
│  ├─ /assets
│  └─ /views
│     └─ NotFoundView.vue
│
├─ /router
│  └─ index.ts
│
└─ /assets
```

---

## File Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Types | `{domain}.types.ts` | `memory.types.ts`, `globe.types.ts` |
| Services | `PascalCase.ts` | `GlobeRenderer.ts` |
| Stores | `camelCase.ts` | `memoryStore.ts` |
| Utils / Config | `camelCase.ts` | `latLngTo3D.ts`, `memoryHelpers.ts` |
| Components | `PascalCase.vue` | `MemoryCard.vue`, `GlobeMarker.vue` |
| Composables | `use{Name}.ts` | `useGlobeScene.ts`, `useMemoryScene.ts` |
| Tests | `{source}.spec.ts` | `memoryStore.spec.ts`, `latLngTo3D.spec.ts` |

---

## What NOT to Do

- Do not render markers as DOM overlays — always `InstancedMesh` in Three.js
- Do not add postprocessing effects (SSR, DOF, chromatic aberration, etc.) before Phase 3
- Do not use 8K or uncompressed textures
- Do not introduce a backend before the 3D frontend is working
- Do not over-engineer shaders early — keep GLSL simple until Phase 2 is solid

---

## Design North Star

> *"If it doesn't feel like I'm holding my travel memories as a glowing planet — it's not done."*

Cinematic feel > geographic precision.

**The app must be FUN.** Gamify the experience: reward exploration with
micro-animations, glow feedback, unlock states, streaks, badges (countries
visited, continents conquered), "first time here" celebrations, and hidden
easter eggs. Every interaction should feel playful and earned — never
utilitarian.
