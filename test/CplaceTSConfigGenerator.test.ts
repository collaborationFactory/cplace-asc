import * as fs from "fs";
import * as path from "path";
import * as rimraf from "rimraf";
import CplacePlugin from "../src/model/CplacePlugin";
import { AssetsCompiler } from "../src/model/AssetsCompiler";
import {
    getDependencyParser, PluginDescriptorDependencyParser,
} from "../src/model/DependencyParser";
import { PackageVersion } from "../src/model/PackageVersion";

const platformPluginName = 'cf.cplace.platform';
const handsOnTablePluginName = 'cf.cplace.handsOnTable';
const curvesPluginName = 'de.toolforge.curves';
const mainRepoName = 'main';
const pawRepoName = 'cplace-paw';
const curvesRepoName = 'cplace-curves';
const basePath = path.join(process.cwd(), 'testsetup');
const mainRepoPath = path.join(basePath, mainRepoName);
const curvesRepoPath = path.join(basePath, curvesRepoName);
const pawRepoPath = path.join(basePath, pawRepoName);
const handsOnTablePluginDir = path.join(pawRepoPath, handsOnTablePluginName);
const curvesPluginDir = path.join(curvesRepoPath, curvesPluginName);
const platformPluginDir = path.join(mainRepoPath, platformPluginName);
const gradleMarkerName = 'build.gradle';
const pluginDescriptorName = 'pluginDescriptor.json';

const tsBaseConfig = '{\n' +
    '    "compilerOptions": {\n' +
    '        "moduleResolution": "node",\n' +
    '        "experimentalDecorators": true,\n' +
    '        "lib": [\n' +
    '            "dom",\n' +
    '            "es6"\n' +
    '        ],\n' +
    '        "target": "es5",\n' +
    '        "strict": true,\n' +
    '        "strictNullChecks": false,\n' +
    '        "noImplicitAny": false,\n' +
    '        "strictFunctionTypes": false,\n' +
    '        "noImplicitThis": false,\n' +
    '        "composite": true,\n' +
    '        "declaration": true,\n' +
    '        "declarationMap": true,\n' +
    '        "sourceMap": true,\n' +
    '        "typeRoots": [\n' +
    '            "./node_modules/@types",\n' +
    '            "./cf.cplace.platform/assets/@cplaceTypes"\n' +
    '        ]\n' +
    '    }\n' +
    '}\n';

const parentRepos = '{\n' +
    '  "main": {\n' +
    '    "url": "git@github.com:collaborationFactory/cplace.git",\n' +
    '    "branch": "master"\n' +
    '  },\n' +
    '  "cplace-paw": {\n' +
    '    "url": "git@github.com:collaborationFactory/cplace-paw.git",\n' +
    '    "branch": "master"\n' +
    '  }\n' +
    '}\n';

const platformPluginDescriptor = '{\n' +
    '    "name": "cf.cplace.platform",\n' +
    '    "dependencies": [\n' +
    '    ]\n' +
    '}';

const curvesPluginDescriptor = '{\n' +
    '    "name": "de.toolforge.curves",\n' +
    '    "dependencies": [\n' +
    '        "cf.cplace.handsOnTable",\n' +
    '        "cf.cplace.platform"\n' +
    '    ]\n' +
    '}';

const handsOnTablePluginDescriptor = '{\n' +
    '    "name": "cf.cplace.handsOnTable",\n' +
    '    "dependencies": [\n' +
    '        "cf.cplace.platform"\n' +
    '    ]\n' +
    '}';

const packageJson = '{\n' +
    '    "name": "cplace",\n' +
    '    "version": "3.0.0",\n' +
    '    "description": ""\n' +
    '}\n';


function removeTestFolder() {
    if (fs.existsSync(path.join(basePath))) {
        console.log('removing path', path.join(basePath));
        rimraf.sync(path.join(basePath));
    }
}

beforeEach(() => {
    removeTestFolder();
    initPluginDir(platformPluginDir, platformPluginDescriptor);
    initPluginDir(curvesPluginDir, curvesPluginDescriptor);
    initPluginDir(handsOnTablePluginDir, handsOnTablePluginDescriptor);

    fs.mkdirSync(mainRepoPath, {recursive: true});
    fs.writeFileSync(path.join(mainRepoPath, 'tsconfig.base.json'), tsBaseConfig);
    fs.writeFileSync(path.join(mainRepoPath, 'package.json'), packageJson);
    fs.writeFileSync(path.join(curvesRepoPath, 'parent-repos.json'), parentRepos);
});

function initPluginDir(pluginDir, pluginDescriptor) {
    fs.mkdirSync(path.join(pluginDir, 'assets', 'ts'), {recursive: true});
    fs.writeFileSync(path.join(pluginDir, 'assets', 'ts', 'app.ts'), "");
    fs.writeFileSync(path.join(pluginDir, gradleMarkerName), 'build.gradle');
    fs.writeFileSync(path.join(pluginDir, pluginDescriptorName), pluginDescriptor);
    fs.mkdirSync(path.join(pluginDir, 'src'), {recursive: true});
}


afterAll(() => {
    removeTestFolder();
});

test('cplace-asc adds typings of node_modules on plugin level', () => {

    process.chdir(curvesRepoPath);
    fs.mkdirSync(handsOnTablePluginDir, {recursive: true});
    fs.mkdirSync(curvesPluginDir, {recursive: true});
    const handsontable = new CplacePlugin("cf.cplace.handsOnTable", handsOnTablePluginDir);
    const curves = new CplacePlugin("de.toolforge.curves", curvesPluginDir);
    PackageVersion.initialize(mainRepoPath);
    const assetsCompiler = new AssetsCompiler({
        clean: true,
        localOnly: false,
        maxParallelism: 1,
        noParents: true,
        onlyPreprocessing: true,
        production: true,
        rootPlugins: [],
        watchFiles: false
    }, curvesRepoPath);
    assetsCompiler.start();
//    const configGenerator = new CplaceTSConfigGenerator(curves, [handsontable], false, true);
//    configGenerator.createConfigAndGetPath();
});

