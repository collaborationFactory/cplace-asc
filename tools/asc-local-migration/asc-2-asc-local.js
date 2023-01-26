const { existsSync, writeFileSync, readFileSync } = require('fs');
const { resolve } = require('path');
const { execSync } = require('child_process');

const WORKSPACE_ROOT = process.cwd();
const PACKAGE_JSON_PATH = resolve(WORKSPACE_ROOT, 'package.json');
const GIT_IGNORE_PATH = resolve(WORKSPACE_ROOT, '.gitignore');
const ASC_SHELL_SCRIPT = resolve(WORKSPACE_ROOT, 'assets-compiler.sh');
const ASC_BATCH_SCRIPT = resolve(WORKSPACE_ROOT, 'assets-compiler.cmd');
const NODE_MODULES_IGNORE_LINE = 'node_modules/';
const CPLACE_ASC_LOCAL_PKG_NAME = '@cplace/asc-local';
const CPLACE_ASC_LOCAL_PKG_VERSION = '~2.0.2';
const PACKAGES_TO_REMOVE = ['typescript'];
const NODE_VERSION = '18.11.0';
const NPM_VERSION = '8.19.2';
const NVMRC_PATH = resolve(WORKSPACE_ROOT, '.nvmrc');
const NVMRC_CONTENT = `v${NODE_VERSION}`;
const GIT_REPOSITORY = execSync('git config --get remote.origin.url')
    .toString()
    .trim();
const WORKSPACE_NAME = execSync(`basename -s .git "${GIT_REPOSITORY}"`)
    .toString()
    .trim();

const SHELL_SCRIPT_CONTENT = `
#!/bin/bash
readonly LOCAL_ASC=./node_modules/.bin/cplace-asc
if [ -f "$LOCAL_ASC" ]; then
    "$LOCAL_ASC" -w -c "$@"
else
    cplace-asc -w -c "$@"
fi
`.trim();

const BATCH_SCRIPT_CONTENT = `
set LOCAL_ASC = ".\\node_modules\\.bin\\cplace-asc"
IF exist LOCAL_ASC (
    LOCAL_ASC -w -c %*
) else (
    cplace-asc -w -c %*
)
`.trim();

const PACKAGE_JSON_CONTENT = `
{
  "name": "${WORKSPACE_NAME}",
  "version": "1.0.0",
  "repository": {
    "type": "git",
    "url": "git+${GIT_REPOSITORY}"
  },
  "engines": {
    "node": "${NODE_VERSION}",
    "npm": "${NPM_VERSION}"
  },
  "private": true,
  "devDependencies": {
    "${CPLACE_ASC_LOCAL_PKG_NAME}": "${CPLACE_ASC_LOCAL_PKG_VERSION}"
  }
}
`;

function run() {
    handlePackageJSON();
    handleGitIgnore();
    handleNVMRC();
    handleAssetsCompilerScripts();
    logChecklist();
}

function handlePackageJSON() {
    if (!existsSync(PACKAGE_JSON_PATH)) {
        console.log('Creating new package.json');
        writeFileSync(PACKAGE_JSON_PATH, PACKAGE_JSON_CONTENT);
    } else {
        updateExistingPackageJSONContent();
    }
}

function updateExistingPackageJSONContent() {
    const existingPackageJSONContent = require(PACKAGE_JSON_PATH);
    cleanExistingPackageJSONDependencies(existingPackageJSONContent);
    updateExistingPackageJSONEngine(existingPackageJSONContent);
    addCplaceAscLocal(existingPackageJSONContent);
}

function cleanExistingPackageJSONDependencies(existingPackageJSONContent) {
    console.log('Cleaning dependencies');
    PACKAGES_TO_REMOVE.forEach((pkg) => {
        const dependencies = existingPackageJSONContent.dependencies;
        const devDependencies = existingPackageJSONContent.devDependencies;
        if (dependencies && dependencies[pkg]) {
            console.log(
                `${pkg} is already provided with @cplace/asc-local and it will be deleted from the dependencies`
            );
            delete dependencies[pkg];
        }
        if (devDependencies && devDependencies[pkg]) {
            console.log(
                `${pkg} is already provided with @cplace/asc-local and it will be deleted from the devDependencies`
            );
            delete devDependencies[pkg];
        }
    });
    writePackageJSONContent(existingPackageJSONContent);
}

function updateExistingPackageJSONEngine(existingPackageJSONContent) {
    console.log('Updating package.json engines');
    const engines = existingPackageJSONContent.engines;
    if (engines) {
        engines.node = NODE_VERSION;
        engines.npm = NPM_VERSION;
    }
    writePackageJSONContent(existingPackageJSONContent);
}

function addCplaceAscLocal(existingPackageJSONContent) {
    console.log('Adding @cplace/asc-local to devDependencies');
    if (!existingPackageJSONContent.devDependencies) {
        existingPackageJSONContent.devDependencies = {};
    }
    const devDependencies = existingPackageJSONContent.devDependencies;
    devDependencies[CPLACE_ASC_LOCAL_PKG_NAME] = CPLACE_ASC_LOCAL_PKG_VERSION;
    writePackageJSONContent(existingPackageJSONContent);
}

function handleGitIgnore() {
    console.log('Handling .gitignore');
    if (existsSync(GIT_IGNORE_PATH)) {
        let buffer = readFileSync(GIT_IGNORE_PATH, 'utf8');
        if (!buffer.includes(NODE_MODULES_IGNORE_LINE)) {
            let includedIgnores = buffer.replace(/\r/g, '').split('\n');
            includedIgnores = includedIgnores.map((line, index) => {
                if (index === includedIgnores.length - 1) {
                    return line.trim();
                }
                return line;
            });
            includedIgnores.push(NODE_MODULES_IGNORE_LINE);
            buffer = includedIgnores.join('\n');
            writeFileSync(GIT_IGNORE_PATH, buffer);
        }
    } else {
        writeFileSync(GIT_IGNORE_PATH, NODE_MODULES_IGNORE_LINE);
    }
}

function writePackageJSONContent(content) {
    writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(content, null, 2));
}

function handleNVMRC() {
    console.log('Handling .nvmrc');
    writeFileSync(NVMRC_PATH, NVMRC_CONTENT);
}

function handleAssetsCompilerScripts() {
    console.log('Handling assets-compilers.(cmd|sh) scripts');
    writeFileSync(ASC_BATCH_SCRIPT, BATCH_SCRIPT_CONTENT);
    writeFileSync(ASC_SHELL_SCRIPT, SHELL_SCRIPT_CONTENT);
}

function logChecklist() {
    console.log(
        '\x1b[33m%s\x1b[0m',
        `
  Migration to @cplace/asc-local and Node 18 is prepared!\n\n
  Please do the following:\n
  - Install NVM -> https://github.com/nvm-sh/nvm
  - Check the changed/generated files
  - Use the Node version written in .nvmrc file -> You can do this by running "nvm use"
  - Run "npm install"
  - Create cplace-asc alias in your ~/.bash_profile like it is described here: https://www.npmjs.com/package/@cplace/asc-local
  - Run "source ~/.bash_profile"
  - Run "cplace-asc"\n
  - PS: Don't forget...After you change your branch and work on an older version (< 23.2), you need to change your Node version and clean the node_modules
  `
    );
}

run();
