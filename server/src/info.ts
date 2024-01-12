import type { DocumentUri, Position } from 'vscode-languageserver';

import type { TokenInfo, TokenLink, TokenLocation } from '@fluencelabs/aqua-language-server-api/aqua-lsp-api';

import { locInLoc, posInToken } from './utils';

/**
 * Class that incapsulates information
 * about tokens inside a document
 */
export class DocumentInfo {
    private links: TokenLink[];
    private tokens: TokenInfo[];

    constructor(links: TokenLink[], tokens: TokenInfo[]) {
        this.links = links;
        this.tokens = tokens;
    }

    /**
     * Find token info at position
     * @param pos position to check
     * @returns token info if found
     */
    infoAt(pos: Position): TokenInfo | undefined {
        const info = this.tokens.find((token) => posInToken(pos, token.location));
        if (info) {
            return info;
        }

        // Fallback: if token info is not found
        // try to find its definition and its info
        const def = this.defAt(pos);
        if (def) {
            return this.tokens.find((token) => locInLoc(def, token.location));
        }

        return undefined;
    }

    /**
     * Find definition location at position
     * @param pos Position to check
     * @returns Definition location if found
     */
    defAt(pos: Position): TokenLocation | undefined {
        return this.links.find((link) => posInToken(pos, link.current))?.definition;
    }
}

/**
 * Info manager for documents
 */
export class InfoManager {
    private documents: Map<DocumentUri, DocumentInfo> = new Map();

    updateDocumentInfo(uri: DocumentUri, info: DocumentInfo) {
        this.documents.set(uri, info);
    }

    infoAt(uri: DocumentUri, pos: Position): TokenInfo | undefined {
        return this.documents.get(uri)?.infoAt(pos);
    }

    defAt(uri: DocumentUri, pos: Position): TokenLocation | undefined {
        return this.documents.get(uri)?.defAt(pos);
    }

    removeDocumentInfo(uri: DocumentUri) {
        this.documents.delete(uri);
    }
}
