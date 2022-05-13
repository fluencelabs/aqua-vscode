import {TextDocument} from "vscode-languageserver-textdocument";
import {AquaLSP} from "@fluencelabs/aqua-language-server-api/aqua-lsp-api";
import {Diagnostic, DiagnosticSeverity} from "vscode-languageserver/node";
import {Settings} from "./server";
import {WorkspaceFolder} from "vscode-languageserver-protocol";

export async function compileAqua(settings: Settings, textDocument: TextDocument, folders: WorkspaceFolder[]): Promise<Diagnostic[]> {

    const uri = textDocument.uri.replace("file://", "")

    let imports: string[] = []

    // add all workspace folders to imports
    imports = imports.concat(folders.map((f) => f.uri.replace("file://", "")))
    imports = imports.concat(folders.map((f) => f.uri.replace("file://", "")) + "/node_modules")
    imports = imports.concat(settings.imports.map((s) => s.replace("file://", "")))
    imports = imports.concat(settings.imports.map((s) => s.replace("file://", "")) + "/node_modules")
    if (require.main) {
        imports = imports.concat(require.main.paths)
    }

    // compile aqua and get possible errors
    const errors = await AquaLSP.compile(uri, imports)

    const diagnostics: Diagnostic[] = [];

    if (errors) {
        // Add all errors to Diagnostic
        errors.forEach((err) => {
            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: {
                    start: textDocument.positionAt(err.start),
                    end: textDocument.positionAt(err.end)
                },
                message: err.message
            };

            if (err.location) {
                diagnostic.relatedInformation = [
                    {
                        location: {
                            uri: err.location,
                            range: Object.assign({}, diagnostic.range)
                        },
                        message: 'Compilation error'
                    }
                ];
            }


            diagnostics.push(diagnostic);
        })
    }

    return diagnostics
}