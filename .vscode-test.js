const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig({
    workspaceFolder: './test/test-workspace/',
    files: 'test/out/**/*.test.js',
});
