import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import * as child_process from 'child_process';
import { RegistryInitializer } from '@cplace/registry-initializer';
import * as os from 'os';
import {
    DEFAULT_TEST_EMAIL,
    DEFAULT_TEST_TOKEN,
    getTestRegistryCredentials,
} from './shared';

describe('configuring jfrog credentials', () => {
    const gradleProperties =
        'org.gradle.java.home=/Users/maxmustermann/.sdkman/candidates/java/xx.0.2-open\n' +
        'repo.cplace.apiTokenUser=max.mustermann@collaboration-factory.de\n' +
        'repo.cplace.apiToken=token\n' +
        'org.gradle.jvmargs=-Xmx4192m\n';

    const npmrc_not_configured =
        '# configure auth token\n' +
        '@fontawesome:registry=https://npm.fontawesome.com/\n' +
        '//npm.fontawesome.com/:_authToken=$AUTH_TOKEN\n' +
        '\n' +
        '#Default registry\n' +
        'registry=https://registry.npmjs.org/\n' +
        '#scoped registry\n' +
        '@cloudhadoop:registry=http://npm.cloudhadoop.com\n' +
        '\n' +
        ';log level settigns\n' +
        'loglevel=warn';

    const CPLACE_NPM_LOCAL = getTestRegistryCredentials(
        '@cplace-next',
        'cplace-npm-local'
    );
    const CPLACE_NPM = getTestRegistryCredentials('@cplace-next', 'cplace-npm');
    const FORTAWESOME_CPLACE_NPM = getTestRegistryCredentials(
        '@fortawesome',
        'cplace-npm'
    );
    const CPLACE_NPM_TEST = getTestRegistryCredentials(
        '@cplace-next',
        'cplace-npm-test'
    );
    const CPLACE_ASSETS_NPM = getTestRegistryCredentials(
        '@cplace-3rdparty-modified',
        'cplace-assets-npm'
    );
    const CPLACE_DEFAULT_REGISTRY = getTestRegistryCredentials(
        '',
        'cplace-npm'
    );
    const CPLACE_DEFAULT_REGISTRY_OUTDATED = getTestRegistryCredentials(
        '',
        'cplace-npm',
        'outdated'
    );

    let tmpTestFolder: tmp.DirSyncObject;
    let basePath: string;
    let gradleHome: string;
    let gradlePropertiesPath: string;
    let npmrcPath: string;

    beforeEach(() => {
        tmpTestFolder = tmp.dirSync({ unsafeCleanup: true });
        console.log('Test data will be below: ', tmpTestFolder.name);
        basePath = tmpTestFolder.name;
        gradleHome = path.join(basePath, RegistryInitializer.GRADLE_HOME);
        gradlePropertiesPath = path.join(
            gradleHome,
            RegistryInitializer.GRADLE_PROPERTIES
        );
        npmrcPath = path.join(basePath, '.npmrc');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetModules();
        tmpTestFolder.removeCallback();
    });

    test('create .npmrc in case it does not exist', () => {
        const registryInitializerPrototype =
            setupRegistryInitializerMock(false);

        registryInitializerPrototype.initRegistry();

        const npmrcContent = fs.readFileSync(npmrcPath).toString();
        expect(npmrcContent).toContain(CPLACE_DEFAULT_REGISTRY);
    });

    test('auth token can be extracted from gradle.properties', () => {
        const registryInitializerPrototype = setupRegistryInitializerMock();
        jest.spyOn(console, 'info').mockImplementation();

        registryInitializerPrototype.extractTokenFromGradleProps();

        expect(registryInitializerPrototype.npmrcUser).toEqual(
            DEFAULT_TEST_EMAIL
        );
        expect(registryInitializerPrototype.npmrcBasicAuthToken).toEqual(
            DEFAULT_TEST_TOKEN
        );
        expect(console.info).toBeCalledTimes(1);
        expect(console.info).toHaveBeenLastCalledWith(
            '⟲ Configuring npm jfrog registry via the gradle properties'
        );
    });

    test('cplace-asc can remove old scopes', () => {
        const registryInitializerPrototype = setupRegistryInitializerMock();
        fs.writeFileSync(
            npmrcPath,
            FORTAWESOME_CPLACE_NPM.concat(`\n${CPLACE_NPM_TEST}`)
                .concat(`\n${CPLACE_ASSETS_NPM}`)
                .concat(`\n${CPLACE_NPM}`)
        );
        registryInitializerPrototype.initRegistry();
        const npmrcContent = fs.readFileSync(npmrcPath).toString();
        expect(npmrcContent).not.toContain(FORTAWESOME_CPLACE_NPM);
        expect(npmrcContent).not.toContain(CPLACE_NPM_TEST);
        expect(npmrcContent).not.toContain(CPLACE_ASSETS_NPM);
        expect(npmrcContent).not.toContain(CPLACE_NPM);
        expect(npmrcContent).toContain(CPLACE_DEFAULT_REGISTRY);
        expect((npmrcContent.match(/cplace.jfrog.io/g) || []).length).toBe(4);
    });

    test('cplace-asc can update outdated auth token', () => {
        const registryInitializerPrototype = setupRegistryInitializerMock();
        fs.writeFileSync(npmrcPath, CPLACE_DEFAULT_REGISTRY_OUTDATED);
        registryInitializerPrototype.initRegistry();
        const npmrcContent = fs.readFileSync(npmrcPath).toString();
        expect(npmrcContent).toContain(CPLACE_DEFAULT_REGISTRY);
        expect((npmrcContent.match(/cplace.jfrog.io/g) || []).length).toBe(4);
    });

    test('cplace-asc does not exit if gradle home exists without gradle properties', () => {
        const registryInitializerPrototype = setupRegistryInitializerMock(
            false,
            false
        );
        jest.spyOn(console, 'error').mockImplementation();

        registryInitializerPrototype.initRegistry();
        expect(console.error).toBeCalledTimes(1);
        expect(console.error).toHaveBeenLastCalledWith(
            `gradle.properties at location ${gradlePropertiesPath} do not exist!`,
            'You can ignore this for cplace versions before 5.16.'
        );
    });

    test('auth token can be extracted from the environment', () => {
        process.env.ENV_CPLACE_ARTIFACTORY_ACTOR =
            'mathilde.musterfrau@cplace.de';
        process.env.ENV_CPLACE_ARTIFACTORY_TOKEN = 'token';

        const registryInitializerPrototype = setupRegistryInitializerMock();
        jest.spyOn(console, 'info').mockImplementation();

        registryInitializerPrototype.extractTokenFromEnvironment();

        expect(registryInitializerPrototype.npmrcUser).toEqual(
            'mathilde.musterfrau@cplace.de'
        );
        expect(registryInitializerPrototype.npmrcBasicAuthToken).toEqual(
            'bWF0aGlsZGUubXVzdGVyZnJhdUBjcGxhY2UuZGU6dG9rZW4='
        );
        expect(console.info).toBeCalledTimes(1);
        expect(console.info).toHaveBeenLastCalledWith(
            '⟲ Configuring npm jfrog registry via environment variables'
        );
    });

    test('auth token and a private npm registry can be extracted from the environment', () => {
        process.env.ENV_CPLACE_ARTIFACTORY_ACTOR =
            'mathilde.musterfrau@cplace.de';
        process.env.ENV_CPLACE_ARTIFACTORY_TOKEN = 'token';
        process.env.ENV_PRIVATE_NPM_REGISTRY = 'private-registry-fe';

        const registryInitializerPrototype = setupRegistryInitializerMock();
        jest.spyOn(console, 'info').mockImplementation();

        registryInitializerPrototype.extractTokenFromEnvironment();
        registryInitializerPrototype.extractNpmRegistryFromEnvironment();

        expect(registryInitializerPrototype.npmrcUser).toEqual(
            'mathilde.musterfrau@cplace.de'
        );
        expect(registryInitializerPrototype.npmrcBasicAuthToken).toEqual(
            'bWF0aGlsZGUubXVzdGVyZnJhdUBjcGxhY2UuZGU6dG9rZW4='
        );
        expect(console.info).toBeCalledTimes(2);
        expect(console.info).toHaveBeenLastCalledWith(
            "⟲ Using private npm jfrog registry 'private-registry-fe' from environment variables"
        );
    });

    function setupRegistryInitializerMock(
        createNpmrc: boolean = true,
        createGradleProperties: boolean = true
    ) {
        fs.mkdirSync(gradleHome, { recursive: true });

        if (createNpmrc) {
            fs.writeFileSync(npmrcPath, CPLACE_NPM);
        }

        if (createGradleProperties) {
            fs.writeFileSync(gradlePropertiesPath, gradleProperties);
        }

        jest.spyOn(os, 'homedir').mockReturnValueOnce(basePath);
        jest.spyOn(child_process, 'execSync').mockReturnValueOnce(
            Buffer.from('userconfig = "' + npmrcPath + '"')
        );

        let registryInitializer = new RegistryInitializer();
        const registryInitializerPrototype =
            Object.getPrototypeOf(registryInitializer);
        registryInitializerPrototype.npmrcPath = npmrcPath;
        registryInitializerPrototype.mainRepo = '';
        registryInitializerPrototype.npmRegistry = 'cplace-npm';
        return registryInitializerPrototype;
    }
});

describe('removeCplaceRegistryConfigurationBlock', () => {
    let tmpTestFolder: tmp.DirSyncObject;
    let npmrcPath: string;

    beforeEach(() => {
        tmpTestFolder = tmp.dirSync({ unsafeCleanup: true });
        npmrcPath = path.join(tmpTestFolder.name, '.npmrc');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetModules();
        tmpTestFolder.removeCallback();
    });

    function setupRegistryInitializerForBlockRemoval(npmrcContent: string) {
        fs.writeFileSync(npmrcPath, npmrcContent);

        let registryInitializer = new RegistryInitializer();
        const registryInitializerPrototype =
            Object.getPrototypeOf(registryInitializer);
        registryInitializerPrototype.npmrcPath = npmrcPath;
        registryInitializerPrototype.currentNpmrcConfig = npmrcContent;
        return registryInitializerPrototype;
    }

    test('removes a single cplace registry configuration block', () => {
        const npmrcContent =
            'some config\n' +
            '# start cplace registry configuration\n' +
            'registry=https://example.com\n' +
            '_auth=token\n' +
            '# end cplace registry configuration\n' +
            'other config\n';

        const registryInitializer = setupRegistryInitializerForBlockRemoval(npmrcContent);
        registryInitializer.removeCplaceRegistryConfigurationBlock();

        const result = fs.readFileSync(npmrcPath, 'utf-8');
        expect(result.trim()).toBe('some config\nother config');
        expect(result).not.toContain('start cplace registry configuration');
        expect(result).not.toContain('end cplace registry configuration');
        expect(result).not.toContain('registry=https://example.com');
    });

    test('removes multiple cplace registry configuration blocks', () => {
        const npmrcContent =
            'config before\n' +
            '# start cplace registry configuration\n' +
            'registry=https://example1.com\n' +
            '# end cplace registry configuration\n' +
            'config middle\n' +
            '# start cplace registry configuration\n' +
            'registry=https://example2.com\n' +
            '# end cplace registry configuration\n' +
            'config after\n';

        const registryInitializer = setupRegistryInitializerForBlockRemoval(npmrcContent);
        registryInitializer.removeCplaceRegistryConfigurationBlock();

        const result = fs.readFileSync(npmrcPath, 'utf-8');
        expect(result.trim()).toBe('config before\nconfig middle\nconfig after');
        expect(result).not.toContain('start cplace registry configuration');
        expect(result).not.toContain('end cplace registry configuration');
        expect(result).not.toContain('registry=https://example1.com');
        expect(result).not.toContain('registry=https://example2.com');
    });

    test('preserves other content when removing cplace blocks', () => {
        const npmrcContent =
            '# important config\n' +
            'registry=https://npm.example.com\n' +
            '# start cplace registry configuration\n' +
            'registry=https://cplace.example.com\n' +
            '# end cplace registry configuration\n' +
            '@scope:registry=https://scoped.example.com\n';

        const registryInitializer = setupRegistryInitializerForBlockRemoval(npmrcContent);
        registryInitializer.removeCplaceRegistryConfigurationBlock();

        const result = fs.readFileSync(npmrcPath, 'utf-8');
        expect(result).toContain('# important config');
        expect(result).toContain('registry=https://npm.example.com');
        expect(result).toContain('@scope:registry=https://scoped.example.com');
        expect(result).not.toContain('start cplace registry configuration');
        expect(result).not.toContain('cplace.example.com');
    });

    test('handles nested blocks correctly', () => {
        const npmrcContent =
            'config start\n' +
            '# start cplace registry configuration\n' +
            'outer line 1\n' +
            '# start cplace registry configuration\n' +
            'inner line\n' +
            '# end cplace registry configuration\n' +
            'outer line 2\n' +
            '# end cplace registry configuration\n' +
            'config end\n';

        const registryInitializer = setupRegistryInitializerForBlockRemoval(npmrcContent);
        registryInitializer.removeCplaceRegistryConfigurationBlock();

        const result = fs.readFileSync(npmrcPath, 'utf-8');
        expect(result.trim()).toBe('config start\nconfig end');
        expect(result).not.toContain('start cplace registry configuration');
        expect(result).not.toContain('end cplace registry configuration');
    });

    test('removes block without matching end line (removes until end of file)', () => {
        const npmrcContent =
            'config before\n' +
            '# start cplace registry configuration\n' +
            'registry=https://example.com\n' +
            'more config that should be removed\n';

        const registryInitializer = setupRegistryInitializerForBlockRemoval(npmrcContent);
        registryInitializer.removeCplaceRegistryConfigurationBlock();

        const result = fs.readFileSync(npmrcPath, 'utf-8');
        expect(result.trim()).toBe('config before');
        expect(result).not.toContain('start cplace registry configuration');
        expect(result).not.toContain('registry=https://example.com');
    });

    test('handles block without matching start line (orphaned end)', () => {
        const npmrcContent =
            'config before\n' +
            'registry=https://example.com\n' +
            '# end cplace registry configuration\n' +
            'config after\n';

        const registryInitializer = setupRegistryInitializerForBlockRemoval(npmrcContent);
        registryInitializer.removeCplaceRegistryConfigurationBlock();

        const result = fs.readFileSync(npmrcPath, 'utf-8');
        expect(result.trim()).toBe('config after');
        expect(result).not.toContain('config before');
        expect(result).not.toContain('registry=https://example.com');
    });

    test('does nothing when no cplace blocks exist', () => {
        const npmrcContent =
            'regular config\n' +
            'registry=https://example.com\n' +
            'another line';

        const registryInitializer = setupRegistryInitializerForBlockRemoval(npmrcContent);
        registryInitializer.removeCplaceRegistryConfigurationBlock();

        const result = fs.readFileSync(npmrcPath, 'utf-8');
        expect(result).toBe(npmrcContent);
    });

    test('handles empty file', () => {
        const npmrcContent = '';

        const registryInitializer = setupRegistryInitializerForBlockRemoval(npmrcContent);
        registryInitializer.removeCplaceRegistryConfigurationBlock();

        const result = fs.readFileSync(npmrcPath, 'utf-8');
        expect(result).toBe('');
    });
});
