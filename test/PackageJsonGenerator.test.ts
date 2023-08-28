import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import {
    AssetsCompiler,
    IAssetsCompilerConfiguration,
} from '../src/model/AssetsCompiler';
import { CplaceVersion } from '../src/model/CplaceVersion';
import { PackageVersion } from '../src/model/PackageVersion';
import {
    generateBuildGradleFile,
    generateExtendedPluginDescriptor,
    generatePackageJson,
    generateParentRepos,
    generateVersionGradle,
} from './helper/TestHelpers';

describe('test generating a package.json file in repo root', () => {
    const mainRepoName = 'main';
    const otherRepoName = 'cplace-paw';
    let platformPath;

    let tmpTestFolder: tmp.DirSyncObject;
    let basePath: string;
    let mainRepoPath: string;
    let otherRepoPath: string;

    let currentCwd;

    beforeEach(() => {
        tmpTestFolder = tmp.dirSync({ unsafeCleanup: true });
        console.log('Test data will be below: ', tmpTestFolder.name);
        basePath = tmpTestFolder.name;
        mainRepoPath = path.join(basePath, mainRepoName);
        otherRepoPath = path.join(basePath, otherRepoName);

        // generate main repo and platform
        fs.mkdirSync(mainRepoPath, {
            recursive: true,
        });
        generateVersionGradle(mainRepoPath, 'release/22.4', '22.4', '22.4.0');
        platformPath = path.resolve(mainRepoPath, 'cf.cplace.platform');
        fs.mkdirSync(platformPath);
        fs.mkdirSync(path.resolve(platformPath, 'src'));
        fs.mkdirSync(path.resolve(platformPath, 'assets'));
        generateBuildGradleFile(platformPath, []);
        generatePackageJson(mainRepoPath, 'cplace', '3.0.0');
        generateExtendedPluginDescriptor(
            platformPath,
            'cf.cplace.platform',
            'cf.cplace',
            'cplace',
            []
        );

        // generate another plugin in main repo
        const mainRepoCommonPluginPath = path.resolve(
            mainRepoPath,
            'cf.cplace.common'
        );
        fs.mkdirSync(mainRepoCommonPluginPath);
        fs.mkdirSync(path.resolve(mainRepoCommonPluginPath, 'src'));
        fs.mkdirSync(path.resolve(mainRepoCommonPluginPath, 'assets'));
        generateBuildGradleFile(mainRepoCommonPluginPath, []);
        generateExtendedPluginDescriptor(
            mainRepoCommonPluginPath,
            'cf.cplace.common',
            'cf.cplace',
            'cplace',
            []
        );

        // generate other repo and plugin
        fs.mkdirSync(otherRepoPath, {
            recursive: true,
        });
        generateParentRepos(otherRepoPath, ['main']);
        generateVersionGradle(otherRepoPath, 'release/22.4', '22.4', '22.4.0');

        const repo2Plugin1Path = path.resolve(
            otherRepoPath,
            'cf.cplace.plugin'
        );
        fs.mkdirSync(repo2Plugin1Path);
        fs.mkdirSync(path.resolve(repo2Plugin1Path, 'src'));
        fs.mkdirSync(path.resolve(repo2Plugin1Path, 'assets'));
        generateBuildGradleFile(repo2Plugin1Path, ['cf.cplace.platform']);
        generateExtendedPluginDescriptor(
            repo2Plugin1Path,
            'cf.cplace.plugin',
            'cf.cplace',
            'cplace-paw',
            [{ name: 'cf.cplace.platform', group: 'cf.cplace' }]
        );

        const repo2Plugin2Path = path.resolve(
            otherRepoPath,
            'cf.cplace.plugin2'
        );
        fs.mkdirSync(repo2Plugin2Path);
        fs.mkdirSync(path.resolve(repo2Plugin2Path, 'src'));
        fs.mkdirSync(path.resolve(repo2Plugin2Path, 'assets'));
        generateBuildGradleFile(repo2Plugin2Path, [
            'cf.cplace.platform',
            'cf.cplace.common',
            'cf.cplace.plugin',
        ]);
        generateExtendedPluginDescriptor(
            repo2Plugin2Path,
            'cf.cplace.plugin2',
            'cf.cplace',
            'cplace-paw',
            [
                { name: 'cf.cplace.platform', group: 'cf.cplace' },
                { name: 'cf.cplace.common', group: 'cf.cplace' },
                { name: 'cf.cplace.plugin', group: 'cf.cplace' },
            ]
        );

        currentCwd = process.cwd();
        process.chdir(otherRepoPath);
    });

    afterEach(() => {
        process.chdir(currentCwd);
        tmpTestFolder.removeCallback();
    });

    test('test generate package.json files', async () => {
        const config: IAssetsCompilerConfiguration = {
            rootPlugins: [],
            watchFiles: false,
            onlyPreprocessing: false,
            clean: false,
            maxParallelism: 1,
            localOnly: false,
            production: false,
            noParents: false,
            packagejson: true,
            cplaceversion: "",
            withYaml: false,
        };

        PackageVersion.initialize(mainRepoPath);
        CplaceVersion.initialize(mainRepoPath);
        const assetsCompiler = new AssetsCompiler(config, otherRepoPath);
        await assetsCompiler.start();

        const pluginPackageJson = path.resolve(
            otherRepoPath,
            'cf.cplace.plugin2',
            'assets',
            'package.json'
        );
        expect(fs.existsSync(pluginPackageJson)).toBeTruthy();
        let packageJsonContent = fs.readFileSync(pluginPackageJson).toString();
        let packageJson = JSON.parse(packageJsonContent);
        expect(packageJson['name']).toEqual(
            '@cplace-assets/cplace-paw_cf-cplace-plugin2'
        );
    });
});
