#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the TypeScript release notes file
const releaseNotesPath = path.join(__dirname, '..', 'src', 'releaseNotes.ts');
const content = fs.readFileSync(releaseNotesPath, 'utf8');

// Find the RELEASE_NOTES array declaration
// Example: const RELEASE_NOTES: ReleaseNote[] = [...];
const releaseNotesMatch = content.match(/const RELEASE_NOTES.*?=\s*\[([\s\S]*?)\n\];/);
if (!releaseNotesMatch) {
    console.error('Could not find RELEASE_NOTES in file');
    process.exit(1);
}

// Extract the first object from the array (the latest release)
// Example: { version: '1.3.15', date: '2025-08-07', ... }
const releaseNotesContent = releaseNotesMatch[1];
const firstReleaseMatch = releaseNotesContent.match(/\{[\s\S]*?\n\s*\}/);
if (!firstReleaseMatch) {
    console.error('Could not find any release notes');
    process.exit(1);
}

// Object to store the extracted release data
const release = {};

// Extract version field
// Example: version: '1.3.15' or version: "1.3.15"
const versionMatch = firstReleaseMatch[0].match(/version:\s*['"]([^'"]+)['"]/);
if (versionMatch) release.version = versionMatch[1];

// Extract date field
// Example: date: '2025-08-07' or date: "2025-08-07"
const dateMatch = firstReleaseMatch[0].match(/date:\s*['"]([^'"]+)['"]/);
if (dateMatch) release.date = dateMatch[1];

// Extract optional info field
// Example: info: 'Release information' or info: "Release information"
const infoMatch = firstReleaseMatch[0].match(/info:\s*['"]([^'"]+)['"]/);
if (infoMatch) release.info = infoMatch[1];

// Function to extract array fields (new, improved, changed, fixed)
const extractArray = fieldName => {
    // Find the array for the specified field
    // Example: new: ['First feature', 'Second feature']
    const regex = new RegExp(`${fieldName}:\\s*\\[([\\s\\S]*?)\\]`, 'm');
    const match = firstReleaseMatch[0].match(regex);
    if (match && match[1]) {
        const items = [];
        // Extract quoted strings from the array
        // Captures: (['"])  - opening quote (group 1)
        //          ((?:(?!\1)[^\\]|\\.)*)  - content until closing quote (group 2)
        //          (\1)  - closing quote matching opening (group 3)
        // Examples: 'text', "text", 'text with \'quotes\'', "multi\nline"
        const itemRegex = /(['"])((?:(?!\1)[^\\]|\\.)*)(\1)/gs;
        let itemMatch;
        while ((itemMatch = itemRegex.exec(match[1])) !== null) {
            // Process escape sequences in the extracted content
            let content = itemMatch[2]
                .replace(/\\'/g, "'")      // Unescape single quotes
                .replace(/\\"/g, '"')       // Unescape double quotes
                .replace(/\\n/g, '\n')      // Convert \n to actual newline
                .replace(/\\\\/g, '\\');    // Unescape backslashes

            // Convert multi-line strings to single line for display
            content = content.replace(/\n\s*/g, ' ').trim();

            if (content) {
                items.push(content);
            }
        }
        return items;
    }
    return [];
};

// Extract all array fields
release.new = extractArray('new');
release.improved = extractArray('improved');
release.changed = extractArray('changed');
release.fixed = extractArray('fixed');

// Output the formatted markdown
console.log(`## Notebook Navigator ${release.version} (${release.date})\n`);

// Print optional info section if present
if (release.info) {
    console.log(`${release.info}\n`);
}

// Print each section if it has content
if (release.new && release.new.length > 0) {
    console.log('### New\n');
    release.new.forEach(item => console.log(`- ${item}`));
    console.log();
}

if (release.improved && release.improved.length > 0) {
    console.log('### Improved\n');
    release.improved.forEach(item => console.log(`- ${item}`));
    console.log();
}

if (release.changed && release.changed.length > 0) {
    console.log('### Changed\n');
    release.changed.forEach(item => console.log(`- ${item}`));
    console.log();
}

if (release.fixed && release.fixed.length > 0) {
    console.log('### Fixed\n');
    release.fixed.forEach(item => console.log(`- ${item}`));
    console.log();
}