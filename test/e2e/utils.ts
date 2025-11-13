import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export function installAssetsCompiler() {
    const distPath = resolve(__dirname, '../../', 'dist');
    const output = spawnSync('npm install -g .', {
        cwd: distPath,
        stdio: 'pipe',
        shell: true,
    });
    if (output.status === 0) {
        console.log('cplace assets compiler successfully installed!');
        showVersion(distPath);
    } else {
        console.error('Failed to install assets compiler');
    }
}

function showVersion(distPath: string) {
    const versionOutput = spawnSync('cplace-asc', ['version'], {
        cwd: distPath,
        stdio: 'pipe',
        shell: true,
    });
    console.log(`cplace-asc version is ${versionOutput.stdout.toString()}`);
}
