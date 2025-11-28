import { beforeAll, afterAll } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs';

beforeAll(() => {
    // Check if assets compiler scripts exist
    const rootDir = path.resolve(__dirname, '../../../..');
    const assetsCompilerSh = path.join(rootDir, 'assets-compiler.sh');
    const assetsCompilerCmd = path.join(rootDir, 'assets-compiler.cmd');

    console.log('Looking for assets compiler scripts in:', rootDir);
    console.log(
        'Checking for assets-compiler.sh:',
        fs.existsSync(assetsCompilerSh)
    );
    console.log(
        'Checking for assets-compiler.cmd:',
        fs.existsSync(assetsCompilerCmd)
    );

    // Change to root directory for script execution
    process.chdir(rootDir);
    console.log('Changed working directory to:', process.cwd());
});

afterAll(() => {
    // Cleanup any temporary files or processes
    console.log('Test suite cleanup completed');
});
