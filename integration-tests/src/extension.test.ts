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

    async function getDiagnostics(uri: vscode.Uri, timeout: number): Promise<vscode.Diagnostic[]> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const diagnostics = vscode.languages.getDiagnostics(uri);

            if (diagnostics.length > 0) {
                return diagnostics;
            }

            await delay(100);
        }

        throw new Error(`No diagnostics provided for ${uri} in ${timeout}ms`);
    }

    test('Semantic errors in single file', async () => {
        const document = await openDocument('singleFile/file.aqua');

        // Retrieve diagnostics
        const diagnostics = await getDiagnostics(document.uri, 10000);

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

        // Retrieve diagnostics
        const diagnostics = await getDiagnostics(document.uri, 10000);

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

        // Retrieve diagnostics
        const diagnostics = await getDiagnostics(document.uri, 10000);

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
