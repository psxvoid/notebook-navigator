import { describe, expect, it, vi } from 'vitest';
import { PreviewTextUtils } from '../../src/utils/previewTextUtils';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { NotebookNavigatorSettings } from '../../src/settings/types';

vi.mock('obsidian', () => ({}));

function createSettings(overrides: Partial<NotebookNavigatorSettings> = {}): NotebookNavigatorSettings {
    return {
        ...DEFAULT_SETTINGS,
        ...overrides
    };
}

describe('PreviewTextUtils.extractPreviewText', () => {
    const skipCodeSettings = createSettings({ skipHeadingsInPreview: false, skipCodeBlocksInPreview: true, stripHtmlInPreview: true });
    const includeCodeSettings = createSettings({ skipHeadingsInPreview: false, skipCodeBlocksInPreview: false, stripHtmlInPreview: true });

    it('keeps italic content wrapped with asterisks', () => {
        const preview = PreviewTextUtils.extractPreviewText('*Italicized* text', skipCodeSettings);
        expect(preview).toBe('Italicized text');
    });

    it('keeps italic content wrapped with underscores', () => {
        const preview = PreviewTextUtils.extractPreviewText('Value with _italic_ content', skipCodeSettings);
        expect(preview).toBe('Value with italic content');
    });

    it('keeps inline code content while removing backticks when code blocks are included', () => {
        const preview = PreviewTextUtils.extractPreviewText('Example `inline` snippet', includeCodeSettings);
        expect(preview).toBe('Example inline snippet');
    });

    it('keeps inline code when code blocks are skipped', () => {
        const preview = PreviewTextUtils.extractPreviewText('Example `inline` snippet', skipCodeSettings);
        expect(preview).toBe('Example inline snippet');
    });

    it('keeps inline code content that includes tags and wiki links', () => {
        const content = 'Use `#include <stdio.h>` and `[[Link]]` here';
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Use #include <stdio.h> and [[Link]] here');
    });

    it('keeps multi-backtick inline code content that looks like a callout', () => {
        const content = 'Example ``[!note]`` content';
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Example [!note] content');
    });

    it('strips html tags while keeping their text content', () => {
        const content = 'Alpha <font color="red">red</font> and <u>underlined</u> text';
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Alpha red and underlined text');
    });

    it('keeps html tags that are inside inline code blocks', () => {
        const content = 'Code sample `const markup = "<div>value</div>";` end';
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Code sample const markup = "<div>value</div>"; end');
    });

    it('keeps html tags inside multi-backtick inline code spans', () => {
        const content = 'Code sample ``const markup = `<div>value</div>`;`` end';
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Code sample const markup = `<div>value</div>`; end');
    });

    it('decodes html entities outside code while preserving code contents', () => {
        const content = 'Alpha &amp; beta &#x2022; gamma `&amp;` tail';
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Alpha & beta • gamma &amp; tail');
    });

    it('keeps html tags that are inside fenced code blocks when code blocks are included', () => {
        const content = ['Intro', '```html', '<div><span>code</span></div>', '```', 'Outro'].join('\n');
        const preview = PreviewTextUtils.extractPreviewText(content, includeCodeSettings);
        expect(preview).toBe('Intro <div><span>code</span></div> Outro');
    });

    it('keeps html tags when HTML stripping is disabled', () => {
        const settings = createSettings({ skipHeadingsInPreview: false, skipCodeBlocksInPreview: true, stripHtmlInPreview: false });
        const preview = PreviewTextUtils.extractPreviewText('Alpha <b>bold</b> text', settings);
        expect(preview).toBe('Alpha <b>bold</b> text');
    });

    it('keeps blockquote text without trailing space', () => {
        const preview = PreviewTextUtils.extractPreviewText('>Quote without space', skipCodeSettings);
        expect(preview).toBe('Quote without space');
    });

    it('keeps blockquote text with trailing space', () => {
        const preview = PreviewTextUtils.extractPreviewText('> Johan', skipCodeSettings);
        expect(preview).toBe('Johan');
    });

    it('strips checkbox syntax while keeping list text', () => {
        const preview = PreviewTextUtils.extractPreviewText('- [ ] Draft task\n- Note item', skipCodeSettings);
        expect(preview).toBe('Draft task Note item');
    });

    it('strips checkbox syntax from indented tasks', () => {
        const preview = PreviewTextUtils.extractPreviewText('    - [ ] Nested task', skipCodeSettings);
        expect(preview).toBe('Nested task');
    });

    it('strips alternate task states while keeping text', () => {
        const content = '+ [x] Done task\n* [/] In progress task\n1. [-] Skipped task';
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Done task In progress task Skipped task');
    });

    it('removes inline footnotes from preview text', () => {
        const preview = PreviewTextUtils.extractPreviewText('Sentence ^[footnote content] continues', skipCodeSettings);
        expect(preview).toBe('Sentence continues');
    });

    it('removes spaced underscore horizontal rules without leaving stray characters', () => {
        const content = ['Alpha line', '_ _ _', 'Omega line'].join('\n');
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Alpha line Omega line');
    });

    it('removes spaced star horizontal rules without leaving stray characters', () => {
        const content = ['Top section', '* * * * *', 'Bottom section'].join('\n');
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Top section Bottom section');
    });

    it('removes footnote references and definitions', () => {
        const content = 'Reference[^1] continues.\n\n[^1]: Footnote details';
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Reference continues.');
    });

    it('removes tilde fenced code blocks when skipping code blocks', () => {
        const content = ['Summary line', '~~~', 'const value = 42;', '~~~', 'Final note'].join('\n');
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Summary line Final note');
    });

    it('keeps tilde fenced code block content when including code blocks', () => {
        const content = ['Intro', '~~~', 'console.log(42);', '~~~', 'Outro'].join('\n');
        const preview = PreviewTextUtils.extractPreviewText(content, includeCodeSettings);
        expect(preview).toBe('Intro console.log(42); Outro');
    });

    it('keeps backticks inside fenced code blocks when code blocks are included', () => {
        const content = ['Intro', '```js', 'const value = `test`;', '```', 'Outro'].join('\n');
        const preview = PreviewTextUtils.extractPreviewText(content, includeCodeSettings);
        expect(preview).toBe('Intro const value = `test`; Outro');
    });

    it('removes fences from indented code blocks while keeping code when included', () => {
        const content = ['Intro', '  ```js', '  const value = 1;', '  ```', 'Outro'].join('\n');
        const preview = PreviewTextUtils.extractPreviewText(content, includeCodeSettings);
        expect(preview).toBe('Intro const value = 1; Outro');
    });

    it('truncates after removing a fenced code block that crosses the preview limit', () => {
        const prefix = 'Start ';
        const beforeBlock = 'a'.repeat(300);
        const afterBlock = 'b'.repeat(260);
        const codeBody = 'console.log("x");\n'.repeat(30);
        const content = `${prefix}${beforeBlock}\n\`\`\`js\n${codeBody}\`\`\`\n${afterBlock}`;

        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);

        expect(preview).not.toContain('console.log');
        expect(preview).not.toContain('```');
        expect(preview.startsWith(`${prefix}${beforeBlock}`)).toBe(true);
        expect(preview).toContain(afterBlock.slice(0, 32));
        expect(preview.endsWith('…')).toBe(true);
        expect(preview.length).toBe(500);
    });

    it('truncates after stripping html near the preview limit', () => {
        const fillerA = 'a'.repeat(240);
        const fillerB = 'b'.repeat(260);
        const content = `Intro ${fillerA}<div>middle</div>${fillerB} Outro`;

        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);

        expect(preview).not.toContain('<div>');
        expect(preview).toContain('middle');
        expect(preview.endsWith('…')).toBe(true);
        expect(preview.length).toBe(500);
    });

    it('removes CRLF frontmatter blocks', () => {
        const content = `---\r\ntitle: Test\r\n---\r\nAlpha line`;
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Alpha line');
    });

    it('extends clipping to include inline code spans near the limit', () => {
        const filler = 'alpha beta '.repeat(40);
        const content = `${filler}\`inline code block\` trailer`;

        const preview = PreviewTextUtils.extractPreviewText(content, includeCodeSettings);

        expect(preview).toContain('inline code block');
        expect(preview).toContain('trailer');
        expect(preview.includes('`')).toBe(false);
    });

    it('keeps fenced code content when the preview boundary falls inside the block', () => {
        const whitespace = ' '.repeat(850);
        const codeLines = Array.from({ length: 20 }, (_, index) => `console.log(${index});`).join('\n');
        const content = `${whitespace}\n\`\`\`js\n${codeLines}\n\`\`\``;

        const preview = PreviewTextUtils.extractPreviewText(content, includeCodeSettings);

        expect(preview).toContain('console.log(0);');
        expect(preview).toContain('console.log(19);');
        expect(preview.includes('```')).toBe(false);
    });

    it('extends clipping to the end of a fenced code block when included', () => {
        const filler = 'line '.repeat(80);
        const content = [filler, '```js', 'const first = 1;', 'const second = 2;', '```', 'tail'].join('\n');

        const preview = PreviewTextUtils.extractPreviewText(content, includeCodeSettings);

        expect(preview).toContain('const second = 2;');
        expect(preview).not.toContain('```');
    });

    it('extends clipping to finish an open html tag before stripping', () => {
        const filler = 'word '.repeat(80);
        const content = `${filler}<span>kept</span> tail`;

        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);

        expect(preview).toContain('kept tail');
    });

    it('keeps text separated when removing fenced code blocks that touch surrounding text', () => {
        const content = 'Alpha\n```js\ncode();\n```\nBeta';

        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);

        expect(preview).toBe('Alpha Beta');
    });
});

describe('PreviewTextUtils.normalizeExcerpt', () => {
    it('strips html and collapses whitespace', () => {
        const excerpt = PreviewTextUtils.normalizeExcerpt('Alpha<br>  <div>beta</div>\n gamma');
        expect(excerpt).toBe('Alpha beta gamma');
    });

    it('decodes html entities outside inline code', () => {
        const excerpt = PreviewTextUtils.normalizeExcerpt('Alpha &amp; beta `&amp;`');
        expect(excerpt).toBe('Alpha & beta &amp;');
    });

    it('preserves tags inside inline code', () => {
        const excerpt = PreviewTextUtils.normalizeExcerpt('Sample `const value = "<div>tag</div>"` here');
        expect(excerpt).toBe('Sample const value = "<div>tag</div>" here');
    });

    it('preserves tags inside multi-backtick inline code', () => {
        const excerpt = PreviewTextUtils.normalizeExcerpt('Sample ``const value = `<div>tag</div>`;`` here');
        expect(excerpt).toBe('Sample const value = `<div>tag</div>`; here');
    });

    it('keeps html tags when stripping is disabled', () => {
        const excerpt = PreviewTextUtils.normalizeExcerpt('<b>alpha</b> beta', { stripHtml: false });
        expect(excerpt).toBe('<b>alpha</b> beta');
    });

    it('returns undefined when content is empty after cleanup', () => {
        const excerpt = PreviewTextUtils.normalizeExcerpt(' <div></div> ');
        expect(excerpt).toBeUndefined();
    });
});
