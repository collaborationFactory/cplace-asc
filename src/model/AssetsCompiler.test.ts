import { AssetsCompiler } from "./AssetsCompiler";
import * as fs from "fs";
import * as path from "path";
import * as rimraf from "rimraf";

const pluginName = 'cf.cplace.handsOnTable';
const mainRepo = 'main';
const repoDependency = 'cplace-paw';
const ppRepo = 'cplace-project-planning';
const gradleMarker = 'build.gradle';
let initialWD = process.cwd();

beforeEach(() => {
    if (fs.existsSync('testsetup')) {
        rimraf.sync('testsetup');
    }
    fs.mkdirSync(path.join('testsetup', repoDependency), {recursive: true})
    fs.mkdirSync(path.join('testsetup', ppRepo), {recursive: true})
    process.chdir(path.join(process.cwd(), 'testsetup'));
});

afterAll(() => {
    if (fs.existsSync(path.join(initialWD, 'testsetup'))) {
        rimraf.sync(path.join(initialWD, 'testsetup'));
    }
});

test('cplace-asc in PPrepo can find Plugin in PPrepo', () => {
    fs.mkdirSync(path.join(process.cwd(), ppRepo, pluginName), {recursive: true})
    process.chdir(ppRepo);
    const pluginPath = AssetsCompiler.findPluginPath(process.cwd(), pluginName, [mainRepo, repoDependency]);
    expect(pluginPath).toBe(path.join(process.cwd(), pluginName).toString());
});

test('cplace-asc in PPrepo can find Plugin in PPrepo with gradle marker', () => {
    fs.mkdirSync(path.join(process.cwd(), ppRepo, pluginName), {recursive: true})
    fs.writeFileSync(path.join(process.cwd(), ppRepo, gradleMarker), 'build.gradle')
    fs.writeFileSync(path.join(process.cwd(), ppRepo, pluginName, gradleMarker), 'build.gradle')
    process.chdir(ppRepo);
    const pluginPath = AssetsCompiler.findPluginPath(process.cwd(), pluginName, [mainRepo, repoDependency]);
    expect(pluginPath).toBe(path.join(process.cwd(), pluginName).toString());
});

test('cplace-asc in PPrepo ignores Plugin in PPrepo without Plugin gradle marker', () => {
    fs.mkdirSync(path.join(process.cwd(), ppRepo, pluginName), {recursive: true})
    fs.writeFileSync(path.join(process.cwd(), ppRepo, gradleMarker), 'build.gradle')
    process.chdir(ppRepo);
    const t = () => { AssetsCompiler.findPluginPath(process.cwd(), pluginName, [mainRepo, repoDependency])};
    expect(t).toThrow(Error);
});

test('cplace-asc in PPRepo can find Plugin in main repo', () => {
    fs.mkdirSync(path.join(process.cwd(), mainRepo, pluginName), {recursive: true})
    process.chdir(ppRepo);
    const pluginPath = AssetsCompiler.findPluginPath(process.cwd(), pluginName, [mainRepo, repoDependency]);
    expect(pluginPath).toBe(path.join('..', mainRepo, pluginName).toString());
});

test('cplace-asc in PPRepo can find Plugin in main repo with gradle marker', () => {
    fs.mkdirSync(path.join(process.cwd(), mainRepo, pluginName), {recursive: true})
    fs.writeFileSync(path.join(process.cwd(), mainRepo, gradleMarker), 'build.gradle')
    fs.writeFileSync(path.join(process.cwd(), mainRepo, pluginName, gradleMarker), 'build.gradle')
    process.chdir(ppRepo);
    const pluginPath = AssetsCompiler.findPluginPath(process.cwd(), pluginName, [mainRepo, repoDependency]);
    expect(pluginPath).toBe(path.join('..', mainRepo, pluginName).toString());
});

test('cplace-asc in PPRepo ignores Plugin in main repo without Plugin gradle marker', () => {
    fs.mkdirSync(path.join(process.cwd(), mainRepo, pluginName), {recursive: true})
    fs.writeFileSync(path.join(process.cwd(), mainRepo, gradleMarker), 'build.gradle')
    process.chdir(ppRepo);
    const t = () => { AssetsCompiler.findPluginPath(process.cwd(), pluginName, [mainRepo, repoDependency])};
    expect(t).toThrow(Error);
});

test('cplace-asc in PPRepo can find Plugin in RepoDependency', () => {
    fs.mkdirSync(path.join(process.cwd(), repoDependency, pluginName), {recursive: true})
    process.chdir(ppRepo);
    const pluginPath = AssetsCompiler.findPluginPath(process.cwd(), pluginName, [mainRepo, repoDependency]);
    expect(pluginPath).toBe(path.join('..', repoDependency, pluginName).toString());
});

test('cplace-asc in PPRepo can find Plugin in RepoDependency with gradle marker', () => {
    fs.mkdirSync(path.join(process.cwd(), repoDependency, pluginName), {recursive: true})
    fs.writeFileSync(path.join(process.cwd(), repoDependency, gradleMarker), 'build.gradle')
    fs.writeFileSync(path.join(process.cwd(), repoDependency, pluginName, gradleMarker), 'build.gradle')
    process.chdir(ppRepo);
    const pluginPath = AssetsCompiler.findPluginPath(process.cwd(), pluginName, [mainRepo, repoDependency]);
    expect(pluginPath).toBe(path.join('..', repoDependency, pluginName).toString());
});

test('cplace-asc in PPRepo ignores Plugin in RepoDependency without Plugin gradle marker', () => {
    fs.mkdirSync(path.join(process.cwd(), repoDependency, pluginName), {recursive: true})
    fs.writeFileSync(path.join(process.cwd(), repoDependency, gradleMarker), 'build.gradle')
    process.chdir(ppRepo);
    const t = () => { AssetsCompiler.findPluginPath(process.cwd(), pluginName, [mainRepo, repoDependency])};
    expect(t).toThrow(Error);
});

test('cplace-asc in Main can find Plugin in Main', () => {
    fs.mkdirSync(path.join(process.cwd(), mainRepo, pluginName), {recursive: true})
    process.chdir(mainRepo);
    const pluginPath = AssetsCompiler.findPluginPath(process.cwd(), pluginName, [repoDependency]);
    expect(pluginPath).toBe(path.join(process.cwd(), pluginName).toString());
});

test('cplace-asc in Main can find Plugin in Main with gradle marker', () => {
    fs.mkdirSync(path.join(process.cwd(), mainRepo, pluginName), {recursive: true})
    fs.writeFileSync(path.join(process.cwd(), mainRepo, gradleMarker), 'build.gradle')
    fs.writeFileSync(path.join(process.cwd(), mainRepo, pluginName, gradleMarker), 'build.gradle')
    process.chdir(mainRepo);
    const pluginPath = AssetsCompiler.findPluginPath(process.cwd(), pluginName, [repoDependency]);
    expect(pluginPath).toBe(path.join(process.cwd(), pluginName).toString());
});

test('cplace-asc in Main igores Plugin in Main without Plugin gradle marker', () => {
    fs.mkdirSync(path.join(process.cwd(), mainRepo, pluginName), {recursive: true})
    fs.writeFileSync(path.join(process.cwd(), mainRepo, gradleMarker), 'build.gradle')
    process.chdir(mainRepo);
    const t = () => { AssetsCompiler.findPluginPath(process.cwd(), pluginName, [mainRepo, repoDependency])};
    expect(t).toThrow(Error);
});
