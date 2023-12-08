import type { TokenInfo, TokenLink, TokenLocation } from '@fluencelabs/aqua-language-server-api/aqua-lsp-api';
import type { Position } from 'vscode-languageserver-textdocument';

function isToken(location: TokenLocation, position: Position, name: string) {
    return (
        location.name == name &&
        location.startLine <= position.line &&
        location.startCol <= position.character &&
        location.endLine >= position.line &&
        location.endCol >= position.character
    );
}

function isTokenByLocation(location: TokenLocation, locationRight: TokenLocation) {
    return (
        location.startLine <= locationRight.startLine &&
        location.startCol <= locationRight.startCol &&
        location.endLine >= locationRight.endLine &&
        location.endCol >= locationRight.endCol
    );
}

export function searchDefinition(position: Position, name: string, locations: TokenLink[]): TokenLink | undefined {
    return locations.find((token) => isToken(token.current, position, name));
}

// find a token by position in the definition.
// If there is no token, look for the definition token in the locations,
// and then look up the token information from the token found.
export function searchInfo(
    position: Position,
    name: string,
    tokens: TokenInfo[],
    locations: TokenLink[],
): TokenInfo | undefined {
    const tokenInfo = tokens.find((token) => isToken(token.location, position, name));

    if (tokenInfo) {
        return tokenInfo;
    }

    const tokenLink = searchDefinition(position, name, locations);

    if (link) {
        return tokens.find((token) => isTokenByLocation(token.location, link.definition));
    } else {
        return undefined;
    }
}
