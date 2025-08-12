# Notebook Navigator Theming Guide

This guide helps theme developers add support for Notebook Navigator's unique
CSS structure. Notebook Navigator replaces Obsidian's default file explorer with
a custom dual-pane interface that uses different CSS classes and DOM structure.

## CSS Custom Properties Reference

Notebook Navigator exposes these CSS custom properties for easy theming:

### Selection & Hover Effects

| Property                     | Element       | Default                            | Description                                 |
| ---------------------------- | ------------- | ---------------------------------- | ------------------------------------------- |
| `--nn-selection-bg`          | `.nn-navitem` | `var(--text-selection)`            | Background color when selected              |
| `--nn-selection-bg-inactive` | `.nn-navitem` | `var(--background-modifier-hover)` | Background when selected but pane unfocused |
| `--nn-selection-radius`      | `.nn-navitem` | `var(--radius-s)`                  | Border radius of selection rectangle        |
| `--nn-hover-bg`              | `.nn-navitem` | `var(--background-modifier-hover)` | Background color on hover                   |
| `--nn-hover-radius`          | `.nn-navitem` | `var(--radius-s)`                  | Border radius of hover rectangle            |
| `--nn-selection-bg`          | `.nn-file`    | `var(--text-selection)`            | File selection background                   |
| `--nn-selection-bg-inactive` | `.nn-file`    | `var(--background-modifier-hover)` | File selection when unfocused               |
| `--nn-selection-radius`      | `.nn-file`    | `var(--radius-m)`                  | File selection border radius                |

### Layout Components

| Property                     | Element                 | Default                             | Description                   |
| ---------------------------- | ----------------------- | ----------------------------------- | ----------------------------- |
| `--nn-header-bg`             | `.nn-pane-header`       | `var(--background-primary)`         | Pane header background        |
| `--nn-header-border-color`   | `.nn-pane-header`       | `var(--background-modifier-border)` | Header bottom border color    |
| `--nn-resize-bg`             | `.nn-resize-handle`     | `transparent`                       | Resize handle background      |
| `--nn-resize-hover-bg`       | `.nn-resize-handle`     | `var(--interactive-accent)`         | Resize handle hover color     |
| `--nn-resize-hover-opacity`  | `.nn-resize-handle`     | `0.5`                               | Resize handle hover opacity   |
| `--nn-resize-active-opacity` | `.nn-resize-handle`     | `0.8`                               | Resize handle drag opacity    |
| `--nn-separator-color`       | `.nn-virtual-file-item` | `var(--background-modifier-border)` | File separator line color     |
| `--nn-separator-height`      | `.nn-virtual-file-item` | `1px`                               | File separator line thickness |

## Key Differences from Default Explorer

| Aspect            | Obsidian Default   | Notebook Navigator              |
| ----------------- | ------------------ | ------------------------------- |
| **Class Prefix**  | `.nav-folder`      | `.nn-navitem`                   |
| **DOM Structure** | Nested hierarchy   | Flat list (virtual scrolling)   |
| **Items Types**   | Folders only       | Folders AND tags (same classes) |
| **Layout**        | Single tree        | Dual-pane (navigation + files)  |
| **File Display**  | Mixed with folders | Separate list pane              |

### Important Notes

1. **Virtual Scrolling**: We use virtual scrolling for performance, meaning
   folders are NOT nested in the DOM. All items are siblings in a flat list.
2. **Shared Classes**: Both folders and tags use `.nn-navitem` classes since
   they serve the same navigation purpose.
3. **No nav-files-container**: Unlike the default explorer, we don't mix files
   with folders. Files are in a separate pane.

## CSS Class Reference

### Navigation Pane Classes

| Class                          | Description                       | Obsidian Equivalent              |
| ------------------------------ | --------------------------------- | -------------------------------- |
| `.nn-navigation-pane`          | Navigation pane container         | `.nav-folder-container`          |
| `.nn-navigation-pane-scroller` | Scrollable area                   | `.nav-folder-children`           |
| `.nn-navitem`                  | Base class for all nav items      | `.nav-folder`                    |
| `.nn-navitem.nn-folder`        | Folder items specifically         | `.nav-folder`                    |
| `.nn-navitem.nn-tag`           | Tag items specifically            | _(no equivalent)_                |
| `.nn-navitem.nn-virtual`       | Virtual folders (Favorites, Tags) | _(no equivalent)_                |
| `.nn-navitem-content`          | Clickable content area            | `.nav-folder-title`              |
| `.nn-navitem-chevron`          | Expand/collapse arrow             | `.nav-folder-collapse-indicator` |
| `.nn-navitem-icon`             | Folder/tag icon                   | _(no equivalent)_                |
| `.nn-navitem-name`             | Item text                         | `.nav-folder-title-content`      |
| `.nn-navitem-count`            | File count badge                  | _(no equivalent)_                |
| `.nn-pane-header-text`         | Breadcrumb path in list header    | _(no equivalent)_                |
| `.nn-pane-header-icon`         | Icon in pane header               | _(no equivalent)_                |
| `.nn-icon-button`              | Action buttons in headers         | _(no equivalent)_                |
| `.nn-icon-button-active`       | Active state for toggle buttons   | _(no equivalent)_                |
| `.nn-mobile-title`             | Mobile breadcrumb path            | _(no equivalent)_                |
| `.nn-tab-bar-button`           | Mobile tab bar buttons            | _(no equivalent)_                |
| `.nn-tab-bar-button-active`    | Active mobile tab button          | _(no equivalent)_                |
| `.nn-navitem.nn-selected`      | Selected item                     | `.nav-folder.is-selected`        |

### File List Pane Classes

| Class                    | Description                             |
| ------------------------ | --------------------------------------- |
| `.nn-list-pane`          | File list container                     |
| `.nn-list-pane-scroller` | Scrollable file list                    |
| `.nn-file`               | Individual file                         |
| `.nn-file-name`          | File name text                          |
| `.nn-file-preview`       | Preview text                            |
| `.nn-file-date`          | Modified date                           |
| `.nn-file-folder`        | Parent folder (when showing subfolders) |
| `.nn-file-tags`          | Tag container                           |
| `.nn-file-tags .nn-tag`  | Individual tag badge                    |
| `.nn-file.nn-selected`   | Selected file                           |
| `.nn-date-group-header`  | Date group headers (Today, Yesterday)   |

### State Classes

| Class                  | When Applied               |
| ---------------------- | -------------------------- |
| `.nn-selected`         | Item is selected           |
| `.nn-focused`          | Item has keyboard focus    |
| `.nn-expanded`         | Folder/tag is expanded     |
| `.nn-has-custom-color` | User set custom color      |
| `.nn-has-folder-note`  | Folder has associated note |
| `.nn-pinned`           | File is pinned             |

## DOM Structure

### Actual DOM Structure (Virtual Scrolling)

```mermaid
graph TD
    Container[.nn-notebook-navigator-container]
    Container --> NavPane[.nn-navigation-pane]
    Container --> ListPane[.nn-list-pane]

    NavPane --> NavScroller[.nn-navigation-pane-scroller]
    NavScroller --> NavItem1[.nn-navitem - Folder 1]
    NavScroller --> NavItem2[.nn-navitem - Folder 2]
    NavScroller --> NavItem3[.nn-navitem - Tag 1]
    NavScroller --> NavItem4[.nn-navitem - Folder 3]

    ListPane --> ListScroller[.nn-list-pane-scroller]
    ListScroller --> FileItem1[.nn-file]
    ListScroller --> FileItem2[.nn-file]
    ListScroller --> FileItem3[.nn-file]
```

### Navigation Item Structure

```html
<div class="nn-navitem" data-path="/folder/path" data-level="0">
  <div class="nn-navitem-content">
    <div class="nn-navitem-chevron nn-navitem-chevron--has-children"></div>
    <span class="nn-navitem-icon">
      <!-- Lucide icon or emoji -->
    </span>
    <span class="nn-navitem-name">Folder Name</span>
    <span class="nn-navitem-spacer"></span>
    <span class="nn-navitem-count">42</span>
  </div>
</div>
```

### File Item Structure

```html
<div class="nn-file" data-path="path/to/file.md">
  <div class="nn-file-inner">
    <div class="nn-file-header">
      <div class="nn-file-title-row">
        <span class="nn-file-name">Note Title</span>
      </div>
      <div class="nn-file-date">2 hours ago</div>
      <div class="nn-file-tags">
        <span class="nn-tag">#tag1</span>
        <span class="nn-tag">#tag2</span>
      </div>
    </div>
    <div class="nn-file-preview">Preview text appears here...</div>
  </div>
</div>
```

## Quick Start

### Installation Instructions

1. Open Obsidian Settings (`Cmd/Ctrl + ,`)
2. Navigate to **Appearance** tab
3. Scroll down to **CSS snippets** section
4. Click **Open snippets folder** button
5. Create a new file called `notebook-navigator-theme.css`
6. Paste the CSS below
7. Return to Obsidian Settings > Appearance
8. Click the **Reload snippets** button
9. Toggle on your new snippet

### Complete Theme Example

Use this complete example as a starting point for your theme:

```css
/* LAYOUT BACKGROUNDS */
.nn-navigation-pane-scroller {
  background: #e6e9ff;
}

.nn-list-pane-scroller {
  background: #e8fcfb;
}

/* Pane headers */
.nn-navigation-pane .nn-pane-header {
  --nn-header-bg: #e6e9ff;
}

.nn-list-pane .nn-pane-header {
  --nn-header-bg: #e8fcfb;
}

.nn-pane-header {
  --nn-header-border-color: #a78bfa;
}

/* Date group headers */
.nn-date-group-header {
  background: #e8fcfb;
  color: #64748b;
}

/* List pane header breadcrumb */
.nn-pane-header-text {
  color: #475569 !important;
}

/* Mobile breadcrumb */
.nn-mobile-title {
  color: #475569 !important;
}

/* Mobile tab bar buttons */
.nn-tab-bar-button svg {
  stroke: #6366f1 !important;
}

.nn-tab-bar-button-active {
  background-color: #ddd6fe !important;
}

.nn-tab-bar-button-active svg {
  stroke: #7c3aed !important;
}

/* Pane header icons and buttons */
.nn-pane-header-icon {
  color: #8b5cf6 !important;
}

.nn-pane-header-icon svg {
  stroke: #8b5cf6 !important;
}

.nn-icon-button {
  color: #6366f1 !important;
}

.nn-icon-button svg {
  stroke: #6366f1 !important;
}

.nn-icon-button:hover {
  background-color: #fef3c7 !important;
}

.nn-icon-button-active {
  background-color: #ddd6fe !important;
  color: #7c3aed !important;
}

.nn-icon-button-active svg {
  stroke: #7c3aed !important;
}

/* Resize handle */
.nn-resize-handle {
  --nn-resize-bg: #e8fcfb;
  --nn-resize-hover-bg: #a8edea;
  --nn-resize-hover-opacity: 1;
  --nn-resize-active-opacity: 0.8;
}

/* File separators */
.nn-virtual-file-item {
  --nn-separator-color: #c8e6c9;
  --nn-separator-height: 2px;
}

/* NAVIGATION ITEMS (Folders & Tags) */
.nn-navitem {
  background: #e6e9ff;
  --nn-selection-bg: #667eea;
  --nn-selection-bg-inactive: #f093fb;
  --nn-selection-radius: 12px;
  --nn-hover-bg: #fee140;
  --nn-hover-radius: 8px;
}

/* Folder-specific */
.nn-navitem.nn-folder {
  --nn-selection-bg: #667eea;
}

.nn-navitem.nn-folder .nn-navitem-name {
  color: #4a5568;
}

.nn-navitem.nn-folder .nn-navitem-icon {
  color: #667eea;
}

/* Tag-specific */
.nn-navitem.nn-tag {
  --nn-selection-bg: #f093fb;
}

.nn-navitem.nn-tag .nn-navitem-name {
  color: #553c9a;
}

.nn-navitem.nn-tag .nn-navitem-icon {
  color: #f093fb;
}

/* Virtual folders */
.nn-navitem.nn-virtual .nn-navitem-name {
  color: #64748b;
  font-style: italic;
}

/* Chevrons and counts */
.nn-navitem-chevron {
  color: #94a3b8;
}

.nn-navitem-chevron:hover {
  color: #475569;
}

.nn-navitem-count {
  background: #f093fb;
  color: white;
  padding: 0 6px;
  border-radius: 10px;
}

/* FILE LIST ITEMS */
.nn-file {
  background: #e8fcfb;
  --nn-selection-bg: #a8edea;
  --nn-selection-bg-inactive: #ffecd2;
  --nn-selection-radius: 16px;
}

.nn-file-name {
  color: #1e293b !important;
  font-weight: 500;
}

.nn-file-preview {
  color: #64748b !important;
}

.nn-file-date {
  color: #94a3b8 !important;
}

.nn-file-folder {
  color: #a78bfa !important;
}

/* Tag badges in files */
.nn-file-tags .nn-tag {
  background: #f093fb;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
}

/* Pinned files */
.nn-file.nn-pinned {
  background: #fff4e6;
}

.nn-file.nn-pinned .nn-file-name {
  color: #92400e;
}

/* DEPTH-BASED STYLING (Optional) */
.nn-navitem.nn-folder[data-level='0'] .nn-navitem-name {
  font-weight: 600;
  color: #2563eb;
}

.nn-navitem.nn-folder[data-level='1'] .nn-navitem-name {
  color: #3b82f6;
}

.nn-navitem.nn-folder[data-level='2'] .nn-navitem-name {
  color: #60a5fa;
}

.nn-navitem.nn-folder[data-level='3'] .nn-navitem-name,
.nn-navitem.nn-folder[data-level='4'] .nn-navitem-name {
  color: #93c5fd;
}
```

## Advanced Techniques

### Supporting Light and Dark Modes

To support both light and dark modes, you need to define your styles twice -
once for each mode. Obsidian uses `.theme-light` and `.theme-dark` classes on
the body element.

#### Example: Mode-Aware Theme

```css
/* Light mode - pastel colors */
.theme-light .nn-navitem {
  background: #ffeeff; /* Light pink */
  --nn-selection-bg: #ffccff; /* Pastel purple */
}

.theme-light .nn-navitem-name {
  color: #ff66cc; /* Pink text */
}

.theme-light .nn-file-name {
  color: #cc33ff !important; /* Purple text */
}

/* Dark mode - pastel colors on dark */
.theme-dark .nn-navitem {
  background: #330033; /* Dark purple */
  --nn-selection-bg: #663366; /* Muted purple */
}

.theme-dark .nn-navitem-name {
  color: #ffaaff; /* Light pink text */
}

.theme-dark .nn-file-name {
  color: #ff99ff !important; /* Light purple text */
}
```

### User Custom Colors Override

Users can right-click any folder or tag and select "Change color" to override
your theme colors. When they do:

1. Their color is applied as an inline style (e.g., `style="color: #ff0000;"`)
2. The class `nn-has-custom-color` is added to the name element
3. Inline styles automatically override your theme CSS

**This means:** Write your theme CSS normally. User preferences will
automatically take priority when set.

### Different Styles for Custom vs. Theme Colors

```css
/* Default theme style for folders */
.nn-navitem.nn-folder .nn-navitem-name {
  color: #4a9eff;
  font-weight: 500;
}

/* When user has NOT set a custom color - add an underline */
.nn-navitem.nn-folder .nn-navitem-name:not(.nn-has-custom-color) {
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* When user HAS set a custom color - make it italic */
.nn-navitem.nn-folder .nn-navitem-name.nn-has-custom-color {
  font-style: italic;
}
```

### Depth-Based Styling

Notebook Navigator adds a `data-level` attribute to each item indicating its
nesting depth (0 = root, 1 = first level, etc.):

```css
/* Root level folders - darker blue, bold */
.nn-navitem.nn-folder[data-level='0'] .nn-navitem-name {
  color: #2563eb;
  font-weight: 600;
}

/* First level nested - medium blue */
.nn-navitem.nn-folder[data-level='1'] .nn-navitem-name {
  color: #3b82f6;
}

/* Second level nested - lighter blue */
.nn-navitem.nn-folder[data-level='2'] .nn-navitem-name {
  color: #60a5fa;
}

/* Deep nesting (3+ levels) - very light */
.nn-navitem.nn-folder[data-level='3'] .nn-navitem-name,
.nn-navitem.nn-folder[data-level='4'] .nn-navitem-name {
  color: #93c5fd;
}
```

## Additional Resources

- [Notebook Navigator GitHub](https://github.com/johansan/notebook-navigator)
- [CSS Architecture Documentation](./storage-architecture.md)
- [API Reference](./api-reference.md)

## Need Help?

If you're a theme developer and need assistance adding Notebook Navigator
support:

1. Open an issue on the
   [GitHub repository](https://github.com/johansan/notebook-navigator/issues)
2. Tag it with "theme-support"
3. Include your theme name and specific challenges

We're happy to help make your theme compatible with Notebook Navigator!
