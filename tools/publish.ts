import { execSync } from 'child_process';
import { CPLACE_ASC_DIST } from './shared';
import { resolve } from 'path';

console.log(`Building cplace-asc...`);
const buildScriptPath = resolve(__dirname, 'build.ts');
console.log(execSync(`npx ts-node ${buildScriptPath}`).toString());
console.log(`cplace-asc successfully built!`);
process.chdir(CPLACE_ASC_DIST);
console.log(`Publishing cplace-asc...`);
// execSync(`npm publish ${withDistTag ? '--tag snapshot' : ''}`);
console.log(`cplace-asc published!`);
