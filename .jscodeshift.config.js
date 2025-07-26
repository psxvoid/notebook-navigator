module.exports = {
    // Parser configuration for TypeScript
    parser: 'tsx',

    // Transform options
    options: {
        // Import organization
        importOrder: [
            // React imports first
            '^react$',
            '^react-dom$',
            '^react/(.*)$',

            // External libraries
            '^obsidian$',
            '^@tanstack/(.*)$',
            '<THIRD_PARTY_MODULES>',

            // Internal absolute imports
            '^@/(.*)$',

            // Relative imports
            '^\\.\\./',
            '^\\.\/',

            // Type imports last
            '^.*\\u0000$'
        ],

        // Code style preferences
        quotes: 'single',
        semi: true,
        trailingComma: 'none',
        tabWidth: 4,
        useTabs: false,

        // React specific
        jsxSingleQuote: false,
        jsxBracketSameLine: false,

        // TypeScript specific
        arrowParens: 'avoid',

        // File patterns to process
        filePatterns: ['src/**/*.ts', 'src/**/*.tsx'],

        // Files to ignore
        ignore: ['node_modules/**', 'build/**', 'dist/**', '*.min.js', '*.d.ts']
    }
};
