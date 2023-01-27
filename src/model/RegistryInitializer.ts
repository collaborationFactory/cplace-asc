import { execSync } from 'child_process';
import * as path from 'path';
import { cgreen, cred, debug } from '../utils';
import * as fs from 'fs';
import * as os from 'os';
import { existsSync } from 'fs';

export class RegistryInitializer {
    public static readonly JROG_CPLACE_NPM_REGISTRY = 'cplace-npm';
    public static readonly JROG_CPLACE_NPM_LOCAL_REGISTRY = 'cplace-npm-local';
    public static readonly JROG_CPLACE_ASSETS_NPM_REGISTRY =
        'cplace-assets-npm';
    public static readonly JROG_REGISTRY_URL =
        '//cplace.jfrog.io/artifactory/api/npm/';
    public static readonly PUBLIC_NPM_REGISTRY = 'registry.npmjs.org';
    public static readonly GRADLE_HOME = '.gradle';
    public static readonly GRADLE_PROPERTIES = 'gradle.properties';

    private static readonly REGISTRY_LIST = [
        RegistryInitializer.JROG_CPLACE_NPM_REGISTRY,
        RegistryInitializer.JROG_CPLACE_NPM_LOCAL_REGISTRY,
        RegistryInitializer.JROG_CPLACE_ASSETS_NPM_REGISTRY,
        RegistryInitializer.PUBLIC_NPM_REGISTRY,
    ];

    private currentNpmrcConfig: string = '';
    private npmrcUser: string = '';
    private npmrcBasicAuthToken: string = '';
    private npmrcPath: string = '';

    constructor() {}

    public initRegistry(): void {
        console.info('⟲ Initialising cplace jfrog registry for NPM');

        try {
            this.setNpmrcPath();

            if (!this.extractTokenFromEnvironment()) {
                this.extractTokenFromGradleProps();
            }

            if (!existsSync(this.npmrcPath)) {
                RegistryInitializer.createEmptyNmprc(this.npmrcPath);
            }

            this.setCurrentNpmrcConfig();
            this.removeAllRegistryCredentials();
            this.addDefaultRegistryCredentialsToNpmrc();
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

    private static getGradlePropsPath(): string {
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

    private static createEmptyNmprc(npmrcPath: string) {
        fs.writeFileSync(npmrcPath, '');
        console.info(
            cgreen`✓`,
            `Created empty .npmrc at location ${npmrcPath}`
        );
    }

    private setCurrentNpmrcConfig() {
        this.currentNpmrcConfig = fs
            .readFileSync(this.npmrcPath, { encoding: 'utf-8' })
            .toString();
    }

    private setNpmrcPath() {
        const npmConfig: string = execSync('npm config ls -l').toString();
        debug(`Found user config ${npmConfig}`);

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

    private removeAllRegistryCredentials() {
        debug(`Cleaning registries jFrog credentials`);
        if (!this.currentNpmrcConfig) {
            return;
        }

        RegistryInitializer.REGISTRY_LIST.forEach((registry) => {
            this.removeSingleRegistryCredentials(registry);
        });
    }

    private removeSingleRegistryCredentials(registry: string): void {
        debug(`Cleaning ${registry} registry jFrog credentials`);
        const linesToRemove = this.currentNpmrcConfig
            .split('\n')
            .filter((configLine) => configLine.includes(registry));
        fs.writeFileSync(
            this.npmrcPath,
            this.getCleanedNpmrcConfig(linesToRemove),
            {
                encoding: 'utf-8',
            }
        );
        this.setCurrentNpmrcConfig();
    }

    private getCleanedNpmrcConfig(linesToRemove: string[]): string {
        let currentNpmrcConfigLines = this.currentNpmrcConfig.split('\n');
        const indexesToRemove: number[] = [];
        currentNpmrcConfigLines.forEach((line) => {
            if (linesToRemove.includes(line) || !line) {
                const index = currentNpmrcConfigLines.indexOf(line);
                if (index !== undefined || !line) {
                    indexesToRemove.push(index);
                }
            }
        });
        currentNpmrcConfigLines = currentNpmrcConfigLines.filter(
            (line, lineIndex) =>
                !indexesToRemove.some((index) => lineIndex === index)
        );
        return currentNpmrcConfigLines.join('\n');
    }

    private getFullRegistryPath(registryUrl: string, registryName: string) {
        return `${registryUrl}${registryName}/`;
    }

    private getRegistryInfo(registryUrl: string, registryName: string) {
        return `registry=https:${this.getFullRegistryPath(
            registryUrl,
            registryName
        )}`;
    }

    private getAuthInfo(registryUrl: string, registryName: string): string {
        return `${this.getFullRegistryPath(registryUrl, registryName)}:_auth=${
            this.npmrcBasicAuthToken
        }`;
    }

    private getAlwaysAuthInfo(
        registryUrl: string,
        registryName: string
    ): string {
        return `${this.getFullRegistryPath(
            registryUrl,
            registryName
        )}:always-auth=true`;
    }

    private getEmailInfo(registryUrl: string, registryName: string): string {
        return `${this.getFullRegistryPath(registryUrl, registryName)}:email=${
            this.npmrcUser
        }`;
    }

    private extractTokenFromGradleProps() {
        console.info(
            '⟲ Configuring npm jfrog registry via the gradle properties'
        );
        const gradleProps = RegistryInitializer.getGradlePropsPath();

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

    private getDefaultRegistryConfigItems(): string[] {
        return [
            this.getRegistryInfo(
                RegistryInitializer.JROG_REGISTRY_URL,
                RegistryInitializer.JROG_CPLACE_NPM_REGISTRY
            ),
            this.getAuthInfo(
                RegistryInitializer.JROG_REGISTRY_URL,
                RegistryInitializer.JROG_CPLACE_NPM_REGISTRY
            ),
            this.getAlwaysAuthInfo(
                RegistryInitializer.JROG_REGISTRY_URL,
                RegistryInitializer.JROG_CPLACE_NPM_REGISTRY
            ),
            this.getEmailInfo(
                RegistryInitializer.JROG_REGISTRY_URL,
                RegistryInitializer.JROG_CPLACE_NPM_REGISTRY
            ),
        ];
    }

    private addDefaultRegistryCredentialsToNpmrc() {
        const defaultRegistryConfigurationItems =
            this.getDefaultRegistryConfigItems();
        let npmrc = this.currentNpmrcConfig
            .concat(`\n${defaultRegistryConfigurationItems[0]}\n`)
            .concat(`${defaultRegistryConfigurationItems[1]}\n`)
            .concat(`${defaultRegistryConfigurationItems[2]}\n`)
            .concat(`${defaultRegistryConfigurationItems[3]}\n`);
        fs.writeFileSync(this.npmrcPath, npmrc, { encoding: 'utf-8' });
        console.log('*****************************************');
        console.log(npmrc);
        console.log(cgreen`✓`, 'Updated config in: ', this.npmrcPath);
    }
}
