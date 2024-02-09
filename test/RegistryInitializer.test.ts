import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import * as child_process from 'child_process';
import { RegistryInitializer } from '../src/model/RegistryInitializer';
import * as os from 'os';
import { cred } from '../src/utils';
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
            cred`✗`,
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
