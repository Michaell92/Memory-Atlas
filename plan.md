# 🌍 Memory Atlas

> A cinematic 3D travel memory system. Not a map app — a memory universe on a globe.

---

## Vision

Users explore a glowing Earth, zoom into cities, and unlock personal travel memories — photos, videos, notes — tied to real places.

---

## Core Experience

| Feature | Description |
|---|---|
| 🌐 Interactive 3D Earth | Smooth rotation, pinch/scroll zoom |
| ✨ Cinematic lighting | Night lights, atmosphere glow, bloom |
| 📍 Memory markers | Visited locations glow on the globe |
| 🎬 Memory scene | Click a marker → photo/video/note timeline |
| 🔒 Unvisited places | Locked and darkened until you've been there |
| 🚀 Space view *(future)* | Zoom all the way out to orbit |

---

## Roadmap

### Phase 1 — The Globe
- [x] Rotating Earth with day/night texture
- [x] Zoom in/out
- [x] Clickable surface via raycasting
- [ ] Simple memory markers

### Phase 2 — Memories
- [x] Memory modal (photos, videos, notes)
- [x] Smooth GSAP camera transitions
- [ ] Glow effect for visited places

## Current Progress

### Globe Systems
- [x] Three.js globe scene is live with orbit/zoom camera controls
- [x] Day/night readable Earth shading is working with emissive limited to the shadow side
- [x] Atmosphere glow, bloom, starfield, cosmic effects, and shooting stars are in place
- [x] Country detection works from raycast hits via topojson + d3-geo
- [x] City detection flow is wired so clicks can open either a city or country memory scope
- [ ] Dedicated visited marker layer on the globe still needs a proper final implementation

### Memory Systems
- [x] Memory modal exists and supports country scope and city scope
- [x] Memory cards support inline editing for title, notes, rating, date, media, and delete
- [x] Memory data persists in local storage
- [x] Memories are scoped per logged-in user instead of being shared globally
- [x] Searchable country/city memory creation exists inside the profile screen

### User Systems
- [x] Local registration and login are built
- [x] Logged-in user button exists in the top-right corner
- [x] User mini menu opens from the name button
- [x] Profile panel exists and shows the user's memory collection
- [x] Settings panel exists and persists locally
- [x] Theme, brightness, nickname, year of birth, and home country are wired through the user store
- [x] Theme and brightness settings affect the app shell and globe appearance

### Current UI Notes
- [x] User panel shell with Profile and Settings tabs is in place
- [x] Profile screen currently includes memory stats, memory creation, collection cards, and search
- [ ] Profile screen still needs final polish and cleanup after recent back-and-forth changes
- [ ] Some user-facing text and panel details may still need refinement for consistency

### Next Likely Work
- [ ] Final visited memory marker layer on the globe
- [ ] Route visualization / travel path layer
- [ ] Space zoom-out layer
- [ ] Backend auth and persistence integration
- [ ] Further cleanup and polish of the User module UI after requirements settle

### Phase 3 — Polish
- [ ] Travel route visualization
- [ ] Space zoom-out layer
- [ ] Bloom, atmospheric glow, and depth-of-field effects

---

## Design Philosophy

> **Cinematic over geographic precision. Feel over realism.**
>
> **This should be FUN.** Memory Atlas is a *playful* experience, not a chore.
> Every interaction should reward the user — micro-animations, satisfying
> sounds, glowing feedback, hidden easter eggs, unlock streaks, badges for
> continents/countries explored, "first visit" celebrations. Gamify the act
> of remembering.

- This is a *memory planet*, not a GIS tool
- Every visual effect must earn its GPU cost
- If it doesn't feel like *"I'm holding my travel memories as a glowing planet"* — it's not done

---

## Engineering Principles

### ✅ Do
- Prioritize architecture stability over quick hacks
- Keep the rendering pipeline simple and predictable
- Optimize for mobile performance first
- Justify every visual effect with a measurable feel improvement

### ❌ Don't
- Stack postprocessing effects before MVP is solid
- Use 8K textures or raw PNG spam
- Introduce heavy systems before the core feel is validated
- Render markers in the DOM — use `InstancedMesh`
- Optimize prematurely before visuals are validated
