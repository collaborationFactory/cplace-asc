import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { existsSync } from 'fs';
import { RegistryResolver } from './RegistryResolver';

export class RegistryInitializer {
    public static readonly JFROG_CPLACE_NPM_REGISTRY = 'cplace-npm';
    public static readonly JFROG_CPLACE_NPM_LOCAL_REGISTRY = 'cplace-npm-local';
    public static readonly JFROG_CPLACE_ASSETS_NPM_REGISTRY =
        'cplace-assets-npm';
    public static readonly JFROG_API_URL =
        'https://cplace.jfrog.io/artifactory/api/';
    public static readonly JFROG_REGISTRY_URL =
        `//cplace.jfrog.io/artifactory/api/npm/`;
    public static readonly PUBLIC_NPM_REGISTRY = 'registry.npmjs.org';
    public static readonly GRADLE_HOME = '.gradle';
    public static readonly GRADLE_PROPERTIES = 'gradle.properties';

    private static readonly REGISTRY_LIST = [
        RegistryInitializer.JFROG_CPLACE_NPM_REGISTRY,
        RegistryInitializer.JFROG_CPLACE_NPM_LOCAL_REGISTRY,
        RegistryInitializer.JFROG_CPLACE_ASSETS_NPM_REGISTRY,
        RegistryInitializer.PUBLIC_NPM_REGISTRY,
    ];

    private currentNpmrcConfig: string = '';
    private npmrcUser: string = '';
    private npmrcBasicAuthToken: string = '';
    private npmrcPath: string = '';
    private npmRegistry: string = RegistryInitializer.JFROG_CPLACE_NPM_REGISTRY;
    private DEBUG_ENABLED: boolean = false;

    private managedScopes: string[] = ["@fortawesome"];

    private registryResolver: RegistryResolver = new RegistryResolver(
        RegistryInitializer.JFROG_API_URL
    );

    constructor() {}

    private debug(content: any): void {
        if (this.DEBUG_ENABLED) {
            if (typeof content === 'string') {
                console.debug(`\x1b[37m✹ ${content}\x1b[0m`);
            } else {
                console.debug(content);
            }
        }
    }

    public enableDebug(debugEnabled = true): void {
        this.DEBUG_ENABLED = debugEnabled;
    }

    public async initRegistry(destination?: string, scoped?: boolean): Promise<void> {
        console.info('⟲ Initialising cplace jfrog registry for NPM');

        try {
            this.setNpmrcPath(destination);

            if (!this.extractTokenFromEnvironment()) {
                this.extractTokenFromGradleProps();
            }
            this.extractNpmRegistryFromEnvironment();

            if (scoped) {
                console.info('⟲ Using scoped registry configuration');
                const localRegistries = await this.registryResolver.getAllLocalNpmRegistries(this.npmrcBasicAuthToken);
                const fetchedScopes = await this.registryResolver.getManagedScopes(localRegistries, this.npmrcBasicAuthToken);
                this.managedScopes.push(...Array.from(fetchedScopes));
                console.info(`⟲ Found managed scopes: ${this.managedScopes.join(', ')}`);
            }

            if (!existsSync(this.npmrcPath)) {
                RegistryInitializer.createEmptyNmprc(this.npmrcPath);
            }

            this.setCurrentNpmrcConfig();
            this.removeAllRegistryCredentials();
            this.addDefaultRegistryCredentialsToNpmrc(scoped);
        } catch (e: any) {
            console.error(
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

    private extractNpmRegistryFromEnvironment(): void {
        if (process.env.ENV_PRIVATE_NPM_REGISTRY) {
            this.npmRegistry = process.env.ENV_PRIVATE_NPM_REGISTRY;
            console.info(
                `⟲ Using private npm jfrog registry '${this.npmRegistry}' from environment variables`
            );
        } else {
            console.info(
                `⟲ Using default npm jfrog registry '${this.npmRegistry}'`
            );
        }
    }

    private getGradlePropsPath(): string {
        const gradleHome = RegistryInitializer.getGradleHome();
        this.debug(`.gradle location: ${gradleHome}`);
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

        this.debug(`gradle.properties location: ${gradleProperties}`);
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
        console.info(`Created empty .npmrc at location ${npmrcPath}`);
    }

    private setCurrentNpmrcConfig() {
        this.currentNpmrcConfig = fs
            .readFileSync(this.npmrcPath, { encoding: 'utf-8' })
            .toString();
    }

    private setNpmrcPath(destination?: string) {
        if (destination) {
            const resolvedPath = path.resolve(destination);

            // Check if destination is a directory
            if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
                this.npmrcPath = path.join(resolvedPath, '.npmrc');
                this.debug(`Destination is a directory, using: ${this.npmrcPath}`);
            } else {
                throw Error('Error: --destination must be a valid directory path');
            }
            return;
        }

        const npmConfig: string = execSync('npm config ls -l').toString();
        this.debug(`Found user config ${npmConfig}`);

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
        this.debug(`Cleaning registries jFrog credentials`);
        if (!this.currentNpmrcConfig) {
            return;
        }

        this.removeCplaceRegistryConfigurationBlock();

        RegistryInitializer.REGISTRY_LIST.forEach((registry) => {
            this.removeSingleRegistryCredentials(registry);
        });
    }

    private removeCplaceRegistryConfigurationBlock() {
        const lines = this.currentNpmrcConfig.split('\n');
        const rangeToRemove: [number, number][] = [];
        const cplaceBlocksStartIndexes: number[] = [];

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('start cplace registry configuration')) {
                cplaceBlocksStartIndexes.push(i);
            }
            if (lines[i].includes('end cplace registry configuration')) {
                let startIndex = 0;
                if (cplaceBlocksStartIndexes.length > 0) {
                    startIndex = cplaceBlocksStartIndexes.pop()!;
                }
                rangeToRemove.push([startIndex, i]);
            }
        }
        if (cplaceBlocksStartIndexes.length > 0) {
            // If there are start indexes without end indexes, remove until the end of the file
            rangeToRemove.push([cplaceBlocksStartIndexes[0], lines.length - 1]);
        }

        // for each line of the flie check if it is in one of the ranges to remove
        const linesToRemove: string[] = [];
        lines.forEach((line, index) => {
            rangeToRemove.forEach((range) => {
                if (index >= range[0] && index <= range[1]) {
                    linesToRemove.push(line);
                }
            });
        });

        // save the new file without the lines to remove
        fs.writeFileSync(
            this.npmrcPath,
            this.getCleanedNpmrcConfig(linesToRemove),
            { encoding: 'utf-8' },
        );
        this.setCurrentNpmrcConfig();
    }

    private removeSingleRegistryCredentials(registry: string): void {
        this.debug(`Cleaning ${registry} registry jFrog credentials`);
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
        currentNpmrcConfigLines.forEach((line, index) => {
            if (linesToRemove.includes(line) || !line) {
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

    private getRegistryInfo(registryUrl: string, registryName: string, scoped?: boolean) {
        if (scoped && this.managedScopes.length > 0) {
            // Generate scoped registry configuration for each managed scope
            return this.managedScopes
                .map(scope => `${scope}:registry=https:${this.getFullRegistryPath(registryUrl, registryName)}`)
                .join('\n');
        }

        // Default non-scoped registry configuration
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

    private getDefaultRegistryConfigItems(scoped?: boolean): string[] {
        return [
            this.getRegistryInfo(
                RegistryInitializer.JFROG_REGISTRY_URL,
                this.npmRegistry,
                scoped
            ),
            this.getAuthInfo(
                RegistryInitializer.JFROG_REGISTRY_URL,
                this.npmRegistry
            ),
            this.getAlwaysAuthInfo(
                RegistryInitializer.JFROG_REGISTRY_URL,
                this.npmRegistry
            ),
            this.getEmailInfo(
                RegistryInitializer.JFROG_REGISTRY_URL,
                this.npmRegistry
            ),
        ];
    }

    private addDefaultRegistryCredentialsToNpmrc(scoped?: boolean) {
        const defaultRegistryConfigurationItems =
            this.getDefaultRegistryConfigItems(scoped);

        let npmrc = this.currentNpmrcConfig;

        npmrc = npmrc.concat('\n# start cplace registry configuration. Do not remove this line\n');
        defaultRegistryConfigurationItems.forEach(item => {
            npmrc = npmrc.concat(`${item}\n`);
        });
        npmrc = npmrc.concat('# end cplace registry configuration. Do not remove this line\n');

        fs.writeFileSync(this.npmrcPath, npmrc, { encoding: 'utf-8' });
        console.log('Updated config in: ', this.npmrcPath);
    }
}
