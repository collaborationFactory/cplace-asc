import { CplaceTSConfigGenerator } from '../src/model/CplaceTSConfigGenerator';
import CplacePlugin from '../src/model/CplacePlugin';
import { AssetsCompiler } from '../src/model/AssetsCompiler';
import * as path from 'path';
import * as fs from 'fs';
import * as process from 'process';

// Properly type the mocked modules
jest.mock('fs');
jest.mock('process');
jest.mock('process', () => ({
    cwd: jest.fn(),
}));
jest.mock('../src/model/AssetsCompiler');

describe('CplaceTSConfigGenerator', () => {
    let mockPlugin: CplacePlugin;
    let mockArtifactPlugin: CplacePlugin;
    let mockPlatformPlugin: CplacePlugin;
    let mockDependencies: CplacePlugin[];

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock fs.existsSync
        (fs.existsSync as jest.Mock).mockReturnValue(true);

        // Mock process.cwd
        (process.cwd as jest.Mock).mockReturnValue('/test-repo/');

        // Setup base plugin mocks
        mockPlugin = {
            repo: 'test-repo',
            pluginName: 'cf.cplace.test',
            pluginDir: '/test/cf.cplace.test',
            assetsDir: '/test/cf.cplace.test/assets',
            isArtifactPlugin: false,
            getPluginPathRelativeFromRepo: jest
                .fn()
                .mockImplementation(
                    (sourceRepo: string, localOnly: boolean) => {
                        return '../test/cf.cplace.test';
                    }
                ),
        } as unknown as CplacePlugin;

        mockPlatformPlugin = {
            repo: 'main',
            pluginName: 'cf.cplace.platform',
            pluginDir: '/main/cf.cplace.platform',
            assetsDir: '/main/cf.cplace.platform/assets',
            isArtifactPlugin: false,
            getPluginPathRelativeFromRepo: jest
                .fn()
                .mockImplementation(
                    (sourceRepo: string, localOnly: boolean) => {
                        return '../main/cf.cplace.platform';
                    }
                ),
        } as unknown as CplacePlugin;

        mockArtifactPlugin = {
            repo: 'other-repo',
            pluginName: 'cf.cplace.artifactPlugin',
            pluginDir: '/other-repo/cf.cplace.artifactPlugin',
            assetsDir: '/other-repo/cf.cplace.artifactPlugin/assets',
            isArtifactPlugin: true,
            getPluginPathRelativeFromRepo: jest
                .fn()
                .mockImplementation(
                    (sourceRepo: string, localOnly: boolean) => {
                        return './node_modules/@cplace-assets/other-repo_cf.cplace.platform';
                    }
                ),
        } as unknown as CplacePlugin;

        mockDependencies = [mockPlatformPlugin, mockArtifactPlugin];

        // Mock AssetsCompiler static methods
        (AssetsCompiler.isLocalParentRepo as jest.Mock).mockImplementation(
            (repoName: string) => true
        );
        (AssetsCompiler.isArtifactsOnlyBuild as jest.Mock).mockReturnValue(
            false
        );
    });

    describe('getRelativePathToMain', () => {
        it('should return correct path when localOnly is true', () => {
            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                mockDependencies,
                true,
                false
            );
            const result = generator.getRelativePathToMain(
                true,
                'test-repo',
                '../../..'
            );
            expect(result).toBe(path.join('../../..'));
        });

        it('should return path to main folder when repo is different from main', () => {
            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                mockDependencies,
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

        it('should return current repo in artifacts-only build case', () => {
            (AssetsCompiler.isLocalParentRepo as jest.Mock).mockReturnValue(
                false
            );
            (AssetsCompiler.isArtifactsOnlyBuild as jest.Mock).mockReturnValue(
                true
            );

            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                mockDependencies,
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
        it('should return correct platform path for local plugin', () => {
            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                mockDependencies,
                false,
                false
            );
            const result = generator.getRelativePathToPlatform();
            expect(result).toBe(
                path.join('../../../../main/cf.cplace.platform')
            );
        });

        it('should throw error when platform plugin not found', () => {
            expect(
                () => new CplaceTSConfigGenerator(mockPlugin, [], false, false)
            ).toThrow('Platform plugin not found');
        });

        it('should return path in node_modules when platform is an artifact plugin', () => {
            const artifactPlatform = {
                ...mockPlatformPlugin,
                isArtifactPlugin: true,
                getPluginPathRelativeFromRepo: jest
                    .fn()
                    .mockImplementation(
                        (sourceRepo: string, localOnly: boolean) => {
                            return './node_modules/@cplace-assets/cplace_cf-cplace-platform';
                        }
                    ),
            } as unknown as CplacePlugin;

            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                [artifactPlatform],
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
    });

    describe('getPathsAndRefs', () => {
        it('should return correct paths and refs for local plugins', () => {
            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                mockDependencies,
                false,
                false
            );
            const result = generator.getPathsAndRefs();

            expect(Object.keys(result.paths)).toContain(
                '@cf.cplace.platform/*'
            );
            expect(result.paths['*']).toEqual(['*']);
            expect(result.refs).toHaveLength(1);
        });

        it('should not include references for artifact plugins', () => {
            const artifactPlatform = {
                ...mockPlatformPlugin,
                isArtifactPlugin: true,
            } as unknown as CplacePlugin;

            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                [artifactPlatform],
                false,
                false
            );
            const result = generator.getPathsAndRefs();

            expect(result.refs).toHaveLength(0);
        });

        it('should handle multiple dependencies correctly', () => {
            const mockDep = {
                ...mockPlugin,
                pluginName: 'test.dependency',
                getPluginPathRelativeFromRepo: jest
                    .fn()
                    .mockReturnValue('test.dependency'),
            } as unknown as CplacePlugin;

            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                [...mockDependencies, mockDep],
                false,
                false
            );
            const result = generator.getPathsAndRefs();

            expect(Object.keys(result.paths)).toContain('@test.dependency/*');
            expect(result.refs).toHaveLength(2);
        });
    });

    describe('getTsConfigBasePath', () => {
        it('should return node_modules path when platform is artifacts plugin', () => {
            (AssetsCompiler.isArtifactsOnlyBuild as jest.Mock).mockReturnValue(
                true
            );
            const artifactPlatform = {
                ...mockPlatformPlugin,
                isArtifactPlugin: true,
                getPluginPathRelativeFromRepo: jest
                    .fn()
                    .mockImplementation(
                        (sourceRepo: string, localOnly: boolean) => {
                            return './node_modules/@cplace-assets/cplace_cf-cplace-platform';
                        }
                    ),
            } as unknown as CplacePlugin;

            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                [artifactPlatform],
                false,
                false
            );
            const result = generator.getTsConfigBasePath();

            expect(result).toBe(
                path.join(
                    '../../../node_modules/@cplace-assets/cplace_cf-cplace-platform/tsconfig.base.json'
                )
            );
        });

        it('should return path from platform for artifacts build and local main repo', () => {
            (AssetsCompiler.isLocalParentRepo as jest.Mock).mockReturnValue(
                true
            );
            (AssetsCompiler.isArtifactsOnlyBuild as jest.Mock).mockReturnValue(
                true
            );

            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                mockDependencies,
                false,
                false
            );
            const result = generator.getTsConfigBasePath();

            expect(result).toContain(
                path.join(
                    '../../../../main/cf.cplace.platform/assets/tsconfig.base.json'
                )
            );
        });

        it('should return path from main repo for normal build', () => {
            const generator = new CplaceTSConfigGenerator(
                mockPlugin,
                mockDependencies,
                false,
                false
            );
            const result = generator.getTsConfigBasePath();

            expect(result).toContain(
                path.join('../../../../main/tsconfig.base.json')
            );
        });
    });
});
