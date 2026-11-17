---
name: frontend-architect
description: Applies scalable, maintainable, and highly performant React architecture patterns.
---

# Frontend Architect Skill

When designing new features or complex components:
1. **Container vs Presentational**: Clearly separate data-fetching/logic (Containers) from pure UI rendering (Presentational).
2. **State Colocation**: Push state as far down the component tree as possible. Only elevate to global context if absolutely necessary.
3. **Compound Components**: For complex UI like Modals or Drawers, use compound component patterns (e.g., `Modal`, `Modal.Header`, `Modal.Body`) for maximum flexibility.
4. **Performance**: Prevent unnecessary re-renders using `useMemo` and `useCallback` only when the computational cost or prop-drilling depth justifies it.
