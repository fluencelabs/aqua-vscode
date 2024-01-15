import * as assert from 'assert';
import * as path from 'path';

import * as vscode from 'vscode';

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(cond: () => boolean, timeout: number): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        if (cond()) {
            return true;
        }

        await delay(100);
    }

    return false;
}

suite('Extension Test Suite', () => {
    async function waitForExtensionActivation(timeout: number): Promise<void> {
        const activated = waitFor(() => {
            return (
                vscode.extensions.all.find((extension) => {
                    return extension.isActive && extension.id === 'FluenceLabs.aqua';
                }) !== undefined
            );
        }, timeout);

        assert.ok(activated, `Aqua extension was not activated after ${timeout}ms`);
    }

    async function openDocument(relPath: string): Promise<vscode.TextDocument> {
        assert.ok(vscode.workspace.workspaceFolders?.length === 1, 'Test workspace should contain one folder');

        const rootPath = vscode.workspace.workspaceFolders[0]!.uri.fsPath;
        const filePath = path.join(rootPath, relPath);
        const fileUri = vscode.Uri.file(filePath);

        const document = await vscode.workspace.openTextDocument(fileUri);

        await waitForExtensionActivation(10000);

        return document;
    }

    async function getDiagnostics(uri: vscode.Uri, timeout: number): Promise<vscode.Diagnostic[]> {
        let diagnostics: vscode.Diagnostic[] = [];

        const got = await waitFor(() => {
            diagnostics = vscode.languages.getDiagnostics(uri);
            return diagnostics.length > 0;
        }, timeout);

        assert.ok(got, `No diagnostics provided for ${uri.toString()} in ${timeout}ms`);

        return diagnostics;
    }

    test('Semantic errors in single file', async () => {
        const document = await openDocument('singleFile/file.aqua');
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
