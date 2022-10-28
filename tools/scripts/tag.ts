import { execSync } from 'child_process';

import * as rootPackageJSON from '../../package.json';

const branch = execSync('git branch --show-current').toString();
let version = rootPackageJSON.version;

const publishedVersions = execSync('npm view @cplace/asc versions').toString();

if (publishedVersions.includes(version)) {
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
