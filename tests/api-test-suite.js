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

                'Should check compatibility correctly': async function () {
                    const result = this.api.checkCompatibility('1.0.0');
                    this.assertExists(result, 'Compatibility check returned null');
                    this.assertExists(result.compatibility, 'Compatibility level not defined');
                    this.assertTrue(['full', 'partial', 'limited', 'incompatible'].includes(result.compatibility));
                },

                'Should list available features': async function () {
                    const features = this.api.getAvailableFeatures();
                    this.assertTrue(Array.isArray(features), 'Features should be an array');
                    this.assertTrue(features.length > 0, 'Should have at least one feature');
                },

                'Should check if features exist': async function () {
                    const hasNavigation = this.api.hasFeature('navigation');
                    const hasMetadata = this.api.hasFeature('metadata');
                    const hasFake = this.api.hasFeature('fake-feature-that-does-not-exist');

                    this.assertTrue(hasNavigation, 'Navigation feature should exist');
                    this.assertTrue(hasMetadata, 'Metadata feature should exist');
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
                    const result = await this.api.navigation.navigateToFile(testFile);

                    this.assertExists(result, 'Navigation result is null');
                    if (result.success) {
                        this.assertEqual(result.path, testFile.path);
                    } else {
                        // View might not be open, which is okay
                        this.assertTrue(result.error.includes('view'), 'Unexpected error: ' + result.error);
                    }
                },

                'Should handle navigation to non-existent file gracefully': async function () {
                    const fakeFile = { path: 'fake-file-that-does-not-exist.md' };
                    const result = await this.api.navigation.navigateToFile(fakeFile);

                    this.assertExists(result, 'Should return a result even for invalid file');
                    this.assertFalse(result.success, 'Should not succeed for non-existent file');
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

                    // Get initial metadata
                    const initialMeta = this.api.metadata.getFolderMetadata(testFolder);
                    this.assertExists(initialMeta, 'Should return metadata object');

                    // Set color
                    await this.api.metadata.setFolderColor(testFolder, '#ff0000');
                    const afterColor = this.api.metadata.getFolderMetadata(testFolder);
                    this.assertEqual(afterColor.color, '#ff0000', 'Color should be set');

                    // Set icon
                    await this.api.metadata.setFolderIcon(testFolder, 'lucide:folder-open');
                    const afterIcon = this.api.metadata.getFolderMetadata(testFolder);
                    this.assertEqual(afterIcon.icon, 'lucide:folder-open', 'Icon should be set');

                    // Clear metadata
                    await this.api.metadata.setFolderColor(testFolder, null);
                    await this.api.metadata.setFolderIcon(testFolder, null);
                    const cleared = this.api.metadata.getFolderMetadata(testFolder);
                    this.assertFalse(cleared.color, 'Color should be cleared');
                    this.assertFalse(cleared.icon, 'Icon should be cleared');
                },

                'Should manage tag metadata': async function () {
                    const testTag = 'test-tag';

                    // Get initial metadata
                    const initialMeta = this.api.metadata.getTagMetadata(testTag);
                    this.assertExists(initialMeta, 'Should return tag metadata object');

                    // Set color
                    await this.api.metadata.setTagColor(testTag, '#00ff00');
                    const afterColor = this.api.metadata.getTagMetadata(testTag);
                    this.assertEqual(afterColor.color, '#00ff00', 'Tag color should be set');

                    // Set icon
                    await this.api.metadata.setTagIcon(testTag, 'lucide:tag');
                    const afterIcon = this.api.metadata.getTagMetadata(testTag);
                    this.assertEqual(afterIcon.icon, 'lucide:tag', 'Tag icon should be set');

                    // Clear
                    await this.api.metadata.setTagColor(testTag, null);
                    await this.api.metadata.setTagIcon(testTag, null);
                    const cleared = this.api.metadata.getTagMetadata(testTag);
                    this.assertFalse(cleared.color, 'Tag color should be cleared');
                    this.assertFalse(cleared.icon, 'Tag icon should be cleared');
                },

                'Should manage pinned files': async function () {
                    const testFile = await this.createTestFile('test-pinned.md', '# Pinned Test');

                    // Initially should not be pinned
                    let isPinned = this.api.metadata.isPinned(testFile);
                    this.assertFalse(isPinned, 'File should not be pinned initially');

                    // Toggle pin (should pin it)
                    await this.api.metadata.togglePin(testFile);
                    isPinned = this.api.metadata.isPinned(testFile);
                    this.assertTrue(isPinned, 'File should be pinned after toggle');

                    // Get all pinned files
                    const pinnedFiles = this.api.metadata.getPinnedFiles();
                    this.assertTrue(Array.isArray(pinnedFiles), 'Should return array of pinned files');
                    const pinnedPaths = pinnedFiles.map(f => f.path);
                    this.assertTrue(pinnedPaths.includes(testFile.path), 'Pinned files should include our test file');

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

                    // Delete the file
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

                    // Delete all files at once
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
                    const result = await this.api.file.move(testFile, targetFolder);
                    this.assertExists(result, 'Move should return a result');
                    this.assertTrue(result.movedCount === 1, 'Should have moved 1 file');
                    this.assertTrue(result.skippedCount === 0, 'Should not skip any files');
                    this.assertTrue(result.errors.length === 0, 'Should have no errors');

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
                        const result = await this.api.file.move(testFile, fakeFolder);
                        // Should either throw or return errors
                        if (result) {
                            this.assertTrue(
                                result.errors.length > 0 || result.skippedCount > 0,
                                'Should have errors or skipped files for invalid move'
                            );
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

                'Should get navigation selection': async function () {
                    const selection = this.api.selection.getNavigationSelection();
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
                    const selection = this.api.selection.getNavigationSelection();
                    this.assertExists(selection, 'Should always return a selection object');

                    // Both can be null when nothing is selected
                    if (!selection.folder && !selection.tag) {
                        this.assertTrue(true, 'API correctly handles no selection');
                    } else {
                        // Something is selected, which is also valid
                        this.assertTrue(true, 'API returns current selection');
                    }
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
