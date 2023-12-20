import { exec } from 'child_process';
import { dirname } from 'path';

import type { Imports } from './imports';
import { normalizeImports } from './imports';

export class FluenceCli {
    readonly cliPath: string;

    /**
     * @param cliPath Path to `fluence` executable.
     * Defaults to `fluence` (i.e. it should be in PATH).
     */
    constructor(cliPath?: string) {
        this.cliPath = cliPath || 'fluence';
    }

    /**
     * Returns output of `fluence aqua imports`
     * in dir of @param filePath.
     */
    async imports(filePath: string): Promise<Imports> {
        const cwd = dirname(filePath);
        const result = await this.runJson(['aqua', 'imports'], cwd);
        try {
            return normalizeImports(result);
        } catch (e) {
            if (e instanceof Error) {
                throw new Error(`Error converting imports from fluence: ${e.message}`);
            } else {
                throw e;
            }
        }
    }

    /**
     * Runs `fluence` with given arguments and returns its stdout as JSON.
     */
    private async runJson(args: string[], cwd?: string | undefined): Promise<JSON> {
        const cmd = `${this.cliPath} ${args.join(' ')}`;

        return new Promise((resolve, reject) => {
            exec(cmd, { cwd }, (err, stdout, _) => {
                if (err) {
                    reject(err);
                } else
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (e) {
                        reject(e);
                    }
            });
        });
    }
}
