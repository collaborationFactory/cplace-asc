import { AbstractTSConfigGenerator } from '../src/model/AbstractTSConfigGenerator';
import CplacePlugin from '../src/model/CplacePlugin';
import * as path from 'path';
import * as fs from 'fs';

// Mock fs module
jest.mock('fs');

// Create concrete test implementation of abstract class
class TestTSConfigGenerator extends AbstractTSConfigGenerator {
    public getTypeRootsOfLinkedPlugins(): string[] {
        return [];
    }
    public getTsConfigBasePath(): string {
        return '/base/tsconfig.json';
    }

    public getRelativePathToMain(
        localOnly: boolean,
        repo: string,
        relRepoRootPrefix: string
    ): string {
        return path.join(relRepoRootPrefix, localOnly ? '' : '../main');
    }

    public getRelativePathToPlugin(
        cplacePlugin: CplacePlugin | undefined
    ): string {
        return '../../../../main/cf.cplace.platform';
    }

    public getRelativePathToPluginAssets(
        cplacePlugin: CplacePlugin | undefined
    ): string {
        return '../../../../main/cf.cplace.platform/assets';
    }

    public getRelativePathToPluginSources(
        cplacePlugin: CplacePlugin | undefined
    ): string {
        return '../../../../main/cf.cplace.platform/assets/ts';
    }

    public getPathsAndRefs(): {
        paths: Record<string, string[]>;
        refs: { path: string }[];
    } {
        return {
            paths: { '*': ['*'] },
            refs: [{ path: 'test/path' }],
        };
    }
}

describe('AbstractTSConfigGenerator', () => {
    let mockPlugin: CplacePlugin;
    let mockDependencies: CplacePlugin[];
    let generator: TestTSConfigGenerator;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup mock plugin
        mockPlugin = {
            pluginName: 'cf.cplace.test',
            pluginDir: '/test/plugin/dir',
            assetsDir: '/test/plugin/dir/assets',
            repo: 'test-repo',
        } as unknown as CplacePlugin;

        // Setup mock platform plugin dependency
        const mockPlatformPlugin = {
            pluginName: 'cf.cplace.platform',
            pluginDir: '/main/cf.cplace.platform',
            repo: 'main',
        } as unknown as CplacePlugin;

        mockDependencies = [mockPlatformPlugin];

        // Create test generator instance
        generator = new TestTSConfigGenerator(
            mockPlugin,
            mockDependencies,
            false, // localOnly
            false, // isProduction
            'ts', // srcFolderName,
            false
        );
    });

    describe('getTypeRoots', () => {
        it('should return correct type roots array', () => {
            const typeRoots = generator['getTypeRoots']();
            expect(typeRoots).toEqual([
                path.join('../../../../main', 'node_modules', '@types'),
                path.join(
                    '../../../../main/cf.cplace.platform/assets',
                    '@cplaceTypes'
                ),
            ]);
        });
    });

    describe('getPathsToMainTypes', () => {
        it('should return correct paths to main types', () => {
            const mainTypes = generator['getPathsToMainTypes']();
            expect(mainTypes).toEqual([
                path.join('../../../../main', 'node_modules', '@types', '*'),
                path.join(
                    '../../../../main/cf.cplace.platform/assets',
                    '@cplaceTypes',
                    '*'
                ),
            ]);
        });
    });

    describe('getTSConfigPath', () => {
        it('should return correct tsconfig path', () => {
            const configPath = generator['getTSConfigPath']();
            expect(configPath).toBe(
                path.join(mockPlugin.assetsDir, 'ts', 'tsconfig.json')
            );
        });
    });

    describe('createConfigAndGetPath', () => {
        beforeEach(() => {
            // Mock ExtraTypesReader
            jest.mock('../src/model/ExtraTypesReader', () => ({
                ExtraTypesReader: {
                    getExtraTypes: jest.fn().mockReturnValue({
                        definitions: ['extra.d.ts'],
                        externals: { test: '_test' },
                    }),
                },
            }));
        });

        it('should create correct tsconfig for non-platform plugin', () => {
            const configPath = generator.createConfigAndGetPath();

            // Verify the config was written
            expect(fs.writeFileSync).toHaveBeenCalled();

            // Get the written config
            const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
            const writtenConfig = JSON.parse(writeCall[1]);

            // Verify config structure
            expect(writtenConfig).toMatchObject({
                extends: '/base/tsconfig.json',
                compilerOptions: {
                    rootDir: '.',
                    baseUrl: '.',
                    outDir: '../generated_js',
                    sourceMap: true,
                    declarationMap: true,
                    typeRoots: expect.any(Array),
                },
                include: expect.arrayContaining(['./**/*.ts']),
                references: expect.any(Array),
            });

            // Verify path
            expect(configPath).toBe(
                path.join(mockPlugin.assetsDir, 'ts', 'tsconfig.json')
            );
        });

        it('should create config without source maps in production mode', () => {
            generator = new TestTSConfigGenerator(
                mockPlugin,
                mockDependencies,
                false,
                true, // isProduction
                'ts',
                false
            );

            generator.createConfigAndGetPath();

            const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
            const writtenConfig = JSON.parse(writeCall[1]);

            expect(writtenConfig.compilerOptions.sourceMap).toBe(false);
            expect(writtenConfig.compilerOptions.declarationMap).toBe(false);
        });
    });

    describe('static getPathDependency', () => {
        it('should return correct dependency path configuration', () => {
            const result = AbstractTSConfigGenerator['getPathDependency'](
                'test-dep',
                './path/to/dep'
            );
            expect(result).toEqual({
                '@test-dep/*': ['./path/to/dep/*'],
            });
        });
    });
});
