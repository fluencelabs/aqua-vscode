import * as assert from 'assert';
import * as path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../extension';

// Time to wait for the extension to provide diagnostics
const DIAGNOSTICS_DELAY = 4000;

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

suite('Extension Test Suite', () => {
    async function openDocument(relPath: string): Promise<vscode.TextDocument> {
        assert.ok(vscode.workspace.workspaceFolders?.length === 1, 'Test workspace should contain one folder');

        const rootPath = vscode.workspace.workspaceFolders[0]!.uri.fsPath;
        const filePath = path.join(rootPath, relPath);
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

        return document;
    }

    test('Semantic errors in single file', async () => {
        const document = await openDocument('singleFile/file.aqua');

        // Wait for the extension to provide diagnostics
        await delay(DIAGNOSTICS_DELAY);

        // Retrieve diagnostics
        const diagnostics = vscode.languages.getDiagnostics(document.uri);

        assert.ok(diagnostics.length > 0, 'No diagnostics provided');
        assert.ok(
            diagnostics.find((diagnostic) => {
                return (
                    diagnostic.severity === vscode.DiagnosticSeverity.Error &&
                    diagnostic.message.includes('Wrong value type')
                );
            }),
            'No error diagnostics provided',
        );
    }).timeout(10000);

    test('Semantic errors in npm package', async () => {
        const document = await openDocument('npmPackage/main.aqua');

        // Wait for the extension to provide diagnostics
        await delay(DIAGNOSTICS_DELAY);

        // Retrieve diagnostics
        const diagnostics = vscode.languages.getDiagnostics(document.uri);

        assert.ok(diagnostics.length > 0, 'No diagnostics provided');
        assert.ok(
            diagnostics.find((diagnostic) => {
                return (
                    diagnostic.severity === vscode.DiagnosticSeverity.Error &&
                    diagnostic.message.includes('Wrong value type')
                );
            }),
            'No error diagnostics provided',
        );
    }).timeout(10000);

    test('Semantic errors in fluence project', async () => {
        const document = await openDocument('fluenceProject/src/aqua/test.aqua');

        // Wait for the extension to provide diagnostics
        await delay(DIAGNOSTICS_DELAY);

        // Retrieve diagnostics
        const diagnostics = vscode.languages.getDiagnostics(document.uri);

        assert.ok(diagnostics.length > 0, 'No diagnostics provided');
        assert.ok(
            diagnostics.find((diagnostic) => {
                return (
                    diagnostic.severity === vscode.DiagnosticSeverity.Error &&
                    diagnostic.message.includes('Wrong value type')
                );
            }),
            'No error diagnostics provided',
        );
    }).timeout(10000);
});
