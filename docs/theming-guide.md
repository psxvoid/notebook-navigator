# Notebook Navigator Theming Guide

## Table of Contents

- [Introduction](#introduction)
- [CSS Variables Reference](#css-variables-reference)
  - [Navigation pane](#navigation-pane)
  - [Resize handle](#resize-handle)
  - [List pane (files)](#list-pane-files)
  - [Headers](#headers)
  - [Mobile styles](#mobile-styles)
- [Complete Theme Example](#complete-theme-example)
- [Advanced Techniques](#advanced-techniques)
  - [Supporting Light and Dark Modes](#supporting-light-and-dark-modes)
  - [User Custom Colors Override](#user-custom-colors-override)
  - [Depth-Based Styling](#depth-based-styling)
- [Style Settings Support](#style-settings-support)

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

### Resize handle

| Variable                            | Default                     | Description                    |
| ----------------------------------- | --------------------------- | ------------------------------ |
| `--nn-theme-resize-handle-bg`       | `var(--background-primary)` | Resize handle background       |
| `--nn-theme-resize-handle-hover-bg` | `var(--interactive-accent)` | Resize handle hover background |

### List pane (files)

| Variable                             | Default                             | Description             |
| ------------------------------------ | ----------------------------------- | ----------------------- |
| `--nn-theme-list-bg`                 | `var(--background-primary)`         | List pane background    |
| `--nn-theme-list-header-bg`          | `var(--background-primary)`         | List header background  |
| `--nn-theme-list-separator-color`    | `var(--background-modifier-border)` | File divider line color |
| `--nn-theme-list-group-header-color` | `var(--text-muted)`                 | Group header color      |

#### File items

| Variable                                | Default                             | Description                   |
| --------------------------------------- | ----------------------------------- | ----------------------------- |
| `--nn-theme-file-name-color`            | `var(--text-normal)`                | File name color               |
| `--nn-theme-file-preview-color`         | `var(--text-muted)`                 | Preview text color            |
| `--nn-theme-file-date-color`            | `var(--text-normal)`                | Modified date color           |
| `--nn-theme-file-parent-color`          | `var(--text-muted)`                 | Parent folder path color      |
| `--nn-theme-file-tag-bg`                | `var(--background-modifier-border)` | Tag pill background           |
| `--nn-theme-file-tag-color`             | `var(--text-muted)`                 | Tag pill text color           |
| `--nn-theme-file-selection-bg`          | `var(--text-selection)`             | Selected file background      |
| `--nn-theme-file-selection-inactive-bg` | `var(--background-modifier-hover)`  | Selected file (inactive pane) |

#### Quick actions

| Variable                                    | Default                                                          | Description                         |
| ------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------- |
| `--nn-theme-quick-actions-bg`               | `color-mix(in srgb, var(--background-primary) 95%, transparent)` | Panel background (semi-transparent) |
| `--nn-theme-quick-actions-border`           | `var(--background-modifier-border)`                              | Panel border color                  |
| `--nn-theme-quick-actions-icon-color`       | `var(--text-muted)`                                              | Icon color                          |
| `--nn-theme-quick-actions-icon-hover-color` | `var(--text-normal)`                                             | Icon hover color                    |
| `--nn-theme-quick-actions-separator-color`  | `var(--background-modifier-border)`                              | Separator line color                |

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
  --nn-theme-nav-bg: #f8f5ff; /* Soft lavender background */
  --nn-theme-nav-header-bg: #ede9fe; /* Deeper lavender for header */

  /* Folder & tag items */
  --nn-theme-navitem-text-color: #4c1d95; /* Deep purple text */
  --nn-theme-navitem-icon-color: #a78bfa; /* Vibrant purple icons */
  --nn-theme-navitem-chevron-color: #c4b5fd; /* Light purple chevrons */
  --nn-theme-navitem-chevron-hover-color: #7c3aed; /* Bright purple on hover */
  --nn-theme-navitem-count-color: #ffffff; /* White count text */
  --nn-theme-navitem-count-bg: #ec4899; /* Hot pink badge */
  --nn-theme-navitem-hover-bg: #fdf2f8; /* Soft pink hover */
  --nn-theme-navitem-selection-bg: #c084fc; /* Bright purple selection */
  --nn-theme-navitem-selection-inactive-bg: #e9d5ff; /* Muted purple inactive */

  /* Tree depth colors - Beautiful gradient */
  --nn-theme-tree-level-0-color: #6366f1; /* Indigo */
  --nn-theme-tree-level-1-color: #8b5cf6; /* Purple */
  --nn-theme-tree-level-2-color: #a855f7; /* Bright purple */
  --nn-theme-tree-level-3-color: #d946ef; /* Magenta */

  /* ========================================
     RESIZE HANDLE
     ======================================== */

  --nn-theme-resize-handle-bg: #e0e7ff; /* Soft indigo */
  --nn-theme-resize-handle-hover-bg: #818cf8; /* Bright indigo on hover */

  /* ========================================
     LIST PANE (Files)
     ======================================== */

  /* Pane background */
  --nn-theme-list-bg: #fefcff; /* Near white with purple tint */
  --nn-theme-list-header-bg: #faf5ff; /* Light purple header */
  --nn-theme-list-separator-color: #e9d5ff; /* Soft purple dividers */
  --nn-theme-list-group-header-color: #9333ea; /* Rich purple headers */

  /* File items */
  --nn-theme-file-name-color: #1e1b4b; /* Deep indigo text */
  --nn-theme-file-preview-color: #6b7280; /* Neutral gray preview */
  --nn-theme-file-date-color: #9ca3af; /* Light gray date */
  --nn-theme-file-parent-color: #c084fc; /* Purple folder path */
  --nn-theme-file-tag-bg: #fce7f3; /* Pink tag background */
  --nn-theme-file-tag-color: #a21caf; /* Deep pink tag text */
  --nn-theme-file-selection-bg: #c7d2fe; /* Indigo selection */
  --nn-theme-file-selection-inactive-bg: #f3e8ff; /* Light purple inactive */

  /* Quick actions */
  --nn-theme-quick-actions-bg: rgba(
    255,
    251,
    254,
    0.92
  ); /* Semi-transparent pink-white */
  --nn-theme-quick-actions-border: #f9a8d4; /* Pink border */
  --nn-theme-quick-actions-icon-color: #8b5cf6; /* Purple icons */
  --nn-theme-quick-actions-icon-hover-color: #ec4899; /* Hot pink on hover */
  --nn-theme-quick-actions-separator-color: #fbcfe8; /* Light pink separator */

  /* ========================================
     HEADERS
     ======================================== */

  /* Header colors */
  --nn-theme-header-border-color: #d8b4fe; /* Soft purple border */
  --nn-theme-header-breadcrumb-color: #581c87; /* Deep purple breadcrumb */
  --nn-theme-header-icon-color: #a855f7; /* Bright purple icons */

  /* Header buttons */
  --nn-theme-header-button-color: #9333ea; /* Purple button icons */
  --nn-theme-header-button-hover-bg: #fae8ff; /* Light purple hover */
  --nn-theme-header-button-active-bg: #f3e8ff; /* Active purple background */
  --nn-theme-header-button-active-color: #6b21a8; /* Deep purple active */
  --nn-theme-header-button-disabled-color: #d4d4d8; /* Gray disabled */

  /* ========================================
     MOBILE STYLES
     ======================================== */

  --nn-theme-mobile-tab-icon-color: #a78bfa; /* Purple tab icons */
  --nn-theme-mobile-tab-active-bg: #ede9fe; /* Lavender active tab */
  --nn-theme-mobile-tab-active-icon-color: #7c3aed; /* Bright purple active icon */
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
automatically override your theme through inline styles.

### Depth-Based Styling

Style items based on their depth using the tree color variables:

```css
/* Using CSS variables for depth colors */
body {
  --nn-theme-tree-level-0-color: #2563eb; /* Root - dark blue */
  --nn-theme-tree-level-1-color: #3b82f6; /* Level 1 - medium blue */
  --nn-theme-tree-level-2-color: #60a5fa; /* Level 2 - light blue */
  --nn-theme-tree-level-3-color: #93c5fd; /* Level 3+ - very light blue */
}
```

## Style Settings Support

Notebook Navigator fully supports the Style Settings plugin. When users install
Style Settings, they can customize all these variables through a UI. Your theme
values become the defaults that users can override.
