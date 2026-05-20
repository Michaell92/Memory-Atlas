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
- [ ] Rotating Earth with day/night texture
- [ ] Zoom in/out
- [ ] Clickable surface via raycasting
- [ ] Simple memory markers

### Phase 2 — Memories
- [ ] Memory modal (photos, videos, notes)
- [ ] Smooth GSAP camera transitions
- [ ] Glow effect for visited places

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
