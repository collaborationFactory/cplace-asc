import * as path from 'node:path';
import { spawnSync, spawn } from 'child_process';
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
                const args = ['-c'];
                const output = spawnSync('cplace-asc', args, {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                });

                expect(output.status).toBe(0);
                expect(output.stdout.toString()).toContain(
                    'You are using a correct Node version'
                );
                expect(output.stdout.toString()).toMatch(
                    /You are using node version: \d+\.\d+\.\d+/
                );
            },
            timeout
        );
    });

    describe('TC2: Verify compilation completed message', () => {
        it(
            'should display compilation completed message with -c flag',
            () => {
                const args = ['-c'];
                const output = spawnSync('cplace-asc', args, {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                });

                expect(output.status).toBe(0);
                expect(output.stdout.toString()).toContain(
                    'Assets compiled successfully'
                );
            },
            timeout
        );
    });

    describe('TC3: Verify assets compiler with -p flag', () => {
        it(
            'should verify assets compiler with -p flag',
            () => {
                const args = ['-p'];
                const output = spawnSync('cplace-asc', args, {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                });

                expect(output.status).toBe(0);
                expect(output.stdout.toString()).toContain(
                    'You are using a correct Node version'
                );
                expect(output.stdout.toString()).toMatch(
                    /You are using node version: \d+\.\d+\.\d+/
                );
            },
            timeout
        );
    });

    describe('TC4: Verify compilation completed message for -p flag', () => {
        it(
            'should display compilation completed message after preprocessing',
            () => {
                const args = ['-p'];
                const output = spawnSync('cplace-asc', args, {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                });

                expect(output.status).toBe(0);
                expect(output.stdout.toString()).toContain(
                    'Assets compiled successfully'
                );
            },
            timeout
        );
    });

    describe('TC5: Verify assets compiler with -t flag', () => {
        it(
            'should verify assets compiler with -t flag',
            () => {
                const args = ['-t'];
                const output = spawnSync('cplace-asc', args, {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                });

                expect(output.status).toBe(0);
                expect(output.stdout.toString()).toContain(
                    'You are using a correct Node version'
                );
                expect(output.stdout.toString()).toMatch(
                    /You are using node version: \d+\.\d+\.\d+/
                );
            },
            timeout
        );
    });

    describe('TC6: Verify compilation completed message for -t flag', () => {
        it(
            'should display compilation completed message for -t flag',
            () => {
                const args = ['-t'];
                const output = spawnSync('cplace-asc', args, {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                });

                expect(output.status).toBe(0);
                expect(output.stdout.toString()).toContain(
                    'Assets compiled successfully'
                );
            },
            timeout
        );
    });

    describe('TC7: Verify assets compiler with -w flag', () => {
        it(
            'should verify assets compiler with -w flag',
            async () => {
                const childProcess = spawn('cplace-asc', ['-w'], {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                    detached: process.platform !== 'win32', // Detached on Unix to allow killing process group
                });

                try {
                    const output = await new Promise<string>(
                        (resolve, reject) => {
                            let stdout = '';
                            let resolved = false;
                            let timeoutId: NodeJS.Timeout;

                            const finish = (result: string) => {
                                if (resolved) return;
                                resolved = true;

                                clearTimeout(timeoutId);

                                // Remove listeners first
                                childProcess.stdout?.removeAllListeners();
                                childProcess.stderr?.removeAllListeners();
                                childProcess.removeAllListeners();

                                // Kill process - Windows requires taskkill for shell spawned processes
                                if (process.platform === 'win32') {
                                    // Kill the entire process tree on Windows
                                    spawn(
                                        'taskkill',
                                        [
                                            '/pid',
                                            childProcess.pid!.toString(),
                                            '/f',
                                            '/t',
                                        ],
                                        {
                                            stdio: 'ignore',
                                        }
                                    );
                                } else {
                                    // On Unix, kill the entire process group
                                    try {
                                        process.kill(
                                            -childProcess.pid!,
                                            'SIGKILL'
                                        );
                                    } catch (e) {
                                        // Fallback to killing just the process
                                        childProcess.kill('SIGKILL');
                                    }
                                }

                                resolve(result);
                            };

                            childProcess.stdout!.on('data', (data) => {
                                stdout += data.toString();
                                if (
                                    stdout.includes(
                                        'You are using a correct Node version'
                                    )
                                ) {
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
                                finish(stdout);
                            }, 5000);
                        }
                    );

                    expect(output).toContain(
                        'You are using a correct Node version'
                    );
                    expect(output).toMatch(
                        /You are using node version: \d+\.\d+\.\d+/
                    );
                } finally {
                    // Ensure process is killed even if test fails
                    if (childProcess.pid && !childProcess.killed) {
                        if (process.platform === 'win32') {
                            spawn(
                                'taskkill',
                                [
                                    '/pid',
                                    childProcess.pid.toString(),
                                    '/f',
                                    '/t',
                                ],
                                {
                                    stdio: 'ignore',
                                }
                            );
                        } else {
                            // On Unix, kill the entire process group
                            try {
                                process.kill(-childProcess.pid, 'SIGKILL');
                            } catch (e) {
                                // Fallback to killing just the process
                                childProcess.kill('SIGKILL');
                            }
                        }
                    }
                }
            },
            timeout
        );
    });

    describe('TC8: Verify compilation completed message for watch mode', () => {
        it(
            'should display compilation started message in watch mode',
            async () => {
                const childProcess = spawn('cplace-asc', ['-w'], {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                    detached: process.platform !== 'win32', // Detached on Unix to allow killing process group
                });

                try {
                    const output = await new Promise<string>(
                        (resolve, reject) => {
                            let stdout = '';
                            let resolved = false;
                            let timeoutId: NodeJS.Timeout;

                            const finish = (result: string) => {
                                if (resolved) return;
                                resolved = true;

                                clearTimeout(timeoutId);

                                // Remove listeners first
                                childProcess.stdout?.removeAllListeners();
                                childProcess.stderr?.removeAllListeners();
                                childProcess.removeAllListeners();

                                // Kill process - Windows requires taskkill for shell spawned processes
                                if (process.platform === 'win32') {
                                    // Kill the entire process tree on Windows
                                    spawn(
                                        'taskkill',
                                        [
                                            '/pid',
                                            childProcess.pid!.toString(),
                                            '/f',
                                            '/t',
                                        ],
                                        {
                                            stdio: 'ignore',
                                        }
                                    );
                                } else {
                                    // On Unix, kill the entire process group
                                    try {
                                        process.kill(
                                            -childProcess.pid!,
                                            'SIGKILL'
                                        );
                                    } catch (e) {
                                        // Fallback to killing just the process
                                        childProcess.kill('SIGKILL');
                                    }
                                }

                                resolve(result);
                            };

                            childProcess.stdout!.on('data', (data) => {
                                stdout += data.toString();
                                // Check for watch mode starting indicator - the main process starting
                                if (
                                    stdout.includes(
                                        'Starting the main process with pid'
                                    )
                                ) {
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
                                finish(stdout);
                            }, 10000); // Increased timeout for watch mode to start
                        }
                    );

                    // Verify watch mode started successfully
                    expect(output).toContain(
                        'Starting the main process with pid'
                    );
                    expect(output).toContain(
                        'You are using a correct Node version'
                    );
                } finally {
                    // Ensure process is killed even if test fails
                    if (childProcess.pid && !childProcess.killed) {
                        if (process.platform === 'win32') {
                            spawn(
                                'taskkill',
                                [
                                    '/pid',
                                    childProcess.pid.toString(),
                                    '/f',
                                    '/t',
                                ],
                                {
                                    stdio: 'ignore',
                                }
                            );
                        } else {
                            // On Unix, kill the entire process group
                            try {
                                process.kill(-childProcess.pid, 'SIGKILL');
                            } catch (e) {
                                // Fallback to killing just the process
                                childProcess.kill('SIGKILL');
                            }
                        }
                    }
                }
            },
            timeout
        );
    });

    describe('TC9: Verify assets compiler version display', () => {
        it(
            'should display version information',
            () => {
                const args = ['-v'];
                const output = spawnSync('cplace-asc', args, {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                });

                expect(output.status).toBe(0);
                expect(output.stdout.toString()).toContain(
                    'You are using a correct Node version'
                );
                expect(output.stdout.toString()).toMatch(
                    /You are using node version: \d+\.\d+\.\d+/
                );
            },
            timeout
        );
    });

    describe('TC10: Verify compilation completed message after version check', () => {
        it(
            'should display compilation completed message after version check',
            () => {
                const args = ['-v'];
                const output = spawnSync('cplace-asc', args, {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                });

                expect(output.status).toBe(0);
                expect(output.stdout.toString()).toContain(
                    'Assets compiled successfully'
                );
            },
            timeout
        );
    });

    describe('TC11: Verify assets compiler with -o flag (only preprocessing)', () => {
        it(
            'should verify assets compiler with -o flag for only preprocessing',
            () => {
                const args = ['-o'];
                const output = spawnSync('cplace-asc', args, {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                });

                expect(output.status).toBe(0);
                expect(output.stdout.toString()).toContain(
                    'You are using a correct Node version'
                );
                expect(output.stdout.toString()).toMatch(
                    /You are using node version: \d+\.\d+\.\d+/
                );
            },
            timeout
        );
    });

    describe('TC12: Verify preprocessing completed message', () => {
        it(
            'should display preprocessing completed message',
            () => {
                const args = ['-o'];
                const output = spawnSync('cplace-asc', args, {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                });

                expect(output.status).toBe(0);
                expect(output.stdout.toString()).toContain(
                    'Preprocessing completed successfully'
                );
            },
            timeout
        );
    });

    describe('TC13: Verify assets compiler with -P flag', () => {
        it(
            'should verify assets compiler with -P flag',
            () => {
                const args = ['-P'];
                const output = spawnSync('cplace-asc', args, {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                });

                expect(output.status).toBe(0);
                expect(output.stdout.toString()).toContain(
                    'You are using a correct Node version'
                );
                expect(output.stdout.toString()).toMatch(
                    /You are using node version: \d+\.\d+\.\d+/
                );
            },
            timeout
        );
    });

    describe('TC14: Verify assets compiled successfully message', () => {
        it(
            'should display assets compiled successfully message',
            () => {
                const args = ['-P'];
                const output = spawnSync('cplace-asc', args, {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                });

                expect(output.status).toBe(0);
                expect(output.stdout.toString()).toContain(
                    'Assets compiled successfully'
                );
            },
            timeout
        );
    });

    describe('TC19: Verify flag conflict error handling', () => {
        it(
            'should handle conflicting flags appropriately',
            () => {
                const args = ['--watch', '--onlypre'];
                const output = spawnSync('cplace-asc', args, {
                    cwd: cplaceMainRepoPath,
                    shell: true,
                    stdio: 'pipe',
                });

                expect(output.status).not.toBe(0);
                const errorOutput =
                    output.stderr.toString() || output.stdout.toString();
                expect(errorOutput).toContain(
                    '--watch and --onlypre cannot be enabled simultaneously'
                );
            },
            timeout
        );
    });

    describe('TC20: Verify undefined properties error handling', () => {
        it(
            'should handle undefined properties error',
            () => {
                const args = ['-P'];
                const output = spawnSync('cplace-asc', args, {
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
