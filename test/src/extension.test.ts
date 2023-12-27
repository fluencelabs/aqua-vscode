import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../extension';

suite('Extension Test Suite', () => {
    test('Should provide diagnostics for syntax errors', async () => {
        console.log('test');

        const document = await vscode.workspace.openTextDocument('./oneFile/file.aqua');

        console.log('uri:', document.uri);

        vscode.extensions.all.forEach((extension) => {
            if (extension.isActive) {
                console.log(`- ${extension.id}`);
            }
        });

        // Wait for the language server to provide diagnostics
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Adjust timeout as needed

        // Retrieve diagnostics
        const diagnostics = vscode.languages.getDiagnostics(document.uri);

        // Assert that diagnostics contain expected errors or warnings
        console.log('diagnostics:', diagnostics);
        // ... additional assertions as needed

        assert.ok(false);

        // Close the document and clean up
        //await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }).timeout(10000);
});
