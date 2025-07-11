# NavigationPane Visibility and Scroll Position Analysis

## Executive Summary

**Problem**: When toggling between single-pane and dual-pane modes, the NavigationPane would lose its scroll position and jump to the top.

**Solution**: Implemented scroll position preservation using event-based tracking while visible, state-based visibility detection, and protection against race conditions.

**Status**: ✅ FULLY WORKING - Both NavigationPane and FileList now maintain their exact scroll positions when toggling pane modes.

## The Journey: From Problem to Solution

### 1. Initial Problem Discovery

When users toggled from dual-pane to single-pane mode and back, the NavigationPane would:
- Correctly show the selected folder (reveal functionality worked)
- But reset scroll position to top (losing user's place)

Example: If a user scrolled 500px down to view a folder, toggled to single-pane, then back to dual-pane, they'd be back at the top instead of 500px down.

### 2. First Key Insight: State vs Refs for Visibility Tracking

The initial implementation used refs to track previous visibility:
```typescript
const wasVisibleRef = useRef(isVisible);
```

**Problem**: React batches all effects in the same render cycle, so:
1. Visibility changes
2. Both effects run in the same cycle
3. Ref is updated before scroll logic can read the old value
4. Transition is never detected

**Solution**: Use state instead of refs:
```typescript
const [prevVisible, setPrevVisible] = useState(isVisible);

// State updates are batched for next render
useEffect(() => {
    setPrevVisible(isVisible);
}, [isVisible]);
```

This ensures the scroll logic sees the previous value from the last render cycle.

### 3. Second Key Insight: Don't Save Scroll Position on Hide 🔑

This was the most important discovery. The naive approach was:
```typescript
// ❌ WRONG - Trying to save when becoming hidden
if (!isVisible && wasVisible && scrollElement) {
    savedScrollOffset.current = scrollElement.scrollTop; // Always 0!
}
```

**Why it failed**: By the time `isVisible` becomes false:
- CSS has already applied `visibility: hidden`
- The browser may have already reset scroll position to 0
- We're saving 0 instead of the actual position

**The Solution - Event-Based Tracking**:
```typescript
// ✅ CORRECT - Save continuously while visible
useEffect(() => {
    if (!preserveScrollOnHide || !scrollElement || !isVisible) return;
    
    const handleScroll = () => {
        savedScrollOffset.current = scrollElement.scrollTop;
    };
    
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
        scrollElement.removeEventListener('scroll', handleScroll);
    };
}, [preserveScrollOnHide, scrollElement, isVisible]);
```

This approach:
- Tracks scroll position in real-time while the pane is visible
- Always has the latest position ready when hiding occurs
- Avoids the timing issue entirely

### 4. Third Key Insight: Race Conditions on Restore

Even with event-based tracking, we hit another problem. When becoming visible:
1. Multiple effects would run
2. The scroll tracking effect would immediately save position 0
3. This would overwrite our saved position (e.g., 932px → 0px)
4. Restoration would restore 0

**Solution - Restoration Flag**:
```typescript
const hasRestoredScroll = useRef(false);

// Don't track scroll during restoration
if (isVisible && !hasRestoredScroll.current) {
    // Add scroll listener
}

// Set flag when restoring
if (isBecomingVisible && savedScrollOffset.current > 0) {
    scrollElement.scrollTop = savedScrollOffset.current;
    hasRestoredScroll.current = true;
}

// Reset flag when hiding
if (!isVisible) {
    hasRestoredScroll.current = false;
}
```

## The Final Working Solution

### Complete Implementation

The working solution is implemented in the `useVisibilityReveal` hook, used by both NavigationPane and FileList:

```typescript
// Usage in components
useVisibilityReveal({
    getSelectionIndex: () => selectedPath ? pathToIndex.get(selectedPath) ?? -1 : -1,
    virtualizer: rowVirtualizer,
    isVisible,
    isMobile,
    isRevealOperation: selectionState.isRevealOperation,
    preserveScrollOnHide: true,
    scrollContainerRef  // Direct ref to scroll container
});
```

### Key Components of the Solution

1. **State-based visibility tracking** prevents React's effect batching issues
2. **Direct scroll container refs** ensure we're tracking the right element
3. **Event-based scroll tracking** captures position while visible, not during hide
4. **Restoration flag** prevents race conditions during restore
5. **Proper null checks** ensure we only restore valid positions

## Implementation Details

### Current File Structure
- **NavigationPane** (`src/components/NavigationPane.tsx`): Uses `useVisibilityReveal` with scroll preservation
- **FileList** (`src/components/FileList.tsx`): Uses `useVisibilityReveal` with scroll preservation
- **useVisibilityReveal** (`src/hooks/useVisibilityReveal.ts`): Unified hook for visibility-based reveals
- **CSS** (`styles.css`): Uses `visibility: hidden` to keep components mounted

### How Pane Hiding Works
```css
/* Components stay mounted but hidden */
.nn-desktop-single-pane.show-files .nn-navigation-pane {
    visibility: hidden;
    position: absolute;
    pointer-events: none;
}
```

This approach:
- Keeps React components and virtualizer instances alive
- Maintains component state between toggles
- Provides instant reveal without re-initialization
- But requires careful scroll position management

## What Didn't Work (And Why)

### 1. Ref-Based Previous Value Tracking
```typescript
// ❌ DOES NOT WORK
const wasVisibleRef = useRef(isVisible);
useEffect(() => {
    wasVisibleRef.current = isVisible;
}, [isVisible]);
```
**Why**: All effects run synchronously. The ref updates before the scroll logic can read the old value.

### 2. Saving Scroll Position on Hide
```typescript
// ❌ DOES NOT WORK
if (!isVisible && wasVisible) {
    savedScrollOffset.current = scrollElement.scrollTop;
}
```
**Why**: By the time this runs, CSS has already hidden the element and scroll is 0.

### 3. Not Protecting Against Overwrites
```typescript
// ❌ DOES NOT WORK
// Save initial position when becoming visible
savedScrollOffset.current = scrollElement.scrollTop; // This is 0!
```
**Why**: When becoming visible, this would overwrite the previously saved position with 0.

## Key Lessons Learned

### 1. Timing is Everything
- React effects run synchronously in batches
- CSS changes can happen before React effects
- Always consider the order of operations

### 2. Don't Trust the Hide Event
- When an element is being hidden, its state may already be compromised
- Track state while the element is stable and visible
- Event listeners are more reliable than transition detection

### 3. Protect Your State
- When restoring state, prevent other effects from interfering
- Use flags to coordinate between multiple effects
- Always validate data before using it

### 4. Simple Features Aren't Simple
- Scroll position preservation required understanding:
  - React's render cycle and effect timing
  - CSS visibility behavior
  - Browser scroll position handling
  - Race condition prevention
- Always budget extra time for "simple" DOM state features

## Testing the Solution

To verify the solution works:
1. Navigate to a folder deep in the tree
2. Scroll down so the folder is in the middle of the viewport
3. Toggle single-pane mode (hides NavigationPane)
4. Toggle back to dual-pane mode
5. The NavigationPane should show the exact same scroll position

The logs showed successful preservation:
```
Hiding: savedScrollOffset: 932
Showing: Restoring scroll position: 932
Result: currentScrollTop: 932 (not 0!)
```

## Conclusion

This implementation journey demonstrates how modern web development often requires deep understanding of framework internals, browser behavior, and timing nuances. What seemed like a simple feature - "preserve scroll position" - required sophisticated state management and careful coordination of multiple systems.

The final solution is elegant and reusable, encapsulated in the `useVisibilityReveal` hook that both major panes can use. Most importantly, it provides a smooth user experience where toggling pane modes feels seamless and preserves the user's context.