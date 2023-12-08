import type { Configuration } from 'vscode-languageserver/lib/common/configuration';
import { URI } from 'vscode-uri';

import type { FluenceCli } from './cli';

type Imports = string[];

export interface Settings {
    imports: Imports;
    enableLegacyAutoImportSearch: boolean;
}

/**
 * Document info stored in `SettingsManager` cache
 */
class DocumentInfo {
    /* Settings from configuration (or default) */
    private settings: Settings;
    /* Additional imports from CLI */
    private imports: Imports = [];
    private importsLastUpdated = 0;
    private importsUpdateRequested = true;

    constructor(settings: Settings) {
        this.settings = settings;
    }

    getSettings(): Settings {
        return {
            ...this.settings,
            imports: [...this.settings.imports, ...this.imports],
        };
    }

    requestImportsUpdate() {
        this.importsUpdateRequested = true;
    }

    isImportsUpdateNeeded(delay?: number): boolean {
        // Update additional imports not more often than once `delay`
        // and only if there is a request to update
        const isUpdateReady = delay ? Date.now() - this.importsLastUpdated > delay : true;
        return isUpdateReady && this.importsUpdateRequested;
    }

    updateImports(imports: string[]) {
        this.imports = imports;
        this.importsLastUpdated = Date.now();
        this.importsUpdateRequested = false;
    }
}

export interface SettingsManagerConfig {
    cli: FluenceCli;
    cliCallDelay?: number | undefined;
    defaultSettings?: Settings | undefined;
}

/**
 * Compilation settings manager for documents
 */
export class SettingsManager {
    private readonly defaultSettings: Settings = {
        imports: [],
        enableLegacyAutoImportSearch: false,
    };
    private documents: Map<string, DocumentInfo> = new Map();

    private readonly cli: FluenceCli;
    private readonly cliCallDelay: number | undefined;
    private readonly configuration: Configuration | undefined;

    constructor(config: SettingsManagerConfig, configuration?: Configuration) {
        this.cli = config.cli;
        this.configuration = configuration;
        if (config.defaultSettings) {
            this.defaultSettings = config.defaultSettings;
        }
        if (config.cliCallDelay) {
            this.cliCallDelay = config.cliCallDelay;
        }
    }

    /**
     * Get settings for document or global settings if document settings are not available
     *
     * @param uri Document uri
     * @returns Settings for the document
     */
    async getDocumentSettings(uri: string): Promise<Settings> {
        const info = await this.updateDocument(uri);

        return info.getSettings();
    }

    /**
     * Remove document settings from cache
     *
     * @param uri Document uri
     */
    removeDocumentSettings(uri: string): void {
        this.documents.delete(uri);
    }

    /**
     * Set flag to request additional imports update.
     * This flag will be reset after first successful update.
     * NOTE: Imports are updated no more than once in 5 seconds.
     */
    requestImportsUpdate(uri: string) {
        this.documents.get(uri)?.requestImportsUpdate();
    }

    /**
     * Update document info in cache:
     * 1. Get settings from configuration (or default)
     * 2. Get additional imports from CLI (if needed)
     * @param uri document uri
     * @returns updated document info
     */
    private async updateDocument(uri: string): Promise<DocumentInfo> {
        let info = this.documents.get(uri);
        if (!info) {
            const settings = await this.getDocumentConfiguration(uri);
            info = new DocumentInfo(settings);
        }

        if (info.isImportsUpdateNeeded(this.cliCallDelay)) {
            const path = URI.parse(uri).fsPath;
            const imports = await this.cli.imports(path);
            info.updateImports(imports);
        }

        this.documents.set(uri, info);

        return info;
    }

    private async getDocumentConfiguration(uri: string): Promise<Settings> {
        if (this.configuration) {
            // TODO: Handle errors
            const settings = await this.configuration.getConfiguration({
                scopeUri: uri,
                section: 'aquaSettings',
            });
            if (settings) {
                return settings;
            }
        }

        return this.defaultSettings;
    }
}
