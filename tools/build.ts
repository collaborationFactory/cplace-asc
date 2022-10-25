import { execSync } from 'child_process';
import { resolve } from 'path';
import { writeFileSync, rmSync } from 'fs';
import * as rootPackageJSON from '../package.json';
import { CPLACE_ASC_DIST } from './shared';

const version = process.argv[2];

if (!version) {
    throw Error('Version has to be specified!');
}

const packageJSONDist = resolve(CPLACE_ASC_DIST, 'package.json');
let tscBin = resolve('node_modules/.bin/tsc');
const packageJSONPropsToRemove = ['devDependencies', 'jest', 'scripts'];

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

const env = process.env.NODE_ENV;

console.log(`Environment is ${env}`);

console.log('Cleaning...');
rmSync(CPLACE_ASC_DIST, { recursive: true, force: true });
console.log('Cleaning DONE!');

console.log('Compiling...');
let tsc = tscBin;
if (env === 'production') {
    tsc = `${tscBin} --project ./tsconfig.prod.json`;
}
console.log(`Compiling with: ${tsc} `, execSync(tscBin).toString());
console.log('Compiling DONE!');

const newPackageJSON = Object.keys(rootPackageJSON).reduce((acc, key) => {
    const value = rootPackageJSON[key];
    if (!packageJSONPropsToRemove.includes(key)) {
        acc[key] = value;
    }
    return acc;
}, {});

console.log(`Creating package.json for version ${version}...`);
writeFileSync(
    packageJSONDist,
    JSON.stringify({ ...newPackageJSON, version: version })
);
console.log('package.json CREATED!');
