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
import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import type { DefinitionParams, Location } from 'vscode-languageserver';

import type { TokenLink } from '@fluencelabs/aqua-language-server-api/aqua-lsp-api';

import { compileAqua } from './validation';
import { FluenceCli } from './cli';
import { Settings, SettingsManager } from './settings';

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

function searchDefinition(position: Position, name: string, locations: TokenLink[]): TokenLink | undefined {
    return locations.find(
        (token) =>
            token.current.name == name &&
            token.current.startLine <= position.line &&
            token.current.startCol <= position.character &&
            token.current.endLine >= position.line &&
            token.current.endCol >= position.character,
    );
}

// Cache all locations of all open documents
const allLocations: Map<string, TokenLink[]> = new Map();

async function onDefinition({ textDocument, position }: DefinitionParams): Promise<Location[]> {
    connection.console.log('onDefinition event');
    const doc = documents.get(textDocument.uri);
    const currentLocations = allLocations.get(textDocument.uri);

    if (doc == undefined || currentLocations == undefined) {
        return [];
    }

    const token = searchDefinition(position, doc.uri.replace('file://', ''), currentLocations);
    connection.console.log('found token: ' + JSON.stringify(token));

    if (token == undefined) {
        return [];
    }

    const definition = token.definition;

    return [
        {
            uri: 'file://' + definition.name,
            range: {
                start: {
                    line: definition.startLine,
                    character: definition.startCol,
                },
                end: {
                    line: definition.endLine,
                    character: definition.endCol,
                },
            },
        },
    ];
}

connection.onDefinition(onDefinition);

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

async function validateDocument(textDocument: TextDocument): Promise<void> {
    const settings = await documentSettings.getDocumentSettings(textDocument.uri);

    connection.console.log(`validateDocument ${textDocument.uri} with settings ${JSON.stringify(settings)}`);

    const [diagnostics, locations] = await compileAqua(settings, textDocument, folders, connection.console);

    allLocations.set(textDocument.uri, locations);

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
