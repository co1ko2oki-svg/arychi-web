# RULE.md — Development Standards & UI Quality

## 1. CORE PRINCIPLES

You must follow every rule in this document throughout the entire development process.

- Prioritize correctness, maintainability, usability, and code quality over coding speed.
- Never skip development steps to reach the final result faster.
- Never make assumptions about the codebase without inspecting the relevant files.
- Never implement a quick workaround when a proper solution is required.
- Never sacrifice existing functionality to simplify implementation.
- Complete the actual task instead of producing a superficial demonstration.
- Do not introduce unnecessary features, dependencies, abstractions, or files.
- Do not stop at a plan when the task requires actual implementation.

## 2. STRICT DEVELOPMENT WORKFLOW

Follow these steps in order. Do not skip, merge, or bypass steps merely to save time.

### Step 1 — Inspect the Existing Project

Before writing or modifying code:

- Read the project structure and identify the application architecture.
- Inspect the relevant source files, components, routes, services, and configurations.
- Understand how the existing implementation works and how its parts interact.
- Identify the current framework, libraries, coding conventions, and dependencies.
- Check for existing reusable components before creating new ones.
- Identify potential regressions and dependencies that could be affected by the changes.

Never modify files based on filenames alone when the implementation needs to be understood.

### Step 2 — Identify the Actual Problem

- Determine the root cause before attempting a fix.
- Separate confirmed problems from assumptions.
- Understand the expected behavior before changing the implementation.
- Identify affected components, user flows, and integration points.
- Keep the scope limited to the requested task.

Do not rewrite unrelated parts of the project just because you notice an opportunity to refactor them.

### Step 3 — Establish an Implementation Approach

- Determine the correct implementation strategy based on the existing architecture.
- Reuse established patterns when they are appropriate.
- Break complex tasks into logical, verifiable steps.
- Identify important edge cases before implementation.
- Consider error handling, loading states, empty states, and failure scenarios where applicable.

Do not create unnecessary planning documents. Keep the plan concise and use it to guide the actual implementation.

### Step 4 — Implement Properly

- Implement the solution in logical stages.
- Finish each logical part before moving to dependent functionality.
- Preserve existing behavior unless the task explicitly requires changing it.
- Use clear naming, appropriate types, consistent formatting, and sensible component boundaries.
- Avoid duplicated logic and unnecessary complexity.
- Keep components, functions, and modules focused on their intended responsibilities.
- Do not leave placeholder implementations, fake data, dead code, or unfinished functionality in the final result unless explicitly requested.
- Never claim that a feature works without verifying its implementation.

### Step 5 — Verify Every Important Change

After implementation:

- Run the relevant tests and available validation commands.
- Check TypeScript, linting, formatting, and build output where applicable.
- Verify affected routes, components, API integrations, and user interactions.
- Check browser console errors and runtime failures when the environment permits.
- Test relevant edge cases and failure states.
- Fix errors introduced by the changes before considering the task complete.

If a test cannot be executed, clearly identify the limitation instead of pretending it passed.

### Step 6 — Final Review

Before finishing:

- Review the final changes for correctness and unnecessary complexity.
- Remove unused imports, temporary debugging output, and accidental test artifacts.
- Ensure existing functionality has not been unnecessarily removed.
- Confirm that the requested result has actually been implemented.
- Report what changed and what verification was performed.

Do not declare completion while known implementation errors remain unresolved.

## 3. CLEAN CODE — NO UNNECESSARY COMMENTS

Write clean, self-explanatory code.

- Do not add comments that simply repeat what the code already says.
- Do not add comments to every function, variable, component, or block.
- Do not write unnecessary explanations inside source files.
- Do not leave AI-generated commentary, TODO notes, implementation diaries, or conversational text in production code.
- Do not add decorative section separators or excessive headings inside source files.
- Do not create README files, Markdown notes, or documentation files unless they are required by the task.
- Do not leave commented-out code, abandoned implementations, or unused debugging helpers.
- Prefer descriptive names and straightforward logic over comments explaining confusing code.

Comments are allowed only when they provide meaningful information that cannot be understood easily from the implementation, such as a non-obvious algorithm, important constraint, security consideration, or compatibility requirement.

**The goal is code that explains itself through its structure, naming, and implementation.**

## 4. ANTI-AI-GENERATED WEB DESIGN RULES

When developing or redesigning a website, do not rely on generic AI-generated design patterns.

The result must look like a carefully designed product created by an experienced human frontend developer, not a template assembled from common UI trends.

### 4.1. Avoid Generic AI Design

Do not automatically use:

- Purple-to-blue gradients across the entire interface.
- Glowing borders, excessive neon, or glassmorphism without a clear design reason.
- Excessive rounded cards containing every piece of information.
- Repeated card grids for content that does not need cards.
- Oversized headings and oversized empty hero sections.
- Random decorative circles, floating shapes, or meaningless background effects.
- Excessive shadows, blur effects, and animated elements.
- Emoji as substitutes for professional interface icons.
- Generic dashboard layouts with meaningless statistics and charts.
- Identical section structures repeated throughout every page.
- Unnecessary badges, pills, labels, and decorative status indicators.
- Random spacing, inconsistent border radii, and excessive empty space.
- Unnecessary animations that make the interface feel artificial.

These elements are not universally forbidden. Use them only when they serve the product's visual identity or improve usability.

### 4.2. Design With Intent

Before implementing the interface, understand:

- What the product does.
- Who will use it.
- What users need to accomplish.
- Which information is most important.
- Which actions users perform most frequently.
- What visual style suits the product's purpose.

Build a coherent visual system instead of styling each component independently.

Define and consistently apply:

- Typography and font hierarchy.
- Spacing and layout rules.
- Color palette and contrast.
- Component sizes and interaction states.
- Border styles, radii, and shadows.
- Icon style and sizing.
- Responsive breakpoints.

Every major visual decision must serve readability, hierarchy, usability, or brand identity.

### 4.3. Create a Distinctive Interface

- Design around the actual product instead of forcing it into a generic template.
- Give each page a layout appropriate to its content and purpose.
- Use visual hierarchy to guide attention naturally.
- Make important actions easy to discover without making every element visually dominant.
- Prefer precise alignment, balanced proportions, and deliberate spacing.
- Use typography, content structure, and layout to create visual character.
- Use colors with restraint and maintain consistent contrast.
- Use existing brand assets, product imagery, and visual references when available.
- Avoid decorative elements that do not contribute to the experience.
- Keep the interface visually distinctive without sacrificing clarity.

Do not redesign everything from scratch when the existing design already contains useful components or established brand conventions.

### 4.4. Realistic Product Quality

The interface must feel like a functional product, not a static mockup.

- Use realistic content appropriate to the application.
- Connect controls to actual functionality whenever the required backend or integration exists.
- Do not use fake statistics or fabricated activity to make the interface appear complete.
- Provide meaningful loading, empty, success, and error states.
- Use appropriate feedback after user actions.
- Make navigation, forms, dialogs, menus, and buttons behave predictably.
- Ensure that content density is appropriate to the page's purpose.
- Do not hide essential information behind unnecessary interactions.

## 5. USER EXPERIENCE — EASY TO USE

The user must be able to understand and use the interface without unnecessary effort.

### Navigation

- Use clear, recognizable navigation labels.
- Organize features according to how users think about their tasks.
- Keep frequently used actions accessible.
- Avoid excessive navigation levels and confusing menu structures.
- Make the current page or active navigation item easy to identify.

### Layout and Information

- Present the most important information first.
- Group related information logically.
- Avoid overwhelming users with too many elements at once.
- Use appropriate content density instead of filling every area with cards.
- Maintain readable text sizes and comfortable line lengths.
- Keep forms concise and label fields clearly.
- Use familiar interaction patterns unless the product has a strong reason to do otherwise.

### Interaction

- Buttons must communicate their purpose clearly.
- Destructive actions must be distinguishable from ordinary actions.
- Forms must validate input and explain errors clearly.
- Interactive elements must have appropriate hover, focus, active, disabled, and loading states.
- Prevent accidental duplicate submissions when relevant.
- Provide clear confirmation or feedback after important actions.
- Avoid interactions that require users to guess what happens next.

### Accessibility

- Use semantic HTML and appropriate ARIA attributes where needed.
- Support keyboard navigation for interactive elements.
- Maintain sufficient text and interface contrast.
- Associate form labels with their corresponding inputs.
- Provide visible focus indicators.
- Use meaningful alternative text for informative images.
- Do not rely on color alone to communicate important information.

## 6. RESPONSIVE DESIGN

Every web interface must work properly across supported screen sizes.

- Design for desktop, tablet, and mobile instead of shrinking a desktop layout.
- Prevent horizontal overflow and clipped content.
- Adapt navigation and content hierarchy to smaller screens.
- Ensure buttons and interactive targets are comfortable to use on touchscreens.
- Keep forms, tables, dialogs, and menus usable on mobile.
- Maintain consistent spacing and readable typography across breakpoints.
- Test important layouts at representative viewport widths.

Do not consider responsive design complete simply because the page technically fits on a mobile screen.

## 7. COMPONENTS AND ARCHITECTURE

- Follow the existing project architecture unless there is a concrete reason to change it.
- Reuse components when their behavior and visual purpose are genuinely shared.
- Avoid creating components for trivial fragments that do not benefit from separation.
- Avoid oversized components responsible for unrelated functionality.
- Separate UI presentation from business logic when appropriate.
- Keep API communication, data processing, and state management organized.
- Use shared design tokens or existing theme configuration when available.
- Avoid duplicated styles and conflicting CSS rules.
- Do not introduce a new library when existing project capabilities are sufficient.
- Keep dependencies compatible with the current framework and runtime.

Do not over-engineer simple features or compress complex functionality into unreadable code.

## 8. BUG FIXING AND REGRESSION PREVENTION

When fixing an existing issue:

- Reproduce or understand the reported problem before changing code.
- Identify the root cause rather than masking the visible symptom.
- Make the smallest complete change that correctly resolves the issue.
- Check related functionality that may be affected.
- Preserve existing API contracts, data formats, and user workflows unless changes are required.
- Do not silently remove features to eliminate errors.
- Do not suppress errors simply to make logs appear clean.
- Add or update tests when appropriate and practical.

Do not turn a narrowly scoped bug fix into an unrelated redesign or refactor.

## 9. SECURITY AND DATA INTEGRITY

- Never expose secrets, API keys, passwords, private tokens, or credentials in frontend code.
- Validate untrusted input at the appropriate system boundaries.
- Apply authorization checks on the server, not only in the interface.
- Handle errors without leaking sensitive internal information.
- Preserve data integrity during updates, migrations, and destructive operations.
- Do not weaken authentication or security checks to make a feature appear functional.
- Never use fabricated success responses to conceal failed operations.

## 10. PROHIBITED SHORTCUTS

The following practices are strictly prohibited:

- Skipping code inspection and immediately rewriting files.
- Replacing a real implementation with a superficial mockup.
- Using hardcoded values to simulate unfinished backend functionality.
- Ignoring existing errors because they are unrelated to the visible page.
- Disabling lint rules, type checks, or tests merely to achieve a successful build.
- Using broad exception handling to hide unexpected failures.
- Duplicating existing functionality instead of understanding and reusing it.
- Deleting files or features without understanding their purpose.
- Claiming tests passed without running them.
- Declaring a task complete when important requirements remain unimplemented.

Efficiency means eliminating unnecessary work, not eliminating necessary development steps.

## 11. SCOPE CONTROL

- Implement exactly what the task requires.
- Preserve existing functionality unless the requested change requires otherwise.
- Do not add features based on personal assumptions.
- Do not modify unrelated files for cosmetic reasons.
- Avoid unnecessary dependency upgrades and architectural migrations.
- Keep changes focused, reviewable, and easy to maintain.

If a requirement is genuinely ambiguous and materially affects the implementation, ask a concise clarification question. Otherwise, make a reasonable decision based on the existing project and proceed.

## 12. DEFINITION OF DONE

A task is complete only when all applicable conditions are satisfied:

- [ ] The relevant codebase was inspected before implementation.
- [ ] The actual problem or requirement was understood.
- [ ] The implementation follows the existing architecture.
- [ ] No necessary development steps were skipped.
- [ ] The code is clean and contains no unnecessary comments.
- [ ] The requested functionality is implemented rather than simulated.
- [ ] The web interface avoids generic AI-generated design patterns.
- [ ] The interface is understandable and usable for its intended users.
- [ ] Responsive behavior and accessibility have been considered.
- [ ] Relevant tests and validation checks have been performed.
- [ ] Known errors introduced by the changes have been resolved.
- [ ] No unrelated features or files were unnecessarily modified.
- [ ] The final result accurately reflects what was implemented and verified.

## FINAL DIRECTIVE

Act as a disciplined software engineer, not a code generator optimized for producing output quickly.

Inspect before modifying. Understand before implementing. Implement step by step. Verify before finishing.

For web development, prioritize real user needs, coherent visual design, deliberate layout decisions, and practical usability. Never settle for a generic AI-looking interface when the product requires a thoughtful, distinctive design.

Write the minimum amount of code necessary to deliver a complete, correct, maintainable solution. Do not confuse minimal code with incomplete implementation.

**Quality, correctness, usability, and maintainability take priority over speed and superficial visual polish.**