import { execSync } from 'child_process';
import * as path from 'path';
import { cgreen, cred, debug } from '../utils';
import * as fs from 'fs';
import * as os from 'os';

export class RegistryInitializer {
    public static readonly JROG_CPLACE_NPM_REGISTRY = 'cplace-npm';
    public static readonly JROG_CPLACE_ASSETS_NPM_REGISTRY = 'cplace-assets-npm';
    public static readonly JROG_REGISTRY_URL = '//cplace.jfrog.io/artifactory/api/npm/';
    public static readonly GRADLE_HOME = '.gradle'
    public static readonly GRADLE_PROPERTIES = 'gradle.properties'


    private currentNpmrcConfig: string = '';
    private npmrcUser: string = '';
    private npmrcBasicAuthToken: string = '';
    private npmrcPath: string = '';

    constructor() {}

    public initRegistry(): void {
        console.info('⟲ Initialising cplace jfrog registry for NPM');

        try {
            this.getNpmrcPath();

            if (!this.extractTokenFromEnvironment()) {
                this.extractTokenFromGradleProps();
            }

            this.initOrUpdateJfrogCredentials(
                '@cplace-next',
                `${RegistryInitializer.JROG_REGISTRY_URL}`,
                'cplace-npm-local',
                RegistryInitializer.JROG_CPLACE_NPM_REGISTRY);
            this.initOrUpdateJfrogCredentials(
                '@cplace-3rdparty-modified',
                `${RegistryInitializer.JROG_REGISTRY_URL}`,
                RegistryInitializer.JROG_CPLACE_ASSETS_NPM_REGISTRY,
                RegistryInitializer.JROG_CPLACE_ASSETS_NPM_REGISTRY);
        } catch (e) {
            console.error(
                cred`✗`,
                e.message,
                'You can ignore this for cplace versions before 5.16.'
            );
        }
    }

    private extractTokenFromEnvironment(): boolean {
        if (
            process.env.ENV_CPLACE_ARTIFACTORY_ACTOR &&
            process.env.ENV_CPLACE_ARTIFACTORY_TOKEN
        ) {
            console.info(
                '⟲ Configuring npm jfrog registry via environment variables'
            );
            this.npmrcBasicAuthToken = Buffer.from(
                `${process.env.ENV_CPLACE_ARTIFACTORY_ACTOR}:${process.env.ENV_CPLACE_ARTIFACTORY_TOKEN}`
            ).toString('base64');
            this.npmrcUser = process.env.ENV_CPLACE_ARTIFACTORY_ACTOR;

            return true;
        }
        return false;
    }

    private extractTokenFromGradleProps() {
        console.info(
            '⟲ Configuring npm jfrog registry via the gradle properties'
        );
        const gradleProps = this.getGradlePropsPath();

        const token: string | undefined = (gradleProps.match(
            /repo\.cplace\.apiToken *= *([a-z0-9]+)/gi
        ) || [])[0];
        const user: string | undefined = (gradleProps.match(
            /repo\.cplace\.apiTokenUser *= *([a-z0-9@\-_\.]+)/gi
        ) || [])[0];
        if (token && user) {
            const cleanToken: string = token.replace(
                /repo\.cplace\.apiToken *= */,
                ''
            );
            this.npmrcUser = user.replace(
                /repo\.cplace\.apiTokenUser *= */,
                ''
            );
            this.npmrcBasicAuthToken = Buffer.from(
                `${this.npmrcUser}:${cleanToken}`
            ).toString('base64');
        } else {
            throw Error(
                'jfrog credentials for Gradle not found or configured correctly. See the KnowledgeBase for help:\nhttps://docs.cplace.io/dev-docs/cplace-architecture/platform-component/build-system/java-artifact-based-builds/#creating-an-api-token-on-cplacejfrogio'
            );
        }
    }

    private getGradlePropsPath(): string {
        const gradleHome = RegistryInitializer.getGradleHome();
        debug(`.gradle location: ${gradleHome}`);
        if (!fs.existsSync(gradleHome)) {
            throw Error(
                `.gradle at location ${gradleHome} does not exist. Please use the default (${os.homedir()}/${
                    RegistryInitializer.GRADLE_HOME
                }) or properly configure the environment variable GRADLE_USER_HOME.`
            );
        }
        const gradleProperties = path.join(
            gradleHome,
            RegistryInitializer.GRADLE_PROPERTIES
        );

        debug(`gradle.properties location: ${gradleProperties}`);
        if (!fs.existsSync(gradleProperties)) {
            throw Error(
                `gradle.properties at location ${gradleProperties} do not exist!`
            );
        }
        return fs.readFileSync(gradleProperties).toString();
    }

    private static getGradleHome(): string {
        if (process.env.GRADLE_USER_HOME) {
            return process.env.GRADLE_USER_HOME;
        }
        return path.join(os.homedir(), RegistryInitializer.GRADLE_HOME);
    }

    private getNpmrcPath() {
        const npmConfig: string = execSync('npm config ls -l').toString();
        console.debug('Found user config', npmConfig);

        const npmrcPath: string | undefined = (npmConfig.match(
            /userconfig *= *".*"/gi
        ) || [])[0];
        if (!npmrcPath) {
            throw Error('No userconfig found in npm config');
        }
        const cleanNpmrcPath: string = npmrcPath
            .replace(/^userconfig *= */, '')
            .replace(/"/gi, '')
            .replace(/\\\\/g, '\\');
        if (!cleanNpmrcPath) {
            throw Error(
                'Userconfig was found in npmrc but path can not be extracted'
            );
        }
        this.npmrcPath = cleanNpmrcPath;
    }

    private initOrUpdateJfrogCredentials(scope: string, registryUrl: string, oldRegistryName: string, newRegistryName: string) {
        if (
            !(
                this.npmrcUser &&
                this.npmrcBasicAuthToken &&
                this.npmrcUser.length > 0 &&
                this.npmrcBasicAuthToken.length > 0
            )
        ) {
            throw Error('No jfrog credentials found.');
        }

        RegistryInitializer.createNmprcIfNotExistent(this.npmrcPath);
        this.currentNpmrcConfig = fs
            .readFileSync(this.npmrcPath, { encoding: 'utf-8' })
            .toString();
        if (!!this.hasJfrogCredentials(scope, registryUrl, oldRegistryName) && !this.hasJfrogCredentials(scope, registryUrl, newRegistryName)) {
            this.appendToExistingNpmrc();
        } else if (!this.hasLatestJfrogCredentials(registryUrl)) {
            this.updateNPMRC();
        }
    }

    private static createNmprcIfNotExistent(npmrcPath: string) {
        debug(`Checking for npmrc at ${npmrcPath}`);
        if (!fs.existsSync(npmrcPath)) {
            fs.writeFileSync(npmrcPath, '');
            console.info(
                cgreen`✓`,
                `Created empty .npmrc at location ${npmrcPath}`
            );
        }
    }

    private hasJfrogCredentials(scope: string, registryUrl: string, registryName: string): boolean {
        return this.currentNpmrcConfig.includes(
            `${scope}:registry=https:${registryUrl}${registryName}/`
        );
    }

    private hasLatestJfrogCredentials(registryUrl: string): boolean {
        return (
            this.currentNpmrcConfig.includes(
                registryUrl
            ) &&
            this.currentNpmrcConfig.includes(this.npmrcBasicAuthToken) &&
            this.currentNpmrcConfig.includes(this.npmrcUser)
        );
    }

    private appendToExistingNpmrc(scope: string, registryUrl: string, registryName: string) {
        console.info('⟲ Append config to existing config at: ', this.npmrcPath);

        const fullRegistryPath = `${registryUrl}${registryName}/`;
        let npmrc = `\n${scope}:registry=https:${fullRegistryPath}\n`;
        npmrc =
            npmrc +
            `${fullRegistryPath}:_auth=${this.npmrcBasicAuthToken}\n`;
        npmrc =
            npmrc +
            `${fullRegistryPath}:always-auth=true\n`;
        npmrc =
            npmrc +
            `${fullRegistryPath}:email=${this.npmrcUser}\n`;
        fs.appendFileSync(this.npmrcPath, npmrc, { encoding: 'utf-8' });
        console.log(
            cgreen`✓`,
            'Appended config to existing config at: ',
            this.npmrcPath
        );
    }

    private updateNPMRC(registryUrl: string, oldRegistryName: string, newRegistryName: string) {
        console.info('⟲ Updating npm config at: ', this.npmrcPath);
        this.currentNpmrcConfig = this.currentNpmrcConfig.replace(
            new RegExp(oldRegistryName, 'g'),
            newRegistryName
        );

        const fullRegistryPath = `${registryUrl}${newRegistryName}/`
        const authRegex = new RegExp(fullRegistryPath.replace(/\./g, '\\.') + ':_auth *= *.*', 'i');
        this.currentNpmrcConfig = this.currentNpmrcConfig.replace(
            authRegex,
            `${fullRegistryPath}:_auth=${this.npmrcBasicAuthToken}`
        );
        this.currentNpmrcConfig = this.currentNpmrcConfig.replace(
            /^\/\/cplace.jfrog.io\/artifactory\/api\/npm\/cplace-npm\/:email *= *.*$/i,
            `${RegistryInitializer.JROG_REGISTRY_URL}:email=${this.npmrcUser}`
        );
        const userRegex = new RegExp(fullRegistryPath.replace(/\./g, '\\.') + ':email *= *.*', 'i');
        this.currentNpmrcConfig = this.currentNpmrcConfig.replace(
            userRegex,
            `${fullRegistryPath}:email=${this.npmrcUser}`
        );

        console.log(cgreen`✓`, 'Updated config at: ', this.npmrcPath);
        fs.writeFileSync(this.npmrcPath, this.currentNpmrcConfig, {
            encoding: 'utf-8',
        });
    }
}
