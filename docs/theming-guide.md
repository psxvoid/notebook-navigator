# Notebook Navigator Theming Guide

## Table of Contents

- [Introduction](#introduction)
- [CSS Variables Reference](#css-variables-reference)
  - [Navigation pane](#navigation-pane)
  - [List pane (files)](#list-pane-files)
  - [Headers](#headers)
  - [Mobile styles](#mobile-styles)
- [Complete Theme Example](#complete-theme-example)
- [Advanced Techniques](#advanced-techniques)
  - [Supporting Light and Dark Modes](#supporting-light-and-dark-modes)
  - [User Custom Colors Override](#user-custom-colors-override)
  - [Different Styles for Custom vs Theme Colors](#different-styles-for-custom-vs-theme-colors)
  - [Depth-Based Styling](#depth-based-styling)
- [For Regular Users (Style Settings)](#for-regular-users-style-settings)
- [For Theme Developers](#for-theme-developers)

## Introduction

This guide helps you add Notebook Navigator support to your Obsidian theme.
Simply define these CSS variables in your theme to customize how Notebook
Navigator looks.

**Note for users:** If you just want to change colors, install the Style
Settings plugin - no coding needed!

## CSS Variables Reference

All variables start with `--nn-theme-` and should be defined at the `body`
level.

### Navigation pane

| Variable                   | Default                       | Description                  |
| -------------------------- | ----------------------------- | ---------------------------- |
| `--nn-theme-nav-bg`        | `var(--background-secondary)` | Navigation pane background   |
| `--nn-theme-nav-header-bg` | `var(--background-secondary)` | Navigation header background |

#### Folder & tag items

| Variable                                   | Default                            | Description                   |
| ------------------------------------------ | ---------------------------------- | ----------------------------- |
| `--nn-theme-navitem-text-color`            | `var(--text-normal)`               | Folder/tag name color         |
| `--nn-theme-navitem-icon-color`            | `var(--text-muted)`                | Folder/tag icon color         |
| `--nn-theme-navitem-chevron-color`         | `var(--text-muted)`                | Expand/collapse arrow color   |
| `--nn-theme-navitem-chevron-hover-color`   | `var(--text-normal)`               | Chevron hover color           |
| `--nn-theme-navitem-count-color`           | `var(--text-muted)`                | File count text color         |
| `--nn-theme-navitem-count-bg`              | `transparent`                      | File count background         |
| `--nn-theme-navitem-hover-bg`              | `var(--background-modifier-hover)` | Item hover background         |
| `--nn-theme-navitem-selection-bg`          | `var(--text-selection)`            | Selected item background      |
| `--nn-theme-navitem-selection-inactive-bg` | `var(--background-modifier-hover)` | Selected item (inactive pane) |

#### Tree depth colors

| Variable                        | Default              | Description      |
| ------------------------------- | -------------------- | ---------------- |
| `--nn-theme-tree-level-0-color` | `var(--text-normal)` | Root level color |
| `--nn-theme-tree-level-1-color` | `var(--text-normal)` | Level 1 color    |
| `--nn-theme-tree-level-2-color` | `var(--text-normal)` | Level 2 color    |
| `--nn-theme-tree-level-3-color` | `var(--text-normal)` | Level 3+ color   |

### List pane (files)

| Variable                             | Default                             | Description             |
| ------------------------------------ | ----------------------------------- | ----------------------- |
| `--nn-theme-list-bg`                 | `var(--background-primary)`         | List pane background    |
| `--nn-theme-list-header-bg`          | `var(--background-primary)`         | List header background  |
| `--nn-theme-list-separator-color`    | `var(--background-modifier-border)` | File divider line color |
| `--nn-theme-list-group-header-color` | `var(--text-muted)`                 | Group header color      |

#### File items

| Variable                                | Default                            | Description                   |
| --------------------------------------- | ---------------------------------- | ----------------------------- |
| `--nn-theme-file-name-color`            | `var(--text-normal)`               | File name color               |
| `--nn-theme-file-preview-color`         | `var(--text-muted)`                | Preview text color            |
| `--nn-theme-file-date-color`            | `var(--text-faint)`                | Modified date color           |
| `--nn-theme-file-parent-color`          | `var(--text-muted)`                | Parent folder path color      |
| `--nn-theme-file-selection-bg`          | `var(--text-selection)`            | Selected file background      |
| `--nn-theme-file-selection-inactive-bg` | `var(--background-modifier-hover)` | Selected file (inactive pane) |

#### Resize handle

| Variable                            | Default                     | Description                    |
| ----------------------------------- | --------------------------- | ------------------------------ |
| `--nn-theme-resize-handle-hover-bg` | `var(--interactive-accent)` | Resize handle hover background |

### Headers

| Variable                             | Default                             | Description         |
| ------------------------------------ | ----------------------------------- | ------------------- |
| `--nn-theme-header-border-color`     | `var(--background-modifier-border)` | Header border color |
| `--nn-theme-header-breadcrumb-color` | `var(--text-muted)`                 | Header title color  |
| `--nn-theme-header-icon-color`       | `var(--text-muted)`                 | Header icon color   |

#### Header buttons

| Variable                                  | Default                            | Description                    |
| ----------------------------------------- | ---------------------------------- | ------------------------------ |
| `--nn-theme-header-button-color`          | `var(--text-muted)`                | Action button icon color       |
| `--nn-theme-header-button-hover-bg`       | `var(--background-modifier-hover)` | Action button hover background |
| `--nn-theme-header-button-active-bg`      | `var(--background-modifier-hover)` | Active button background       |
| `--nn-theme-header-button-active-color`   | `var(--text-normal)`               | Active button icon color       |
| `--nn-theme-header-button-disabled-color` | `var(--text-muted)`                | Disabled button icon color     |

### Mobile styles

| Variable                                  | Default                            | Description           |
| ----------------------------------------- | ---------------------------------- | --------------------- |
| `--nn-theme-mobile-tab-icon-color`        | `var(--text-muted)`                | Tab bar icon color    |
| `--nn-theme-mobile-tab-active-bg`         | `var(--background-modifier-hover)` | Active tab background |
| `--nn-theme-mobile-tab-active-icon-color` | `var(--text-normal)`               | Active tab icon color |

## Complete Theme Example

Here's a complete example showing all variables with custom colors:

```css
/* ========================================
   NOTEBOOK NAVIGATOR THEME CUSTOMIZATION
   All variables are defined at body level
   ======================================== */

body {
  /* ========================================
     NAVIGATION PANE (Folders & Tags)
     ======================================== */

  /* Pane background */
  --nn-theme-nav-bg: #e6e9ff; /* Light purple navigation pane */
  --nn-theme-nav-header-bg: #e6e9ff; /* Navigation header background */

  /* Folder & tag items */
  --nn-theme-navitem-text-color: #4a5568;
  --nn-theme-navitem-icon-color: #667eea;
  --nn-theme-navitem-chevron-color: #94a3b8;
  --nn-theme-navitem-chevron-hover-color: #475569;
  --nn-theme-navitem-count-color: white;
  --nn-theme-navitem-count-bg: #f093fb;
  --nn-theme-navitem-hover-bg: #fee140;
  --nn-theme-navitem-selection-bg: #667eea;
  --nn-theme-navitem-selection-inactive-bg: #f093fb;

  /* Tree depth colors */
  --nn-theme-tree-level-0-color: #2563eb;
  --nn-theme-tree-level-1-color: #3b82f6;
  --nn-theme-tree-level-2-color: #60a5fa;
  --nn-theme-tree-level-3-color: #93c5fd;

  /* ========================================
     LIST PANE (Files)
     ======================================== */

  /* Pane background */
  --nn-theme-list-bg: #e8fcfb; /* Light cyan file list pane */
  --nn-theme-list-header-bg: #e8fcfb; /* List header background */
  --nn-theme-list-separator-color: #c8e6c9; /* File divider lines */
  --nn-theme-list-group-header-color: #64748b; /* Group headers (dates, pinned) */

  /* File items */
  --nn-theme-file-name-color: #1e293b;
  --nn-theme-file-preview-color: #64748b;
  --nn-theme-file-date-color: #94a3b8;
  --nn-theme-file-parent-color: #a78bfa;
  --nn-theme-file-selection-bg: #a8edea;
  --nn-theme-file-selection-inactive-bg: #ffecd2;

  /* Resize handle */
  --nn-theme-resize-handle-hover-bg: #a8edea; /* Cyan on hover */

  /* ========================================
     HEADERS
     ======================================== */

  /* Header colors */
  --nn-theme-header-border-color: #a78bfa;
  --nn-theme-header-breadcrumb-color: #475569;
  --nn-theme-header-icon-color: #8b5cf6;

  /* Header buttons */
  --nn-theme-header-button-color: #6366f1;
  --nn-theme-header-button-hover-bg: #fef3c7;
  --nn-theme-header-button-active-bg: #ddd6fe;
  --nn-theme-header-button-active-color: #7c3aed;
  --nn-theme-header-button-disabled-color: #94a3b8;

  /* ========================================
     MOBILE STYLES
     ======================================== */

  --nn-theme-mobile-tab-icon-color: #6366f1;
  --nn-theme-mobile-tab-active-bg: #ddd6fe;
  --nn-theme-mobile-tab-active-icon-color: #7c3aed;
}
```

## Advanced Techniques

### Supporting Light and Dark Modes

To support both light and dark modes, define your variables under `.theme-light`
and `.theme-dark` classes:

#### Example: Mode-Aware Theme

```css
/* Light mode - pastel colors */
.theme-light {
  /* Navigation pane */
  --nn-theme-nav-bg: #ffeeff; /* Light pink */
  --nn-theme-navitem-selection-bg: #ffccff; /* Pastel purple */
  --nn-theme-navitem-text-color: #ff66cc; /* Pink text */
  --nn-theme-navitem-hover-bg: #ffddff; /* Very light pink */

  /* File list */
  --nn-theme-list-bg: #fff0ff; /* Very light purple */
  --nn-theme-file-name-color: #cc33ff; /* Purple text */
  --nn-theme-file-selection-bg: #ffccff; /* Pastel purple */
  --nn-theme-file-preview-color: #ff99cc; /* Light pink */
}

/* Dark mode - pastel colors on dark */
.theme-dark {
  /* Navigation pane */
  --nn-theme-nav-bg: #330033; /* Dark purple */
  --nn-theme-navitem-selection-bg: #663366; /* Muted purple */
  --nn-theme-navitem-text-color: #ffaaff; /* Light pink text */
  --nn-theme-navitem-hover-bg: #442244; /* Dark purple hover */

  /* File list */
  --nn-theme-list-bg: #2a002a; /* Very dark purple */
  --nn-theme-file-name-color: #ff99ff; /* Light purple text */
  --nn-theme-file-selection-bg: #663366; /* Muted purple */
  --nn-theme-file-preview-color: #cc99cc; /* Muted pink */
}
```

### User Custom Colors Override

When users set custom colors (right-click → "Change color"), their choices
automatically override your theme through inline styles. The element also gets a
`nn-has-custom-color` class you can target.

### Different Styles for Custom vs Theme Colors

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

Style items based on their depth using the tree color variables or `data-level`
attributes:

```css
/* Using CSS variables for depth colors */
body {
  --nn-theme-tree-level-0-color: #2563eb; /* Root - dark blue */
  --nn-theme-tree-level-1-color: #3b82f6; /* Level 1 - medium blue */
  --nn-theme-tree-level-2-color: #60a5fa; /* Level 2 - light blue */
  --nn-theme-tree-level-3-color: #93c5fd; /* Level 3+ - very light blue */
}

/* Or override directly with attribute selectors for more control */
.nn-navitem.nn-folder[data-level='0'] .nn-navitem-name {
  font-weight: 700; /* Make root folders bold */
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.nn-navitem.nn-folder[data-level='1'] .nn-navitem-name {
  font-weight: 600;
}

.nn-navitem.nn-folder[data-level='2'] .nn-navitem-name {
  font-style: italic;
}
```

## Style Settings Support

Notebook Navigator fully supports the Style Settings plugin. When users install
Style Settings, they can customize all these variables through a UI. Your theme
values become the defaults that users can override.
