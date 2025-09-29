#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STYLES_FILE="$PROJECT_ROOT/styles.css"
SRC_DIR="$PROJECT_ROOT/src"

if [ ! -f "$STYLES_FILE" ]; then
    printf "%bError:%b styles.css not found at %s\n" "$RED" "$NC" "$STYLES_FILE"
    exit 1
fi

if command -v rg >/dev/null 2>&1; then
    HAS_RG=1
else
    HAS_RG=0
fi

RG_CODE_GLOBS=(-g '!docs/**' -g '*.ts' -g '*.tsx' -g '*.js' -g '*.jsx')
GREP_CODE_INCLUDES=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --exclude-dir='docs')
RG_CSS_GLOBS=(-g '!docs/**' -g '*.css')
GREP_CSS_INCLUDES=(--include='*.css' --exclude-dir='docs')

show_progress() {
    local current=$1
    local total=$2

    if [ "$total" -le 0 ]; then
        return
    fi

    local percent=$((current * 100 / total))
    local filled=$((percent / 2))
    local empty=$((50 - filled))

    printf "\rProgress: ["
    printf "%${filled}s" | tr ' ' '='
    printf "%${empty}s" | tr ' ' '.'
    printf "] %3d%% (%d/%d)" "$percent" "$current" "$total"
}

code_search_literal() {
    local needle=$1
    if [ "$HAS_RG" -eq 1 ]; then
        rg --quiet --no-messages --fixed-strings "${RG_CODE_GLOBS[@]}" -- "$needle" "$SRC_DIR"
    else
        grep -R -q -F "${GREP_CODE_INCLUDES[@]}" -e "$needle" "$SRC_DIR" 2>/dev/null
    fi
}

css_search_literal() {
    local needle=$1
    if [ "$HAS_RG" -eq 1 ]; then
        rg --quiet --no-messages --fixed-strings "${RG_CSS_GLOBS[@]}" -- "$needle" "$PROJECT_ROOT"
    else
        grep -R -q -F "${GREP_CSS_INCLUDES[@]}" -e "$needle" "$PROJECT_ROOT" 2>/dev/null
    fi
}

style_settings_contains() {
    local var_name=$1
    local setting_id="${var_name#--}"
    sed -n '/@settings/,/\*\//p' "$STYLES_FILE" 2>/dev/null | grep -Fq "id: ${setting_id}"
}

OBSIDIAN_CLASSES=(
    "is-mobile"
    "theme-dark"
    "theme-light"
    "view-content"
    "modal"
    "modal-content"
    "modal-close-button"
    "menu-item"
    "menu-item-icon"
    "setting-item-heading"
)

is_obsidian_class() {
    local class_name=$1
    local known
    for known in "${OBSIDIAN_CLASSES[@]}"; do
        if [ "$known" = "$class_name" ]; then
            return 0
        fi
    done
    return 1
}

class_used_in_stylesheet() {
    local class_name=$1
    local count
    count=$(grep -c -E "\\.${class_name}([^a-zA-Z0-9_-]|$)" "$STYLES_FILE" 2>/dev/null || true)
    count=${count:-0}
    if [ "$count" -gt 1 ]; then
        return 0
    fi
    return 1
}

check_class_usage() {
    local class_name=$1

    if code_search_literal "$class_name"; then
        return 0
    fi

    local literal_patterns=(
        "? '${class_name}'"
        ": '${class_name}'"
        "'${class_name}' :"
        "\"${class_name}\""
    )
    local pattern
    for pattern in "${literal_patterns[@]}"; do
        if code_search_literal "$pattern"; then
            return 0
        fi
    done

    if [[ "$class_name" == *-* ]]; then
        local prefix="${class_name%-*}-"
        local dynamic_patterns=(
            "${prefix}\${"
            "'${prefix}' +"
            "\"${prefix}\" +"
        )
        for pattern in "${dynamic_patterns[@]}"; do
            if code_search_literal "$pattern"; then
                return 0
            fi
        done
    fi

    return 1
}

check_css_variable_usage() {
    local var_name=$1

    if css_search_literal "var(${var_name})"; then
        return 0
    fi

    if code_search_literal "$var_name"; then
        return 0
    fi

    if style_settings_contains "$var_name"; then
        return 0
    fi

    return 1
}

print_unused_classes() {
    local -a nn_classes=()
    local -a other_classes=()
    local class
    for class in "${UNUSED_CLASSES_LIST[@]}"; do
        if [[ "$class" == nn-* ]]; then
            nn_classes+=("$class")
        else
            other_classes+=("$class")
        fi
    done

    if ((${#nn_classes[@]})); then
        printf "\n%bnn- prefixed classes:%b\n" "$YELLOW" "$NC"
        for class in "${nn_classes[@]}"; do
            printf "  - %s\n" "$class"
        done
    fi

    if ((${#other_classes[@]})); then
        printf "\n%bOther classes:%b\n" "$YELLOW" "$NC"
        for class in "${other_classes[@]}"; do
            printf "  - %s\n" "$class"
        done
    fi

    printf "\n%bNote:%b The following Obsidian built-in classes are automatically excluded:\n" "$BLUE" "$NC"
    printf "      is-mobile, theme-dark, theme-light, view-content, modal, modal-content,\n"
    printf "      modal-close-button, menu-item, menu-item-icon, setting-item-heading\n"
    printf "\n%bTip:%b The nn- prefixed classes above are plugin-specific and can likely be removed\n" "$BLUE" "$NC"
    printf "     if they are confirmed unused in the codebase.\n"
}

print_unused_variables() {
    local -a nn_variables=()
    local -a other_variables=()
    local variable
    for variable in "${UNUSED_VARIABLES_LIST[@]}"; do
        if [[ "$variable" == --nn-* ]]; then
            nn_variables+=("$variable")
        else
            other_variables+=("$variable")
        fi
    done

    if ((${#nn_variables[@]})); then
        printf "\n%bnn- prefixed variables:%b\n" "$YELLOW" "$NC"
        for variable in "${nn_variables[@]}"; do
            printf "  - %s\n" "$variable"
        done
    fi

    if ((${#other_variables[@]})); then
        printf "\n%bOther variables:%b\n" "$YELLOW" "$NC"
        for variable in "${other_variables[@]}"; do
            printf "  - %s\n" "$variable"
        done
    fi

    printf "\n%bNote:%b CSS variables exposed in Style Settings are considered 'used'\n" "$BLUE" "$NC"
    printf "      Variables only referenced in docs/ folder are reported as 'unused'\n"
}

TEMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t css-check)
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

ALL_CLASSES="$TEMP_DIR/all-classes.txt"
ALL_VARIABLES="$TEMP_DIR/all-variables.txt"

printf "%bCSS Class & Variable Usage Checker%b\n" "$BOLD" "$NC"
printf "===================================\n\n"

if [ "$HAS_RG" -eq 1 ]; then
    printf "Search tool: %bripgrep%b\n\n" "$GREEN" "$NC"
else
    printf "Search tool: %bgrep%b (ripgrep not found)\n\n" "$YELLOW" "$NC"
fi

printf "%bStep 1:%b Extracting CSS classes and variables from styles.css...\n" "$BLUE" "$NC"

grep -o '\.[a-zA-Z][a-zA-Z0-9_-]*' "$STYLES_FILE" | sed 's/^\.//' | sort -u > "$ALL_CLASSES"
grep -o '\-\-[a-zA-Z0-9-]*:' "$STYLES_FILE" | sed 's/:$//' | sort -u > "$ALL_VARIABLES"

TOTAL_CLASSES=$(wc -l < "$ALL_CLASSES")
TOTAL_CLASSES=${TOTAL_CLASSES//[[:space:]]/}
TOTAL_CLASSES=${TOTAL_CLASSES:-0}
TOTAL_VARIABLES=$(wc -l < "$ALL_VARIABLES")
TOTAL_VARIABLES=${TOTAL_VARIABLES//[[:space:]]/}
TOTAL_VARIABLES=${TOTAL_VARIABLES:-0}

printf "Found %b%s%b unique CSS classes\n" "$GREEN" "$TOTAL_CLASSES" "$NC"
printf "Found %b%s%b unique CSS variables\n\n" "$GREEN" "$TOTAL_VARIABLES" "$NC"

printf "%bStep 2:%b Checking CSS class usage...\n" "$BLUE" "$NC"
printf "Searching in: %b%s%b\n\n" "$YELLOW" "$SRC_DIR" "$NC"

UNUSED_CLASSES_LIST=()
UNUSED_COUNT=0
CHECKED=0

if [ "$TOTAL_CLASSES" -gt 0 ]; then
    while IFS= read -r class_name; do
        [ -z "$class_name" ] && continue
        CHECKED=$((CHECKED + 1))
        show_progress "$CHECKED" "$TOTAL_CLASSES"

        if is_obsidian_class "$class_name"; then
            continue
        fi

        if check_class_usage "$class_name"; then
            continue
        fi

        if class_used_in_stylesheet "$class_name"; then
            continue
        fi

        UNUSED_CLASSES_LIST+=("$class_name")
        UNUSED_COUNT=$((UNUSED_COUNT + 1))
    done < "$ALL_CLASSES"

    printf "\n\n"
else
    printf "No CSS classes found in styles.css.\n\n"
fi

printf "%bStep 3:%b Checking CSS variable usage...\n\n" "$BLUE" "$NC"

UNUSED_VARIABLES_LIST=()
UNUSED_VAR_COUNT=0
CHECKED=0

if [ "$TOTAL_VARIABLES" -gt 0 ]; then
    while IFS= read -r var_name; do
        [ -z "$var_name" ] && continue
        CHECKED=$((CHECKED + 1))
        show_progress "$CHECKED" "$TOTAL_VARIABLES"

        if check_css_variable_usage "$var_name"; then
            continue
        fi

        UNUSED_VARIABLES_LIST+=("$var_name")
        UNUSED_VAR_COUNT=$((UNUSED_VAR_COUNT + 1))
    done < "$ALL_VARIABLES"

    printf "\n\n"
else
    printf "No CSS variables defined.\n\n"
fi

USED_COUNT=$((TOTAL_CLASSES - UNUSED_COUNT))
USED_VAR_COUNT=$((TOTAL_VARIABLES - UNUSED_VAR_COUNT))

printf "%bReport Summary%b\n" "$BOLD" "$NC"
printf "==============\n\n"

printf "%bCSS Classes:%b\n" "$BOLD" "$NC"
printf "  Total: %b%s%b\n" "$YELLOW" "$TOTAL_CLASSES" "$NC"
printf "  Used: %b%s%b\n" "$GREEN" "$USED_COUNT" "$NC"
printf "  Unused: %b%s%b\n" "$RED" "$UNUSED_COUNT" "$NC"

printf "\n%bCSS Variables:%b\n" "$BOLD" "$NC"
printf "  Total: %b%s%b\n" "$YELLOW" "$TOTAL_VARIABLES" "$NC"
printf "  Used: %b%s%b\n" "$GREEN" "$USED_VAR_COUNT" "$NC"
printf "  Unused: %b%s%b\n" "$RED" "$UNUSED_VAR_COUNT" "$NC"

if [ "$UNUSED_COUNT" -gt 0 ]; then
    printf "\n%bUnused CSS Classes:%b\n" "$BOLD" "$NC"
    printf "===================\n"
    print_unused_classes
fi

if [ "$UNUSED_VAR_COUNT" -gt 0 ]; then
    printf "\n%bUnused CSS Variables:%b\n" "$BOLD" "$NC"
    printf "=====================\n"
    print_unused_variables
fi

if [ "$UNUSED_COUNT" -eq 0 ] && [ "$UNUSED_VAR_COUNT" -eq 0 ]; then
    printf "\n%bAll CSS classes and variables are being used.%b\n" "$GREEN" "$NC"
fi

printf "\n%bScan complete!%b\n" "$BOLD" "$NC"
