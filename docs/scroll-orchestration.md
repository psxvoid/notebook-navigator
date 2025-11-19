# Notebook Navigator Scroll Orchestration

## Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Core Concepts](#core-concepts)
  - [Index Versioning](#index-versioning)
  - [Pending Scrolls](#pending-scrolls)
  - [Intent-Based Scrolling](#intent-based-scrolling)
  - [Version Gating](#version-gating)
- [Architecture](#architecture)
  - [Shared Safeguards](#shared-safeguards)
  - [Navigation Pane Scrolling](#navigation-pane-scrolling)
  - [List Pane Scrolling](#list-pane-scrolling)
- [Common Scenarios](#common-scenarios)
  - [Toggling Hidden Items](#toggling-hidden-items)
  - [Folder Navigation](#folder-navigation)
  - [Settings and Layout Changes](#settings-and-layout-changes)
  - [Reveal Operations](#reveal-operations)
  - [Mobile Drawer Visibility](#mobile-drawer-visibility)
  - [Search Filtering](#search-filtering)
- [Implementation Details](#implementation-details)
  - [Priority System](#priority-system)
  - [Alignment Policies](#alignment-policies)
  - [Stabilization Mechanisms](#stabilization-mechanisms)
  - [Container Readiness](#container-readiness)
- [Debugging Guide](#debugging-guide)
  - [Observability](#observability)
  - [Common Issues](#common-issues)
  - [Key Debugging Points](#key-debugging-points)
- [See Also](#see-also)

## Overview

The scroll orchestration system coordinates TanStack Virtual lists in both panes. Each pane tracks structural changes,
defers scroll execution until data and DOM state are ready, and applies deterministic alignment for user-driven actions.

## The Problem

Virtual lists rebuild whenever folder trees, list contents, or settings change. A rebuild invalidates cached indices
while scroll requests are still pending, so naive scrolling lands on the wrong item or fails silently.

### Race Condition Example

1. User has tag "todo" selected at index 61.
2. User toggles "Show hidden items".
3. Hidden tag "archived" becomes visible at index 40.
4. Tree rebuilds, "todo" is now at index 62.
5. Without orchestration: scroll uses stale index 61 and targets the wrong tag.
6. With orchestration: scroll waits for the rebuild, resolves the tag again, and hits index 62.

This kind of shift happens with visibility toggles, layout changes, sorting updates, folder navigation, and asynchronous
metadata hydration.

## The Solution

Scroll orchestration combines version tracking, intent metadata, and priority coalescing.

```mermaid
graph LR
    A[User Action] --> B[Tree/List Change]
    B --> C[Index Version++]
    A --> D[Scroll Request]
    D --> E[Set minVersion]
    E --> F{Container Ready + Version Met}
    F -->|No| G[Wait]
    F -->|Yes| H[Resolve Index]
    H --> I[Execute Scroll]
    G --> F
```

Key principles:

1. Always resolve indices at execution time.
2. Increment pane-specific versions when index maps change.
3. Block scroll execution until the pane reports visible and the required version is reached.
4. Use intent metadata to pick alignment and replace lower-priority requests.

## Core Concepts

### Index Versioning

Both panes maintain `indexVersionRef` counters.

- **Navigation pane** increments when the `pathToIndex` map changes size or identity.
- **List pane** increments on `filePathToIndex` identity changes and triggers an immediate `virtualizer.measure()` so
  item heights stay current.

These counters allow pending scrolls to specify the version they require before execution.

### Pending Scrolls

Each pane stores at most one pending request.

- **Navigation pane** records `{ path, itemType, intent, align?, minIndexVersion? }`. Paths are normalized by item type.
- **List pane** records `{ type: 'file' | 'top', filePath?, reason?, minIndexVersion?, skipScroll? }`. `skipScroll`
  marks bookkeeping entries that clear without scrolling.

A `pendingScrollVersion` state value forces React effects to re-run whenever a new request replaces the previous one.

### Intent-Based Scrolling

Intent metadata ties each request to its trigger and alignment policy.

- **Navigation intents**: `selection`, `reveal`, `visibilityToggle`, `external`, `mobile-visibility`. `startup` exists
  in the type for future use but is not currently enqueued.
- **List intents**: `folder-navigation`, `visibility-change`, `reveal`, `list-structure-change`. `'top'` requests use
  the same priority system with `type: 'top'`.

### Version Gating

Scroll execution runs inside an effect that checks pane readiness and index versions.

```typescript
if (!pending || !isScrollContainerReady) {
  return;
}

const requiredVersion = pending.minIndexVersion ?? indexVersionRef.current;
if (indexVersionRef.current < requiredVersion) {
  return;
}

const index = resolveIndex(pending);
if (index >= 0) {
  virtualizer.scrollToIndex(index, { align: getAlign(pending.intent) });
  pendingScrollRef.current = null;
}
```

Navigation resolves via `getNavigationIndex`. List scrolls either use `scrollToIndex` or `scrollToOffset(0)` for top
requests.

## Architecture

### Shared Safeguards

- Both hooks use `ResizeObserver` to detect when the DOM container has width and height. Scrolls never run while the
  container or any parent is hidden.
- The composed `isScrollContainerReady` flag requires both logical visibility and physical dimensions.
- Mobile taps on the pane header call `handleScrollToTop`, which performs a smooth `scrollTo({ top: 0 })` when the
  device is mobile.

### Navigation Pane Scrolling

`useNavigationPaneScroll` wires TanStack Virtual for folder, tag, banner, and spacer items.

- **Virtualizer setup**: Item height estimates follow navigation settings and mobile overrides. Banner height falls back
  to a spacer until measured.
- **Selection handling**: The hook watches folder/tag selection, pane focus, and visibility. It suppresses auto-scroll
  when a shortcut is active or when `skipAutoScroll` is enabled for shortcut reveals.
- **Hidden item toggles**: When `showHiddenItems` changes, the current selection is queued with intent
  `visibilityToggle` and `minIndexVersion = current + 1`.
- **Startup tags**: Tags load after folders, so a dedicated effect watches for new tag indices and queues the selected
  tag once available.
- **Pending execution**: While a visibility toggle is in progress, only `visibilityToggle` requests can execute. After
  running such a scroll, the hook rechecks the index on the next animation frame and queues a follow-up if the index
  moved again.
- **External entries**: `requestScroll` normalizes the path and queues an `external` intent so reveal flows can drive
  the navigation pane.
- **Mobile drawer**: A `notebook-navigator-visible` event sets a pending scroll when the drawer becomes visible on
  mobile devices.
- **Settings changes**: Line height or indentation updates trigger a `measure()` call and a `requestAnimationFrame`
  scroll to re-center the selection when auto-scroll is allowed.

### List Pane Scrolling

`useListPaneScroll` manages article lists, pinned groups, spacers, and date headers.

- **Virtualizer setup**: Height estimation mirrors `FileItem` logic, looking up preview availability synchronously and
  respecting slim mode.
- **Priority queue**: `setPending` wraps `rankListPending`, replacing lower-ranked requests and preventing skip-only
  updates from clobbering real scrolls.
- **Selected file tracking**: `selectedFilePathRef` avoids executing stale config scrolls for files that are no longer
  selected.
- **Context tracking**: `contextIndexVersionRef` maintains the last version seen per folder/tag context. When the index
  advances within a folder or tag (pin/unpin, reorder, delete), the hook queues a `list-structure-change` scroll so the
  selected file remains visible.
- **Folder navigation**: When the list context changes or `isFolderNavigation` is true, the hook sets a pending request
  (file or top) and clears the navigation flag. Pending entries execute even if the pane is hidden, so the position is
  restored once visible.
- **Reveal operations**: Reveal flows queue a `reveal` pending scroll. Startup reveals override alignment to `'center'`.
- **Mobile drawer**: The `notebook-navigator-visible` event queues a visibility-change scroll when a file is selected.
- **Settings and search**: Appearance changes and descendant toggles queue `list-structure-change` entries. Search
  filters queue a `top` scroll when the selected file drops out of the filtered list, respecting mobile suppression
  flags.

## Common Scenarios

### Toggling Hidden Items

1. `showHiddenItems` flips in UX preferences.
2. The navigation hook increments `indexVersion`, defers selection scrolls with `intent: 'visibilityToggle'`, and waits
   for the next version.
3. After the tree rebuild, the pending scroll resolves the selection and runs.
4. The stabilization check revalidates the index on the next frame and queues another scroll if the index moved again.

### Folder Navigation

1. Selection context raises `isFolderNavigation` when the user picks a folder or tag.
2. `useListPaneScroll` queues a file or top scroll with reason `folder-navigation` and clears the flag.
3. `getListAlign` centers the selection on mobile and uses `auto` on desktop.
4. The navigation pane independently scrolls to the selected folder or tag when the pane becomes focused or visible.

### Settings and Layout Changes

1. Navigation line height or indentation updates trigger `rowVirtualizer.measure()` followed by a deferred selection
   scroll when auto-scroll is allowed.
2. List appearance or descendant toggles queue a `list-structure-change` scroll with `minIndexVersion = current + 1`. If
   no file is selected and descendants are disabled, the hook scrolls to top instead.
3. Reorders within the same folder or tag update `indexVersion` and enqueue a `list-structure-change` scroll so pinned
   files remain visible.

### Reveal Operations

1. Reveal flows call `requestScroll` for the navigation pane and set `selectionState.isRevealOperation`.
2. The navigation pane resolves the target path and scrolls with alignment from `getNavAlign('reveal')` (`auto`).
3. The list pane queues a `reveal` request and scrolls once the index is ready. Startup reveals center the target item;
   manual reveals use `auto`.

### Mobile Drawer Visibility

1. The mobile drawer raises the `notebook-navigator-visible` event when opened.
2. Navigation queues a `mobile-visibility` scroll for the current selection.
3. The list pane queues a `visibility-change` scroll for the selected file, preserving context when the drawer becomes
   visible.

### Search Filtering

1. When search filters remove the selected file, the list pane detects that the file path is absent from
   `filePathToIndex`.
2. Unless suppressed for mobile shortcuts, the hook queues a `top` scroll with reason `list-structure-change`.
3. If the selected file remains in the results, folder navigation effects keep it visible without extra scroll requests.

## Implementation Details

### Priority System

List pane priorities live in `rankListPending`:

```typescript
export function rankListPending(p?: { type: 'file' | 'top'; reason?: ListScrollIntent }): number {
  if (!p) return -1;
  if (p.type === 'top') return 0;
  switch (p.reason) {
    case 'list-structure-change':
      return 1;
    case 'visibility-change':
      return 2;
    case 'folder-navigation':
      return 3;
    case 'reveal':
      return 4;
    default:
      return 1;
  }
}
```

`setPending` compares these ranks and only replaces the current request when the new one is equal or higher, aside from
preserving non-skip entries when the incoming request is skip-only.

### Alignment Policies

- **Navigation pane**: `selection` centers on mobile and uses `auto` on desktop. `visibilityToggle`, `reveal`,
  `external`, and `mobile-visibility` use `auto`.
- **List pane**: `folder-navigation` centers on mobile, others use `auto`. Startup reveals override to `center` after
  execution.

### Stabilization Mechanisms

- Navigation visibility toggles run a `requestAnimationFrame` check after scrolling to detect secondary rebuilds and
  queue another pending request if needed.
- List config-change scrolls run a similar frame-based check and queue a follow-up when the index changes again.
- `skipScroll` entries allow the list pane to clear pending state without scrolling while still synchronizing
  version-based updates.

### Container Readiness

- `scrollContainerRefCallback` stores the DOM node and updates a local state reference.
- `ResizeObserver` (or a window resize fallback) tracks the node's size.
- `isScrollContainerReady` gates all scroll execution paths, preventing TanStack Virtual from throwing while hidden
  elements are measured.

## Debugging Guide

### Observability

- Add temporary `console.log` statements near `setPending`, pending execution effects, and version increments. Obsidian
  ignores `console.debug`, so use `console.log`.
- The hooks include comment tags (`NAV_SCROLL_*`, `SCROLL_*`) marking where to instrument logs.

### Common Issues

**Scroll lands on wrong item**

- Confirm `minIndexVersion` is set to `indexVersionRef.current + 1` when a rebuild is pending.
- Ensure the path resolves through `getNavigationIndex` or `getSelectionIndex`.

**Scroll does not execute**

- Verify `isScrollContainerReady` is true.
- Check that the pending entry still matches the current selection.
- Confirm the required version has been reached.

**Multiple scrolls conflict**

- Inspect `rankListPending` decisions to see which request displaced another.
- For navigation, confirm visibility-toggle guards are not blocking unrelated intents.

### Key Debugging Points

1. Log every `indexVersionRef` increment to correlate rebuilds with pending execution.
2. Log path-to-index resolution results to confirm indices match expectations.
3. Log pending intent, required version, and alignment when the execution effect runs.
4. Log priority comparisons inside `setPending` to see why a request was replaced or kept.

## See Also

- [Service Architecture](./service-architecture.md)
- [Startup Process](./startup-process.md)
- [Storage Architecture](./storage-architecture.md)
