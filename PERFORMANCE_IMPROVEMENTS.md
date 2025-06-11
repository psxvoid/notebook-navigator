# Performance Improvements - Round 2

## Summary
Fixed severe performance issue where navigating through 2500 files caused 100% CPU usage. The root cause was twofold:
1. All 2500 FileItem components were re-rendering on every navigation keystroke
2. The context value included `refreshCounter` which changed frequently, bypassing React.memo

## Changes Made

### 1. **Fixed Context Re-render Issue** (CRITICAL)
- Created `useStableAppContext()` hook that excludes frequently changing values
- FileItem now uses stable context, preventing re-renders from `refreshCounter` changes
- Added `settingsVersion` prop to FileItem for controlled settings updates

### 2. **Added React.memo to FileItem Component**
- Wrapped FileItem with React.memo and custom comparison function
- Now only the previously selected and newly selected items re-render
- Reduces re-renders from 2500 to just 2 per navigation

### 3. **Optimized Keyboard Navigation**
- Changed from querying all DOM elements on every keypress to using DOM traversal
- Falls back to full query only when necessary (e.g., at list boundaries)
- Significantly reduces DOM operations during navigation
- Reduced debounce delay from 50ms to 30ms for better responsiveness

### 4. **Deferred Preview Text Loading**
- Selected items load preview text immediately
- Non-selected items load with 100ms delay
- Prevents 2500 simultaneous file reads on initial render

### 5. **Stabilized onClick Handlers**
- Used `.bind()` to create stable function references
- Prevents breaking memoization due to new function creation

## Additional Optimizations (Round 3)

### 6. **Eliminated onClick Arrow Functions**
- Removed arrow function creation in render (`onClick={() => handleFileClick(file)}`)
- Now uses event delegation pattern with data attributes
- Prevents 2500 new function creations on every render

### 7. **Optimized Date Formatting**
- Added optional `formattedDate` prop to FileItem
- Date formatting can now be done once in the parent instead of 2500 times
- Falls back to formatting if not provided

### 8. **Cached Selection Check**
- Cache `selectedFilePath` to avoid repeated property access in render loop
- Minor optimization but helps with 2500 iterations

### 9. **React 18 startTransition**
- Used `startTransition` for non-urgent state updates in keyboard navigation
- Allows React to prioritize urgent updates (like scrolling) over state changes
- Should make navigation feel more responsive

## Expected Results
- CPU usage during navigation should drop from 100% to minimal levels
- Navigation should feel instant and smooth
- Initial folder load should be faster
- Keyboard navigation should feel more responsive
- Initial folder load should be faster due to deferred preview loading

## Testing
1. Open a folder with 2500+ files
2. Use arrow keys to navigate up/down
3. CPU usage should remain low
4. Navigation should be smooth with no lag

## Future Optimizations
If performance issues persist with even larger vaults (10k+ files):
1. Implement virtualization (react-window or similar)
2. Add intersection observer for lazy loading previews
3. Consider pagination for extremely large folders