import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export function installAssetsCompiler() {
    const distPath = resolve(__dirname, '../../', 'dist');

    // Use npx for local execution instead of global install
    console.log('Setting up assets compiler for testing...');

    // First verify the package exists and is built
    const testOutput = spawnSync('npm', ['pack', '--dry-run'], {
        cwd: distPath,
        stdio: 'pipe',
        shell: true,
    });

    if (testOutput.status !== 0) {
        console.error('Failed to verify package build');
        return;
    }

    console.log('Assets compiler package verified!');
    showVersion(distPath);
}

function showVersion(distPath: string) {
    const versionOutput = spawnSync('cplace-asc', ['version'], {
        cwd: distPath,
        stdio: 'pipe',
        shell: true,
    });
    console.log(`cplace-asc version is ${versionOutput.stdout.toString()}`);
}
