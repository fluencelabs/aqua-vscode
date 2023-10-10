import type { Configuration } from 'vscode-languageserver/lib/common/configuration';

import type { FluenceCli } from './cli';

export interface Settings {
    imports: string[];
    enableLegacyAutoImportSearch: boolean;
}

function addImports(settings: Settings, imports?: string[]): Settings {
    return {
        ...settings,
        imports: [...settings.imports, ...(imports ?? [])],
    };
}

/**
 * Compilation settings manager for documents
 */
export class SettingsManager {
    private readonly defaultSettings: Settings = {
        imports: [],
        enableLegacyAutoImportSearch: false,
    };
    private globalSettings: Settings = this.defaultSettings;
    private documentSettings: Map<string, Settings> = new Map();

    private additionalImports: string[] = [];
    private additionalImportsLastUpdated = 0;
    private additionalImportsUpdateRequested = true;

    private readonly cli: FluenceCli;
    private readonly configuration: Configuration | undefined;

    constructor(cli: FluenceCli, configuration?: Configuration, defaultSettings?: Settings) {
        this.cli = cli;
        this.configuration = configuration;
        if (defaultSettings) {
            this.defaultSettings = defaultSettings;
        }
    }

    /**
     * Get settings for document or global settings if document settings are not available
     *
     * @param uri Document uri
     * @returns Settings for the document
     */
    async getDocumentSettings(uri: string): Promise<Settings> {
        await this.tryUpdateDocumentSettings(uri);

        const settings = this.documentSettings.get(uri) || this.globalSettings;

        await this.tryUpdateAdditionalImports();

        return addImports(settings, this.additionalImports);
    }

    /**
     * Remove document settings from cache
     *
     * @param uri Document uri
     */
    removeDocumentSettings(uri: string): void {
        this.documentSettings.delete(uri);
    }

    /**
     * Set flag to request additional imports update.
     * This flag will be reset after first successful update.
     * NOTE: Imports are updated no more than once in 5 seconds.
     */
    requestImportsUpdate() {
        this.additionalImportsUpdateRequested = true;
    }

    private async tryUpdateDocumentSettings(uri: string): Promise<void> {
        if (this.configuration && !this.documentSettings.has(uri)) {
            // TODO: Handle errors
            const settings = await this.configuration.getConfiguration({
                scopeUri: uri,
                section: 'aquaSettings',
            });
            if (settings) {
                this.documentSettings.set(uri, settings);
            }
        }
    }

    private async tryUpdateAdditionalImports(): Promise<void> {
        const now = Date.now();
        // Update additional imports not more often than once in 5 seconds
        // and only if there is a request to update
        if (now - this.additionalImportsLastUpdated < 5000 || !this.additionalImportsUpdateRequested) {
            return;
        }

        try {
            this.additionalImports = await this.cli.imports();
            this.additionalImportsLastUpdated = now;
            this.additionalImportsUpdateRequested = false;
        } catch (e) {
            // TODO: Handle this more gracefully
            console.log('Failed to update additional imports', e);
        }
    }
}
