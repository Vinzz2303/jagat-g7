---
name: react-mastery
description: Applies best practices for modern React development using Vite, TypeScript, and functional components.
---

# React Mastery (Frontend Engineering Skill)

When building or refactoring React components in this workspace, strictly adhere to these practices:

1. **Component Modularity**: Keep components small, focused, and single-purpose. Break down massive files.
2. **TypeScript Strictly**: Always type your props and state interfaces. Avoid `any` whenever possible.
3. **Hooks over Classes**: Exclusively use functional components and hooks (`useState`, `useEffect`, custom hooks).
4. **State Management**: Keep state as localized as possible. Lift state up only when siblings need to share it.
5. **Tailwind Best Practices**: Use `clsx` and `tailwind-merge` for dynamic class names to avoid specificity conflicts. Avoid deeply nested custom CSS if Tailwind utilities suffice.
