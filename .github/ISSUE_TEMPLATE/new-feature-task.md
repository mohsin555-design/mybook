---
name: New feature task
about: For create a new feature task
title: ''
labels: ''
assignees: ''

---

## Summary

Briefly describe what needs to be implemented and the main purpose of this task.

Mention any existing functionality, system, or component that should be reused instead of rebuilt.


## Scope with Requirements / Behavior

### 1. [Feature / Section Name]

Describe the expected behavior.

* Main requirement
* User interaction
* Expected result
* Navigation/action behavior
* Data/state behavior if applicable

### 2. [Feature / Section Name]

* Requirement
* Requirement
* Expected behavior

### 3. [Feature / Section Name]

* Requirement
* Requirement
* Expected behavior

Add or remove sections based on the task.


# Out of Scope

Clearly list anything that should **not** be implemented as part of this task.

* Future functionality
* Unrelated redesigns
* New architecture unless specifically required
* Advanced/custom functionality outside the current MVP scope


# Acceptance Criteria

* [ ] Main required functionality is implemented.
* [ ] User can complete the intended flow successfully.
* [ ] Existing components/functions are reused where appropriate.
* [ ] UI states and interactions behave according to the requirements.
* [ ] Changes update without unnecessary page reloads where applicable.
* [ ] Empty and unavailable-data states are handled.
* [ ] No blocking console or runtime errors are introduced.
* [ ] Existing related functionality continues to work.

Add task-specific acceptance criteria here.


# Loading and Error States

* Use the application's existing loading/skeleton pattern.
* Do not display incorrect empty states while data is still loading.
* Handle failed requests/data loading without breaking the entire page or feature.
* Provide appropriate fallback behavior when optional data is unavailable.
* Keep unrelated functionality usable when one section fails.
* Follow the application's existing error-message/toast pattern.

# Edge Cases

Consider relevant cases such as:

* Missing or unavailable data.
* Empty state.
* Very long names/content.
* Deleted or moved items.
* Invalid/stale stored state.
* Failed API/storage request.
* User refreshes or navigates during an operation.
* User repeats an action quickly.
* Existing saved data uses an older state/format.
* Feature behaves differently between Local and Cloud/Google workspace.

Only keep the edge cases relevant to the task.


# Accessibility Requirements

* All interactive controls must be keyboard accessible.
* Provide visible focus states.
* Icon-only controls must have accessible labels.
* Do not rely only on color to communicate state.
* Maintain appropriate contrast in Light and Dark themes.
* Use existing accessible modal, dropdown, tooltip, form, and menu components.
* Maintain logical focus behavior when opening and closing overlays.
* Support appropriate ARIA labels/roles where required.


# Technical Considerations

* Inspect and reuse existing components, hooks, contexts, stores, utilities, APIs, and routes before creating new implementations.
* Avoid duplicate state management and duplicate data-fetching logic.
* Follow the existing project architecture, naming conventions, and component structure.
* Reuse the existing design system and shared UI components.
* Keep data/business logic separate from presentation components where practical.
* Use existing routing and avoid unnecessary full-page reloads.
* Use the application's established persistence approach for user-specific state.
* Handle loading, empty, error, and fallback states gracefully.
* Avoid breaking or unnecessarily changing existing APIs, storage structure, or data models.
* Do not introduce advanced/future functionality unless it is explicitly part of the task.
* Keep implementation maintainable and extensible for future requirements without over-engineering the current MVP.


# Regression Requirements

The implementation must not break existing applicable functionality, including:

* Authentication and logout.
* Local workspace functionality.
* Google account and Google Drive connection.
* Routing and navigation.
* File and folder creation.
* File and folder opening.
* File/folder move, rename, duplicate, and delete behavior.
* Search.
* Recent activity.
* Favorites.
* Theme and persisted preferences.
* Trash.
* Existing modals, dropdowns, menus, and keyboard shortcuts.
* Existing Local/Cloud data.
* Desktop and mobile/PWA behavior.

Only keep the regression items related to the task.
