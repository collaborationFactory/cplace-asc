import * as fs from 'fs';
import { cerr, cwarn } from '../utils';
import * as path from 'path';

export class CplaceVersion {
    private static readonly VERSION_GRADLE = 'version.gradle';

    private static _version: CplaceVersion | undefined = undefined;

    private constructor(
        public readonly major: number,
        public readonly minor: number,
        public readonly patch: number,
        public readonly snapshot: boolean
    ) {}

    public static initialize(currentRepo: string): CplaceVersion {
        if (CplaceVersion._version !== undefined) {
            throw new Error(
                `(CplaceVersion) version has already been initialized`
            );
        }

        const versionFilePath = path.resolve(
            currentRepo,
            CplaceVersion.VERSION_GRADLE
        );
        if (!fs.existsSync(versionFilePath)) {
            console.warn(
                cwarn`[NPM] Could not find version.gradle in repo ${currentRepo}...`
            );
            console.warn(cwarn`[CplaceVersion] -> Assuming version 1.0.0`);
            CplaceVersion._version = new CplaceVersion(1, 0, 0, false);
        } else {
            const versionFileContent = fs.readFileSync(versionFilePath, 'utf8');
            const versionString = versionFileContent
                .split('\n')
                .find((line) => line.includes('currentVersion'));
            if (!versionString) {
                console.error(
                    cerr`[CplaceVersion] Version string not found in version.gradle file`
                );
                throw new Error(
                    `[CplaceVersion] Version string not found in version.gradle file`
                );
            }

            const version = versionString
                .split('=')[1]
                .replace(/'/g, '')
                .trim();
            const versionSnapshotParts = version.split('-');

            const versionParts = versionSnapshotParts[0].split('.');
            versionParts.push(
                versionSnapshotParts.length > 1 &&
                    versionSnapshotParts[1].toLowerCase().includes('snapshot')
                    ? 'true'
                    : 'false'
            );

            if (versionParts.length < 3) {
                console.error(
                    cerr`[CplaceVersion] Expected version to consist of 3 parts`
                );
                throw new Error(
                    `[CplaceVersion] Expected version to consist of 3 parts`
                );
            }

            CplaceVersion._version = new CplaceVersion(
                parseInt(versionParts[0]),
                parseInt(versionParts[1]),
                parseInt(versionParts[2]),
                versionParts[3] == 'true'
            );
        }
        return CplaceVersion._version;
    }

    public static toString(): string {
        let version = `${this._version?.major}.${this._version?.minor}.${this._version?.patch}`;
        if (this._version?.snapshot) {
            version += '-SNAPSHOT';
        }

        return version;
    }

    public static get(): CplaceVersion {
        if (CplaceVersion._version === undefined) {
            throw new Error(
                `(CplaceVersion) version has not yet been initialized`
            );
        }
        return CplaceVersion._version;
    }
}
