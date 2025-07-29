#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TransformConfig {
    name: string;
    description: string;
    transform: string;
    filePattern?: string;
}

const transforms: TransformConfig[] = [
    {
        name: 'organize-imports',
        description: 'Organize and sort import statements',
        transform: './codemods/transforms/organize-imports.ts',
        filePattern: 'src/**/*.{ts,tsx}'
    },
    {
        name: 'sort-class-members',
        description: 'Sort class members by type and visibility',
        transform: './codemods/transforms/sort-class-members.ts',
        filePattern: 'src/**/*.{ts,tsx}'
    },
    {
        name: 'organize-react-components',
        description: 'Organize React components, hooks, and constants',
        transform: './codemods/transforms/organize-react-components.ts',
        filePattern: 'src/**/*.{ts,tsx}'
    },
    {
        name: 'organize-react-internals',
        description: 'Organize hooks and code inside React components',
        transform: './codemods/transforms/organize-react-internals.ts',
        filePattern: 'src/**/*.{ts,tsx}'
    }
];

async function runTransform(transform: TransformConfig, dryRun: boolean = false) {
    console.log(`\n🔧 Running transform: ${transform.name}`);
    console.log(`   ${transform.description}`);

    const filePattern = transform.filePattern || 'src/**/*.{ts,tsx}';
    const dryRunFlag = dryRun ? '--dry' : '';

    const command = `npx jscodeshift ${dryRunFlag} -t ${transform.transform} --parser tsx --extensions=ts,tsx ${filePattern}`;

    try {
        console.log(`   Command: ${command}`);
        const { stdout, stderr } = await execAsync(command);

        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);

        console.log(`✅ Transform ${transform.name} completed`);

        // Run prettier on modified files if not in dry-run mode
        if (!dryRun && stdout) {
            // Extract modified file count from jscodeshift output
            const modifiedMatch = stdout.match(/(\d+) ok/);
            const modifiedCount = modifiedMatch ? parseInt(modifiedMatch[1]) : 0;

            if (modifiedCount > 0) {
                console.log(`\n🎨 Running Prettier on modified files...`);
                try {
                    const prettierCommand = `npx prettier --write ${filePattern}`;
                    await execAsync(prettierCommand);
                    console.log(`✅ Prettier formatting completed`);
                } catch (prettierError: any) {
                    console.error(`⚠️  Warning: Prettier formatting failed:`, prettierError.message);
                    // Don't exit on prettier errors - transforms were still successful
                }
            }
        }
    } catch (error: any) {
        console.error(`❌ Error running transform ${transform.name}:`, error.message);
        process.exit(1);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const selectedTransform = args.find(arg => !arg.startsWith('--'));

    console.log('🚀 Notebook Navigator Code Transforms');
    console.log('=====================================');

    if (dryRun) {
        console.log('🔍 Running in dry-run mode (no files will be modified)');
    }

    let transformsToRun = transforms;

    if (selectedTransform) {
        const transform = transforms.find(t => t.name === selectedTransform);
        if (!transform) {
            console.error(`❌ Unknown transform: ${selectedTransform}`);
            console.log('\nAvailable transforms:');
            transforms.forEach(t => {
                console.log(`  - ${t.name}: ${t.description}`);
            });
            process.exit(1);
        }
        transformsToRun = [transform];
    }

    for (const transform of transformsToRun) {
        await runTransform(transform, dryRun);
    }

    console.log('\n✨ All transforms completed!');

    if (!dryRun) {
        console.log('\n💡 Tip: Run with --dry-run to preview changes without modifying files');
        console.log('💡 Tip: Run prettier after transforms to ensure consistent formatting');
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
