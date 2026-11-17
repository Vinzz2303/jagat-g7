---
name: form-wizard
description: Manages complex multi-step forms with validation, auto-save (draft), and animated progress state. Designed for government/enterprise application forms like scholarship, tax, or permit applications.
---

# Form Wizard Skill

When building multi-step forms in this workspace:

1. **Step Isolation**: Each step is its own component (`StepOne`, `StepTwo`, etc.). The parent wizard holds shared state and step index only.
2. **Auto-Save as Draft**: On every `next` step transition, persist the current partial data to the API as `status: "DRAFT"`. This ensures data survives a browser close/refresh.
3. **Animated Step Transitions**: Use `framer-motion` `AnimatePresence` with `x` slide transitions (next → slide left, back → slide right) so each step "slides" into view like a native app.
4. **Progress Bar**: Show a clear top-of-form progress indicator (e.g., `Step 2 of 4`) using a filled bar that animates width via `motion.div`.
5. **Validation per Step**: Validate only the current step's fields before advancing. Do NOT validate all fields upfront.
6. **Required Field Indicators**: Mark required fields with a red asterisk (`*`) and show inline error messages below each field using `<AnimatePresence>` for smooth error appearance.
7. **Review Step**: The final step must be a read-only summary of all data entered, allowing the user to go back and fix anything before final submission.
