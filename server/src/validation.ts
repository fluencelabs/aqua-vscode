import * as fs from 'fs';
import * as Path from 'path';

import type { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';

import { AquaLSP, ErrorInfo, TokenLink, WarningInfo } from '@fluencelabs/aqua-language-server-api/aqua-lsp-api';

import type { Settings } from './settings';
import { DocumentInfo } from './info';
import { uriToPath } from './utils';

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
): Promise<[Diagnostic[], DocumentInfo]> {
    const path = uriToPath(textDocument.uri);

    // compile aqua and get result
    const result = await AquaLSP.compile(path, settings.imports);

    const diagnostics: Diagnostic[] = [];
    const links: TokenLink[] = [];

    const docPath = Path.parse(path);

    // empty string for already resolved paths in 'importLocations'
    const linksSearch = ['', docPath.dir];

    result.importLocations.map(function (ti) {
        // add extension for imports without extension
        let importPath: string;
        if (ti.path.endsWith('.aqua')) {
            importPath = ti.path;
        } else {
            importPath = ti.path + '.aqua';
        }

        const path = linksSearch.map((i) => Path.join(i, importPath)).find(fs.existsSync);
        
        
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
        } else {
            console.log(`Cannot find path for '${ti}'`)
        }
    });

    if (result.warnings) {
        // Add all warnings related to the file to Diagnostic
        const warnings = result.warnings
            .filter((w) => w.location == null || w.location === path)
            .map((w) => infoToDiagnostic(textDocument, w));
        diagnostics.push(...warnings);
    }

    if (result.errors) {
        // Add all errors related to the file to Diagnostic
        const errors = result.errors
            .filter((e) => e.location == null || e.location === path)
            .map((e) => infoToDiagnostic(textDocument, e));
        diagnostics.push(...errors);
    }

    const locations = result.locations.concat(links);
    const info = new DocumentInfo(path, locations, result.tokens);

    return [diagnostics, info];
}
