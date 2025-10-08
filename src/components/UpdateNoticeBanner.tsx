/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { useEffect, useState } from 'react';
import type { ReleaseUpdateNotice } from '../services/ReleaseCheckService';
import { strings } from '../i18n';

/** Props for the UpdateNoticeBanner component */
interface UpdateNoticeBannerProps {
    notice: ReleaseUpdateNotice | null;
    onDismiss: (version: string) => Promise<void>;
}

/** Duration to display the banner before starting fade-out (7 seconds) */
const DISPLAY_DURATION_MS = 7000;
/** Duration of the fade-out animation (0.5 seconds) */
const FADE_DURATION_MS = 500;

/**
 * Displays a temporary banner when a newer plugin release is available.
 */
export function UpdateNoticeBanner({ notice, onDismiss }: UpdateNoticeBannerProps) {
    const [visibleNotice, setVisibleNotice] = useState<ReleaseUpdateNotice | null>(null);
    const [isFading, setIsFading] = useState(false);

    // Update visible notice when a new notice arrives
    useEffect(() => {
        if (!notice) {
            return;
        }

        setVisibleNotice(notice);
        setIsFading(false);
    }, [notice]);

    // Start fade-out animation after display duration
    useEffect(() => {
        if (!visibleNotice) {
            return;
        }

        const displayTimer = window.setTimeout(() => {
            setIsFading(true);
        }, DISPLAY_DURATION_MS);

        return () => {
            window.clearTimeout(displayTimer);
        };
    }, [visibleNotice]);

    // Dismiss banner after fade-out completes
    useEffect(() => {
        if (!isFading || !visibleNotice) {
            return;
        }

        const dismissTimer = window.setTimeout(() => {
            void onDismiss(visibleNotice.version);
            setVisibleNotice(null);
        }, FADE_DURATION_MS);

        return () => {
            window.clearTimeout(dismissTimer);
        };
    }, [isFading, visibleNotice, onDismiss]);

    if (!visibleNotice) {
        return null;
    }

    const className = `nn-update-banner${isFading ? ' fade-out' : ''}`;

    return (
        <div className={className} role="status">
            <div className="nn-update-banner__text">
                <span className="nn-update-banner__label">{strings.common.updateBannerTitle}</span>
                <span className="nn-update-banner__instruction">{strings.common.updateBannerInstruction}</span>
            </div>
        </div>
    );
}
