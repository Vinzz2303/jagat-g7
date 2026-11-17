---
name: performance-tuner
description: Focuses on optimizing React applications for speed, minimal chunk sizes, and smooth perceived performance.
---

# Performance Tuner Skill

1. **Code Splitting**: Route-level components MUST be lazy-loaded using `React.lazy()` and wrapped in `<Suspense>` to reduce the main JS bundle size.
2. **Skeleton Loaders**: Provide beautiful, pulsating skeleton UI fallbacks while lazy-loaded components or data are being fetched.
3. **Memoization**: Prevent unnecessary re-renders in heavy components (like tables and maps) if data hasn't changed.
