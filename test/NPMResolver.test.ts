import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import { cred } from "../src/utils";
import { NPMResolver } from "../src/model/NPMResolver";
import { removeTestFolder } from "./Util";

const basePath = path.join(process.cwd(), 'testsetup');
const npmrcPath = path.join(basePath, '.npmrc');
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


beforeEach(() => {
    removeTestFolder(basePath);
    fs.mkdirSync(path.join(basePath), {recursive: true});
});

afterAll(() => {
    removeTestFolder(basePath);
});

test('no userconfig in npm config', () => {
    const checkAndInstall = jest.spyOn(NPMResolver.prototype as any, 'checkAndInstall');
    checkAndInstall.mockImplementation(() => {
    });
    console.error = jest.fn();

    jest.spyOn(child_process, "execSync").mockReturnValueOnce(Buffer.from("no user configured"));
    const resolver = new NPMResolver("", false);
    return resolver.resolve().then(() => {
        expect(console.error).toHaveBeenCalledWith(cred`✗`, 'No userconfig found in npm config');
    });
});

test('cplace-asc can initialize jfrog credentials in circleci env', () => {
    process.env.ENV_CPLACE_ARTIFACTORY_ACTOR = 'actor@circleci.com';
    process.env.ENV_CPLACE_ARTIFACTORY_TOKEN = 'token';
    const resolver = setupNPMResolverMock();
    fs.writeFileSync(npmrcPath, npmrc_not_configured);
    resolver.resolve();
    const npmrcContent = fs.readFileSync(npmrcPath).toString();
    expect(npmrcContent).toContain('@cplace-next:registry=https://cplace.jfrog.io/artifactory/api/npm/cplace-npm/\n' +
        '//cplace.jfrog.io/artifactory/api/npm/cplace-npm/:_auth=YWN0b3JAY2lyY2xlY2kuY29tOnRva2Vu\n' +
        '//cplace.jfrog.io/artifactory/api/npm/cplace-npm/:always-auth=true\n' +
        '//cplace.jfrog.io/artifactory/api/npm/cplace-npm/:email=actor@circleci.com\n');
    expect( (npmrcContent.match(/cplace.jfrog.io/g) || []).length).toBe(4);
});

function setupNPMResolverMock() {
    const checkAndInstall = jest.spyOn(NPMResolver.prototype as any, 'checkAndInstall');
    checkAndInstall.mockImplementation(() => {
    });
    jest.spyOn(child_process, "execSync").mockReturnValueOnce(Buffer.from('userconfig = \"' + npmrcPath + '\"'));
    return new NPMResolver("", false);
}
