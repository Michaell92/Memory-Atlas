# Memory Atlas

🌍 Travel Globe App
Vision

A cinematic 3D travel memory system.
Users explore a glowing Earth, zoom into cities, and unlock personal travel memories (photos, videos, notes).

Not a map app.
A memory universe on a globe.

- Architected following a DDD (Domain-Driven Design) approach — each business domain is a self-contained module
- Core graphics rendered with Three.js and GPU-accelerated rendering where needed like requestAnimationFrame
for css transforms

Uses latest Vue 3.6 with Vapor mode as of now.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Run End-to-End Tests with [Cypress](https://www.cypress.io/)

```sh
npm run test:e2e:dev
```

```sh
npm run build
npm run test:e2e
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
