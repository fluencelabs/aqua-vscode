import url from 'url';

import type { Position } from 'vscode-languageserver-textdocument';
import type { DocumentUri, Location } from 'vscode-languageserver';

import type { TokenLocation } from '@fluencelabs/aqua-language-server-api/aqua-lsp-api';

/**
 * Check if position is inside token
 * @param path path to file with token
 * @param position position to check
 * @param token token to check
 * @returns true if position is inside token
 * @note this ignores token's file name
 *       as position does not contain such info
 */
export function posInToken(path: string, position: Position, token: TokenLocation): boolean {
    return (
        token.name == path &&
        token.startLine <= position.line &&
        token.startCol <= position.character &&
        token.endLine >= position.line &&
        token.endCol >= position.character
    );
}

/**
 * Check if if location is inside other location
 * @param lhs location to check
 * @param rhs enclosing location
 * @returns true if rhs is enclosing lhs
 */
export function locInLoc(lhs: TokenLocation, rhs: TokenLocation): boolean {
    return (
        lhs.name == rhs.name &&
        rhs.startLine <= lhs.startLine &&
        rhs.startCol <= lhs.startCol &&
        rhs.endLine >= lhs.endLine &&
        rhs.endCol >= lhs.endCol
    );
}

/**
 * Convert URI to file path
 * @param uri URI to convert
 * @returns file path
 */
export function uriToPath(uri: DocumentUri) {
    return url.fileURLToPath(uri);
}

/**
 * Convert file path to URI
 * @param path file path to convert
 * @returns URI
 */
export function pathToUri(path: string) {
    return url.format(url.pathToFileURL(path));
}

/**
 * Convert token location to location
 * @param loc token location
 * @returns location
 */
export function tokenToLocation(loc: TokenLocation): Location {
    return {
        uri: pathToUri(loc.name),
        range: {
            start: {
                line: loc.startLine,
                character: loc.startCol,
            },
            end: {
                line: loc.endLine,
                character: loc.endCol,
            },
        },
    };
}
