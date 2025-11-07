import * as path from 'node:path';
import { spawnSync } from 'child_process';

const cplaceMainRepoPath = path.resolve('../main');

describe('Assets Compiler E2E Tests', () => {
  const timeout = 30000; // 30 second timeout for CLI operations

  beforeAll(() => {
    // Set longer timeout for all tests in this suite
    jest.setTimeout(timeout);
  });

  describe('TC1: Verify assets compiler basic functionality', () => {
    it('should verify assets compiler basic functionality with -c flag', async () => {
      const args = ['-c']
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
});
