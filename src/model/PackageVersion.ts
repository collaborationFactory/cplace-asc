import * as fs from "fs";
import {cerr, cwarn} from "../utils";
import * as path from "path";

export class PackageVersion {
    private static readonly PACKAGE_JSON = 'package.json';

    private static _version: PackageVersion | undefined = undefined;

    private constructor(public readonly major: number, public readonly minor: number, public readonly patch: number) {
    }

    public static initialize(mainRepo: string): PackageVersion {
        if (PackageVersion._version !== undefined) {
            throw new Error(`(PackageVersion) version has already been initialized`);
        }

        const packagePath = path.resolve(mainRepo, PackageVersion.PACKAGE_JSON);
        if (!fs.existsSync(packagePath)) {
            console.warn(cwarn`[NPM] Could not find package.json in repo ${mainRepo}...`);
            console.warn(cwarn`[NPM] -> Assuming version 1.0.0`);
            PackageVersion._version = new PackageVersion(1, 0, 0);
        } else {
            const packageJson_String = fs.readFileSync(packagePath, 'utf8');
            const packageJson = JSON.parse(packageJson_String);
            const versionString = packageJson.version as string;
            const versionParts = versionString.split('.');
            if (versionParts.length !== 3) {
                console.error(cerr`[NPM] Expected package.json "version" to consist of 3 parts`);
                throw new Error(`[NPM] Expected package.json "version" to consist of 3 parts`);
            }

            PackageVersion._version = new PackageVersion(
                parseInt(versionParts[0]),
                parseInt(versionParts[1]),
                parseInt(versionParts[2])
            );
        }
        return PackageVersion._version;
    }

    public static get(): PackageVersion {
        if (PackageVersion._version === undefined) {
            throw new Error(`(PackageVersion) version has not yet been initialized`);
        }
        return PackageVersion._version;
    }
}
