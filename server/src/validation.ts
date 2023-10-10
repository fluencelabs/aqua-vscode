import * as fs from 'fs';
import * as Path from 'path';

import type { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity, RemoteConsole } from 'vscode-languageserver/node';
import type { WorkspaceFolder } from 'vscode-languageserver-protocol';

import { AquaLSP, ErrorInfo, TokenLink, WarningInfo } from '@fluencelabs/aqua-language-server-api/aqua-lsp-api';

import type { Settings } from './settings';

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

function getImports(
    settings: Settings,
    textDocument: TextDocument,
    folders: WorkspaceFolder[],
    console: RemoteConsole,
) {
    let imports: string[] = [];

    const assumeImports = settings.enableLegacyAutoImportSearch;

    const openFolders = folders.map((f) => f.uri.replace('file://', ''));

    // add all workspace folders to imports
    // 1. open folders
    if (assumeImports) imports = imports.concat(openFolders);

    // 2. imports from settings
    if (settings.imports && Array.isArray(settings.imports)) {
        const validatedImports: string[] = settings.imports.filter((s) => {
            const isString = typeof s == 'string';
            if (!isString) {
                console.warn(
                    `Field 'import' in extension settings must have only array of strings. 
                    Cannot add import ${JSON.stringify(s)}`,
                );
            }

            return isString;
        });

        const absoluteImports = validatedImports.filter((s) => Path.isAbsolute(s));

        // relative imports must be started from open folders
        const relativeImports = validatedImports
            .filter((s) => !absoluteImports.includes(s))
            .map((s) => openFolders.map((f) => Path.join(f, s)))
            .flat();

        imports = imports.concat(relativeImports);
        imports = imports.concat(absoluteImports);

        if (assumeImports) {
            imports = imports.concat(relativeImports.map((s) => Path.join(s, '/node_modules')));
            imports = imports.concat(absoluteImports.map((s) => Path.join(s, '/node_modules')));
        }
    }

    if (assumeImports) {
        // 3. node_modules in open folders
        imports = imports.concat(openFolders.map((f) => Path.join(f, '/node_modules')));

        // 4. path to aqua library
        if (require.main) {
            imports = imports.concat(require.main.paths);
        }

        // 5. node_modules from root to open folders
        const nodeModulesPaths = folders.map((f) => findNearestNodeModules(textDocument.uri, f.uri)).filter(notEmpty);
        imports = imports.concat(nodeModulesPaths);
    }

    return imports;
}

function infoToDiagnostic(textDocument: TextDocument, info: ErrorInfo | WarningInfo): Diagnostic {
    const severity = info.infoType === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning;

    const diagnostic: Diagnostic = {
        severity: severity,
        range: {
            start: textDocument.positionAt(info.start),
            end: textDocument.positionAt(info.end),
        },
        message: info.message,
    };

    if (info.location) {
        const message = info.infoType === 'error' ? 'Compilation error' : 'Compilation warning';

        diagnostic.relatedInformation = [
            {
                location: {
                    uri: info.location,
                    range: Object.assign({}, diagnostic.range),
                },
                message: message,
            },
        ];
    }

    return diagnostic;
}

export async function compileAqua(
    settings: Settings,
    textDocument: TextDocument,
    folders: WorkspaceFolder[],
    console: RemoteConsole,
): Promise<[Diagnostic[], TokenLink[]]> {
    const uri = textDocument.uri.replace('file://', '');

    const imports = getImports(settings, textDocument, folders, console);

    // compile aqua and get result
    const result = await AquaLSP.compile(uri, imports);

    const diagnostics: Diagnostic[] = [];
    const links: TokenLink[] = [];

    const docPath = Path.parse(textDocument.uri);
    const linksSearch = [docPath.dir.replace('file://', '')].concat(imports);

    result.importLocations.map(function (ti) {
        const path = linksSearch.map((i) => Path.join(i, ti.path)).find(fs.existsSync);

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

    if (result.warnings) {
        // Add all warnings to Diagnostic
        diagnostics.push(...result.warnings.map((w) => infoToDiagnostic(textDocument, w)));
    }

    if (result.errors) {
        // Add all errors to Diagnostic
        diagnostics.push(...result.errors.map((e) => infoToDiagnostic(textDocument, e)));
    }

    const locations = result.locations.concat(links);

    return [diagnostics, locations];
}
