import {
    createConnection,
    InitializeParams,
    InitializeResult,
    ProposedFeatures,
    TextDocuments,
    TextDocumentSyncKind,
} from 'vscode-languageserver/node';

import type { WorkspaceFolder } from 'vscode-languageserver-protocol';

import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { compileAqua } from './validation';
import type { DefinitionParams, Location } from 'vscode-languageserver';
import type { TokenLink } from '@fluencelabs/aqua-language-server-api/aqua-lsp-api';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let folders: WorkspaceFolder[] = [];

export interface Settings {
    imports: string[];
}

function searchDefinition(position: Position, name: string, locations: TokenLink[]): TokenLink | undefined {
    return locations.find((token) => {
        return (
            token.current.name == name &&
            token.current.startLine <= position.line &&
            token.current.startCol <= position.character &&
            token.current.endLine >= position.line &&
            token.current.endCol >= position.character
        );
    });
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: Settings = { imports: [] };
let globalSettings: Settings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<Settings>> = new Map();

const allLocations: Map<string, TokenLink[]> = new Map();

async function onDefinition({ textDocument, position }: DefinitionParams): Promise<Location[]> {
    connection.console.log('onDefinition event');
    const doc = documents.get(textDocument.uri);

    if (doc) {
        const currentLocations = allLocations.get(textDocument.uri);
        if (currentLocations) {
            const token = searchDefinition(position, doc.uri.replace('file://', ''), currentLocations);
            connection.console.log('find token: ' + JSON.stringify(token));
            if (token) {
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
        }
    }

    return [];
}

connection.onDefinition(onDefinition);

connection.onDidChangeConfiguration((change) => {
    connection.console.log(change.settings);

    globalSettings = <Settings>(change.settings.aquaSettings || defaultSettings);

    // Revalidate all open text documents
    documents.all().forEach(validateDocument);
});

function getDocumentSettings(resource: string): Thenable<Settings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'aquaSettings',
        });
        documentSettings.set(resource, result);
    }
    return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri);
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

connection.onInitialized(() => {
    connection.console.log('onInitialized event');
    connection.workspace.onDidChangeWorkspaceFolders((event) => {
        folders = folders.concat(event.added);
        folders = folders.filter((f) => !event.removed.includes(f));
    });
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
    const settings = await getDocumentSettings(textDocument.uri);

    const [diagnostics, locations] = await compileAqua(settings, textDocument, folders);

    allLocations.set(textDocument.uri, locations);

    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
