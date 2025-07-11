# NavigationPane Visibility and Scroll Position Analysis

## Problem Statement
When toggling between single-pane and dual-pane modes, the NavigationPane loses its scroll position and fails to show the selected folder when becoming visible again.

**Clarification**: The current solution successfully reveals the selected folder (scrolls it into view), but does NOT restore the exact scroll offset. For example, if the selected folder was 200px from the top of the viewport before hiding, it might appear at a different position when revealed.

## How It Works Now

### Current Implementation Status
- **NavigationPane** (`src/components/NavigationPane.tsx`): Uses `useState` for visibility tracking, NOT using `useVisibilityReveal` hook
- **FileList** (`src/components/FileList.tsx`): Uses the `useVisibilityReveal` hook for consistent reveal behavior
- **NotebookNavigatorComponent** (`src/components/NotebookNavigatorComponent.tsx`): Manages single/dual pane state
- **CSS** (`styles.css`): Uses `visibility: hidden` to hide panes while keeping them mounted

### Implementation Flow

#### 1. Single-Pane Toggle (User Action)
```
User toggles settings.singlePane → NotebookNavigatorComponent effect (line 198)
→ Sets uiState.singlePane and currentSinglePaneView to 'files'
→ CSS class 'nn-desktop-single-pane show-files' applied
→ NavigationPane becomes hidden via CSS but stays mounted
```

#### 2. Visibility Tracking in NavigationPane
```typescript
// Line 362: Calculate current visibility
const isVisible = !uiState.singlePane || uiState.currentSinglePaneView === 'navigation';

// Line 368: State to track previous visibility from last render
const [prevVisible, setPrevVisible] = useState(isVisible);

// Line 371: Update state AFTER render completes
useEffect(() => {
    setPrevVisible(isVisible);
}, [isVisible]);
```

#### 3. Scroll-to-Selection Logic (useLayoutEffect at line 386)
```typescript
// Line 402: Detect visibility transition
const isBecomingVisible = isVisible && !prevVisible;

// Line 411: Scroll if becoming visible
if (isInitialMount || isBecomingVisible) {
    const index = pathToIndex.get(selectedPath);
    if (index >= 0) {
        requestAnimationFrame(() => {
            rowVirtualizer.scrollToIndex(index, {
                align: isMobile ? 'center' : 'auto',  // 'auto' means minimal scroll to bring into view
                behavior: 'auto'
            });
        });
    }
}
```

**Note**: `align: 'auto'` scrolls the minimum amount needed to bring the item into view. It does NOT restore the exact scroll position from before the pane was hidden.

#### 4. CSS Implementation (styles.css)
```css
/* Desktop single-pane mode - hides navigation but keeps it mounted */
.nn-desktop-single-pane.show-files .nn-navigation-pane {
    visibility: hidden;
    position: absolute;
    pointer-events: none;
}
```

## Why We Structured It This Way

### 1. State vs Ref for Previous Value Tracking
- **State (`useState`)**: Updates are batched and applied in the next render cycle
- During render N, `prevVisible` contains the value from render N-1
- This creates a natural "lag" that allows transition detection
- `isBecomingVisible = isVisible && !prevVisible` works because we compare current render's value with previous render's value

### 2. Effect Types and Execution Order
- **`useEffect`** for state update: Runs after DOM updates, perfect for updating "previous" value
- **`useLayoutEffect`** for scrolling: Runs before paint, ensures scroll happens before user sees the pane
- This order ensures `prevVisible` is read before it's updated

### 3. CSS `visibility: hidden` vs Component Unmounting
- Keeps components mounted and virtualizer instances alive
- Preserves component state (but NOT scroll position)
- More performant than mount/unmount cycles
- Allows instant reveal without re-initialization

### 4. RequestAnimationFrame for Scrolling
- Ensures DOM measurements are accurate
- Prevents scroll before virtualizer is ready
- Provides smooth visual transition

## What Does Not Work

### 1. Ref-Based Previous Value Tracking
```typescript
// ❌ DOES NOT WORK
const wasVisibleRef = useRef(isVisible);
useEffect(() => {
    wasVisibleRef.current = isVisible;
}, [isVisible]);
```
**Why it fails**: All effects run in the same cycle. The ref is updated before the scroll effect can read the old value.

### 2. Single Effect with Ref Update at End
```typescript
// ❌ DOES NOT WORK
useLayoutEffect(() => {
    if (!isVisible) return; // Early return prevents ref update
    // ... scroll logic ...
    wasVisibleRef.current = isVisible;
}, [isVisible]);
```
**Why it fails**: Early return when `!isVisible` prevents the ref from ever being set to false.

### 3. Mixed Effect Types with Wrong Order
```typescript
// ❌ DOES NOT WORK
useLayoutEffect(() => {
    setPrevVisible(isVisible); // Updates too early
}, [isVisible]);

useEffect(() => {
    // Scroll logic here sees already-updated prevVisible
}, [isVisible, prevVisible]);
```
**Why it fails**: `useLayoutEffect` runs before `useEffect`, so state is updated before scroll logic runs.

### 4. Tracking in Parent Component
**Why we didn't do it**: Would require prop drilling and complicate the component hierarchy. The visibility state is better encapsulated within NavigationPane.

### 5. Using the useVisibilityReveal Hook
```typescript
// NavigationPane doesn't use this, but FileList does
useVisibilityReveal({
    getSelectionIndex,
    virtualizer,
    isVisible,
    isMobile
});
```
**Why NavigationPane doesn't use it**: The hook uses refs internally and would suffer from the same timing issues. NavigationPane needs the state-based approach for proper transition detection.

## What's Not Implemented: Exact Scroll Position Restoration

The current solution reveals the selected item but doesn't restore the exact scroll offset. To implement exact scroll position restoration, we would need:

### 1. Save Scroll Position Before Hiding
```typescript
const savedScrollTop = useRef<number>(0);

useEffect(() => {
    if (!isVisible && scrollContainerRef.current) {
        savedScrollTop.current = scrollContainerRef.current.scrollTop;
    }
}, [isVisible]);
```

### 2. Restore Scroll Position When Becoming Visible
```typescript
if (isBecomingVisible && scrollContainerRef.current && savedScrollTop.current > 0) {
    scrollContainerRef.current.scrollTop = savedScrollTop.current;
    savedScrollTop.current = 0;
}
```

### Why We Don't Do This
1. **User expectation**: When returning to a pane, users typically want to see their selection, not the exact previous viewport
2. **Selection changes**: The selected item might have changed while the pane was hidden
3. **Complexity**: Managing saved scroll positions adds state that needs to be cleared appropriately
4. **Virtualizer complications**: The virtualizer might need to recalculate item positions

The `useVisibilityReveal` hook actually has a `preserveScrollOnHide` option that implements this pattern, but NavigationPane doesn't use it.

## Lessons Learned

### 1. React State vs Refs for Previous Values
- **Use state when you need the previous render's value**: State naturally provides this through React's render cycle
- **Use refs for mutable values within the same render**: Refs update immediately and are visible to all effects in the same cycle

### 2. Effect Execution Order Matters
- `useLayoutEffect` runs before `useEffect`
- All effects in a component run in declaration order
- Effects see ref updates from previous effects immediately
- State updates are batched and only visible in the next render

### 3. CSS Visibility Patterns
- `visibility: hidden` + `position: absolute` is ideal for hiding while preserving state
- Better than conditional rendering for frequently toggled UI
- Prevents expensive mount/unmount cycles
- Maintains scroll positions and component state

### 4. Debugging Visibility Transitions
- Always log both current and previous visibility states
- Check effect execution order with cleanup logs
- Verify that transition detection logic (`isBecomingVisible`) evaluates correctly
- Use state updates to ensure values from different renders are compared

### 5. Component-Specific Solutions
- Different components may need different approaches (NavigationPane vs FileList)
- Consider the specific timing requirements of each use case
- Don't force a one-size-fits-all solution when components have different needs

### 6. Performance Considerations
- RequestAnimationFrame for DOM operations ensures measurements are accurate
- Keeping components mounted with CSS hiding is more performant than unmounting
- Virtualization must be preserved across visibility changes for large lists