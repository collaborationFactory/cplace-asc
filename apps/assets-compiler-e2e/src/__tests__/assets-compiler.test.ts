import { execSync } from 'child_process';
import * as os from 'os';

describe('Assets Compiler E2E Tests', () => {
    const isWindows = os.platform() === 'win32';
    const getCommand = (flag: string = '') => {
        const script = isWindows
            ? './assets-compiler.cmd'
            : './assets-compiler.sh';
        return flag ? `${script} ${flag}` : script;
    };

    beforeAll(() => {
        // Ensure we're in the correct directory for assets compiler
        // This should be adjusted based on actual project structure
        console.log('Current working directory:', process.cwd());
    });

    afterEach(() => {
        // Cleanup any processes that might still be running
        // Kill any potential watch processes
        try {
            if (!isWindows) {
                execSync('pkill -f "assets-compiler" || true', {
                    stdio: 'ignore',
                });
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('TC1: Basic Assets Compiler Verification', () => {
        it('should verify assets compiler with correct Node version', () => {
            const command = getCommand('-c');

            try {
                const result = execSync(command, {
                    encoding: 'utf8',
                    timeout: 30000,
                    cwd: process.cwd(),
                });

                // Verify that the output contains expected messages
                expect(result).toContain('You are using node version');
                expect(result).toContain(
                    'You are using a correct Node version'
                );

                console.log('TC1 Test Output:', result);
            } catch (error: any) {
                console.error('TC1 Test failed with error:', error.message);
                console.error('Stdout:', error.stdout?.toString());
                console.error('Stderr:', error.stderr?.toString());
                throw error;
            }
        });
    });
});
