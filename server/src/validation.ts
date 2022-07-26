import type { TextDocument } from 'vscode-languageserver-textdocument';
import { AquaLSP, ErrorInfo, TokenLink } from '@fluencelabs/aqua-language-server-api/aqua-lsp-api';
import { Diagnostic, DiagnosticSeverity, RemoteConsole } from 'vscode-languageserver/node';
import type { Settings } from './server';
import type { WorkspaceFolder } from 'vscode-languageserver-protocol';
import * as fs from 'fs';
import * as Path from 'path';

export async function compileAqua(
    settings: Settings,
    textDocument: TextDocument,
    folders: WorkspaceFolder[],
    console: RemoteConsole,
): Promise<[Diagnostic[], TokenLink[]]> {
    const uri = textDocument.uri.replace('file://', '');

    let imports: string[] = [];

    // add all workspace folders to imports
    imports = imports.concat(folders.map((f) => f.uri.replace('file://', '')));
    imports = imports.concat(folders.map((f) => f.uri.replace('file://', '')) + '/node_modules');

    if (settings.imports && Array.isArray(settings.imports)) {
        const validatedImports: string[] = settings.imports.filter((s) => {
            if (typeof s != 'string') {
                console.warn(
                    `Field 'import' in extension settings must have only array of strings. Cannot add import ${JSON.stringify(
                        s,
                    )}`,
                );
                return false;
            } else {
                return true;
            }
        });

        imports = imports.concat(validatedImports.map((s) => s.replace('file://', '')));
        imports = imports.concat(validatedImports.map((s) => s.replace('file://', '')) + '/node_modules');
    }

    if (require.main) {
        imports = imports.concat(require.main.paths);
    }

    // compile aqua and get possible errors
    const result = await AquaLSP.compile(uri, imports);

    const diagnostics: Diagnostic[] = [];

    let links: TokenLink[] = [];
    let p = Path.parse(textDocument.uri);
    let linksSearch = [p.dir.replace('file://', '')].concat(imports);
    result.importLocations.map(function (ti) {
        const path = linksSearch.map((i) => i + '/' + ti.path).find((i) => fs.existsSync(i));
        if (path) {
            links.push({
                current: ti.current,
                definition: {
                    name: path,
                    startLine: 0,
                    startCol: 0,
                    endLine: 0,
                    endCol: 0,
                },
            });
        }
    });

    if (result.errors) {
        // Add all errors to Diagnostic
        result.errors.forEach((err: ErrorInfo) => {
            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: {
                    start: textDocument.positionAt(err.start),
                    end: textDocument.positionAt(err.end),
                },
                message: err.message,
            };

            if (err.location) {
                diagnostic.relatedInformation = [
                    {
                        location: {
                            uri: err.location,
                            range: Object.assign({}, diagnostic.range),
                        },
                        message: 'Compilation error',
                    },
                ];
            }

            diagnostics.push(diagnostic);
        });
    }

    return [diagnostics, result.locations.concat(links)];
}
