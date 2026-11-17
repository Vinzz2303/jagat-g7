---
name: motion-master
description: Applies highly premium, subtle, and fluid micro-animations (Apple/Vercel standard).
---

# Motion Master (Interaction & Animation Skill)

When building interactive UI elements (Modals, Drawers, Toasts, Dropdowns) in this workspace, follow these strict animation guidelines:

1. **Subtlety is Key**: Animations must never feel sluggish or exaggerated. Prioritize speed and fluidity (e.g., duration 0.2s - 0.3s).
2. **Spring Physics**: Whenever possible, use spring-based physics instead of linear easing. This makes the UI feel alive and organic.
3. **Micro-interactions**: 
   - Add subtle scale-down effects on buttons when clicked (`active:scale-95`).
   - Use layout animations when lists reorder or items are removed.
4. **Tooling**: Prefer `framer-motion` for complex orchestration (like staggered list entries or layout transitions) or Tailwind's built-in `transition-all duration-200 ease-out` for simple hover states.
