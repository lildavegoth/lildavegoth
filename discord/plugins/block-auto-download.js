import { Plugin } from '@revenge/core';
import { patcher, findByStoreName } from '@revenge/api';

export default class BlockAutoDownload extends Plugin {
    start() {
        const UserSettingsStore = findByStoreName('UserSettingsStore');
        patcher.instead(UserSettingsStore, 'getAutoDownloadSettings', () => ({
            mobile: { images: false, videos: false, files: false },
            wifi: { images: false, videos: false, files: false }
        }));
    }

    stop() {
        patcher.unpatchAll();
    }
}
