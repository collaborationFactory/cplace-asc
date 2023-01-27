import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import * as child_process from 'child_process';
import { cred } from '../src/utils';
import { NPMResolver } from '../src/model/NPMResolver';
import { getTestRegistryCredentials } from './shared';

describe('resolve npm credentials', () => {
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

    let tmpTestFolder: tmp.DirSyncObject;
    let basePath: string;
    let npmrcPath: string;

    beforeEach(() => {
        tmpTestFolder = tmp.dirSync({ unsafeCleanup: true });
        console.log('Test data will be below: ', tmpTestFolder.name);
        basePath = tmpTestFolder.name;
        npmrcPath = path.join(basePath, '.npmrc');
    });

    afterEach(() => {
        tmpTestFolder.removeCallback();
    });

    test('no userconfig in npm config', () => {
        const checkAndInstall = jest.spyOn(
            NPMResolver.prototype as any,
            'checkAndInstall'
        );
        checkAndInstall.mockImplementation(() => {});
        console.error = jest.fn();

        jest.spyOn(child_process, 'execSync').mockReturnValueOnce(
            Buffer.from('no user configured')
        );
        const resolver = new NPMResolver('', false);
        return resolver.resolve().then(() => {
            expect(console.error).toHaveBeenCalledWith(
                cred`✗`,
                'No userconfig found in npm config',
                'You can ignore this for cplace versions before 5.16.'
            );
        });
    });

    test('cplace-asc can initialize jfrog credentials in circleci env', () => {
        process.env.ENV_CPLACE_ARTIFACTORY_ACTOR = 'actor@circleci.com';
        process.env.ENV_CPLACE_ARTIFACTORY_TOKEN = 'token';
        const resolver = setupNPMResolverMock();
        fs.writeFileSync(npmrcPath, npmrc_not_configured);
        resolver.resolve();
        const npmrcContent = fs.readFileSync(npmrcPath).toString();
        const token = Buffer.from(
            `${process.env.ENV_CPLACE_ARTIFACTORY_ACTOR}:${process.env.ENV_CPLACE_ARTIFACTORY_TOKEN}`
        ).toString('base64');
        expect(npmrcContent).toContain(
            getTestRegistryCredentials(
                '',
                'cplace-npm',
                token,
                process.env.ENV_CPLACE_ARTIFACTORY_ACTOR
            )
        );
        expect((npmrcContent.match(/cplace.jfrog.io/g) || []).length).toBe(4);
    });

    function setupNPMResolverMock() {
        const checkAndInstall = jest.spyOn(
            NPMResolver.prototype as any,
            'checkAndInstall'
        );
        checkAndInstall.mockImplementation(() => {});
        jest.spyOn(child_process, 'execSync').mockReturnValueOnce(
            Buffer.from('userconfig = "' + npmrcPath + '"')
        );
        return new NPMResolver('', false);
    }
});
