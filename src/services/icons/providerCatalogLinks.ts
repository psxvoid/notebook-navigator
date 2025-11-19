import { EXTERNAL_ICON_PROVIDERS, type ExternalIconProviderId } from './external/providerRegistry';

const BUILTIN_PROVIDER_LINKS: Record<string, string> = {
    lucide: 'https://lucide.dev/icons/'
};

/**
 * Returns the public catalog URL for a provider so users can browse icons outside the modal.
 */
export function getProviderCatalogUrl(providerId: string): string | null {
    if (!providerId) {
        return null;
    }

    const builtInUrl = BUILTIN_PROVIDER_LINKS[providerId];
    if (builtInUrl) {
        return builtInUrl;
    }

    const externalProvider = EXTERNAL_ICON_PROVIDERS[providerId as ExternalIconProviderId];
    return externalProvider?.catalogUrl ?? null;
}
