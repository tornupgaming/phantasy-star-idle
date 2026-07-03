# reactive-ui-architecture Specification (delta)

## ADDED Requirements

### Requirement: Fine-grained menu rendering
The menu screens (character select, character create, Pioneer 2 hub) SHALL be
rendered with fine-grained reactive updates: a user interaction or engine-state
change SHALL update only the DOM nodes whose backing state changed, and SHALL NOT
replace the surrounding screen or pane wholesale.

#### Scenario: Interaction preserves surrounding DOM
- **WHEN** the player performs a pane-local action (e.g. buys an item in a shop pane)
- **THEN** unrelated DOM in the same screen (pane list, dialogue window, backdrop layer) SHALL remain the same nodes, preserving scroll position and in-flight CSS animations

#### Scenario: Poll updates only changed values
- **WHEN** the 1 Hz poll runs and only derived values (e.g. meseta) changed
- **THEN** only the elements displaying those values SHALL update

### Requirement: Transient UI state survives updates
The UI SHALL hold transient state (dialogue reveal progress, keyboard-menu
focus, list/detail selection, and the character-create draft) in reactive state
outside the DOM, such that it survives any re-render without re-attachment or
restoration passes.

#### Scenario: Typewriter uninterrupted by re-render
- **WHEN** a dialogue line is mid-reveal and an unrelated part of the hub updates
- **THEN** the typewriter SHALL continue from its current character position without restarting or skipping

#### Scenario: Keyboard focus survives a state change
- **WHEN** the player has keyboard focus on a menu row and an engine-state update repaints values in that pane
- **THEN** the focused row SHALL remain focused without a restoration pass

### Requirement: Imperative islands for stage and backdrop
The battle stage and the hub backdrop SHALL run as imperative islands: the
reactive layer mounts each island's container and lifecycle (create on mount,
dispose on cleanup), and SHALL NOT reactively render inside an island's
container. The islands' internal update loops (requestAnimationFrame playback,
canvas drawing) SHALL be unchanged by the reactive layer.

#### Scenario: Run start mounts the stage island
- **WHEN** a run becomes active
- **THEN** the reactive layer SHALL mount the run shell and construct/start the battle stage exactly once for that run

#### Scenario: Run settle disposes the stage island
- **WHEN** the active run settles
- **THEN** the stage island SHALL be stopped and disposed via its cleanup hook, and the hub SHALL be shown on the Hunters Guild pane per ui-navigation

#### Scenario: Backdrop persists across pane changes
- **WHEN** the player switches hub panes
- **THEN** the backdrop canvas element SHALL persist (theme updated in place), not be recreated

### Requirement: One-way engine-state bridge
UI components SHALL read engine state only through a reactive store that is
synchronized from an engine-state snapshot after every engine mutation (user
action or poll). The simulation engine SHALL remain framework-agnostic: no
reactive primitives, subscriptions, or UI imports in `src/engine/*`, and the
store SHALL never alias live engine-owned objects. All engine mutations SHALL
continue to go through existing engine APIs; the store is read-only for
components.

#### Scenario: Engine stays framework-agnostic
- **WHEN** the UI layer is built against the reactive framework
- **THEN** `src/engine/*` SHALL contain no imports from the framework and SHALL pass all existing engine tests unchanged

#### Scenario: Action then sync
- **WHEN** a component invokes an engine action
- **THEN** the action SHALL call the engine API and then synchronize the store, and the component SHALL observe the post-action state on the next read
