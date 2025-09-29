# Notebook Navigator Theming Guide

## Table of Contents

- [Introduction](#introduction)
- [CSS Variables Reference](#css-variables-reference)
  - [Navigation pane](#navigation-pane)
  - [Pane divider](#pane-divider)
  - [List pane (files)](#list-pane-files)
  - [Headers (desktop only)](#headers-desktop-only)
  - [Mobile styles](#mobile-styles)
- [Complete Theme Example](#complete-theme-example)
- [Advanced Techniques](#advanced-techniques)
  - [Supporting Light and Dark Modes](#supporting-light-and-dark-modes)
  - [User Custom Colors Override](#user-custom-colors-override)
- [Style Settings Support](#style-settings-support)

## Introduction

This guide helps you add Notebook Navigator support to your Obsidian theme. Simply define these CSS variables in your
theme to customize how Notebook Navigator looks.

**Note for users:** If you just want to change colors, install the Style Settings plugin - no coding needed!

## CSS Variables Reference

All variables start with `--nn-theme-` and should be defined at the `body` level.

### Navigation pane

| Variable            | Default                       | Description                                                  |
| ------------------- | ----------------------------- | ------------------------------------------------------------ |
| `--nn-theme-nav-bg` | `var(--background-secondary)` | Navigation pane background (desktop only, see mobile styles) |

#### Folder & tag items

| Variable                                    | Default                                 | Description                                                   |
| ------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `--nn-theme-navitem-chevron-color`          | `var(--text-muted)`                     | Color for expand/collapse arrows                              |
| `--nn-theme-navitem-icon-color`             | `var(--text-muted)`                     | Icon color for folders and tags                               |
| `--nn-theme-navitem-name-color`             | `var(--text-normal)`                    | Text color for folder and tag names                           |
| `--nn-theme-navitem-count-color`            | `var(--text-muted)`                     | Text color for file count badges                              |
| `--nn-theme-navitem-count-bg`               | `transparent`                           | Background color for file count badges                        |
| `--nn-theme-navitem-count-border-radius`    | `8px`                                   | Corner radius for file count badges (0-8px)                   |
| `--nn-theme-navitem-border-radius`          | `4px`                                   | Corner radius for folder and tag items (0-14px)               |
| `--nn-theme-navitem-hover-bg`               | `var(--background-modifier-hover)`      | Item hover background color (desktop only)                    |
| `--nn-theme-navitem-selected-bg`            | `var(--text-selection)`                 | Selected item background color                                |
| `--nn-theme-navitem-selected-chevron-color` | `var(--nn-theme-navitem-chevron-color)` | Expand/collapse arrow color when item is selected             |
| `--nn-theme-navitem-selected-icon-color`    | `var(--nn-theme-navitem-icon-color)`    | Icon color when item is selected                              |
| `--nn-theme-navitem-selected-name-color`    | `var(--nn-theme-navitem-name-color)`    | Folder/tag name color when selected                           |
| `--nn-theme-navitem-selected-count-color`   | `var(--nn-theme-navitem-count-color)`   | File count text color when item is selected                   |
| `--nn-theme-navitem-selected-count-bg`      | `var(--nn-theme-navitem-count-bg)`      | File count background color when selected                     |
| `--nn-theme-navitem-selected-inactive-bg`   | `var(--background-modifier-hover)`      | Selected item background when pane is inactive (desktop only) |

#### Text styling

These variables control the font weight and decoration of folder/tag names. Priority order: folder note styles override
custom color styles, which override the default style.

| Variable                                           | Default     | Description                                                              |
| -------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `--nn-theme-navitem-name-font-weight`              | `400`       | Default font weight for all folder/tag names (400 = regular, 600 = bold) |
| `--nn-theme-navitem-count-font-weight`             | `400`       | Font weight for file count badges                                        |
| `--nn-theme-navitem-custom-color-name-font-weight` | `600`       | Font weight for items with custom colors (overrides default)             |
| `--nn-theme-navitem-folder-note-name-font-weight`  | `600`       | Font weight for folders with notes (overrides all others)                |
| `--nn-theme-navitem-folder-note-name-decoration`   | `underline` | Text decoration for folder notes (none, underline, underline dotted)     |

### Pane divider (desktop only)

| Variable                                    | Default                             | Description                                               |
| ------------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| `--nn-theme-divider-border-color`           | `var(--background-modifier-border)` | Color of the vertical border between panes                |
| `--nn-theme-divider-resize-handle-hover-bg` | `var(--interactive-accent)`         | Background color when hovering the pane divider to resize |

### List pane (files)

| Variable                              | Default                             | Description                                                                        |
| ------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `--nn-theme-list-bg`                  | `var(--background-primary)`         | Background color of the list pane                                                  |
| `--nn-theme-list-search-active-bg`    | `var(--text-highlight-bg)`          | Background color for the search field when a search query is active (desktop only) |
| `--nn-theme-list-search-border-color` | `var(--background-modifier-border)` | Border and focus ring color for the search field (desktop only)                    |
| `--nn-theme-list-heading-color`       | `var(--text-muted)`                 | Text color for the list pane overlay heading                                       |
| `--nn-theme-list-group-header-color`  | `var(--text-muted)`                 | Text color for date groups and pinned section                                      |
| `--nn-theme-list-separator-color`     | `var(--background-modifier-border)` | Divider line color between files                                                   |

#### File items

| Variable                                      | Default                              | Description                                                   |
| --------------------------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| `--nn-theme-file-name-color`                  | `var(--text-normal)`                 | Text color for file names                                     |
| `--nn-theme-file-preview-color`               | `var(--text-muted)`                  | Text color for content preview                                |
| `--nn-theme-file-feature-border-radius`       | `4px`                                | Corner radius for feature images (0-32px)                     |
| `--nn-theme-file-date-color`                  | `var(--text-normal)`                 | Text color for creation or modification dates                 |
| `--nn-theme-file-parent-color`                | `var(--text-muted)`                  | Text color for parent folder path (when showing subfolders)   |
| `--nn-theme-file-tag-color`                   | `var(--text-muted)`                  | Text color for tag pills                                      |
| `--nn-theme-file-tag-custom-color-text-color` | `white`                              | Text color for tags with custom colors                        |
| `--nn-theme-file-tag-bg`                      | `var(--background-modifier-border)`  | Background color for tag pills                                |
| `--nn-theme-file-tag-border-radius`           | `10px`                               | Corner radius for tag pills (0-10px)                          |
| `--nn-theme-file-border-radius`               | `8px`                                | Corner radius for file items (0-16px)                         |
| `--nn-theme-file-selected-bg`                 | `var(--text-selection)`              | Selected file background color                                |
| `--nn-theme-file-selected-name-color`         | `var(--nn-theme-file-name-color)`    | Text color for file names when selected                       |
| `--nn-theme-file-selected-preview-color`      | `var(--nn-theme-file-preview-color)` | Text color for content preview when selected                  |
| `--nn-theme-file-selected-date-color`         | `var(--nn-theme-file-date-color)`    | Text color for file dates when selected                       |
| `--nn-theme-file-selected-parent-color`       | `var(--nn-theme-file-parent-color)`  | Text color for parent folder path when selected               |
| `--nn-theme-file-selected-tag-color`          | `var(--nn-theme-file-tag-color)`     | Text color for tag pills when selected                        |
| `--nn-theme-file-selected-tag-bg`             | `var(--nn-theme-file-tag-bg)`        | Background color for tag pills when selected                  |
| `--nn-theme-file-selected-inactive-bg`        | `var(--background-modifier-hover)`   | Selected file background when pane is inactive (desktop only) |

#### Text styling

| Variable                                   | Default | Description                                    |
| ------------------------------------------ | ------- | ---------------------------------------------- |
| `--nn-theme-list-heading-font-weight`      | `600`   | Font weight for the list pane overlay heading  |
| `--nn-theme-list-group-header-font-weight` | `600`   | Font weight for date groups and pinned section |
| `--nn-theme-file-name-font-weight`         | `600`   | Font weight for file names                     |
| `--nn-theme-file-slim-name-font-weight`    | `400`   | Font weight for file names in slim mode        |
| `--nn-theme-file-preview-font-weight`      | `400`   | Font weight for file preview text              |
| `--nn-theme-file-date-font-weight`         | `400`   | Font weight for file dates                     |
| `--nn-theme-file-parent-font-weight`       | `400`   | Font weight for parent folder path             |
| `--nn-theme-file-tag-font-weight`          | `400`   | Font weight for tag pills                      |

#### Quick actions (desktop only)

| Variable                                    | Default                                                          | Description                                                       |
| ------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| `--nn-theme-quick-actions-bg`               | `color-mix(in srgb, var(--background-primary) 95%, transparent)` | Background color of quick actions toolbar (supports transparency) |
| `--nn-theme-quick-actions-border`           | `var(--background-modifier-border)`                              | Border color of quick actions toolbar                             |
| `--nn-theme-quick-actions-border-radius`    | `4px`                                                            | Corner radius for quick actions panel (0-12px)                    |
| `--nn-theme-quick-actions-icon-color`       | `var(--text-muted)`                                              | Icon color for quick action buttons                               |
| `--nn-theme-quick-actions-icon-hover-color` | `var(--text-normal)`                                             | Icon color when hovering quick action buttons                     |
| `--nn-theme-quick-actions-separator-color`  | `var(--background-modifier-border)`                              | Divider color between quick action buttons                        |

### Headers (desktop only)

| Variable                                       | Default                            | Description                                        |
| ---------------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| `--nn-theme-header-button-icon-color`          | `var(--text-muted)`                | Default icon color for header buttons              |
| `--nn-theme-header-button-hover-bg`            | `var(--background-modifier-hover)` | Background color when hovering header buttons      |
| `--nn-theme-header-button-active-bg`           | `var(--background-modifier-hover)` | Background color for active/toggled header buttons |
| `--nn-theme-header-button-active-icon-color`   | `var(--text-normal)`               | Icon color for active/toggled header buttons       |
| `--nn-theme-header-button-disabled-icon-color` | `var(--text-muted)`                | Icon color for disabled header buttons             |

### Mobile styles

| Variable                                               | Default                             | Description                                                                  |
| ------------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------- |
| `--nn-theme-mobile-nav-bg`                             | `var(--background-primary)`         | Background color of navigation pane on mobile (by default, both panes match) |
| `--nn-theme-mobile-list-header-link-color`             | `var(--link-color)`                 | Color for back button and clickable breadcrumb segments on mobile            |
| `--nn-theme-mobile-list-header-breadcrumb-color`       | `var(--text-normal)`                | Color for current folder and separators in breadcrumb on mobile              |
| `--nn-theme-mobile-list-header-breadcrumb-font-weight` | `600`                               | Font weight for mobile breadcrumb                                            |
| `--nn-theme-mobile-toolbar-bg`                         | `var(--background-secondary)`       | Background color of the mobile toolbar                                       |
| `--nn-theme-mobile-toolbar-border-color`               | `var(--background-modifier-border)` | Border color of the mobile toolbar                                           |
| `--nn-theme-mobile-toolbar-button-icon-color`          | `var(--link-color)`                 | Icon color for toolbar buttons                                               |
| `--nn-theme-mobile-toolbar-button-active-bg`           | `var(--background-modifier-hover)`  | Background color for active toolbar button                                   |
| `--nn-theme-mobile-toolbar-button-active-icon-color`   | `var(--link-color)`                 | Icon color for active toolbar button                                         |

## Complete Theme Example

Here's a complete example showing all variables styled with the JetBrains Darcula theme - a low-contrast dark theme
that's easy on the eyes:

```css
/* ========================================
   NOTEBOOK NAVIGATOR DARCULA THEME
   ======================================== */

body {
  /* ========================================
     NAVIGATION PANE (Folders & Tags)
     ======================================== */

  /* Pane background */
  --nn-theme-nav-bg: #3c3f41; /* Dark gray sidebar - navigation pane background */

  /* Folder & tag items */
  --nn-theme-navitem-chevron-color: #6e6e6e; /* Muted gray - expand/collapse arrows */
  --nn-theme-navitem-icon-color: #afb1b3; /* Light gray - folder/tag icons */
  --nn-theme-navitem-name-color: #a9b7c6; /* Soft blue-gray - folder/tag names */
  --nn-theme-navitem-count-color: #7f8b91; /* Muted gray - file count text */
  --nn-theme-navitem-count-bg: transparent; /* No background for count badges */
  --nn-theme-navitem-count-border-radius: 3px; /* Subtle rounded count badges */
  --nn-theme-navitem-border-radius: 3px; /* Subtle rounded corners */
  --nn-theme-navitem-hover-bg: #4b5059; /* Slightly lighter gray - hover background */
  --nn-theme-navitem-selected-bg: #4a78c8; /* Muted blue - selected item background */
  --nn-theme-navitem-selected-chevron-color: #c5c5c5; /* Light gray - selected item arrows */
  --nn-theme-navitem-selected-icon-color: #e6e6e6; /* Near white - selected item icons */
  --nn-theme-navitem-selected-name-color: #ffffff; /* White - selected item text */
  --nn-theme-navitem-selected-count-color: #e6e6e6; /* Light gray - selected item count text */
  --nn-theme-navitem-selected-count-bg: rgba(0, 0, 0, 0.2); /* Subtle dark overlay - selected count bg */
  --nn-theme-navitem-selected-inactive-bg: #464c55; /* Dark gray - inactive selected background */

  /* Text styling */
  --nn-theme-navitem-name-font-weight: 400; /* Regular weight for normal items */
  --nn-theme-navitem-custom-color-name-font-weight: 500; /* Medium for custom colored items */
  --nn-theme-navitem-folder-note-name-font-weight: 500; /* Medium for folder notes */
  --nn-theme-navitem-folder-note-name-decoration: none; /* No decoration for cleaner look */
  --nn-theme-navitem-count-font-weight: 400; /* Regular for count badges */

  /* ========================================
     PANE DIVIDER
     ======================================== */

  --nn-theme-divider-border-color: #323232; /* Dark gray - vertical divider between panes */
  --nn-theme-divider-resize-handle-hover-bg: #4a78c8; /* Blue accent - resize handle on hover */

  /* ========================================
     LIST PANE (Files)
     ======================================== */

  /* Pane background */
  --nn-theme-list-bg: #2b2b2b; /* Dark editor background - file list background */
  --nn-theme-list-search-active-bg: #515336; /* Yellow tint - active search field background */
  --nn-theme-list-search-border-color: #3c3c3c; /* Subtle gray - search field border */
  --nn-theme-list-heading-color: #d0d2d6; /* Light gray - list overlay heading */
  --nn-theme-list-separator-color: #3c3c3c; /* Very subtle - divider lines between files */
  --nn-theme-list-group-header-color: #7f8b91; /* Muted gray - date group headers */

  /* File items */
  --nn-theme-file-border-radius: 4px; /* Subtle rounded file items */
  --nn-theme-file-name-color: #a9b7c6; /* Soft blue-gray - file names */
  --nn-theme-file-feature-border-radius: 3px; /* Subtle rounded feature images */
  --nn-theme-file-preview-color: #7f8b91; /* Muted gray - preview text */
  --nn-theme-file-date-color: #6a8759; /* Muted green - file dates */
  --nn-theme-file-parent-color: #cc7832; /* Muted orange - parent folder path */
  --nn-theme-file-tag-color: #9876aa; /* Muted purple - tag text */
  --nn-theme-file-tag-bg: #383a3e; /* Dark gray - tag pill background */
  --nn-theme-file-tag-border-radius: 3px; /* Subtle rounded tag pills */
  --nn-theme-file-tag-custom-color-text-color: #ffffff; /* White - text for custom colored tags */
  --nn-theme-file-selected-bg: #4a78c8; /* Blue accent - selected file background */
  --nn-theme-file-selected-inactive-bg: #383c45; /* Dark gray - inactive selected file background */
  --nn-theme-file-selected-name-color: #ffffff; /* White - selected file names */
  --nn-theme-file-selected-preview-color: #c5c5c5; /* Light gray - selected preview text */
  --nn-theme-file-selected-date-color: #a5dc86; /* Bright green - selected file dates */
  --nn-theme-file-selected-parent-color: #ffd580; /* Bright orange - selected parent folder */
  --nn-theme-file-selected-tag-color: #ffffff; /* White - selected tag text */
  --nn-theme-file-selected-tag-bg: #5a5f66; /* Medium gray - selected tag background */

  /* File text styling */
  --nn-theme-list-heading-font-weight: 600; /* Bold for list overlay heading */
  --nn-theme-list-group-header-font-weight: 600; /* Bold for date groups */
  --nn-theme-file-name-font-weight: 600; /* Bold for file names */
  --nn-theme-file-slim-name-font-weight: 400; /* Regular for slim file names */
  --nn-theme-file-preview-font-weight: 400; /* Regular for preview text */
  --nn-theme-file-date-font-weight: 400; /* Regular weight for dates */
  --nn-theme-file-parent-font-weight: 400; /* Regular for parent folder */
  --nn-theme-file-tag-font-weight: 400; /* Regular for tag pills */

  /* Quick actions */
  --nn-theme-quick-actions-bg: rgba(43, 43, 43, 0.95); /* Semi-transparent dark - quick actions panel */
  --nn-theme-quick-actions-border: #555555; /* Subtle gray - quick actions border */
  --nn-theme-quick-actions-border-radius: 4px; /* Subtle rounded toolbar */
  --nn-theme-quick-actions-icon-color: #7f8b91; /* Muted gray - quick action icons */
  --nn-theme-quick-actions-icon-hover-color: #a9b7c6; /* Light gray - quick action icons on hover */
  --nn-theme-quick-actions-separator-color: #3c3c3c; /* Very subtle - separators between actions */

  /* ========================================
     HEADERS
     ======================================== */

  /* Header buttons */
  --nn-theme-header-button-icon-color: #7f8b91; /* Muted gray - header button icons */
  --nn-theme-header-button-hover-bg: #4b5059; /* Slightly lighter gray - header button hover background */
  --nn-theme-header-button-active-bg: #4a78c8; /* Blue accent - active/toggled button background */
  --nn-theme-header-button-active-icon-color: #ffffff; /* White - active/toggled button icons */
  --nn-theme-header-button-disabled-icon-color: #5c5c5c; /* Dark gray - disabled button icons */

  /* ========================================
     MOBILE STYLES
     ======================================== */

  --nn-theme-mobile-nav-bg: #2b2b2b; /* Dark editor background - mobile navigation background */
  --nn-theme-mobile-list-header-link-color: #589df6; /* Bright blue - mobile back button and breadcrumb links */
  --nn-theme-mobile-list-header-breadcrumb-color: #a9b7c6; /* Soft blue-gray - current folder and separators */
  --nn-theme-mobile-list-header-breadcrumb-font-weight: 600; /* Bold weight - mobile breadcrumb */
  --nn-theme-mobile-toolbar-bg: #3c3f41; /* Dark gray sidebar - mobile toolbar background */
  --nn-theme-mobile-toolbar-border-color: #555555; /* Subtle gray - mobile toolbar border */
  --nn-theme-mobile-toolbar-button-icon-color: #a9b7c6; /* Soft blue-gray - mobile toolbar icons */
  --nn-theme-mobile-toolbar-button-active-bg: #4a78c8; /* Blue accent - active mobile button background */
  --nn-theme-mobile-toolbar-button-active-icon-color: #ffffff; /* White - active mobile button icons */
}
```

## Advanced Techniques

### Supporting Light and Dark Modes

To support both light and dark modes, define your variables under `.theme-light` and `.theme-dark` classes:

#### Example: Mode-Aware Theme

```css
/* Light mode - pastel colors */
.theme-light {
  /* Navigation pane */
  --nn-theme-nav-bg: #ffeeff; /* Light pink */
  --nn-theme-navitem-name-color: #ff66cc; /* Pink text */
  --nn-theme-navitem-hover-bg: #ffddff; /* Very light pink */
  --nn-theme-navitem-selected-bg: #ffccff; /* Pastel purple */
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
  --nn-theme-navitem-name-color: #ffaaff; /* Light pink text */
  --nn-theme-navitem-hover-bg: #442244; /* Dark purple hover */
  --nn-theme-navitem-selected-bg: #663366; /* Muted purple */
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

When users set custom colors (right-click → "Change color" or "Change icon color"), their choices automatically override
your theme through inline styles.

## Style Settings Support

Notebook Navigator fully supports the Style Settings plugin. When users install Style Settings, they can customize all
these variables through a UI. Your theme values become the defaults that users can override.
