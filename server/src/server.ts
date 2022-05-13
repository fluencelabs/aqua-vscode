import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import {
	WorkspaceFolder
} from "vscode-languageserver-protocol"

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import {compileAqua} from "./validation";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let folders: WorkspaceFolder[] = []

export interface Settings {
	imports: string[];
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: Settings = { imports: [] };
let globalSettings: Settings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<Settings>> = new Map();

connection.onDidChangeConfiguration(change => {

	connection.console.log(change.settings)

	globalSettings = <Settings>(
		(change.settings.aquaSettings || defaultSettings)
	);


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
			section: 'aquaSettings'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);

	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);

	if (params.workspaceFolders) {
		folders = params.workspaceFolders
	}

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	connection.workspace.onDidChangeWorkspaceFolders(event => {
		folders = folders.concat(event.added)
		folders = folders.filter((f) => !event.removed.includes(f));
	});

});

documents.onDidSave(async change => {
	await validateDocument(change.document);
});

documents.onDidOpen(async change => {
	await validateDocument(change.document);
});

async function validateDocument(textDocument: TextDocument): Promise<void> {
	const settings = await getDocumentSettings(textDocument.uri);

	const diagnostics = await compileAqua(settings, textDocument, folders);

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
