import { execSync } from 'child_process';
import { CPLACE_ASC_DIST } from './shared';
import { resolve } from 'path';

const tag = process.env.TAG;

if (!tag) {
    throw Error('No tag provided!');
}

const version = tag.split('v')[1];

if (!version) {
    throw Error('Could not extract version from tag!');
}

const isSnapshot = version.includes('SNAPSHOT');

console.log(`Building cplace-asc version ${version}...`);
const buildScriptPath = resolve(__dirname, 'build.ts');
console.log(execSync(`npx ts-node ${buildScriptPath} ${version}`).toString());
console.log(`cplace-asc successfully built!`);

console.log(`Packing cplace-asc...`);
const packOutput = execSync(
    `npm pack ${CPLACE_ASC_DIST} --pack-destination ${CPLACE_ASC_DIST}`
)
    .toString()
    .trim();
console.log(`Pack output: ${packOutput}`);

// The pack output is the filename of the created tgz
const tgzFilename = packOutput.split('\n').pop()?.trim();
console.log(`Created package: ${tgzFilename}`);

// Output information for the next job
console.log(`::set-output name=tgz_filename::${tgzFilename}`);
console.log(`::set-output name=is_snapshot::${isSnapshot}`);
console.log(`::set-output name=version::${version}`);

console.log(`cplace-asc packed successfully!`);
