import { execSync } from 'child_process';
import { CPLACE_ASC_DIST } from './shared';
import { resolve } from 'path';

const tag = process.env.TAG;

if (!tag) {
    throw Error('No tag provided!');
}

const version = tag.split('v')[1];
const isSnapshot = version?.includes('SNAPSHOT');

console.log(`Building cplace-asc...`);
const buildScriptPath = resolve(__dirname, 'build.ts');
console.log(
    execSync(`npm run ts-node ${buildScriptPath} ${version}`).toString()
);
console.log(`cplace-asc successfully built!`);
process.chdir(CPLACE_ASC_DIST);
console.log(`Publishing cplace-asc...`);
execSync(`npm publish ${isSnapshot ? '--tag snapshot' : ''}`);
console.log(`cplace-asc published!`);
