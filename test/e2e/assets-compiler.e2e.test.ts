import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'node:path';

const execAsync = promisify(exec);
const cplaceMainRepoPath = path.resolve('../main')

describe('Assets Compiler E2E Tests', () => {
    const timeout = 30000; // 30 second timeout for CLI operations

    beforeAll(() => {
        // Set longer timeout for all tests in this suite
        jest.setTimeout(timeout);
    });

    describe('TC1: Verify assets compiler basic functionality', () => {
        it('should verify assets compiler basic functionality with -c flag', async () => {
            const { stdout, stderr, exitCode } = await execAsync('node_modules/.bin/cplace-asc -c',{
                cwd:cplaceMainRepoPath,
                shell:true
            });

            expect(exitCode).toBe(0);
            expect(stdout).toContain('You are using a correct Node version');
            expect(stdout).toMatch(/You are using node version:\d+\.\d+\.\d+/);
        }, timeout);
    });
});