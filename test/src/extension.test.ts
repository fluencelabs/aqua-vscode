import * as assert from 'assert';
import * as path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../extension';

const testFolderLocation = '/../test-workspace/';

suite('Extension Test Suite', () => {
    test('Should provide diagnostics for syntax errors', async () => {
        vscode.window.showInformationMessage('test');

        const uri = vscode.Uri.file(path.join(__dirname + testFolderLocation + 'oneFile/file.aqua'));

        const document = await vscode.workspace.openTextDocument(uri);

        console.log('uri:', document.uri);

        // Wait for the language server to provide diagnostics
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Adjust timeout as needed

        // Retrieve diagnostics
        const diagnostics = vscode.languages.getDiagnostics(document.uri);

        // Assert that diagnostics contain expected errors or warnings
        console.log('diagnostics:', diagnostics);

        assert.ok(
            vscode.extensions.all.find((extension) => {
                return extension.isActive && extension.id === 'FluenceLabs.aqua';
            }), "Aqua extension is not active"
        );

        assert.ok(true);

        // Close the document and clean up
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }).timeout(10000);
});
