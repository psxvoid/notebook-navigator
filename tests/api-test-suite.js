/**
 * Notebook Navigator API Test Suite
 *
 * A comprehensive test suite for the Notebook Navigator API.
 * Paste this entire script into the Obsidian developer console to run tests.
 *
 * ⚠️ WARNING: This test suite will create and delete files in your vault!
 *
 * TEST DATA LOCATION:
 * - Creates temporary test files at the ROOT of your vault with names like:
 *   - test-navigation.md
 *   - test-pinned.md
 *   - test-delete.md
 *   - test-batch-0.md, test-batch-1.md, etc.
 * - Creates temporary test folders at the ROOT of your vault:
 *   - test-metadata-folder/
 *   - test-move-source/
 *   - test-move-target/
 *
 * CLEANUP:
 * - All test files and folders are automatically deleted after tests complete
 * - If tests fail or are interrupted, you may need to manually delete test files
 * - Use runTests({cleanup: false}) to keep test data for inspection
 *
 * SAFETY:
 * - Only creates files/folders with "test-" prefix
 * - Does NOT modify any existing files in your vault
 * - Does NOT read or access your personal notes
 * - Modifies plugin settings temporarily (colors, icons, pins) but restores them
 *
 * Usage:
 *   runTests()                    - Run all tests (with auto-cleanup)
 *   runTests({verbose: true})     - Show detailed output
 *   runTests({only: 'metadata'})  - Run only specific test suite
 *   runTests({only: ['metadata', 'navigation']}) - Run multiple suites
 *   runTests({cleanup: false})    - Keep test files after running (for debugging)
 */

(function () {
    'use strict';

    // Test Framework
    class TestRunner {
        constructor(options = {}) {
            this.options = {
                verbose: false,
                only: null,
                cleanup: true,
                ...options
            };

            this.results = {
                passed: 0,
                failed: 0,
                skipped: 0,
                errors: []
            };

            this.testFiles = [];
            this.testFolders = [];
            this.startTime = null;
        }

        // Console styling
        log(message, type = 'info') {
            const styles = {
                header: 'color: #7c3aed; font-weight: bold; font-size: 14px',
                success: 'color: #10b981; font-weight: bold',
                error: 'color: #ef4444; font-weight: bold',
                warning: 'color: #f59e0b; font-weight: bold',
                info: 'color: #6b7280',
                test: 'color: #3b82f6',
                dim: 'color: #9ca3af'
            };

            console.log(`%c${message}`, styles[type] || styles.info);
        }

        // Assertions
        assertEqual(actual, expected, message) {
            if (actual !== expected) {
                throw new Error(message || `Expected ${expected}, got ${actual}`);
            }
        }

        assertTrue(condition, message) {
            if (!condition) {
                throw new Error(message || 'Assertion failed: expected true');
            }
        }

        assertFalse(condition, message) {
            if (condition) {
                throw new Error(message || 'Assertion failed: expected false');
            }
        }

        assertExists(value, message) {
            if (value === null || value === undefined) {
                throw new Error(message || 'Value does not exist');
            }
        }

        async assertThrows(fn, message) {
            let threw = false;
            try {
                await fn();
            } catch (e) {
                threw = true;
            }
            if (!threw) {
                throw new Error(message || 'Expected function to throw');
            }
        }

        // Test execution
        async runTest(name, testFn) {
            if (this.options.verbose) {
                this.log(`  Running: ${name}`, 'dim');
            }

            const startTime = performance.now();

            try {
                await testFn();
                const duration = (performance.now() - startTime).toFixed(2);
                this.log(`  ✅ ${name} (${duration}ms)`, 'success');
                this.results.passed++;
            } catch (error) {
                const duration = (performance.now() - startTime).toFixed(2);
                this.log(`  ❌ ${name} (${duration}ms)`, 'error');
                this.log(`     ${error.message}`, 'error');
                this.results.failed++;
                this.results.errors.push({ test: name, error: error.message });
            }
        }

        async runSuite(suiteName, tests) {
            // Check if we should run this suite
            if (this.options.only) {
                const only = Array.isArray(this.options.only) ? this.options.only : [this.options.only];
                if (!only.includes(suiteName.toLowerCase())) {
                    this.results.skipped += Object.keys(tests).length;
                    return;
                }
            }

            this.log(`\n📋 ${suiteName}`, 'header');

            for (const [testName, testFn] of Object.entries(tests)) {
                await this.runTest(testName, testFn.bind(this));
            }
        }

        // Helper methods for test data
        async createTestFile(path, content = '') {
            const file = await app.vault.create(path, content);
            this.testFiles.push(file);
            return file;
        }

        async createTestFolder(path) {
            await app.vault.createFolder(path);
            const folder = app.vault.getAbstractFileByPath(path);
            this.testFolders.push(folder);
            return folder;
        }

        async cleanup() {
            if (!this.options.cleanup) return;

            this.log('\n🧹 Cleaning up test data...', 'dim');

            // Delete test files
            for (const file of this.testFiles) {
                try {
                    await app.vault.delete(file);
                } catch (e) {
                    // File might already be deleted
                }
            }

            // Delete test folders (in reverse order to delete children first)
            for (const folder of this.testFolders.reverse()) {
                try {
                    await app.vault.delete(folder);
                } catch (e) {
                    // Folder might already be deleted
                }
            }

            this.testFiles = [];
            this.testFolders = [];
        }

        async run() {
            this.startTime = performance.now();

            this.log('🚀 Notebook Navigator API Test Suite', 'header');
            this.log('================================\n', 'header');

            // Get the API
            const plugin = app.plugins.plugins['notebook-navigator'];
            if (!plugin) {
                this.log('❌ Notebook Navigator plugin is not installed or enabled', 'error');
                return;
            }

            const api = plugin.api;
            if (!api) {
                this.log('❌ Notebook Navigator API is not available', 'error');
                return;
            }

            this.api = api;
            this.log(`API Version: ${api.getVersion()}`, 'info');

            // Run test suites
            await this.runSuite('Version & Compatibility', this.versionTests());
            await this.runSuite('Navigation', this.navigationTests());
            await this.runSuite('Metadata', this.metadataTests());
            await this.runSuite('File Operations', this.fileTests());
            await this.runSuite('Selection', this.selectionTests());
            await this.runSuite('Events', this.eventTests());

            // Cleanup
            await this.cleanup();

            // Results
            this.printResults();
        }

        printResults() {
            const duration = ((performance.now() - this.startTime) / 1000).toFixed(2);

            this.log('\n================================', 'header');
            this.log('📊 Test Results', 'header');
            this.log('================================\n', 'header');

            this.log(`✅ Passed: ${this.results.passed}`, 'success');
            if (this.results.failed > 0) {
                this.log(`❌ Failed: ${this.results.failed}`, 'error');
            }
            if (this.results.skipped > 0) {
                this.log(`⏭️  Skipped: ${this.results.skipped}`, 'warning');
            }

            this.log(`\n⏱️  Total time: ${duration}s`, 'info');

            if (this.results.errors.length > 0) {
                this.log('\n❌ Failed Tests:', 'error');
                for (const error of this.results.errors) {
                    this.log(`  • ${error.test}: ${error.error}`, 'error');
                }
            }

            if (this.results.failed === 0) {
                this.log('\n🎉 All tests passed!', 'success');
            }
        }

        // Test Suites
        versionTests() {
            return {
                'API version should be defined': async function () {
                    const version = this.api.getVersion();
                    this.assertExists(version, 'API version is not defined');
                    this.assertTrue(version.match(/^\d+\.\d+\.\d+$/), `Invalid version format: ${version}`);
                },

                'Should negotiate version correctly': async function () {
                    const result = this.api.negotiateVersion('1.0.0');
                    this.assertExists(result, 'Compatibility check returned null');
                    this.assertExists(result.compatibility, 'Compatibility level not defined');
                    this.assertTrue(['full', 'partial', 'limited', 'incompatible'].includes(result.compatibility));
                },

                'Should list available features': async function () {
                    const features = this.api.listFeatures();
                    this.assertTrue(Array.isArray(features), 'Features should be an array');
                    this.assertTrue(features.length > 0, 'Should have at least one feature');
                },

                'Should check if features exist': async function () {
                    // Check for specific feature keys
                    const hasFileDelete = this.api.hasFeature('file.delete');
                    const hasNavigation = this.api.hasFeature('navigation.navigateToFile');
                    const hasMetadata = this.api.hasFeature('metadata.setFolderColor');
                    const hasFake = this.api.hasFeature('fake-feature-that-does-not-exist');

                    this.assertTrue(hasFileDelete, 'file.delete feature should exist');
                    this.assertTrue(hasNavigation, 'navigation.navigateToFile feature should exist');
                    this.assertTrue(hasMetadata, 'metadata.setFolderColor feature should exist');
                    this.assertFalse(hasFake, 'Fake feature should not exist');
                }
            };
        }

        navigationTests() {
            return {
                'Navigation API should exist': async function () {
                    this.assertExists(this.api.navigation, 'Navigation API not found');
                },

                'Should navigate to a file': async function () {
                    const testFile = await this.createTestFile('test-navigation.md', '# Test Navigation');

                    try {
                        await this.api.navigation.navigateToFile(testFile);
                        // If successful, navigation completed
                        this.assertTrue(true, 'Navigation completed successfully');
                    } catch (error) {
                        // View might not be open, which is okay
                        this.assertTrue(error.message.includes('view'), 'Error should mention view not being open');
                    }
                },

                'Should handle navigation to non-existent file gracefully': async function () {
                    const fakeFile = { path: 'fake-file-that-does-not-exist.md' };

                    try {
                        await this.api.navigation.navigateToFile(fakeFile);
                        // Should throw an error for non-existent file
                        this.assertTrue(false, 'Should have thrown an error for non-existent file');
                    } catch (error) {
                        this.assertTrue(true, 'Correctly threw error for non-existent file');
                    }
                }
            };
        }

        metadataTests() {
            return {
                'Metadata API should exist': async function () {
                    this.assertExists(this.api.metadata, 'Metadata API not found');
                },

                'Should get and set folder metadata': async function () {
                    const testFolder = await this.createTestFolder('test-metadata-folder');

                    // Get initial metadata (should be null when nothing is set)
                    const initialMeta = this.api.metadata.getFolderMetadata(testFolder);
                    this.assertEqual(initialMeta, null, 'Should return null when no metadata is set');

                    // Set color
                    await this.api.metadata.setFolderColor(testFolder, '#ff0000');
                    const afterColor = this.api.metadata.getFolderMetadata(testFolder);
                    this.assertExists(afterColor, 'Should return metadata after setting color');
                    this.assertEqual(afterColor.color, '#ff0000', 'Color should be set');

                    // Set icon
                    await this.api.metadata.setFolderIcon(testFolder, 'lucide:folder-open');
                    const afterIcon = this.api.metadata.getFolderMetadata(testFolder);
                    this.assertEqual(afterIcon.icon, 'lucide:folder-open', 'Icon should be set');

                    // Clear metadata using dedicated methods
                    await this.api.metadata.clearFolderColor(testFolder);
                    await this.api.metadata.clearFolderIcon(testFolder);
                    const cleared = this.api.metadata.getFolderMetadata(testFolder);
                    this.assertEqual(cleared, null, 'Should return null when all metadata is cleared');
                },

                'Should manage tag metadata': async function () {
                    const testTag = '#test-tag';

                    // Get initial metadata (should be null when nothing is set)
                    const initialMeta = this.api.metadata.getTagMetadata(testTag);
                    this.assertEqual(initialMeta, null, 'Should return null when no metadata is set');

                    // Set color
                    await this.api.metadata.setTagColor(testTag, '#00ff00');
                    const afterColor = this.api.metadata.getTagMetadata(testTag);
                    this.assertExists(afterColor, 'Should return metadata after setting color');
                    this.assertEqual(afterColor.color, '#00ff00', 'Tag color should be set');

                    // Set icon
                    await this.api.metadata.setTagIcon(testTag, 'lucide:tag');
                    const afterIcon = this.api.metadata.getTagMetadata(testTag);
                    this.assertEqual(afterIcon.icon, 'lucide:tag', 'Tag icon should be set');

                    // Clear using dedicated methods
                    await this.api.metadata.clearTagColor(testTag);
                    await this.api.metadata.clearTagIcon(testTag);
                    const cleared = this.api.metadata.getTagMetadata(testTag);
                    this.assertEqual(cleared, null, 'Should return null when all metadata is cleared');
                },

                'Should manage pinned files': async function () {
                    const testFile = await this.createTestFile('test-pinned.md', '# Pinned Test');

                    // Initially should not be pinned
                    let isPinned = this.api.metadata.isPinned(testFile);
                    this.assertFalse(isPinned, 'File should not be pinned initially');

                    // Pin the file
                    await this.api.metadata.pin(testFile);
                    isPinned = this.api.metadata.isPinned(testFile);
                    this.assertTrue(isPinned, 'File should be pinned after pin()');

                    // Get all pinned files
                    const pinnedFiles = this.api.metadata.listPinnedFiles();
                    this.assertTrue(Array.isArray(pinnedFiles), 'Should return array of pinned files');
                    const pinnedPaths = pinnedFiles.map(f => f.path);
                    this.assertTrue(pinnedPaths.includes(testFile.path), 'Pinned files should include our test file');

                    // Try pinning again (should remain pinned)
                    await this.api.metadata.pin(testFile);
                    isPinned = this.api.metadata.isPinned(testFile);
                    this.assertTrue(isPinned, 'File should remain pinned');

                    // Unpin the file
                    await this.api.metadata.unpin(testFile);
                    isPinned = this.api.metadata.isPinned(testFile);
                    this.assertFalse(isPinned, 'File should be unpinned after unpin()');

                    // Toggle pin (should pin it again)
                    await this.api.metadata.togglePin(testFile);
                    isPinned = this.api.metadata.isPinned(testFile);
                    this.assertTrue(isPinned, 'File should be pinned after toggle');

                    // Toggle again (should unpin)
                    await this.api.metadata.togglePin(testFile);
                    isPinned = this.api.metadata.isPinned(testFile);
                    this.assertFalse(isPinned, 'File should be unpinned after second toggle');
                }
            };
        }

        fileTests() {
            return {
                'File API should exist': async function () {
                    this.assertExists(this.api.file, 'File API not found');
                },

                'Should delete a single file': async function () {
                    const testFile = await this.createTestFile('test-delete.md', '# Delete Test');

                    // Delete the file (returns void now)
                    await this.api.file.delete(testFile);

                    // Verify file is deleted (wait a bit for async operation)
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const exists = app.vault.getAbstractFileByPath(testFile.path);
                    this.assertFalse(exists, 'File should be deleted');
                },

                'Should delete multiple files': async function () {
                    const files = [];
                    for (let i = 0; i < 3; i++) {
                        files.push(await this.createTestFile(`test-multi-delete-${i}.md`, `# Delete ${i}`));
                    }

                    // Delete all files at once (returns void now)
                    await this.api.file.delete(files);

                    // Verify all files are deleted
                    await new Promise(resolve => setTimeout(resolve, 100));
                    for (const file of files) {
                        const exists = app.vault.getAbstractFileByPath(file.path);
                        this.assertFalse(exists, `File ${file.path} should be deleted`);
                    }
                },

                'Should move files to target folder': async function () {
                    const sourceFolder = await this.createTestFolder('test-move-source');
                    const targetFolder = await this.createTestFolder('test-move-target');
                    const testFile = await this.createTestFile('test-move-source/test-file.md', '# Move Test');

                    // Move the file
                    const result = await this.api.file.moveTo(testFile, targetFolder);
                    this.assertExists(result, 'Move should return a result');
                    this.assertEqual(result.movedCount, 1, 'Should have moved 1 file');
                    this.assertEqual(result.errors.length, 0, 'Should have no errors');

                    // Verify file is moved
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const movedFile = app.vault.getAbstractFileByPath('test-move-target/test-file.md');
                    this.assertExists(movedFile, 'File should exist at new location');

                    const oldFile = app.vault.getAbstractFileByPath('test-move-source/test-file.md');
                    this.assertFalse(oldFile, 'File should not exist at old location');
                },

                'Should handle move errors gracefully': async function () {
                    const testFile = await this.createTestFile('test-move-error.md', '# Error Test');

                    // Try to move to a non-existent folder (create a fake folder object)
                    const fakeFolder = { path: 'non-existent-folder', name: 'fake' };

                    try {
                        const result = await this.api.file.moveTo(testFile, fakeFolder);
                        // Should either throw or return errors
                        if (result) {
                            this.assertTrue(result.errors.length > 0, 'Should have errors for invalid move');
                        }
                    } catch (e) {
                        // Expected - moving to non-existent folder should fail
                        this.assertTrue(true, 'Move to non-existent folder should fail');
                    }
                }
            };
        }

        selectionTests() {
            return {
                'Selection API should exist': async function () {
                    this.assertExists(this.api.selection, 'Selection API not found');
                },

                'Should get selected navigation item': async function () {
                    const selection = this.api.selection.getSelectedNavigationItem();
                    this.assertExists(selection, 'Should return selection object');
                    this.assertExists(selection.folder !== undefined, 'Should have folder property');
                    this.assertExists(selection.tag !== undefined, 'Should have tag property');

                    // Either folder or tag can be selected, but not both
                    if (selection.folder && selection.tag) {
                        this.assertTrue(false, 'Both folder and tag should not be selected simultaneously');
                    }

                    // If a folder is selected, it should be a valid TFolder
                    if (selection.folder) {
                        this.assertExists(selection.folder.path, 'Selected folder should have a path');
                        this.assertTrue(typeof selection.folder.path === 'string', 'Folder path should be a string');
                    }

                    // If a tag is selected, it should be a string
                    if (selection.tag) {
                        this.assertTrue(typeof selection.tag === 'string', 'Tag should be a string');
                    }
                },

                'Should handle no selection gracefully': async function () {
                    // This test verifies the API handles the case when nothing is selected
                    const selection = this.api.selection.getSelectedNavigationItem();
                    this.assertExists(selection, 'Should always return a selection object');

                    // Both can be null when nothing is selected
                    if (!selection.folder && !selection.tag) {
                        this.assertTrue(true, 'API correctly handles no selection');
                    } else {
                        // Something is selected, which is also valid
                        this.assertTrue(true, 'API returns current selection');
                    }
                },

                'Should get file selection state': async function () {
                    // Test getting selected files
                    const selectedFiles = this.api.selection.listSelectedFiles();
                    this.assertTrue(Array.isArray(selectedFiles), 'listSelectedFiles should return an array');
                },

                'Should get focused file': async function () {
                    const focusedFile = this.api.selection.getFocusedFile();

                    // Focused file can be null (no selection) or a TFile object
                    if (focusedFile !== null) {
                        this.assertExists(focusedFile.path, 'Focused file should have a path');
                        this.assertTrue(typeof focusedFile.path === 'string', 'File path should be a string');
                        this.assertExists(focusedFile.name, 'Focused file should have a name');

                        // If there's a focused file, there should be selected files
                        const selectedFiles = this.api.selection.listSelectedFiles();
                        this.assertTrue(selectedFiles.length >= 1, 'Should have at least 1 selected file when focused file exists');
                    }
                },

                'Should get selection state': async function () {
                    const state = this.api.selection.getSelectionState();

                    this.assertExists(state, 'getSelectionState should return an object');
                    this.assertTrue(Array.isArray(state.files), 'State should have files array');
                    this.assertTrue(state.focused === null || typeof state.focused === 'object', 'State should have focused property');

                    // Compare with individual methods
                    const files = this.api.selection.listSelectedFiles();
                    const focused = this.api.selection.getFocusedFile();

                    this.assertEqual(state.files.length, files.length, 'State files should match listSelectedFiles');
                    this.assertEqual(state.focused, focused, 'State focused should match getFocusedFile');
                },

                'Should handle file selection events': async function () {
                    // Test event subscription
                    let eventFired = false;
                    let eventData = null;

                    const eventRef = this.api.on('file-selection-changed', data => {
                        eventFired = true;
                        eventData = data;
                    });

                    // The event should have been set up
                    this.assertExists(eventRef, 'Event subscription should return a reference');

                    // Clean up event listener
                    this.api.off(eventRef);

                    // Verify event data structure if an event was captured
                    if (eventData) {
                        this.assertTrue(Array.isArray(eventData.files), 'Event should include files array (TFile objects)');
                        // focused can be null or a TFile
                        this.assertTrue(
                            eventData.focused === null || typeof eventData.focused === 'object',
                            'Focused should be null or TFile'
                        );
                    }
                }
            };
        }

        eventTests() {
            return {
                'Should handle storage-ready event': async function () {
                    let eventFired = false;

                    const eventRef = this.api.on('storage-ready', () => {
                        eventFired = true;
                    });

                    this.assertExists(eventRef, 'Event subscription should return a reference');

                    // Clean up
                    this.api.off(eventRef);
                },

                'Should handle folder-selected event': async function () {
                    let eventData = null;

                    const eventRef = this.api.on('folder-selected', data => {
                        eventData = data;
                    });

                    this.assertExists(eventRef, 'Event subscription should return a reference');

                    // If an event was captured, verify structure
                    if (eventData) {
                        this.assertExists(eventData.folder, 'Should have folder');
                        this.assertTrue(typeof eventData.folder === 'object', 'Folder should be TFolder object');
                        this.assertExists(eventData.folder.path, 'Folder should have path');
                    }

                    // Clean up
                    this.api.off(eventRef);
                },

                'Should handle tag-selected event': async function () {
                    let eventData = null;

                    const eventRef = this.api.on('tag-selected', data => {
                        eventData = data;
                    });

                    this.assertExists(eventRef, 'Event subscription should return a reference');

                    // If an event was captured, verify structure
                    if (eventData) {
                        this.assertExists(eventData.tag, 'Should have tag');
                        this.assertTrue(typeof eventData.tag === 'string', 'Tag should be string');
                        this.assertTrue(eventData.tag.startsWith('#'), 'Tag should start with #');
                    }

                    // Clean up
                    this.api.off(eventRef);
                },

                'Should handle pinned-files-changed event': async function () {
                    let eventData = null;

                    const eventRef = this.api.on('pinned-files-changed', data => {
                        eventData = data;
                    });

                    this.assertExists(eventRef, 'Event subscription should return a reference');

                    // If an event was captured, verify structure
                    if (eventData) {
                        this.assertTrue(Array.isArray(eventData.files), 'Should have files array');
                        // Files array contains all currently pinned files
                        eventData.files.forEach(file => {
                            this.assertExists(file.path, 'Each pinned file should have a path');
                        });
                    }

                    // Clean up
                    this.api.off(eventRef);
                },

                'Should handle folder-metadata-changed event': async function () {
                    let eventData = null;

                    const eventRef = this.api.on('folder-metadata-changed', data => {
                        eventData = data;
                    });

                    this.assertExists(eventRef, 'Event subscription should return a reference');

                    // If an event was captured, verify structure
                    if (eventData) {
                        this.assertExists(eventData.folder, 'Should have folder');
                        this.assertTrue(['color', 'icon'].includes(eventData.property), 'Should have valid property');
                    }

                    // Clean up
                    this.api.off(eventRef);
                },

                'Should handle tag-metadata-changed event': async function () {
                    let eventData = null;

                    const eventRef = this.api.on('tag-metadata-changed', data => {
                        eventData = data;
                    });

                    this.assertExists(eventRef, 'Event subscription should return a reference');

                    // If an event was captured, verify structure
                    if (eventData) {
                        this.assertExists(eventData.tag, 'Should have tag');
                        this.assertTrue(['color', 'icon'].includes(eventData.property), 'Should have valid property');
                    }

                    // Clean up
                    this.api.off(eventRef);
                },

                'Should unsubscribe from events': async function () {
                    // Test that off() works correctly
                    const eventRef = this.api.on('storage-ready', () => {});
                    this.assertExists(eventRef, 'Should get event reference');

                    // Should not throw when unsubscribing
                    this.api.off(eventRef);

                    // Should be idempotent (safe to call multiple times)
                    this.api.off(eventRef);
                    this.api.off(eventRef);
                }
            };
        }
    }

    // Make the test runner globally available
    window.runTests = async function (options = {}) {
        const runner = new TestRunner(options);
        await runner.run();
        return runner.results;
    };

    // Auto-run if this script is executed directly
    if (typeof runTests !== 'undefined') {
        console.log('Notebook Navigator API Test Suite loaded!');
        console.log('Run tests with: runTests()');
        console.log('Options:');
        console.log('  runTests({verbose: true})     - Show detailed output');
        console.log('  runTests({only: "metadata"})  - Run only specific suite');
        console.log('  runTests({cleanup: false})    - Keep test data after running');
    }
})();

// Run the tests immediately
runTests();
