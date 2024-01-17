import * as assert from 'assert';

import { normalizeImports, uniteImports } from '../imports.js';

describe('Imports Test Suite', () => {
    describe('normalizeImports', () => {
        it('should normalize empty imports', async () => {
            assert.deepStrictEqual(normalizeImports(undefined), {});
            assert.deepStrictEqual(normalizeImports(null), {});
        });

        it('should normalize legacy imports', async () => {
            const imports = ['a', 'b', 'c'];
            const normalized = {
                '/': {
                    '': imports,
                },
            };
            assert.deepStrictEqual(normalizeImports(imports), normalized);
        });

        it('should normalize imports', async () => {
            const imports = {
                '/': {
                    '': ['a', 'b', 'c'],
                },
            };
            assert.deepStrictEqual(normalizeImports(imports), imports);
        });

        it('should normalize imports with single paths', async () => {
            const imports = {
                '/': {
                    '': 'a',
                },
            };
            const normalized = {
                '/': {
                    '': ['a'],
                },
            };
            assert.deepStrictEqual(normalizeImports(imports), normalized);
        });

        it('should throw on invalid imports', async () => {
            assert.throws(() => normalizeImports(123));
            assert.throws(() => normalizeImports(['a', 123]));
            assert.throws(() => normalizeImports({ a: 123 }));
            assert.throws(() => normalizeImports({ a: { b: 123 } }));
            assert.throws(() => normalizeImports({ a: { b: ['a', 123] } }));
        });
    });

    describe('uniteImports', () => {
        it('should unite distinct imports', async () => {
            const lhs = {
                '/left': {
                    '': ['l'],
                },
            };
            const rhs = {
                '/right': {
                    '': ['r'],
                },
            };
            const result = { ...lhs, ...rhs };
            assert.deepStrictEqual(uniteImports(lhs, rhs), result);
        });

        it('should unite path-intersecting imports', async () => {
            const lhs = {
                '/': {
                    left: ['l'],
                },
            };
            const rhs = {
                '/': {
                    right: ['r'],
                },
            };
            const result = {
                '/': {
                    left: ['l'],
                    right: ['r'],
                },
            };
            assert.deepStrictEqual(uniteImports(lhs, rhs), result);
        });

        it('should unite path-prefix-intersecting imports', async () => {
            const lhs = {
                '/': {
                    '': ['l'],
                },
            };
            const rhs = {
                '/': {
                    '': ['r'],
                },
            };
            const result = {
                '/': {
                    '': ['l', 'r'],
                },
            };
            assert.deepStrictEqual(uniteImports(lhs, rhs), result);
        });
    });
});
