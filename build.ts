import { execSync } from 'child_process';
import { resolve } from 'path';
import { writeFileSync, rmSync } from 'fs';
import * as rootPackageJSON from './package.json';

const tsc = resolve('node_modules/.bin/tsc');
const dist = resolve('dist');
const packageJSONDist = resolve(dist, 'package.json');
const packageJSONPropsToRemove = ['devDependencies', 'jest', 'scripts'];

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

const env = process.env.NODE_ENV;

console.log(`Environment is ${env}`);

console.log('Cleaning...');
rmSync(dist, { recursive: true, force: true });
console.log('Cleaning DONE!');

console.log('Compiling...');
if (env === 'production') {
    execSync(`${tsc} --project ./tsconfig.prod.json`);
} else {
    execSync(tsc);
}
console.log('Compiling DONE!');

const newPackageJSON = Object.keys(rootPackageJSON).reduce((acc, key) => {
    const value = rootPackageJSON[key];
    if (!packageJSONPropsToRemove.includes(key)) {
        acc[key] = value;
    }
    return acc;
}, {});

console.log('Creating package.json...');
writeFileSync(packageJSONDist, JSON.stringify(newPackageJSON));
console.log('package.json CREATED!');
