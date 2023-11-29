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
import type { DefinitionParams, HoverParams, Location } from 'vscode-languageserver';
import type { TokenInfo, TokenLink, TokenLocation } from '@fluencelabs/aqua-language-server-api/aqua-lsp-api';
import type { Hover, MarkupContent } from 'vscode-languageserver';
import { MarkupKind } from 'vscode-languageserver';

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

function createSettingsManager(cliPath?: string, defaultSettings?: Settings): SettingsManager {
    const cli = new FluenceCli(cliPath);
    const configuration = hasConfigurationCapability ? connection.workspace : undefined;
    return new SettingsManager(cli, configuration, defaultSettings);
}

let documentSettings = createSettingsManager();

function isToken(location: TokenLocation, position: Position, name: string) {
    return (
        location.name == name &&
        location.startLine <= position.line &&
        location.startCol <= position.character &&
        location.endLine >= position.line &&
        location.endCol >= position.character
    );
}

function isTokenByLocation(location: TokenLocation, locationRight: TokenLocation) {
    return (
        location.startLine <= locationRight.startLine &&
        location.startCol <= locationRight.startCol &&
        location.endLine >= locationRight.endLine &&
        location.endCol >= locationRight.endCol
    );
}

function searchDefinition(position: Position, name: string, locations: TokenLink[]): TokenLink | undefined {
    return locations.find((token) => isToken(token.current, position, name));
}

function searchInfo(
    position: Position,
    name: string,
    tokens: TokenInfo[],
    locations: TokenLink[],
): TokenInfo | undefined {
    const tokenInfo = tokens.find((token) => isToken(token.location, position, name));

    if (tokenInfo) {
        return tokenInfo;
    }

    const link = searchDefinition(position, name, locations);

    if (link) {
        return tokens.find((token) => isTokenByLocation(token.location, link.definition));
    } else {
        return undefined;
    }
}

interface PageInfo {
    links: TokenLink[];
    tokens: TokenInfo[];
}

// Cache all locations of all open documents
const allPageInfo: Map<string, PageInfo> = new Map();

function onHover({ textDocument, position }: HoverParams): Hover | null {
    console.log(textDocument.uri);
    console.log(position);

    const doc = documents.get(textDocument.uri);

    if (doc) {
        const currentPage = allPageInfo.get(textDocument.uri);
        if (currentPage) {
            const token = searchInfo(position, doc.uri.replace('file://', ''), currentPage.tokens, currentPage.links);
            connection.console.log('find token: ' + JSON.stringify(token));
            if (token) {
                const content: MarkupContent = { kind: MarkupKind.PlainText, value: token.type };

                const hover: Hover = { contents: content };

                return hover;
            }
        }
    }

    return null;
}

connection.onHover(onHover);
connection.console.log('hover registered');

async function onDefinition({ textDocument, position }: DefinitionParams): Promise<Location[]> {
    connection.console.log('onDefinition event');
    const doc = documents.get(textDocument.uri);
    const currentPage = allPageInfo.get(textDocument.uri);

    if (doc == undefined || currentPage == undefined) {
        return [];
    }

    const token = searchDefinition(position, doc.uri.replace('file://', ''), currentPage.links);
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

    documentSettings = createSettingsManager(change.settings.aquaSettings.fluencePath, change.settings.aquaSettings);

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

async function validateDocument(textDocument: TextDocument): Promise<void> {
    const settings = await documentSettings.getDocumentSettings(textDocument.uri);

    connection.console.log(`validateDocument ${textDocument.uri} with settings ${JSON.stringify(settings)}`);

    const [diagnostics, locations, tokenInfos] = await compileAqua(settings, textDocument, folders, connection.console);

    allPageInfo.set(textDocument.uri, { links: locations, tokens: tokenInfos });

    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

    // Request additional imports update if there are errors
    if (diagnostics.some((d) => d.severity === DiagnosticSeverity.Error)) {
        documentSettings.requestImportsUpdate();
    }
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
