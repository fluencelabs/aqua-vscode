import { exec } from 'child_process';

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
     */
    async imports(): Promise<string[]> {
        const result = await this.runJson(['aqua', 'imports']);
        if (Array.isArray(result) && result.every((i) => typeof i === 'string')) {
            return result;
        } else {
            throw new Error(`Invalid result: ${JSON.stringify(result)}`);
        }
    }

    /**
     * Runs `fluence` with given arguments and returns its stdout as JSON.
     */
    private async runJson(args: string[]): Promise<JSON> {
        const cmd = `${this.cliPath} ${args.join(' ')}`;
        return new Promise((resolve, reject) => {
            exec(cmd, (err, stdout, _) => {
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
