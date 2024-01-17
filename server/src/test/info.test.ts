import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Location, Position, Range } from 'vscode-languageserver';

import { compileAqua } from '../validation';
import { DocumentInfo } from '../info';
import { pathToUri, tokenToLocation } from '../utils';

/**
 * Load document from file, compile it and return info
 * @param relPath path relative to test folder
 * @returns document, document info after compilation
 */
async function openDocument(relPath: string): Promise<[TextDocument, DocumentInfo]> {
    const absPath = path.join(__dirname, relPath);

    const file = await fs.open(absPath);
    const content = await file.readFile('utf-8');
    await file.close();

    const document = TextDocument.create(pathToUri(absPath), 'aqua', 0, content);
    // Compile without imports
    const [_, info] = await compileAqua({ imports: {} }, document);

    return [document, info];
}

/**
 * Find all locations of a variable in a document
 * @param name variable name
 * @param doc text document to search in
 * @returns locations of variable in document
 */
function locationsOf(name: string, doc: TextDocument): Location[] {
    const re = new RegExp(`(?<=\\b)${name}(?=\\b)`, 'g');
    const text = doc.getText();

    const locations: Location[] = [];
    for (let match = re.exec(text); match !== null; match = re.exec(text)) {
        const start = doc.positionAt(match.index);
        const end = doc.positionAt(match.index + match[0].length);
        locations.push({
            uri: doc.uri,
            range: {
                start,
                end,
            },
        });
    }

    return locations;
}

/**
 * Generate all positions in a range
 * @param doc text document
 * @param range range
 * @returns positions in range
 */
function genRange(doc: TextDocument, range: Range): Position[] {
    const positions: Position[] = [];

    const begOff = doc.offsetAt(range.start);
    const endOff = doc.offsetAt(range.end);
    for (let off = begOff; off < endOff; off++) {
        positions.push(doc.positionAt(off));
    }

    return positions;
}

describe('DocumentInfo Test Suite', () => {
    describe('infoAt', () => {
        it('should return type information on each occurrence (simple)', async () => {
            const [document, docInfo] = await openDocument('aqua/simple.aqua');
            const locations = locationsOf('testVar', document);

            assert.strictEqual(locations.length, 6, 'Not all occurrences found');

            for (const loc of locations) {
                for (const pos of genRange(document, loc.range)) {
                    const info = docInfo.infoAt(pos);

                    assert.ok(info, 'Info not found');
                    assert.strictEqual(info.type, 'string', 'Wrong type info');
                }
            }
        });
    });

    describe('defAt', () => {
        it('should return definition location on each occurrence (simple)', async () => {
            const [document, docInfo] = await openDocument('aqua/simple.aqua');
            const locations = locationsOf('testVar', document);

            assert.strictEqual(locations.length, 6, 'Not all occurrences found');

            const definition = locations[0];

            for (const loc of locations.slice(1)) {
                for (const pos of genRange(document, loc.range)) {
                    const def = docInfo.defAt(pos);

                    assert.ok(def, 'Definition not found');
                    assert.deepStrictEqual(tokenToLocation(def), definition, 'Wrong definition location');
                }
            }
        });
    });
});
