import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export function installAssetsCompiler(){
  const distPath = resolve(__dirname, 'dist');
  const output = spawnSync('npm install -g .', {
    cwd: distPath,
    stdio: 'pipe',
    shell: true
  });
  if(output.status === 0){
    console.log('cplace assets compiler successfully installed!');
  }
  else {
    console.error('Failed to install assets compiler');
  }
}
