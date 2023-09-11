import * as fs from 'fs';
import { cerr, cwarn } from '../utils';
import * as path from 'path';

export class CplaceVersion {
    private static readonly VERSION_GRADLE = 'version.gradle';

    private static _currentVersion: CplaceVersion | undefined = undefined;
    private static _cplaceVersion: CplaceVersion | undefined = undefined;
    private static _createdOnBranch: CplaceVersion | undefined = undefined;

    private constructor(
        public readonly major: number,
        public readonly minor: number,
        public readonly patch: number,
        public readonly appendix: string
    ) {}

    public static initialize(
        currentRepo: string,
        cplaceVersion?: string,
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

        if (cplaceVersion) {
            this.parseCurrentVersion(cplaceVersion as string);
        } else {
            const versionFilePath = path.resolve(
                currentRepo,
                CplaceVersion.VERSION_GRADLE
            );
            if (!fs.existsSync(versionFilePath)) {
                console.warn(
                    cwarn`[NPM] Could not find version.gradle in repo ${currentRepo}...`
                );
                console.warn(cwarn`[CplaceVersion] -> Assuming version 1.0.0`);
                CplaceVersion._currentVersion = new CplaceVersion(1, 0, 0, '');
            } else {
                const versionFileContent = fs.readFileSync(
                    versionFilePath,
                    'utf8'
                );
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

                this.parseCreatedOnBranch(createdOnBranchString as string);
                this.parseCurrentVersion(currentVersionString as string);
                this.parseCplaceVersion(cplaceVersionString as string);
            }
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

        if (this._currentVersion == undefined) {
            if (this._cplaceVersion) {
                this._currentVersion = this._cplaceVersion;
            } else {
                this._currentVersion = this._createdOnBranch;
            }
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
            console.error(
                cerr`[CplaceVersion] provided version string does not match the provided pattern`
            );
            return undefined;
        }

        return new CplaceVersion(
            parseInt(match[1]),
            parseInt(match[2]),
            parseInt(match[3] ?? 0),
            match[4] ?? ''
        );
    }

    private static parseCurrentVersion(currentVersion: string): void {
        if (currentVersion) {
            const versionPattern =
                /([0-9]+)\.([0-9]+).([0-9]+)-?(SNAPSHOT|RC\.[0-9]+)?/;
            this._currentVersion = this.parseVersion(
                currentVersion,
                versionPattern
            );
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
        return this.appendix != null && this.appendix.toLowerCase().indexOf('snapshot') != -1;
    }

    public static toString(): string {
        let version = `${this._currentVersion?.major}.${this._currentVersion?.minor}.${this._currentVersion?.patch}`;
        if (this._currentVersion?.appendix) {
            version += `-${this._currentVersion?.appendix}`;
        }

        return version;
    }

    public static get(): CplaceVersion {
        if (CplaceVersion._currentVersion === undefined) {
            throw new Error(
                `(CplaceVersion) version has not yet been initialized`
            );
        }
        return CplaceVersion._currentVersion;
    }
}
