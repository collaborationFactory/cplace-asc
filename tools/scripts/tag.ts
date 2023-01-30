import { execSync } from 'child_process';

import * as rootPackageJSON from '../../package.json';

const branch = execSync('git branch --show-current').toString().trim();
let version = rootPackageJSON.version;

let publishedVersions = '';

try {
    publishedVersions = execSync(
        'npm view @cplace/asc-local versions'
    ).toString();
} catch (e: any) {
    console.warn(e);
}

console.log(`Current branch: ${branch}`);

if (branch === 'master') {
    const hash = execSync('git rev-parse origin/master').toString();
    version = '0.0.0'.concat('-SNAPSHOT-').concat(hash);
}

console.log(`Current version: ${version}`);

if (publishedVersions !== '' && publishedVersions.includes(version)) {
    throw Error(`${version} already exists!`);
}

const tag = `v${version}`;

const cmd = `git tag -m "version ${tag}" -a ${tag}`;

console.log(execSync(cmd).toString());
console.log(execSync(`git push origin ${tag}`).toString());
