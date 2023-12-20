export type Imports = Record<string, Record<string, string[]>>;

// Normalize imports to the new format
// Legacy format of an array of paths is converted to the new format
// Empty imports are converted to an empty object
export function normalizeImports(imports: unknown): Imports {
    console.log('normalizeImports: ', imports);
    // Empty imports
    if (imports === undefined || imports === null) {
        return {};
    }

    // Legacy imports - array of paths
    if (Array.isArray(imports) && imports.every((i) => typeof i === 'string')) {
        return {
            '/': {
                '': imports as string[],
            },
        };
    }

    const isStringArray = (v: unknown): v is string[] => {
        return Array.isArray(v) && v.every((i) => typeof i === 'string');
    };

    // New imports - object of objects of paths or arrays of paths
    // Inner single paths are normalized to arrays
    if (typeof imports === 'object') {
        for (const info of Object.values(imports)) {
            if (typeof info !== 'object') {
                throw new Error(`Invalid imports: ${JSON.stringify(imports)}`);
            }

            for (const [importPrefix, locations] of Object.entries(info)) {
                if (typeof locations === 'string') {
                    info[importPrefix] = [locations];
                } else if (!isStringArray(locations)) {
                    throw new Error(`Invalid imports: ${JSON.stringify(imports)}`);
                }
            }
        }

        return imports as Imports;
    }

    throw new Error(`Invalid imports: ${JSON.stringify(imports)}`);
}

// Deep merge two import settings, overriding the first with the second
export function uniteImports(pre: Imports, post: Imports): Imports {
    const result: Imports = { ...pre };
    for (const [importPrefix, locations] of Object.entries(post)) {
        if (importPrefix in result) {
            result[importPrefix] = { ...result[importPrefix], ...locations };
        } else {
            result[importPrefix] = locations;
        }
    }

    return result;
}
