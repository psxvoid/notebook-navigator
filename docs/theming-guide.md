# Notebook Navigator Theming Guide

## Table of Contents

- [Introduction](#introduction)
- [CSS Variables Reference](#css-variables-reference)
  - [Navigation pane](#navigation-pane)
  - [Pane divider](#pane-divider)
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

| Variable                   | Default                       | Description                                                  |
| -------------------------- | ----------------------------- | ------------------------------------------------------------ |
| `--nn-theme-nav-bg`        | `var(--background-secondary)` | Navigation pane background (desktop only, see mobile styles) |
| `--nn-theme-nav-header-bg` | `var(--background-secondary)` | Navigation header background                                 |

#### Folder & tag items

| Variable                                    | Default                            | Description                                       |
| ------------------------------------------- | ---------------------------------- | ------------------------------------------------- |
| `--nn-theme-navitem-chevron-color`          | `var(--text-muted)`                | Color for expand/collapse arrows                  |
| `--nn-theme-navitem-icon-color`             | `var(--text-muted)`                | Icon color for folders and tags                   |
| `--nn-theme-navitem-name-color`             | `var(--text-normal)`               | Text color for folder and tag names               |
| `--nn-theme-navitem-count-color`            | `var(--text-muted)`                | Text color for file count badges                  |
| `--nn-theme-navitem-count-bg`               | `transparent`                      | Background color for file count badges            |
| `--nn-theme-navitem-hover-bg`               | `var(--background-modifier-hover)` | Item hover background color                       |
| `--nn-theme-navitem-selected-bg`            | `var(--text-selection)`            | Selected item background color                    |
| `--nn-theme-navitem-selected-inactive-bg`   | `var(--background-modifier-hover)` | Selected item background when pane is inactive    |
| `--nn-theme-navitem-selected-chevron-color` | `var(--text-accent)`               | Expand/collapse arrow color when item is selected |
| `--nn-theme-navitem-selected-icon-color`    | `var(--text-accent)`               | Icon color when item is selected                  |
| `--nn-theme-navitem-selected-name-color`    | `var(--text-accent)`               | Folder/tag name color when selected               |
| `--nn-theme-navitem-selected-count-color`   | `var(--text-on-accent)`            | File count text color when item is selected       |
| `--nn-theme-navitem-selected-count-bg`      | `var(--interactive-accent)`        | File count background color when selected         |

#### Text styling

These variables control the font weight and decoration of folder/tag names.
Priority order: folder note styles override custom color styles, which override
the default style.

| Variable                                           | Default     | Description                                                              |
| -------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `--nn-theme-navitem-name-font-weight`              | `400`       | Default font weight for all folder/tag names (400 = regular, 600 = bold) |
| `--nn-theme-navitem-custom-color-name-font-weight` | `600`       | Font weight for items with custom colors (overrides default)             |
| `--nn-theme-navitem-folder-note-name-font-weight`  | `600`       | Font weight for folders with notes (overrides all others)                |
| `--nn-theme-navitem-folder-note-name-decoration`   | `underline` | Text decoration for folder notes (none, underline, underline dotted)     |

### Pane divider

| Variable                                    | Default                             | Description                                               |
| ------------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| `--nn-theme-divider-border-color`           | `var(--background-modifier-border)` | Color of the vertical border between panes                |
| `--nn-theme-divider-resize-handle-hover-bg` | `var(--interactive-accent)`         | Background color when hovering the pane divider to resize |

### List pane (files)

| Variable                                  | Default                             | Description                                               |
| ----------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| `--nn-theme-list-bg`                      | `var(--background-primary)`         | Background color of the list pane                         |
| `--nn-theme-list-header-bg`               | `var(--background-primary)`         | Background color of the list pane header                  |
| `--nn-theme-list-header-icon-color`       | `var(--text-muted)`                 | Folder/tag icon color shown to the left of the breadcrumb |
| `--nn-theme-list-header-breadcrumb-color` | `var(--text-muted)`                 | Text color for the breadcrumb path in the list header     |
| `--nn-theme-list-separator-color`         | `var(--background-modifier-border)` | Divider line color between files                          |
| `--nn-theme-list-group-header-text-color` | `var(--text-muted)`                 | Text color for date groups and pinned section             |

#### File items

| Variable                                      | Default                             | Description                                                 |
| --------------------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| `--nn-theme-file-name-color`                  | `var(--text-normal)`                | Text color for file names                                   |
| `--nn-theme-file-date-color`                  | `var(--text-normal)`                | Text color for creation or modification dates               |
| `--nn-theme-file-preview-color`               | `var(--text-muted)`                 | Text color for content preview                              |
| `--nn-theme-file-tag-bg`                      | `var(--background-modifier-border)` | Background color for tag pills                              |
| `--nn-theme-file-tag-text-color`              | `var(--text-muted)`                 | Text color for tag pills                                    |
| `--nn-theme-file-tag-custom-color-text-color` | `white`                             | Text color for tags with custom colors                      |
| `--nn-theme-file-parent-color`                | `var(--text-muted)`                 | Text color for parent folder path (when showing subfolders) |
| `--nn-theme-file-selected-bg`                 | `var(--text-selection)`             | Selected file background color                              |
| `--nn-theme-file-selected-inactive-bg`        | `var(--background-modifier-hover)`  | Selected file background when pane is inactive              |

#### Quick actions

| Variable                                    | Default                                                          | Description                                                       |
| ------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| `--nn-theme-quick-actions-bg`               | `color-mix(in srgb, var(--background-primary) 95%, transparent)` | Background color of quick actions toolbar (supports transparency) |
| `--nn-theme-quick-actions-border`           | `var(--background-modifier-border)`                              | Border color of quick actions toolbar                             |
| `--nn-theme-quick-actions-icon-color`       | `var(--text-muted)`                                              | Icon color for quick action buttons                               |
| `--nn-theme-quick-actions-icon-hover-color` | `var(--text-normal)`                                             | Icon color when hovering quick action buttons                     |
| `--nn-theme-quick-actions-separator-color`  | `var(--background-modifier-border)`                              | Divider color between quick action buttons                        |

### Headers

| Variable                         | Default                             | Description                  |
| -------------------------------- | ----------------------------------- | ---------------------------- |
| `--nn-theme-header-border-color` | `var(--background-modifier-border)` | Border color of pane headers |

#### Header buttons

| Variable                                       | Default                            | Description                                        |
| ---------------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| `--nn-theme-header-button-icon-color`          | `var(--text-muted)`                | Default icon color for header buttons              |
| `--nn-theme-header-button-hover-bg`            | `var(--background-modifier-hover)` | Background color when hovering header buttons      |
| `--nn-theme-header-button-active-bg`           | `var(--background-modifier-hover)` | Background color for active/toggled header buttons |
| `--nn-theme-header-button-active-icon-color`   | `var(--text-normal)`               | Icon color for active/toggled header buttons       |
| `--nn-theme-header-button-disabled-icon-color` | `var(--text-muted)`                | Icon color for disabled header buttons             |

### Mobile styles

| Variable                                  | Default                            | Description                                                                  |
| ----------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| `--nn-theme-mobile-nav-bg`                | `var(--background-primary)`        | Background color of navigation pane on mobile (by default, both panes match) |
| `--nn-theme-mobile-tab-icon-color`        | `var(--text-muted)`                | Icon color in mobile tab bar                                                 |
| `--nn-theme-mobile-tab-active-bg`         | `var(--background-modifier-hover)` | Background color for active tab                                              |
| `--nn-theme-mobile-tab-active-icon-color` | `var(--text-normal)`               | Icon color for active tab                                                    |

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
  --nn-theme-navitem-chevron-color: #c4b5fd; /* Light purple arrows */
  --nn-theme-navitem-icon-color: #a78bfa; /* Vibrant purple icons */
  --nn-theme-navitem-name-color: #4c1d95; /* Deep purple text */
  --nn-theme-navitem-count-color: #ffffff; /* White count text */
  --nn-theme-navitem-count-bg: #ec4899; /* Hot pink badge */
  --nn-theme-navitem-hover-bg: #fdf2f8; /* Soft pink hover */
  --nn-theme-navitem-selected-bg: #c084fc; /* Bright purple selection */
  --nn-theme-navitem-selected-inactive-bg: #e9d5ff; /* Muted purple inactive */

  /* Selected item styling */
  --nn-theme-navitem-selected-chevron-color: #ffffff; /* White chevron when selected */
  --nn-theme-navitem-selected-icon-color: #ffffff; /* White icon when selected */
  --nn-theme-navitem-selected-name-color: #ffffff; /* White text when selected */
  --nn-theme-navitem-selected-count-color: #c084fc; /* Purple count text when selected */
  --nn-theme-navitem-selected-count-bg: #ffffff; /* White count background when selected */

  /* Text styling */
  --nn-theme-navitem-name-font-weight: 400; /* Regular weight */
  --nn-theme-navitem-custom-color-name-font-weight: 600; /* Bold for custom colors */
  --nn-theme-navitem-folder-note-name-font-weight: 600; /* Bold for folder notes */
  --nn-theme-navitem-folder-note-name-decoration: underline; /* Underline folder notes */

  /* ========================================
     PANE DIVIDER
     ======================================== */

  --nn-theme-divider-border-color: #d8b4fe; /* Soft purple border */
  --nn-theme-divider-resize-handle-hover-bg: #818cf8; /* Bright indigo on hover */

  /* ========================================
     LIST PANE (Files)
     ======================================== */

  /* Pane background */
  --nn-theme-list-bg: #fefcff; /* Near white with purple tint */
  --nn-theme-list-header-bg: #faf5ff; /* Light purple header */
  --nn-theme-list-header-icon-color: #a855f7; /* Folder/tag icon in header */
  --nn-theme-list-header-breadcrumb-color: #581c87; /* Breadcrumb path text */
  --nn-theme-list-separator-color: #e9d5ff; /* Soft purple dividers */
  --nn-theme-list-group-header-text-color: #9333ea; /* Rich purple headers */

  /* File items */
  --nn-theme-file-name-color: #1e1b4b; /* Deep indigo text */
  --nn-theme-file-date-color: #9ca3af; /* Light gray date */
  --nn-theme-file-preview-color: #6b7280; /* Neutral gray preview */
  --nn-theme-file-tag-bg: #fce7f3; /* Pink tag background */
  --nn-theme-file-tag-text-color: #a21caf; /* Deep pink tag text */
  --nn-theme-file-tag-custom-color-text-color: #ffffff; /* White text for custom colored tags */
  --nn-theme-file-parent-color: #c084fc; /* Purple folder path */
  --nn-theme-file-selected-bg: #c7d2fe; /* Indigo selection */
  --nn-theme-file-selected-inactive-bg: #f3e8ff; /* Light purple inactive */

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

  /* Header buttons */
  --nn-theme-header-button-icon-color: #9333ea; /* Purple button icons */
  --nn-theme-header-button-hover-bg: #fae8ff; /* Light purple hover */
  --nn-theme-header-button-active-bg: #f3e8ff; /* Active purple background */
  --nn-theme-header-button-active-icon-color: #6b21a8; /* Deep purple active */
  --nn-theme-header-button-disabled-icon-color: #d4d4d8; /* Gray disabled */

  /* ========================================
     MOBILE STYLES
     ======================================== */

  --nn-theme-mobile-nav-bg: #faf5ff; /* Light purple navigation on mobile */
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
  --nn-theme-navitem-selected-bg: #ffccff; /* Pastel purple */
  --nn-theme-navitem-name-color: #ff66cc; /* Pink text */
  --nn-theme-navitem-hover-bg: #ffddff; /* Very light pink */
  --nn-theme-navitem-selected-chevron-color: #990099; /* Deep purple chevron when selected */
  --nn-theme-navitem-selected-icon-color: #990099; /* Deep purple icon when selected */
  --nn-theme-navitem-selected-name-color: #990099; /* Deep purple text when selected */
  --nn-theme-navitem-selected-count-color: #ffffff; /* White count text when selected */
  --nn-theme-navitem-selected-count-bg: #ff66cc; /* Pink count background when selected */

  /* File list */
  --nn-theme-list-bg: #fff0ff; /* Very light purple */
  --nn-theme-file-name-color: #cc33ff; /* Purple text */
  --nn-theme-file-selected-bg: #ffccff; /* Pastel purple */
  --nn-theme-file-preview-color: #ff99cc; /* Light pink */
  --nn-theme-file-tag-custom-color-text-color: #000000; /* Black text for custom tags in light mode */
}

/* Dark mode - pastel colors on dark */
.theme-dark {
  /* Navigation pane */
  --nn-theme-nav-bg: #330033; /* Dark purple */
  --nn-theme-navitem-selected-bg: #663366; /* Muted purple */
  --nn-theme-navitem-name-color: #ffaaff; /* Light pink text */
  --nn-theme-navitem-hover-bg: #442244; /* Dark purple hover */
  --nn-theme-navitem-selected-chevron-color: #ffccff; /* Light purple chevron when selected */
  --nn-theme-navitem-selected-icon-color: #ffccff; /* Light purple icon when selected */
  --nn-theme-navitem-selected-name-color: #ffccff; /* Light purple text when selected */
  --nn-theme-navitem-selected-count-color: #330033; /* Dark purple count text when selected */
  --nn-theme-navitem-selected-count-bg: #ffaaff; /* Light pink count background when selected */

  /* File list */
  --nn-theme-list-bg: #2a002a; /* Very dark purple */
  --nn-theme-file-name-color: #ff99ff; /* Light purple text */
  --nn-theme-file-selected-bg: #663366; /* Muted purple */
  --nn-theme-file-preview-color: #cc99cc; /* Muted pink */
  --nn-theme-file-tag-custom-color-text-color: #ffffff; /* White text for custom tags in dark mode */
}
```

### User Custom Colors Override

When users set custom colors (right-click → "Change color"), their choices
automatically override your theme through inline styles.

## Style Settings Support

Notebook Navigator fully supports the Style Settings plugin. When users install
Style Settings, they can customize all these variables through a UI. Your theme
values become the defaults that users can override.
