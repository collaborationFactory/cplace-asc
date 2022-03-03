import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";
import * as child_process from "child_process";
import {RegistryInitializer} from "../src/model/RegistryInitializer";
import * as os from "os";
import {cred} from "../src/utils";

describe('configuring jfrog credentials', () => {

    const npmrcUser = 'max.mustermann@collaboration-factory.de';
    const npmrcBasicAuthToken = 'bWF4Lm11c3Rlcm1hbm5AY29sbGFib3JhdGlvbi1mYWN0b3J5LmRlOnRva2Vu';

    const gradleProperties = 'org.gradle.java.home=/Users/maxmustermann/.sdkman/candidates/java/xx.0.2-open\n' +
        'repo.cplace.apiTokenUser=max.mustermann@collaboration-factory.de\n' +
        'repo.cplace.apiToken=token\n' +
        'org.gradle.jvmargs=-Xmx4192m\n';

    const npmrc_not_configured = '# configure auth token\n' +
        '@fontawesome:registry=https://npm.fontawesome.com/\n' +
        '//npm.fontawesome.com/:_authToken=$AUTH_TOKEN\n' +
        '\n' +
        '#Default registry\n' +
        'registry=https://registry.npmjs.org/\n' +
        '#scoped registry\n' +
        '@cloudhadoop:registry=http://npm.cloudhadoop.com\n' +
        '\n' +
        ';log level settigns\n' +
        'loglevel=warn'

    const npmrcConfigured_old_registry = '@cplace-next:registry=https://cplace.jfrog.io/artifactory/api/npm/cplace-npm-local/\n' +
        '//cplace.jfrog.io/artifactory/api/npm/cplace-npm-local/:_auth=bWF4Lm11c3Rlcm1hbm5AY29sbGFib3JhdGlvbi1mYWN0b3J5LmRlOnRva2Vu\n' +
        '//cplace.jfrog.io/artifactory/api/npm/cplace-npm-local/:always-auth=true\n' +
        '//cplace.jfrog.io/artifactory/api/npm/cplace-npm-local/:email=max.mustermann@collaboration-factory.de\n'

    const npmrcConfigured_outdated_token = '@cplace-next:registry=https://cplace.jfrog.io/artifactory/api/npm/cplace-npm-local/\n' +
        '//cplace.jfrog.io/artifactory/api/npm/cplace-npm-local/:_auth=outdatedtoken\n' +
        '//cplace.jfrog.io/artifactory/api/npm/cplace-npm-local/:always-auth=true\n' +
        '//cplace.jfrog.io/artifactory/api/npm/cplace-npm-local/:email=max.mustermann@collaboration-factory.de\n'

    const npmrcConfigured_new_registry = '@cplace-next:registry=https://cplace.jfrog.io/artifactory/api/npm/cplace-npm/\n' +
        '//cplace.jfrog.io/artifactory/api/npm/cplace-npm/:_auth=bWF4Lm11c3Rlcm1hbm5AY29sbGFib3JhdGlvbi1mYWN0b3J5LmRlOnRva2Vu\n' +
        '//cplace.jfrog.io/artifactory/api/npm/cplace-npm/:always-auth=true\n' +
        '//cplace.jfrog.io/artifactory/api/npm/cplace-npm/:email=max.mustermann@collaboration-factory.de'

    let tmpTestFolder: tmp.DirSyncObject;
    let basePath: string;
    let gradleHome: string;
    let gradlePropertiesPath: string;
    let npmrcPath: string;

    beforeEach(() => {
        tmpTestFolder = tmp.dirSync({unsafeCleanup: true});
        console.log('Test data will be below: ', tmpTestFolder.name);
        basePath = tmpTestFolder.name;
        gradleHome = path.join(basePath, RegistryInitializer.GRADLE_HOME);
        gradlePropertiesPath = path.join(gradleHome, RegistryInitializer.GRADLE_PROPERTIES);
        npmrcPath = path.join(basePath, '.npmrc');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetModules();
        tmpTestFolder.removeCallback();
    });

    test('create .npmrc in case it does not exist', () => {
        const registryInitializerPrototype = setupRegistryInitializerMock(false);

        registryInitializerPrototype.initRegistry();

        const npmrcContent = fs.readFileSync(npmrcPath).toString();
        expect(npmrcContent).toContain(npmrcConfigured_new_registry);
    });

    test('auth token can be extracted from gradle.properties', () => {
        const registryInitializerPrototype = setupRegistryInitializerMock();
        jest.spyOn(console, 'info').mockImplementation()

        registryInitializerPrototype.extractTokenFromGradleProps();

        expect(registryInitializerPrototype.npmrcUser).toEqual(npmrcUser);
        expect(registryInitializerPrototype.npmrcBasicAuthToken).toEqual(npmrcBasicAuthToken);
        expect(console.info).toBeCalledTimes(1)
        expect(console.info).toHaveBeenLastCalledWith('⟲ Configuring npm jfrog registry via the gradle properties')
    });

    test('cplace-asc can init credentials', () => {
        const registryInitializerPrototype = setupRegistryInitializerMock();
        fs.writeFileSync(npmrcPath, npmrc_not_configured);

        registryInitializerPrototype.initRegistry();

        const npmrcContent = fs.readFileSync(npmrcPath).toString();

        expect(npmrcContent).toContain(npmrc_not_configured);
        expect(npmrcContent).toContain(npmrcConfigured_new_registry);
        expect((npmrcContent.match(/cplace.jfrog.io/g) || []).length).toBe(4);
    });

    test('cplace-asc can update old registry url', () => {
        const registryInitializerPrototype = setupRegistryInitializerMock();
        fs.writeFileSync(npmrcPath, npmrcConfigured_old_registry);
        registryInitializerPrototype.initRegistry();
        const npmrcContent = fs.readFileSync(npmrcPath).toString();
        expect(npmrcContent).toContain(npmrcConfigured_new_registry);
        expect((npmrcContent.match(/cplace.jfrog.io/g) || []).length).toBe(4);
    });

    test('cplace-asc can update outdated auth token', () => {
        const registryInitializerPrototype = setupRegistryInitializerMock();
        fs.writeFileSync(npmrcPath, npmrcConfigured_outdated_token);
        registryInitializerPrototype.initRegistry();
        const npmrcContent = fs.readFileSync(npmrcPath).toString();
        expect(npmrcContent).toContain(npmrcConfigured_new_registry);
        expect((npmrcContent.match(/cplace.jfrog.io/g) || []).length).toBe(4);
    });

    test('cplace-asc does not exit if gradle home exists without gradle properties', () => {
        const registryInitializerPrototype = setupRegistryInitializerMock(false, false);
        jest.spyOn(console, 'error').mockImplementation()

        registryInitializerPrototype.initRegistry();
        expect(console.error).toBeCalledTimes(1)
        expect(console.error).toHaveBeenLastCalledWith(cred`✗`, `gradle.properties at location ${gradlePropertiesPath} do not exist!`, 'You can ignore this for cplace versions before 5.16.')
    });

    test('auth token can be extracted from the environment', () => {
        process.env.ENV_CPLACE_ARTIFACTORY_ACTOR = "mathilde.musterfrau@cplace.de"
        process.env.ENV_CPLACE_ARTIFACTORY_TOKEN = "token"

        const registryInitializerPrototype = setupRegistryInitializerMock();
        jest.spyOn(console, 'info').mockImplementation()

        registryInitializerPrototype.extractTokenFromEnvironment();

        expect(registryInitializerPrototype.npmrcUser).toEqual("mathilde.musterfrau@cplace.de");
        expect(registryInitializerPrototype.npmrcBasicAuthToken).toEqual("bWF0aGlsZGUubXVzdGVyZnJhdUBjcGxhY2UuZGU6dG9rZW4=");
        expect(console.info).toBeCalledTimes(1)
        expect(console.info).toHaveBeenLastCalledWith('⟲ Configuring npm jfrog registry via environment variables')
    });

    function setupRegistryInitializerMock(createNpmrc: boolean = true, createGradleProperties: boolean = true) {
        fs.mkdirSync(gradleHome, {recursive: true});

        if (createNpmrc) {
            fs.writeFileSync(npmrcPath, npmrcConfigured_new_registry);
        }

        if (createGradleProperties) {
            fs.writeFileSync(gradlePropertiesPath, gradleProperties);
        }

        jest.spyOn(os, "homedir").mockReturnValueOnce(basePath);
        jest.spyOn(child_process, "execSync").mockReturnValueOnce(Buffer.from('userconfig = \"' + npmrcPath + '\"'))

        let registryInitializer = new RegistryInitializer();
        const registryInitializerPrototype = Object.getPrototypeOf(registryInitializer);
        registryInitializerPrototype.npmrcPath = npmrcPath;
        registryInitializerPrototype.mainRepo = '';
        return registryInitializerPrototype;
    }

});
