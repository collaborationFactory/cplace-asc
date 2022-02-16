import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import { RegistryInitializer } from "../src/model/RegistryInitializer";
import { removeTestFolder } from "./Util";
import * as os from "os";

const basePath = path.join(process.cwd(), 'testsetup');
const gradleHome = path.join(basePath, RegistryInitializer.GRADLE_HOME);
const gradlePropertiesPath = path.join(gradleHome, RegistryInitializer.GRADLE_PROPERTIES);
const npmrcPath = path.join(basePath, '.npmrc');
const npmrcUser = 'max.mustermann@collaboration-factory.de';
const npmrcBasicAuthToken = 'bWF4Lm11c3Rlcm1hbm5AY29sbGFib3JhdGlvbi1mYWN0b3J5LmRlOnRva2Vu';

const gradleProperties='org.gradle.java.home=/Users/maxmustermann/.sdkman/candidates/java/xx.0.2-open\n' +
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


beforeEach(() => {
    removeTestFolder(basePath);
    fs.mkdirSync(path.join(basePath), {recursive: true});
});

afterAll(() => {
    removeTestFolder(basePath);
});

test('auth token can be extracted from gradle.properties', () => {
    const registryInitializerPrototype = setupRegistryInitializerMock();
    registryInitializerPrototype.extractTokenFromGradleProps();
    expect(registryInitializerPrototype.npmrcUser).toEqual(npmrcUser);
    expect(registryInitializerPrototype.npmrcBasicAuthToken).toEqual(npmrcBasicAuthToken);
});


test('cplace-asc can init credentials', () => {
    const registryInitializerPrototype = setupRegistryInitializerMock();
    fs.writeFileSync(npmrcPath, npmrc_not_configured);
    registryInitializerPrototype.initRegistry();
    const npmrcContent = fs.readFileSync(npmrcPath).toString();
    expect(npmrcContent).toContain(npmrc_not_configured);
    expect(npmrcContent).toContain(npmrcConfigured_new_registry);
    expect( (npmrcContent.match(/cplace.jfrog.io/g) || []).length).toBe(4);
});

test('cplace-asc can update old registry url', () => {
    const registryInitializerPrototype = setupRegistryInitializerMock();
    fs.writeFileSync(npmrcPath, npmrcConfigured_old_registry);
    registryInitializerPrototype.initRegistry();
    const npmrcContent = fs.readFileSync(npmrcPath).toString();
    expect(npmrcContent).toContain(npmrcConfigured_new_registry);
    expect( (npmrcContent.match(/cplace.jfrog.io/g) || []).length).toBe(4);
});

test('cplace-asc can update outdated auth token', () => {
    const registryInitializerPrototype = setupRegistryInitializerMock();
    fs.writeFileSync(npmrcPath, npmrcConfigured_outdated_token);
    registryInitializerPrototype.initRegistry();
    const npmrcContent = fs.readFileSync(npmrcPath).toString();
    expect(npmrcContent).toContain(npmrcConfigured_new_registry);
    expect( (npmrcContent.match(/cplace.jfrog.io/g) || []).length).toBe(4);
});

function setupRegistryInitializerMock() {
    fs.mkdirSync(gradleHome, {recursive: true});
    fs.writeFileSync(gradlePropertiesPath, gradleProperties);
    jest.spyOn(os, "homedir").mockReturnValueOnce(basePath);

    jest.spyOn(child_process, "execSync").mockReturnValueOnce(Buffer.from('userconfig = \"' + npmrcPath + '\"'))

    let registryInitializer = new RegistryInitializer();
    const registryInitializerPrototype = Object.getPrototypeOf(registryInitializer);
    registryInitializerPrototype.npmrcPath = npmrcPath;
    registryInitializerPrototype.mainRepo = '';
    return registryInitializerPrototype;
}

