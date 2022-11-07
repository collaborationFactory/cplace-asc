import { execSync } from 'child_process';

import * as rootPackageJSON from '../../package.json';

const branch = execSync('git branch --show-current').toString();
let version = rootPackageJSON.version;

let publishedVersions = '';

try {
    publishedVersions = execSync(
        'npm view @cplace/asc-local versions'
    ).toString();
} catch (e: any) {
    console.warn(e);
}

if (publishedVersions !== '' && publishedVersions.includes(version)) {
    throw Error(`${version} already exists!`);
}

if (branch === 'master') {
    const hash = execSync('git rev-parse origin/master').toString();
    version = '0.0.0'.concat('-SNAPSHOT-').concat(hash);
}

console.log(
    execSync(`git tag -a ${version} -m "Version ${version}"`).toString()
);
console.log(execSync(`git push origin ${version}`).toString());
