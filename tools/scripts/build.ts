import { execSync } from 'child_process';
import { resolve } from 'path';
import {
    writeFileSync,
    rmSync,
    copyFileSync,
    mkdirSync,
    readFileSync,
    existsSync,
} from 'fs';
import * as rootPackageJSON from '../../package.json';
import { CPLACE_ASC_DIST } from './shared';

const version = process.argv[2];

if (!version) {
    throw Error('Version has to be specified!');
}

const PACKAGE_JSON_DIST = resolve(CPLACE_ASC_DIST, 'package.json');
const OPENAPI_TOOLS_JSON = 'openapitools.json';
const README = 'README.md';
const OPENAPI_JAR = '5.0.0.jar';
const OPENAPI_TOOLS = resolve(__dirname, '../openapi');
const OPENAPI_VERSIONS_DIST = resolve(CPLACE_ASC_DIST, 'versions');
const PACKAGE_JSON_PROPS_TO_REMOVE = ['devDependencies', 'jest', 'scripts'];
let tscBin = resolve('node_modules/.bin/tsc');

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
console.log(`Compiling with: ${tsc} `, execSync(tsc).toString());
console.log('Compiling DONE!');

const newPackageJSON = Object.keys(rootPackageJSON).reduce((acc, key) => {
    const value = rootPackageJSON[key];
    if (!PACKAGE_JSON_PROPS_TO_REMOVE.includes(key)) {
        acc[key] = value;
    }
    return acc;
}, {});

console.log(`Copying package.json files for each workspace`);
const distWorskpaces: string[] = [];
for (const workspace of rootPackageJSON.workspaces) {
    // Remove the ./src prefix since the generated js files in the dist folder will be in the root, not in a src subfolder
    const distWorskpace = workspace.replace('./src', '.');
    distWorskpaces.push(distWorskpace);

    const workspacePackageJson = resolve(workspace, 'package.json');
    if (existsSync(workspacePackageJson)) {
        console.log(`Copying ${workspacePackageJson} to ${distWorskpace}`);
        const workspacePackageJsonContent = JSON.parse(
            readFileSync(workspacePackageJson).toString()
        );
        const workspacePackageJsonDist = resolve(
            CPLACE_ASC_DIST,
            distWorskpace,
            'package.json'
        );
        writeFileSync(
            workspacePackageJsonDist,
            JSON.stringify({ ...workspacePackageJsonContent, version: version })
        );
    }
}

console.log(`Creating package.json for version ${version}...`);
writeFileSync(
    PACKAGE_JSON_DIST,
    JSON.stringify({
        ...newPackageJSON,
        version: version,
        workspaces: distWorskpaces,
        dependencies: {
            ...newPackageJSON['dependencies'],
            '@cplace/global-registry-initializer': version,
        },
    })
);
console.log('package.json CREATED!');

copyFileSync(
    `${OPENAPI_TOOLS}/${OPENAPI_TOOLS_JSON}`,
    resolve(CPLACE_ASC_DIST, OPENAPI_TOOLS_JSON)
);
mkdirSync(OPENAPI_VERSIONS_DIST);
console.log(`Copying openapitools.json ...`);
copyFileSync(
    `${OPENAPI_TOOLS}/${OPENAPI_JAR}`,
    resolve(OPENAPI_VERSIONS_DIST, OPENAPI_JAR)
);
console.log(`openapitools.json copied!`);
console.log(`Copying README.md ...`);
copyFileSync(
    resolve(__dirname, '../../', README),
    resolve(CPLACE_ASC_DIST, README)
);
console.log(`README.md copied!`);
