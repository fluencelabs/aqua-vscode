import type { TextDocument } from 'vscode-languageserver-textdocument';
import { AquaLSP, ErrorInfo, TokenLink } from '@fluencelabs/aqua-language-server-api/aqua-lsp-api';
import { Diagnostic, DiagnosticSeverity, RemoteConsole } from 'vscode-languageserver/node';
import type { Settings } from './server';
import type { WorkspaceFolder } from 'vscode-languageserver-protocol';
import * as fs from 'fs';
import * as Path from 'path';

function findNearestNodeModules(fileLocation: string, projectLocation: string): string | undefined {
    const relative = Path.relative(projectLocation, fileLocation);

    const projectPath = Path.resolve(projectLocation.replace('file://', ''));

    // project location is a part of file location
    if (relative && !relative.startsWith('..') && !Path.isAbsolute(relative)) {
        let currentPath = Path.join(fileLocation.replace('file:/', ''), '..');

        let result: string | undefined = undefined;

        while (true) {
            const possibleNodeModulesPath = Path.join(currentPath, '/node_modules');
            if (fs.existsSync(possibleNodeModulesPath)) {
                result = Path.resolve(possibleNodeModulesPath);
                break;
            }
            if (Path.resolve(currentPath) === projectPath) {
                break;
            } else {
                currentPath = Path.join(currentPath, '..');
            }
        }

        return result;
    } else {
        return undefined;
    }
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

export async function compileAqua(
    settings: Settings,
    textDocument: TextDocument,
    folders: WorkspaceFolder[],
    console: RemoteConsole,
): Promise<[Diagnostic[], TokenLink[]]> {
    const uri = textDocument.uri.replace('file://', '');

    let imports: string[] = [];

    let nodeModulesPaths = folders.map((f) => findNearestNodeModules(textDocument.uri, f.uri)).filter(notEmpty);
    imports = imports.concat(nodeModulesPaths);

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
