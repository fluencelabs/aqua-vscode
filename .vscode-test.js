const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig({
    workspaceFolder: './integration-tests/test-workspace/',
    files: 'integration-tests/out/**/*.test.js',
});
