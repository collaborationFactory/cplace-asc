import { CplaceTSConfigGenerator } from '../src/model/CplaceTSConfigGenerator';
import CplacePlugin from '../src/model/CplacePlugin';
import * as path from 'path';
import { AssetsCompiler } from '../src/model/AssetsCompiler';
import * as fs from 'fs';

jest.mock('../src/model/AssetsCompiler', () => ({
    AssetsCompiler: {
        isLocalParentRepo: jest.fn(),
    },
}));
jest.mock('fs');

describe('CplaceTSConfigGenerator', () => {
    const mockPlugin: CplacePlugin = {
        pluginName: 'cf.cplace.test',
        repo: 'test-repo',
        isArtifactPlugin: false,
    } as CplacePlugin;

    const mockPlatformPlugin: CplacePlugin = {
        pluginName: 'cf.cplace.platform',
        repo: 'main',
        isArtifactPlugin: false,
    } as CplacePlugin;

    const mockArtifactPlugin: CplacePlugin = {
        pluginName: 'cf.cplace.artifactPlugin',
        repo: 'other-repo',
        isArtifactPlugin: true,
    } as CplacePlugin;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getRelativePathToMain', () => {
        it('should return correct path when main repo is local and plugin is in main', () => {
            process.cwd = jest.fn().mockReturnValue('/path/to/main');
            (AssetsCompiler.isLocalParentRepo as jest.Mock).mockReturnValue(
                true
            );
            const generator = new CplaceTSConfigGenerator(
                { ...mockPlugin, repo: 'main' } as CplacePlugin,
                [mockPlatformPlugin],
                false,
                false
            );

            const result = generator.getRelativePathToMain(
                false,
                'main',
                '../../..'
            );
            expect(result).toBe(path.join('../../..'));
        });

        it('should return correct path when main repo is local and plugin is in different repo', () => {
            process.cwd = jest.fn().mockReturnValue('/path/to/test-repo');
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (AssetsCompiler.isLocalParentRepo as jest.Mock).mockReturnValue(
                true
            );
            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                [mockPlatformPlugin],
                false,
                false
            );

            const result = generator.getRelativePathToMain(
                false,
                'test-repo',
                '../../..'
            );
            expect(result).toBe(path.join('../../../../main'));
        });

        it('should return base path when main repo is not local', () => {
            (AssetsCompiler.isLocalParentRepo as jest.Mock).mockReturnValue(
                false
            );
            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                [mockPlatformPlugin],
                false,
                false
            );

            const result = generator.getRelativePathToMain(
                false,
                'test-repo',
                '../../..'
            );
            expect(result).toBe(path.join('../../..'));
        });
    });

    describe('getRelativePathToPlatform', () => {
        it('should return platform path in node_modules when platform is an artifact', () => {
            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                [
                    {
                        ...mockPlatformPlugin,
                        isArtifactPlugin: true,
                    } as CplacePlugin,
                ],
                false,
                false
            );

            const result = generator.getRelativePathToPlatform();
            expect(result).toBe(
                path.join(
                    '../../../node_modules/@cplace-assets/cplace_cf-cplace-platform'
                )
            );
        });

        it('should return regular path when platform is not an artifact', () => {
            process.cwd = jest.fn().mockReturnValue('/path/to/test-repo');
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (AssetsCompiler.isLocalParentRepo as jest.Mock).mockReturnValue(
                true
            );

            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                [mockPlatformPlugin],
                false,
                false
            );

            generator.getRelativePathToMain(false, 'test-repo', '../../..');
            const result = generator.getRelativePathToPlatform();
            expect(result).toBe(
                path.join('../../../../main/cf.cplace.platform')
            );
        });
    });

    describe('getPathsAndRefs', () => {
        it('should include platform paths by default', () => {
            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                [mockPlatformPlugin],
                false,
                false
            );

            const { paths, refs } = generator.getPathsAndRefs();
            expect(paths['@cf.cplace.platform/*']).toBeDefined();
            expect(refs).toHaveLength(1);
        });

        it('should include dependency paths but exclude platform paths', () => {
            const mockDependency = {
                ...mockPlugin,
                pluginName: 'cf.cplace.dependency',
                getPluginPathRelativeFromRepo: jest
                    .fn()
                    .mockReturnValue('dependency-path'),
            } as unknown as CplacePlugin;

            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                [mockPlatformPlugin, mockDependency],
                false,
                false
            );

            const { paths, refs } = generator.getPathsAndRefs();
            expect(paths['@cf.cplace.dependency/*']).toBeDefined();
            expect(refs).toHaveLength(2); // Platform + dependency
        });

        // it('should not include references for artifact plugins', () => {
        //     const generator = new CplaceTSConfigGenerator(
        //         mockPlugin,
        //         [mockPlatformPlugin, mockArtifactPlugin],
        //         false,
        //         false
        //     );

        //     const { paths, refs } = generator.getPathsAndRefs();
        //     expect(paths['@cf.cplace.artifactPlugin/*']).toBeDefined();
        //     expect(refs).toHaveLength(1); // Only platform ref
        // });
    });

    describe('getTsConfigBasePath', () => {
        it('should return tsconfig.base from platform assets when in artifacts-only build', () => {
            process.env.CPLACE_BUILD_WITHOUT_PARENT_REPOS = 'true';
            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                [mockPlatformPlugin],
                false,
                false
            );

            const result = generator.getTsConfigBasePath();
            expect(result).toBe(
                path.join(
                    '../../../../main/cf.cplace.platform/assets/tsconfig.base.json'
                )
            );
            delete process.env.CPLACE_BUILD_WITHOUT_PARENT_REPOS;
        });

        it('should return path from main repo in normal build', () => {
            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                [mockPlatformPlugin],
                false,
                false
            );

            const result = generator.getTsConfigBasePath();
            expect(result).toBe(
                path.join('../../../../main/tsconfig.base.json')
            );
        });
    });
});
