import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import {
    AssetsCompiler,
    IAssetsCompilerConfiguration,
} from '../src/model/AssetsCompiler';
import { PackageVersion } from '../src/model/PackageVersion';
import {
    generateBuildGradleFile,
    generateExtendedPluginDescriptor,
    generatePackageJson,
    generateParentRepos,
    generateSimplePluginDescriptor,
    generateVersionGradle,
} from './helper/TestHelpers';
import { CplaceVersion } from '../src/model/CplaceVersion';

describe('test the handling of plugin descriptor', () => {
    const mainRepoName = 'main';
    const otherRepoName = 'cplace-paw';
    let platformPath;
    let pluginPath;

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
        platformPath = path.resolve(mainRepoPath, 'cf.cplace.platform');
        fs.mkdirSync(platformPath);
        fs.mkdirSync(path.resolve(mainRepoPath, 'cf.cplace.platform', 'src'));
        fs.mkdirSync(
            path.resolve(mainRepoPath, 'cf.cplace.platform', 'assets')
        );

        generateBuildGradleFile(platformPath, []);
        generatePackageJson(mainRepoPath, 'cplace', '3.0.0');
        generateVersionGradle(mainRepoPath, 'release/23.1', '23.1');

        // generate other repo and plugin
        fs.mkdirSync(otherRepoPath, {
            recursive: true,
        });
        pluginPath = path.resolve(otherRepoPath, 'cf.cplace.plugin');
        fs.mkdirSync(pluginPath);
        fs.mkdirSync(path.resolve(otherRepoPath, 'cf.cplace.plugin', 'src'));
        fs.mkdirSync(path.resolve(otherRepoPath, 'cf.cplace.plugin', 'assets'));
        generateBuildGradleFile(pluginPath, ['cf.cplace.platform']);
        generateParentRepos(otherRepoPath, ['main']);
        generateVersionGradle(otherRepoPath, 'release/23.1', '23.1');

        currentCwd = process.cwd();
        process.chdir(otherRepoPath);
    });

    afterEach(() => {
        process.chdir(currentCwd);
        tmpTestFolder.removeCallback();
    });

    // simple plugin descriptors are not in use anymore
    test.skip('test assets compiler with simple plugin descriptors', () => {
        generateSimplePluginDescriptor(platformPath, 'cf.cplace.platform', []);
        generateSimplePluginDescriptor(pluginPath, 'cf.cplace.plugin', [
            'cf.cplace.platform',
        ]);

        const config: IAssetsCompilerConfiguration = {
            rootPlugins: [],
            watchFiles: false,
            onlyPreprocessing: false,
            clean: false,
            maxParallelism: 1,
            localOnly: false,
            production: false,
            noParents: false,
            withYaml: false,
            packagejson: false,
            cplaceversion: '23.1',
        };

        PackageVersion.initialize(mainRepoPath);
        CplaceVersion.initialize(otherRepoPath);
        const assetsCompiler = new AssetsCompiler(config, otherRepoPath);
        assetsCompiler.start().then(
            () => {
                console.log('Test sucessful');
            },
            () => {
                fail('Cannot execute assets compiler');
            }
        );
    });

    test('test assets compiler with extended plugin descriptors', () => {
        generateExtendedPluginDescriptor(
            platformPath,
            'cf.cplace.platform',
            'cf.cplace',
            'cplace',
            []
        );
        generateExtendedPluginDescriptor(
            pluginPath,
            'cf.cplace.plugin',
            'cf.cplace',
            'cplace-paw',
            [
                {
                    name: 'cf.cplace.platform',
                    group: 'cf.cplace',
                    repoName: 'cplace',
                },
            ]
        );

        const config: IAssetsCompilerConfiguration = {
            rootPlugins: [],
            watchFiles: false,
            onlyPreprocessing: false,
            clean: false,
            maxParallelism: 1,
            localOnly: false,
            production: false,
            noParents: false,
            withYaml: false,
            packagejson: false,
            cplaceversion: '23.1',
        };

        CplaceVersion.initialize(otherRepoPath);
        PackageVersion.initialize(mainRepoPath);
        const assetsCompiler = new AssetsCompiler(config, otherRepoPath);
        assetsCompiler.start().then(
            () => {
                console.log('Test sucessful');
            },
            () => {
                fail('Cannot execute assets compiler');
            }
        );
    });
});
