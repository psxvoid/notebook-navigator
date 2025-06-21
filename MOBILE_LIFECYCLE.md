# Mobile Lifecycle and Scroll Position Preservation

This document details the complex mobile lifecycle issues discovered in the Notebook Navigator plugin for Obsidian on iOS, the solutions implemented, and why some issues remain fundamentally unsolvable with the current Obsidian mobile API.

## The Core Problem

On mobile devices (specifically iOS), when users swipe between the navigator view and the editor view, the virtualizers (used for efficient rendering of long lists) lose their scroll position and reset to the top. This happens because:

1. The React components get unmounted/remounted when the view is hidden/shown
2. The virtualizers lose their internal state completely
3. Obsidian's mobile view lifecycle doesn't provide reliable hooks for state preservation
4. The timing of events makes it impossible to restore state properly

## Key Discoveries

### 1. setState is Never Called on Mobile

Despite Obsidian's documentation suggesting that `setState` and `getState` should work together for view state persistence:
- `getState()` IS called when the view is being saved (e.g., when swiping away)
- `setState()` is NEVER called on mobile when restoring the view
- This means we cannot rely on the standard state persistence mechanism

```typescript
// This is called when swiping away
getState(): Record<string, unknown> {
    const activeFile = this.app.workspace.getActiveFile();
    const state = { activeFilePath: activeFile?.path };
    mobileLogger.logViewLifecycle('getState called', state);
    return state;
}

// This is NEVER called on mobile when returning to the view
async setState(state: NotebookNavigatorViewState, result: any): Promise<void> {
    mobileLogger.logViewLifecycle('setState called', state); // Never logs on mobile
    // ...
}
```

### 2. The "Magic Pattern" Discovery

Through extensive logging and testing, we discovered that the virtualizers only update correctly when a file-open event is triggered while the navigator is NOT the active view. This "magic pattern" occurs naturally when:
- User clicks a link in the editor
- The file-open event fires
- The navigator is inactive, so it processes the reveal operation correctly
- When the user returns to the navigator, it shows the correct file and scroll position

### 3. Mobile View Lifecycle Events

The typical lifecycle when swiping away from navigator to editor:
```
1. [active-leaf-change] event fires (leaf: "markdown")
2. [getState] called on navigator view
3. Navigator focus changes from true to false
4. View becomes inactive
```

When returning to navigator from editor:
```
1. [Navigator view became active] logged
2. [handleViewBecomeActive] called
3. [getState] called (multiple times)
4. [active-leaf-change] event fires (leaf: "notebook-navigator-react-view")
5. Auto-reveal logic triggers
```

### 4. The Timing Problem

The auto-reveal logic has a fundamental issue on mobile:
- When returning to the navigator, the reveal happens while the navigator is active
- This causes the virtualizers to not update properly
- The navigator shows the wrong scroll position

## Implemented Solutions

### 1. Delayed File Open on Mobile Clicks

When a user clicks a file in the navigator on mobile, we:
1. Collapse the sidebar first (to ensure navigator loses focus)
2. Wait 100ms for the focus change to complete
3. Then open the file

This ensures the file-open event happens while the navigator is not active, triggering the "magic pattern":

```typescript
if (isMobile && app.workspace.leftSplit) {
    // Collapse sidebar first
    app.workspace.leftSplit.collapse();
    
    // Then open file after a delay to ensure navigator has lost focus
    setTimeout(() => {
        const leaf = openInNewTab ? app.workspace.getLeaf('tab') : app.workspace.getLeaf(false);
        if (leaf) {
            leaf.openFile(file, { active: true });
        }
    }, 100); // Increased delay to ensure focus change
}
```




## Mobile-Specific Scroll Momentum Preservation

The FileList component includes sophisticated logic to preserve scroll momentum during virtualization:

```typescript
// Track scroll state on mobile
const scrollStateRef = useRef({
    isScrolling: false,
    lastScrollTop: 0,
    scrollVelocity: 0,
    lastTimestamp: 0,
    animationFrameId: 0,
    scrollEndTimeoutId: 0
});

// Constants for mobile scroll handling
const VELOCITY_THRESHOLD = 0.1;        // Minimum velocity to consider as momentum scrolling
const SCROLL_END_DELAY = 150;          // Delay before marking scroll as ended
const MOMENTUM_DURATION = 500;         // How long to preserve state after touch end
```

When new items are added to the virtualized list during scrolling, we calculate their height and adjust the scroll position to maintain visual continuity without interrupting momentum.

## Why This Problem is Fundamentally Unsolvable

After extensive investigation and multiple implementation attempts, we've concluded that preserving scroll position when swiping between views on mobile is fundamentally unsolvable with the current Obsidian mobile API. Here's why:

### 1. The Event Cascade Problem

When returning to the navigator from the editor, a cascade of events fires:
```
1. Navigator view became active
2. handleViewBecomeActive called
3. getState called (multiple times)
4. active-leaf-change → navigator
5. active-leaf-change → markdown (file in editor)
6. Auto-reveal triggers
```

This cascade happens AFTER the navigator is already active, meaning any reveals triggered at this point won't benefit from the "magic pattern."

### 2. The Virtualizer State Problem

React virtualizers (@tanstack/react-virtual) maintain complex internal state:
- Scroll position
- Item measurements
- Rendered item ranges
- Scroll velocity and momentum

When the view is hidden, this state is completely lost. The virtualizer doesn't provide a way to serialize this state, and even if it did, we have no reliable way to restore it due to setState never being called on mobile.

### 3. The Timing Paradox

The "magic pattern" requires file-open events to fire while the navigator is inactive. However:
- When we trigger file-open from getState (while navigator is being hidden), it helps for the initial reveal
- But when returning to the navigator, multiple new events fire that trigger additional reveals
- These new reveals happen while the navigator is active, overriding any benefit from the earlier file-open
- We can't prevent these reveals without breaking other functionality

### 4. Competing State Updates

Multiple systems are trying to update state simultaneously:
- The delayed file-open from getState
- The auto-reveal system detecting active file changes
- The navigator's own state restoration from localStorage
- User interactions (if they quickly tap while swiping)

These competing updates create race conditions that are impossible to resolve reliably.

## Remaining Challenges

1. **No Reliable Hook for View Visibility**: Obsidian doesn't provide a reliable way to know when a view becomes visible on mobile before user interaction.

2. **Virtualizer State Loss**: The virtualizers lose their state completely when the view is hidden, and there's no way to serialize/deserialize their internal state.

3. **Focus Management**: Mobile focus behavior is different from desktop, making it challenging to ensure the correct focus state for keyboard navigation.

4. **Timing Sensitivity**: Many solutions rely on setTimeout delays, which can be fragile and may not work consistently across different devices or Obsidian versions.

5. **No setState on Mobile**: The most critical limitation - Obsidian never calls setState on mobile, preventing normal state persistence.

## Development Tips

1. **Test Swipe Scenarios**: Always test:
   - Quick swipe away and back
   - Swipe away, wait, swipe back
   - Swipe away, change file in editor, swipe back
   - Multiple rapid swipes

2. **Watch for Race Conditions**: Many events fire in rapid succession on mobile. Use flags and careful state management to avoid race conditions.

3. **Consider Performance**: Mobile devices have limited resources. The solutions should not impact scrolling performance or battery life.

## Implementation Attempts Summary

Throughout development, we tried numerous approaches to solve this problem:

1. **Delayed File Open on Click (PARTIALLY WORKING)**
   - Collapse sidebar first, then open file after 100ms delay
   - Works reliably for revealing the correct file when clicking
   - Does NOT preserve scroll position when swiping back

2. **Force Reveal on Navigator Activation**
   - Attempted to track when navigator becomes active with `navigatorWasActiveRef`
   - Allow reveal even for same file after navigator activation
   - Did not solve the issue - removed from implementation

3. **Hidden State Tracking with wasHidden Flag**
   - Track when navigator is hidden in getState
   - Trigger file-open in handleViewBecomeActive
   - Abandoned because events fire too late (after navigator is active)



## Current Status

The plugin currently implements:
- ✅ Delayed file open on mobile clicks (100ms) - ensures correct file is shown
- ✅ Mobile scroll momentum preservation - smooth scrolling experience
- ❌ Scroll position preservation when swiping between views - fundamentally unsolvable

The user experience is that the navigator always shows the correct file when returning from the editor, but the scroll position resets to show that file at the top or center of the view.

## Future Considerations

1. **Accept the Limitation**: Document that scroll position loss on mobile is a known limitation due to Obsidian API constraints.

2. **Obsidian API Enhancement**: Request Obsidian to:
   - Call setState on mobile when restoring views
   - Provide pre-activation hooks for view visibility
   - Add native scroll position persistence for plugin views

3. **Alternative Approaches**:
   - Non-virtualized lists (performance impact)
   - Simpler mobile UI without nested folders
   - Native mobile app instead of plugin

4. **Workarounds for Users**:
   - Use bookmarks for quick navigation
   - Keep frequently accessed files in shallow folders
   - Use search instead of scrolling for deep hierarchies