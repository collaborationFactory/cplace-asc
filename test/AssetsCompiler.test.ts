import * as fs from "fs";
import * as path from "path";
import * as rimraf from "rimraf";
import { AssetsCompiler } from "../src/model/AssetsCompiler";

const pluginName = 'cf.cplace.handsOnTable';
const mainRepoName = 'main';
const repoDependencyName = 'cplace-paw';
const ppRepoName = 'cplace-project-planning';
const gradleMarkerName = 'build.gradle';
const basePath = path.join(process.cwd(), 'testsetup');
const mainRepoPath = path.join(basePath, mainRepoName);
const ppRepoPath = path.join(basePath, ppRepoName);

function removeTestFolder() {
    if (fs.existsSync(path.join(basePath))) {
        console.log('removing path', path.join(basePath));
        rimraf.sync(path.join(basePath));
    }
}

beforeEach(() => {
    removeTestFolder();
    fs.mkdirSync(path.join(basePath, repoDependencyName), {recursive: true});
    fs.mkdirSync(path.join(basePath, ppRepoName), {recursive: true});
});

afterAll(() => {
    removeTestFolder();
});

test('cplace-asc in PPrepo can find Plugin in PPrepo', () => {
    fs.mkdirSync(path.join(ppRepoPath, pluginName), {recursive: true});
    const pluginPath = AssetsCompiler.findPluginPath(ppRepoPath, pluginName, [mainRepoName, repoDependencyName]);
    expect(pluginPath).toBe(path.join(ppRepoPath, pluginName).toString());
});

test('cplace-asc in PPrepo can find Plugin in PPrepo with gradle marker', () => {
    fs.mkdirSync(path.join(ppRepoPath, pluginName), {recursive: true});
    fs.writeFileSync(path.join(ppRepoPath, gradleMarkerName), 'build.gradle');
    fs.writeFileSync(path.join(ppRepoPath, pluginName, gradleMarkerName), 'build.gradle');
    const pluginPath = AssetsCompiler.findPluginPath(ppRepoPath, pluginName, [mainRepoName, repoDependencyName]);
    expect(pluginPath).toBe(path.join(ppRepoPath, pluginName).toString());
});

test('cplace-asc in PPrepo ignores Plugin in PPrepo without Plugin gradle marker', () => {
    fs.mkdirSync(path.join(ppRepoPath, pluginName), {recursive: true});
    fs.writeFileSync(path.join(ppRepoPath, gradleMarkerName), 'build.gradle');
    const t = () => {
        AssetsCompiler.findPluginPath(ppRepoPath, pluginName, [mainRepoName, repoDependencyName])
    };
    expect(t).toThrow(Error);
});

test('cplace-asc in PPRepo can find Plugin in main repo', () => {
    fs.mkdirSync(path.join(basePath, mainRepoName, pluginName), {recursive: true});
    const pluginPath = AssetsCompiler.findPluginPath(ppRepoPath, pluginName, [mainRepoName, repoDependencyName]);
    expect(pluginPath).toBe(path.join('..', mainRepoName, pluginName).toString());
});

test('cplace-asc in PPRepo can find Plugin in main repo with gradle marker', () => {
    fs.mkdirSync(path.join(basePath, mainRepoName, pluginName), {recursive: true});
    fs.writeFileSync(path.join(basePath, mainRepoName, gradleMarkerName), 'build.gradle');
    fs.writeFileSync(path.join(basePath, mainRepoName, pluginName, gradleMarkerName), 'build.gradle');
    const pluginPath = AssetsCompiler.findPluginPath(ppRepoPath, pluginName, [mainRepoName, repoDependencyName]);
    expect(pluginPath).toBe(path.join('..', mainRepoName, pluginName).toString());
});

test('cplace-asc in PPRepo ignores Plugin in main repo without Plugin gradle marker', () => {
    fs.mkdirSync(path.join(basePath, mainRepoName, pluginName), {recursive: true});
    fs.writeFileSync(path.join(basePath, mainRepoName, gradleMarkerName), 'build.gradle');
    const t = () => {
        AssetsCompiler.findPluginPath(ppRepoPath, pluginName, [mainRepoName, repoDependencyName])
    };
    expect(t).toThrow(Error);
});

test('cplace-asc in PPRepo can find Plugin in RepoDependency', () => {
    fs.mkdirSync(path.join(basePath, repoDependencyName, pluginName), {recursive: true});
    const pluginPath = AssetsCompiler.findPluginPath(ppRepoPath, pluginName, [mainRepoName, repoDependencyName]);
    expect(pluginPath).toBe(path.join('..', repoDependencyName, pluginName).toString());
});

test('cplace-asc in PPRepo can find Plugin in RepoDependency with gradle marker', () => {
    fs.mkdirSync(path.join(basePath, repoDependencyName, pluginName), {recursive: true});
    fs.writeFileSync(path.join(basePath, repoDependencyName, gradleMarkerName), 'build.gradle');
    fs.writeFileSync(path.join(basePath, repoDependencyName, pluginName, gradleMarkerName), 'build.gradle');
    const pluginPath = AssetsCompiler.findPluginPath(ppRepoPath, pluginName, [mainRepoName, repoDependencyName]);
    expect(pluginPath).toBe(path.join('..', repoDependencyName, pluginName).toString());
});

test('cplace-asc in PPRepo ignores Plugin in RepoDependency without Plugin gradle marker', () => {
    fs.mkdirSync(path.join(basePath, repoDependencyName, pluginName), {recursive: true});
    fs.writeFileSync(path.join(basePath, repoDependencyName, gradleMarkerName), 'build.gradle');
    const t = () => {
        AssetsCompiler.findPluginPath(ppRepoPath, pluginName, [mainRepoName, repoDependencyName]);
    };
    expect(t).toThrow(Error);
});

test('cplace-asc in Main can find Plugin in Main', () => {
    fs.mkdirSync(path.join(basePath, mainRepoName, pluginName), {recursive: true});
    const pluginPath = AssetsCompiler.findPluginPath(mainRepoPath, pluginName, [repoDependencyName]);
    expect(pluginPath).toBe(path.join(mainRepoPath, pluginName).toString());
});

test('cplace-asc in Main can find Plugin in Main with gradle marker', () => {
    fs.mkdirSync(path.join(basePath, mainRepoName, pluginName), {recursive: true});
    fs.writeFileSync(path.join(basePath, mainRepoName, gradleMarkerName), 'build.gradle');
    fs.writeFileSync(path.join(basePath, mainRepoName, pluginName, gradleMarkerName), 'build.gradle');
    const pluginPath = AssetsCompiler.findPluginPath(mainRepoPath, pluginName, [repoDependencyName]);
    expect(pluginPath).toBe(path.join(mainRepoPath, pluginName).toString());
});

test('cplace-asc in Main ignores Plugin in Main without Plugin gradle marker', () => {
    fs.mkdirSync(path.join(mainRepoPath, pluginName), {recursive: true});
    fs.writeFileSync(path.join(mainRepoPath, gradleMarkerName), 'build.gradle');
    const t = () => {
        AssetsCompiler.findPluginPath(mainRepoPath, pluginName, [mainRepoName, repoDependencyName]);
    };
    expect(t).toThrow(Error);
});
