import * as fs from 'fs';
import { cerr, cgreen, cwarn } from '../utils';
import * as path from 'path';

export class CplaceVersion {
    private static readonly VERSION_GRADLE = 'version.gradle';

    private static _currentVersion: CplaceVersion | undefined = undefined;
    private static _cplaceVersion: CplaceVersion | undefined = undefined;
    private static _createdOnBranch: CplaceVersion | undefined = undefined;

    private constructor(
        public readonly rawVersion: string,
        public readonly major: number,
        public readonly minor: number,
        public readonly patch: number,
        public readonly appendix: string
    ) {}

    public static initialize(
        currentRepo: string,
        providedCurrentVersion?: string,
        force?: boolean
    ): void {
        if (force) {
            this._currentVersion = undefined;
            this._cplaceVersion = undefined;
            this._createdOnBranch = undefined;
        }

        if (
            this._currentVersion ||
            this._cplaceVersion ||
            this._createdOnBranch
        ) {
            throw new Error(
                `(CplaceVersion) version has already been initialized`
            );
        }

        this.parseVersionsFromVersionFile(currentRepo);

        // Override current version if it was provided as a command line argument
        if (providedCurrentVersion) {
            this._currentVersion = new CplaceVersion(
                providedCurrentVersion,
                0,
                0,
                0,
                ''
            );
        }

        // If cplaceVersion was not specified in version.gradle, use createOnBranch as fallback
        if (this._cplaceVersion == undefined) {
            this._cplaceVersion = this._createdOnBranch;
        }

        // If cplaceVersion is still not set, use currentVersion as fallback
        if (this._cplaceVersion == undefined) {
            this._cplaceVersion = this._currentVersion;
        }

        // If currentVersion is not in the version file and is not provided, use cplaceVersion as fallback
        if (this._currentVersion == undefined) {
            this._currentVersion = this._cplaceVersion;
        }

        if (
            this._currentVersion == undefined &&
            this._cplaceVersion == undefined &&
            this._createdOnBranch == undefined
        ) {
            console.error(
                cerr`[CplaceVersion] Cplace version was not detected in version.gradle file`
            );
            throw new Error(
                `[CplaceVersion] Cplace version was not detected in version.gradle file`
            );
        }

        console.log(
            cgreen`⇢`,
            `current version: ${CplaceVersion.getCurrentVersion()}, cplace version: ${
                this._cplaceVersion!.major
            }.${this._cplaceVersion!.minor}`
        );
    }

    private static parseVersionsFromVersionFile(currentRepo: string) {
        const versionFilePath = path.resolve(
            currentRepo,
            CplaceVersion.VERSION_GRADLE
        );
        if (!fs.existsSync(versionFilePath)) {
            console.warn(
                cwarn`[NPM] Could not find version.gradle in repo ${currentRepo}...`
            );
            console.warn(cwarn`[CplaceVersion] -> Assuming version 1.0.0`);
            CplaceVersion._currentVersion = new CplaceVersion(
                '1.0.0',
                1,
                0,
                0,
                ''
            );
        } else {
            const versionFileContent = fs.readFileSync(versionFilePath, 'utf8');
            const currentVersionString = this.readVersionStringFromFile(
                versionFileContent,
                'currentVersion'
            );
            const cplaceVersionString = this.readVersionStringFromFile(
                versionFileContent,
                'cplaceVersion'
            );
            const createdOnBranchString = this.readVersionStringFromFile(
                versionFileContent,
                'createdOnBranch'
            );

            this.parseCplaceVersion(cplaceVersionString as string);
            this.parseCreatedOnBranch(createdOnBranchString as string);
            this.parseCurrentVersion(
                currentVersionString as string,
                this._cplaceVersion == undefined
            );
        }
    }

    private static readVersionStringFromFile(
        versionFileContent: string,
        stringPattern: string
    ): string | null {
        const versionString = versionFileContent
            .split('\n')
            .find(
                (line) =>
                    line.includes(stringPattern) &&
                    !line.trim().startsWith('//')
            );

        return versionString
            ? versionString.split('=')[1].replace(/'/g, '').trim()
            : null;
    }

    private static parseVersion(
        versionString: string,
        versionPattern
    ): CplaceVersion | undefined {
        const match = versionString.match(versionPattern);
        if (!match) {
            console.log(
                cwarn`[CplaceVersion] provided version string '${versionString}' does not match the expected format`
            );
            return undefined;
        }

        return new CplaceVersion(
            versionString,
            parseInt(match[1]),
            parseInt(match[2]),
            parseInt(match[3] ?? 0),
            match[4] ?? ''
        );
    }

    private static parseCurrentVersion(
        currentVersion: string,
        asCplaceVersion: boolean
    ): void {
        if (currentVersion) {
            if (asCplaceVersion) {
                const versionPattern =
                    /([0-9]+)\.([0-9]+).([0-9]+)-?(SNAPSHOT|RC\.[0-9]+)?/;
                this._currentVersion = this.parseVersion(
                    currentVersion,
                    versionPattern
                );
            } else {
                this._currentVersion = new CplaceVersion(
                    currentVersion,
                    0,
                    0,
                    0,
                    ''
                );
            }
        }
    }

    private static parseCplaceVersion(cplaceVersionString: string): void {
        if (cplaceVersionString) {
            const versionPattern = /([0-9]{2})\.([1-4])/;
            this._cplaceVersion = this.parseVersion(
                cplaceVersionString,
                versionPattern
            );
        }
    }

    private static parseCreatedOnBranch(createdOnBranchString: string): void {
        if (createdOnBranchString) {
            const versionPattern = /release\/([0-9]{2})\.([1-4])/;
            this._createdOnBranch = this.parseVersion(
                createdOnBranchString,
                versionPattern
            );
        }
    }

    public isSnapshot() {
        return (
            this.appendix != null &&
            this.appendix.toLowerCase().indexOf('snapshot') != -1
        );
    }

    public static getCurrentVersion(): string {
        return this._currentVersion!.rawVersion;
    }

    public static get(): CplaceVersion {
        if (CplaceVersion._cplaceVersion === undefined) {
            throw new Error(
                `(CplaceVersion) version has not been initialized. cplaceVersion or createdOnBranch must be specified in version.gradle`
            );
        }
        return CplaceVersion._cplaceVersion;
    }
}
