import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { fixupPluginRules } from '@eslint/compat';
import globals from 'globals';

export default tseslint.config(
    {
        ignores: ['node_modules/**', 'dist/**', 'build/**', 'main.js', '*.min.js', 'web/**', 'codemods/**']
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...obsidianmd.configs.recommended,
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                React: 'readonly'
            },
            parserOptions: {
                ecmaFeatures: {
                    jsx: true
                },
                project: './tsconfig.json'
            }
        },
        plugins: {
            react: fixupPluginRules(react),
            'react-hooks': fixupPluginRules(reactHooks),
            obsidianmd: obsidianmd
        },
        settings: {
            react: {
                version: 'detect'
            }
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': 'error',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-non-null-assertion': 'warn',
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'no-console': 'off',
            'no-debugger': 'error',
            'prefer-const': 'error',
            'no-var': 'error',
            // Upgrade obsidianmd rules from warn to error
            'obsidianmd/prefer-file-manager-trash-file': 'error',

            // Warns about unnecessary type assertions like "as string" when TypeScript already knows the type
            '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
            '@typescript-eslint/prefer-as-const': 'warn'
        }
    }
);
