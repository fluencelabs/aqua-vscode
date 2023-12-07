import { exec } from 'child_process';
import { dirname } from 'path';

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
    async imports(filePath: string): Promise<string[]> {
        const cwd = dirname(filePath);
        const result = await this.runJson(['aqua', 'imports'], cwd);
        if (Array.isArray(result) && result.every((i) => typeof i === 'string')) {
            return result;
        } else {
            throw new Error(`Invalid result: ${JSON.stringify(result)}`);
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
