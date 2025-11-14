import { describe, it, expect } from 'vitest';
import {
    convertIconizeToIconId,
    convertIconIdToIconize,
    normalizeCanonicalIconId,
    serializeIconForFrontmatter,
    deserializeIconFromFrontmatter
} from '../../src/utils/iconizeFormat';

describe('convertIconizeToIconId', () => {
    it('converts lucide identifiers without provider prefix', () => {
        expect(convertIconizeToIconId('LiHome')).toBe('home');
    });

    it('strips redundant lucide prefix from icon names when present', () => {
        expect(convertIconizeToIconId('LiLucideUser')).toBe('user');
    });

    it('converts Font Awesome solid identifiers to fontawesome-solid provider', () => {
        expect(convertIconizeToIconId('FasUser')).toBe('fontawesome-solid:user');
    });

    it('converts Font Awesome regular identifiers to canonical provider', () => {
        expect(convertIconizeToIconId('FarUser')).toBe('fontawesome-solid:user');
    });

    it('converts Simple Icons identifiers with numeric prefixes', () => {
        expect(convertIconizeToIconId('Si500Px')).toBe('simple-icons:500px');
        expect(convertIconizeToIconId('Si1Password')).toBe('simple-icons:1password');
    });

    it('converts phosphor identifiers and collapses duplicate prefixes', () => {
        expect(convertIconizeToIconId('PhAppleLogo')).toBe('phosphor:apple-logo');
        expect(convertIconizeToIconId('PhPhAppleLogo')).toBe('phosphor:apple-logo');
    });

    it('converts RPG Awesome identifiers and collapses duplicate prefixes', () => {
        expect(convertIconizeToIconId('RaHarpoonTrident')).toBe('rpg-awesome:harpoon-trident');
        expect(convertIconizeToIconId('RaRaHarpoonTrident')).toBe('rpg-awesome:harpoon-trident');
    });

    it('returns null when no valid prefix is present', () => {
        expect(convertIconizeToIconId('Li')).toBeNull();
        expect(convertIconizeToIconId('📝')).toBeNull();
    });
});

describe('convertIconIdToIconize', () => {
    it('converts default provider identifiers with explicit lucide prefix', () => {
        expect(convertIconIdToIconize('lucide-home')).toBe('LiHome');
    });

    it('converts legacy default provider identifiers without prefix', () => {
        expect(convertIconIdToIconize('home')).toBe('LiHome');
    });

    it('converts fontawesome-solid identifiers using Fas prefix', () => {
        expect(convertIconIdToIconize('fontawesome-solid:user')).toBe('FasUser');
    });

    it('converts Simple Icons identifiers that start with numbers', () => {
        expect(convertIconIdToIconize('simple-icons:500px')).toBe('Si500Px');
        expect(convertIconIdToIconize('simple-icons:1password')).toBe('Si1Password');
    });

    it('converts icon brew identifiers with hyphenated names', () => {
        expect(convertIconIdToIconize('icon-brew:custom-icon')).toBe('IbCustomIcon');
    });

    it('converts phosphor identifiers without repeating provider name', () => {
        expect(convertIconIdToIconize('phosphor:apple-logo')).toBe('PhAppleLogo');
    });

    it('converts RPG Awesome identifiers without repeating provider name', () => {
        expect(convertIconIdToIconize('rpg-awesome:harpoon-trident')).toBe('RaHarpoonTrident');
    });

    it('returns null for providers without Iconize mappings', () => {
        expect(convertIconIdToIconize('emoji:📁')).toBeNull();
        expect(convertIconIdToIconize('unknown-provider:icon')).toBeNull();
    });
});

describe('normalizeCanonicalIconId', () => {
    it('removes redundant lucide prefix', () => {
        expect(normalizeCanonicalIconId('lucide-sun')).toBe('sun');
    });

    it('normalizes phosphor identifiers by stripping provider prefix', () => {
        expect(normalizeCanonicalIconId('phosphor:ph-apple-logo')).toBe('phosphor:apple-logo');
    });

    it('normalizes RPG Awesome identifiers by stripping provider prefix', () => {
        expect(normalizeCanonicalIconId('rpg-awesome:ra-harpoon-trident')).toBe('rpg-awesome:harpoon-trident');
    });

    it('leaves unknown providers unchanged', () => {
        expect(normalizeCanonicalIconId('custom-pack:icon-name')).toBe('custom-pack:icon-name');
    });
});

describe('frontmatter icon helpers', () => {
    it('serializes canonical identifiers to Iconize format', () => {
        expect(serializeIconForFrontmatter('phosphor:ph-apple-logo')).toBe('PhAppleLogo');
    });

    it('returns bare emoji characters when serializing emoji icons', () => {
        expect(serializeIconForFrontmatter('emoji:📁')).toBe('📁');
    });

    it('falls back to canonical identifier when provider has no Iconize mapping', () => {
        expect(serializeIconForFrontmatter('custom-pack:icon-name')).toBe('custom-pack:icon-name');
    });

    it('deserializes Iconize identifiers with redundant prefixes', () => {
        expect(deserializeIconFromFrontmatter('PhPhAppleLogo')).toBe('phosphor:apple-logo');
    });

    it('deserializes canonical identifiers that still contain redundant provider prefixes', () => {
        expect(deserializeIconFromFrontmatter('phosphor:ph-apple-logo')).toBe('phosphor:apple-logo');
        expect(deserializeIconFromFrontmatter('rpg-awesome:ra-harpoon-trident')).toBe('rpg-awesome:harpoon-trident');
    });

    it('deserializes plain emoji strings into canonical emoji identifiers', () => {
        expect(deserializeIconFromFrontmatter('📁')).toBe('emoji:📁');
    });

    it('deserializes legacy lucide identifiers', () => {
        expect(deserializeIconFromFrontmatter('lucide-sun')).toBe('sun');
    });
});
