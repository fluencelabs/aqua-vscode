import * as assert from 'assert';
import * as path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../extension';

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

suite('Extension Test Suite', () => {
    test('Should provide diagnostics for syntax errors', async () => {
        assert.ok(vscode.workspace.workspaceFolders?.length === 1, 'Test workspace should contain one folder');

        const rootPath = vscode.workspace.workspaceFolders[0]!.uri.fsPath;
        const filePath = path.join(rootPath, 'oneFile/file.aqua');
        const fileUri = vscode.Uri.file(filePath);

        const document = await vscode.workspace.openTextDocument(fileUri);

        // Wait for VSCode to enable the extension
        await delay(1000);

        assert.ok(
            vscode.extensions.all.find((extension) => {
                return extension.isActive && extension.id === 'FluenceLabs.aqua';
            }),
            'Aqua extension is not active',
        );

        // Wait for the extension to provide diagnostics
        await delay(2000);

        // Retrieve diagnostics
        const diagnostics = vscode.languages.getDiagnostics(document.uri);

        assert.ok(diagnostics.length > 0, 'No diagnostics provided');
        assert.ok(
            diagnostics.find((diagnostic) => {
                return diagnostic.severity === vscode.DiagnosticSeverity.Error;
            }),
            'No error diagnostics provided',
        );
    }).timeout(10000);
});
