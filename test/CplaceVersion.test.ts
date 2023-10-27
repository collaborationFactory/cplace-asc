import { CplaceVersion } from '../src/model/CplaceVersion';
import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import { generateVersionGradle } from './helper/TestHelpers';

describe('test the cplace version detection', () => {
    const mainRepoName = 'main';

    let tmpTestFolder: tmp.DirSyncObject;
    let basePath: string;
    let mainRepoPath: string;

    let currentCwd;

    beforeEach(() => {
        tmpTestFolder = tmp.dirSync({ unsafeCleanup: true });
        console.log('Test data will be below: ', tmpTestFolder.name);
        basePath = tmpTestFolder.name;
        mainRepoPath = path.join(basePath, mainRepoName);

        // generate main repo
        fs.mkdirSync(mainRepoPath, {
            recursive: true,
        });

        currentCwd = process.cwd();
    });

    afterEach(() => {
        process.chdir(currentCwd);
        tmpTestFolder.removeCallback();
    });

    test('cplace release version provided as parameter', () => {
        generateVersionGradle(mainRepoPath, 'release/23.1', '23.1');

        CplaceVersion.initialize(mainRepoPath, '23.1.5', true);
        expect(CplaceVersion.getCurrentVersion()).toBe('23.1.5');
    });

    test('cplace snapshot version provided as parameter', () => {
        generateVersionGradle(mainRepoPath, 'release/23.1', '23.1');

        CplaceVersion.initialize(mainRepoPath, '23.1.5-SNAPSHOT', true);

        expect(CplaceVersion.getCurrentVersion()).toBe('23.1.5-SNAPSHOT');
    });

    test('cplace snapshot version in curentVerison of version file', () => {
        generateVersionGradle(
            mainRepoPath,
            'release/23.1',
            '23.1',
            '23.1.7-SNAPSHOT'
        );

        CplaceVersion.initialize(mainRepoPath, '', true);
        assertCplaceVersion(23, 1, 0, '');
    });

    test('cplace RC version in curentVerison of version file', () => {
        generateVersionGradle(
            mainRepoPath,
            'release/23.1',
            '23.1',
            '23.1.7-RC.1'
        );

        CplaceVersion.initialize(mainRepoPath, '', true);
        assertCplaceVersion(23, 1, 0, '');
    });

    test('cplace no curentVerison in version file', () => {
        generateVersionGradle(mainRepoPath, 'release/23.1', '23.1');

        CplaceVersion.initialize(mainRepoPath, '', true);
        assertCplaceVersion(23, 1, 0, '');
    });

    test('cplace only createdOnBranch in version file', () => {
        generateVersionGradle(mainRepoPath, 'release/23.2');

        CplaceVersion.initialize(mainRepoPath, '', true);
        assertCplaceVersion(23, 2, 0, '');
    });

    test('cplace customer version in currentVersion in version file', () => {
        generateVersionGradle(
            mainRepoPath,
            'customer/release/23.2',
            '23.2',
            '3.12.116-SNAPSHOT'
        );

        CplaceVersion.initialize(mainRepoPath, '', true);
        assertCplaceVersion(23, 2, 0, '');
    });

    test('cplace no versions in version file', () => {
        generateVersionGradle(mainRepoPath, '');

        const t = () => {
            CplaceVersion.initialize(mainRepoPath, '', true);
        };
        expect(t).toThrow(Error);
    });

    test('cplace no versions in version file', () => {
        generateVersionGradle(mainRepoPath, '');

        const t = () => {
            CplaceVersion.initialize(mainRepoPath, '', true);
        };
        expect(t).toThrow(Error);
    });

    function assertCplaceVersion(
        major: number,
        minor: number,
        patch: number,
        appendix: string
    ) {
        expect(CplaceVersion.get().major).toBe(major);
        expect(CplaceVersion.get().minor).toBe(minor);
        expect(CplaceVersion.get().patch).toBe(patch);
        expect(CplaceVersion.get().appendix).toBe(appendix);
    }
});
