import { execSync } from 'child_process';

import * as rootPackageJSON from '../package.json';

const version = rootPackageJSON.version;

const publishedVersions = execSync('npm view @cplace/asc versions').toString();

if (publishedVersions.includes(version)) {
    throw Error(`${version} already exists!`);
}

const tag = `v${version}`;
console.log(execSync(`git tag -a ${tag} -m "Version ${version}"`).toString());
console.log(execSync(`git push origin ${tag}`).toString());
