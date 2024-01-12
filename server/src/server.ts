import {
    createConnection,
    DiagnosticSeverity,
    DidChangeConfigurationNotification,
    InitializeParams,
    InitializeResult,
    ProposedFeatures,
    TextDocuments,
    TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import type { WorkspaceFolder } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DefinitionParams, Hover, HoverParams, MarkupContent } from 'vscode-languageserver';
import { MarkupKind } from 'vscode-languageserver';

import { compileAqua } from './validation';
import { FluenceCli } from './cli';
import { Settings, SettingsManager } from './settings';
import { InfoManager } from './info';
import { tokenToLocation } from './utils';

// Create a connection to the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let folders: WorkspaceFolder[] = [];

function createSettingsManager(cliPath?: string, cliCallDelay?: number, defaultSettings?: Settings): SettingsManager {
    const cli = new FluenceCli(cliPath);
    const configuration = hasConfigurationCapability ? connection.workspace : undefined;
    return new SettingsManager({ cli, cliCallDelay, defaultSettings }, configuration);
}

let documentSettings = createSettingsManager();
const documentInfos = new InfoManager();

connection.onDidChangeConfiguration((change) => {
    connection.console.log(`onDidChangeConfiguration event ${JSON.stringify(change)}`);

    documentSettings = createSettingsManager(
        change.settings.aquaSettings.fluencePath,
        change.settings.aquaSettings.fluenceCallDelay,
        change.settings.aquaSettings,
    );

    // Revalidate all open text documents
    documents.all().forEach(validateDocument);
});

// Only keep settings for open documents
documents.onDidClose((e) => {
    documentSettings.removeDocumentSettings(e.document.uri);
    documentInfos.removeDocumentInfo(e.document.uri);
});

connection.onInitialize((params: InitializeParams) => {
    connection.console.log('onInitialize event');
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

    if (params.workspaceFolders) {
        folders = params.workspaceFolders;
    }

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            definitionProvider: true,
            hoverProvider: true,
        },
    };

    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true,
            },
        };
    }

    return result;
});

connection.onInitialized(async () => {
    connection.console.log('onInitialized event');

    if (hasConfigurationCapability) {
        connection.client.register(DidChangeConfigurationNotification.type, {
            section: 'aquaSettings',
        });
    }

    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((event) => {
            folders = folders.concat(event.added);
            folders = folders.filter((f) => !event.removed.includes(f));
        });
    }
});

documents.onDidSave(async (change) => {
    connection.console.log('onDidSave event');

    await validateDocument(change.document);
});

documents.onDidOpen(async (change) => {
    connection.console.log('onDidOpen event');

    await validateDocument(change.document);
});

connection.onHover(({ textDocument, position }: HoverParams) => {
    connection.console.log('onHover event');

    const info = documentInfos.infoAt(textDocument.uri, position);
    if (info) {
        const content: MarkupContent = { kind: MarkupKind.PlainText, value: info.type };
        const hover: Hover = { contents: content };

        return hover;
    }

    return null;
});

connection.onDefinition(({ textDocument, position }: DefinitionParams) => {
    connection.console.log('onDefinition event');

    const def = documentInfos.defAt(textDocument.uri, position);

    return def ? [tokenToLocation(def)] : [];
});

async function validateDocument(textDocument: TextDocument): Promise<void> {
    const settings = await documentSettings.getDocumentSettings(textDocument.uri);

    connection.console.log(`validateDocument ${textDocument.uri} with settings ${JSON.stringify(settings)}`);

    const [diagnostics, info] = await compileAqua(settings, textDocument);

    documentInfos.updateDocumentInfo(textDocument.uri, info);

    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

    // Request additional imports update if there are errors
    if (diagnostics.some((d) => d.severity === DiagnosticSeverity.Error)) {
        documentSettings.requestImportsUpdate(textDocument.uri);
    }
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
