import * as path from 'node:path';
import { spawnSync, spawn, SpawnSyncReturns } from 'child_process';
import { installAssetsCompiler } from './utils';

const cplaceMainRepoPath = process.env.CI
    ? path.resolve('./main')
    : path.resolve('../main');

console.log(`cplace main repo path ${cplaceMainRepoPath}`);

const result = spawnSync('pwd', {
    cwd: cplaceMainRepoPath,
    stdio: 'pipe',
    shell: true,
});
console.log(result.stdout.toString());

interface CompilerTestExpectations {
    expectedMessages?: string[];
    expectedPatterns?: RegExp[];
    shouldSucceed?: boolean;
}

const runCompilerCommand = (
    args: string[],
    expectations: CompilerTestExpectations = {}
): SpawnSyncReturns<Buffer> => {
    const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe',
    });

    const {
        expectedMessages = [],
        expectedPatterns = [],
        shouldSucceed = true,
    } = expectations;

    if (shouldSucceed) {
        expect(output.status).toBe(0);
    } else {
        expect(output.status).not.toBe(0);
    }

    const outputText = output.stdout.toString();
    const errorText = output.stderr.toString();
    const fullOutput = outputText + errorText;

    expectedMessages.forEach((message) => {
        expect(fullOutput).toContain(message);
    });

    expectedPatterns.forEach((pattern) => {
        expect(outputText).toMatch(pattern);
    });

    return output;
};

const verifyBasicCompilerOutput = (args: string[]): void => {
    runCompilerCommand(args, {
        expectedMessages: ['You are using a correct Node version'],
        expectedPatterns: [/You are using node version: \d+\.\d+\.\d+/],
    });
};

const verifyCompilationSuccess = (args: string[]): void => {
    runCompilerCommand(args, {
        expectedMessages: ['Assets compiled successfully'],
    });
};

const verifyPreprocessingSuccess = (args: string[]): void => {
    runCompilerCommand(args, {
        expectedMessages: ['Preprocessing completed successfully'],
    });
};

const killProcess = (childProcess: any): void => {
    if (!childProcess.pid || childProcess.killed) return;

    if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', childProcess.pid.toString(), '/f', '/t'], {
            stdio: 'ignore',
        });
    } else {
        try {
            process.kill(-childProcess.pid, 'SIGKILL');
        } catch (e) {
            childProcess.kill('SIGKILL');
        }
    }
};

const runWatchModeTest = async (
    expectedMessage: string,
    timeoutMs: number = 10000
): Promise<void> => {
    const childProcess = spawn('cplace-asc', ['-w'], {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe',
        detached: process.platform !== 'win32',
    });

    try {
        const output = await new Promise<string>((resolve, reject) => {
            let stdout = '';
            let resolved = false;
            let timeoutId: NodeJS.Timeout;

            const finish = (result: string, isTimeout: boolean = false) => {
                if (resolved) return;
                resolved = true;

                clearTimeout(timeoutId);
                childProcess.stdout?.removeAllListeners();
                childProcess.stderr?.removeAllListeners();
                childProcess.removeAllListeners();
                killProcess(childProcess);

                if (isTimeout && !result.includes(expectedMessage)) {
                    reject(
                        new Error(
                            `Timeout: Expected message "${expectedMessage}" not found in output: ${result}`
                        )
                    );
                    return;
                }

                resolve(result);
            };

            childProcess.stdout!.on('data', (data) => {
                stdout += data.toString();
                if (stdout.includes(expectedMessage)) {
                    finish(stdout);
                }
            });

            childProcess.on('error', (error) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            timeoutId = setTimeout(() => {
                finish(stdout, true);
            }, timeoutMs);
        });

        expect(output).toContain(expectedMessage);
        if (expectedMessage === 'You are using a correct Node version') {
            expect(output).toMatch(/You are using node version: \d+\.\d+\.\d+/);
        }
    } finally {
        killProcess(childProcess);
    }
};

describe('Assets Compiler E2E Tests', () => {
    const timeout = 180000; // 180 second (3 minute) timeout for CLI operations

    beforeAll(() => {
        // Set longer timeout for all tests in this suite
        jest.setTimeout(timeout);
        // Install assets compiler
        installAssetsCompiler();
    });

    describe('TC1: Verify assets compiler basic functionality', () => {
        it(
            'should verify assets compiler basic functionality with -c flag',
            () => {
                verifyBasicCompilerOutput(['-c']);
            },
            timeout
        );
    });

    describe('TC2: Verify compilation completed message', () => {
        it(
            'should display compilation completed message with -c flag',
            () => {
                verifyCompilationSuccess(['-c']);
            },
            timeout
        );
    });

    describe('TC3: Verify assets compiler with -p flag', () => {
        it(
            'should verify assets compiler with -p flag',
            () => {
                verifyBasicCompilerOutput(['-p']);
            },
            timeout
        );
    });

    describe('TC4: Verify compilation completed message for -p flag', () => {
        it(
            'should display compilation completed message after preprocessing',
            () => {
                verifyCompilationSuccess(['-p']);
            },
            timeout
        );
    });

    describe('TC5: Verify assets compiler with -t flag', () => {
        it(
            'should verify assets compiler with -t flag',
            () => {
                verifyBasicCompilerOutput(['-t']);
            },
            timeout
        );
    });

    describe('TC6: Verify compilation completed message for -t flag', () => {
        it(
            'should display compilation completed message for -t flag',
            () => {
                verifyCompilationSuccess(['-t']);
            },
            timeout
        );
    });

    describe('TC7: Verify assets compiler with -w flag', () => {
        it(
            'should verify assets compiler with -w flag',
            async () => {
                await runWatchModeTest('You are using a correct Node version');
            },
            timeout
        );
    });

    describe('TC8: Verify compilation completed message for watch mode', () => {
        it(
            'should display compilation started message in watch mode',
            async () => {
                await runWatchModeTest('Starting the main process with pid');
            },
            timeout
        );
    });

    describe('TC9: Verify assets compiler version display', () => {
        it(
            'should display version information',
            () => {
                verifyBasicCompilerOutput(['-v']);
            },
            timeout
        );
    });

    describe('TC10: Verify compilation completed message after version check', () => {
        it(
            'should display compilation completed message after version check',
            () => {
                verifyCompilationSuccess(['-v']);
            },
            timeout
        );
    });

    describe('TC11: Verify assets compiler with -o flag (only preprocessing)', () => {
        it(
            'should verify assets compiler with -o flag for only preprocessing',
            () => {
                verifyBasicCompilerOutput(['-o']);
            },
            timeout
        );
    });

    describe('TC12: Verify preprocessing completed message', () => {
        it(
            'should display preprocessing completed message',
            () => {
                verifyPreprocessingSuccess(['-o']);
            },
            timeout
        );
    });

    describe('TC13: Verify assets compiler with -P flag', () => {
        it(
            'should verify assets compiler with -P flag',
            () => {
                verifyBasicCompilerOutput(['-P']);
            },
            timeout
        );
    });

    describe('TC14: Verify assets compiled successfully message', () => {
        it(
            'should display assets compiled successfully message',
            () => {
                verifyCompilationSuccess(['-P']);
            },
            timeout
        );
    });

    describe('TC19: Verify flag conflict error handling', () => {
        it(
            'should handle conflicting flags appropriately',
            () => {
                runCompilerCommand(['--watch', '--onlypre'], {
                    expectedMessages: [
                        '--watch and --onlypre cannot be enabled simultaneously',
                    ],
                    shouldSucceed: false,
                });
            },
            timeout
        );
    });

    describe('TC20: Verify undefined properties error handling', () => {
        it(
            'should handle undefined properties error',
            () => {
                const output = spawnSync('cplace-asc', ['-P'], {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                    env: { ...process.env, TEST_UNDEFINED_ERROR: 'true' },
                });

                if (output.status !== 0) {
                    const errorOutput =
                        output.stderr.toString() || output.stdout.toString();
                    expect(errorOutput).toMatch(
                        /TypeEsrror.*Cannot read properties of undefined/
                    );
                }
            },
            timeout
        );
    });
});
