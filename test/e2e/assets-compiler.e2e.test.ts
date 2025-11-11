import * as path from 'node:path';
import { spawnSync, spawn } from 'child_process';
import { installAssetsCompiler } from './utils';

const cplaceMainRepoPath = path.resolve('../main');

describe('Assets Compiler E2E Tests', () => {
  const timeout = 30000; // 30 second timeout for CLI operations

  beforeAll(() => {
    // Set longer timeout for all tests in this suite
    jest.setTimeout(timeout);
    // Install assets compiler
    installAssetsCompiler();
  });

  describe('TC1: Verify assets compiler basic functionality', () => {
    it('should verify assets compiler basic functionality with -c flag', async () => {
      const args = ['-c'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      expect(output.status).toBe(0);
      expect(output.stdout.toString()).toContain('You are using a correct Node version');
      expect(output.stdout.toString()).toMatch(/You are using node version: \d+\.\d+\.\d+/);
    }, timeout);
  });

  describe('TC2: Verify compilation completed message', () => {
    it('should display compilation completed message with -c flag', async () => {
      const args = ['-c'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      expect(output.status).toBe(0);
      expect(output.stdout.toString()).toContain('Assets compiled successfully');
    }, timeout);
  });

  describe('TC3: Verify assets compiler with -p flag', () => {
    it('should verify assets compiler with -p flag', async () => {
      const args = ['-p'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      expect(output.status).toBe(0);
      expect(output.stdout.toString()).toContain('You are using a correct Node version');
      expect(output.stdout.toString()).toMatch(/You are using node version: \d+\.\d+\.\d+/);
    }, timeout);
  });

  describe('TC4: Verify compilation completed message for -p flag', () => {
    it('should display compilation completed message after preprocessing', async () => {
      const args = ['-p'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      expect(output.status).toBe(0);
      expect(output.stdout.toString()).toContain('Assets compiled successfully');
    }, timeout);
  });

  describe('TC5: Verify assets compiler with -t flag', () => {
    it('should verify assets compiler with -t flag', async () => {
      const args = ['-t'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      expect(output.status).toBe(0);
      expect(output.stdout.toString()).toContain('You are using a correct Node version');
      expect(output.stdout.toString()).toMatch(/You are using node version: \d+\.\d+\.\d+/);
    }, timeout);
  });

  describe('TC6: Verify compilation completed message for -t flag', () => {
    it('should display compilation completed message for -t flag', async () => {
      const args = ['-t'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      expect(output.status).toBe(0);
      expect(output.stdout.toString()).toContain('Assets compiled successfully');
    }, timeout);
  });

  describe('TC7: Verify assets compiler with -w flag', () => {
    it('should verify assets compiler with -w flag', async () => {
      const childProcess = spawn('cplace-asc', ['-w'], {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      const output = await new Promise<string>((resolve) => {
        let stdout = '';
        childProcess.stdout!.on('data', (data) => {
          stdout += data.toString();
          if (stdout.includes('You are using a correct Node version')) {
            childProcess.kill();
            resolve(stdout);
          }
        });
        setTimeout(() => {
          childProcess.kill();
          resolve(stdout);
        }, 5000);
      });

      expect(output).toContain('You are using a correct Node version');
      expect(output).toMatch(/You are using node version: \d+\.\d+\.\d+/);
    }, timeout);
  });

  describe('TC8: Verify compilation completed message for watch mode', () => {
    it('should display compilation completed message in watch mode', async () => {
      const childProcess = spawn('cplace-asc', ['-w'], {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      const output = await new Promise<string>((resolve) => {
        let stdout = '';
        childProcess.stdout!.on('data', (data) => {
          stdout += data.toString();
          if (stdout.includes('Compilation completed - watching files')) {
            childProcess.kill();
            resolve(stdout);
          }
        });
        setTimeout(() => {
          childProcess.kill();
          resolve(stdout);
        }, 5000);
      });

      expect(output).toContain('Compilation completed - watching files');
    }, timeout);
  });

  describe('TC9: Verify assets compiler version display', () => {
    it('should display version information', async () => {
      const args = ['-v'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      expect(output.status).toBe(0);
      expect(output.stdout.toString()).toContain('You are using a correct Node version');
      expect(output.stdout.toString()).toMatch(/You are using node version: \d+\.\d+\.\d+/);
    }, timeout);
  });

  describe('TC10: Verify compilation completed message after version check', () => {
    it('should display compilation completed message after version check', async () => {
      const args = ['-v'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      expect(output.status).toBe(0);
      expect(output.stdout.toString()).toContain('Assets compiled successfully');
    }, timeout);
  });

  describe('TC11: Verify assets compiler with -o flag (only preprocessing)', () => {
    it('should verify assets compiler with -o flag for only preprocessing', async () => {
      const args = ['-o'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      expect(output.status).toBe(0);
      expect(output.stdout.toString()).toContain('You are using a correct Node version');
      expect(output.stdout.toString()).toMatch(/You are using node version: \d+\.\d+\.\d+/);
    }, timeout);
  });

  describe('TC12: Verify preprocessing completed message', () => {
    it('should display preprocessing completed message', async () => {
      const args = ['-o'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      expect(output.status).toBe(0);
      expect(output.stdout.toString()).toContain('Preprocessing completed successfully');
    }, timeout);
  });

  describe('TC13: Verify assets compiler with -P flag', () => {
    it('should verify assets compiler with -P flag', async () => {
      const args = ['-P'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      expect(output.status).toBe(0);
      expect(output.stdout.toString()).toContain('You are using a correct Node version');
      expect(output.stdout.toString()).toMatch(/You are using node version: \d+\.\d+\.\d+/);
    }, timeout);
  });

  describe('TC14: Verify assets compiled successfully message', () => {
    it('should display assets compiled successfully message', async () => {
      const args = ['-P'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      expect(output.status).toBe(0);
      expect(output.stdout.toString()).toContain('Assets compiled successfully');
    }, timeout);
  });

  describe('TC15: Verify error handling for incorrect Node.js version', () => {
    it('should handle incorrect Node.js version gracefully', async () => {
      const originalVersion = process.version;
      Object.defineProperty(process, 'version', { value: 'v18.0.0' });

      try {
        const args = ['-c'];
        const output = spawnSync('cplace-asc', args, {
          cwd: cplaceMainRepoPath,
          shell: true,
          stdio: 'pipe'
        });

        expect(output.status).not.toBe(1);
        const errorOutput = output.stderr.toString() || output.stdout.toString();
        expect(errorOutput).toContain('You are using an incorrect major Node version');
        expect(errorOutput).toMatch('Currently supported Node version');
      } finally {
        Object.defineProperty(process, 'version', { value: originalVersion });
      }
    }, timeout);
  });

  describe('TC19: Verify flag conflict error handling', () => {
    it('should handle conflicting flags appropriately', async () => {
      const args = ['--watch', '--onlypre'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe'
      });

      expect(output.status).not.toBe(0);
      const errorOutput = output.stderr.toString() || output.stdout.toString();
      expect(errorOutput).toContain('--watch and --onlypre cannot be enabled simultaneously');
    }, timeout);
  });

  describe('TC20: Verify undefined properties error handling', () => {
    it('should handle undefined properties error', async () => {
      const args = ['-P'];
      const output = spawnSync('cplace-asc', args, {
        cwd: cplaceMainRepoPath,
        shell: true,
        stdio: 'pipe',
        env: { ...process.env, TEST_UNDEFINED_ERROR: 'true' }
      });

      if (output.status !== 0) {
        const errorOutput = output.stderr.toString() || output.stdout.toString();
        expect(errorOutput).toMatch(/TypeEsrror.*Cannot read properties of undefined/);
      }
    }, timeout);
  });
});
