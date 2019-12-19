export class PackageVersion {
    private static _version: PackageVersion;

    private constructor(public readonly major: number, public readonly minor: number, public readonly patch: number) {
    }

    public static initialize(major: number, minor: number, patch: number): void {
        if (PackageVersion._version) {
            throw new Error(`(PackageVersion) version has already been initialized`);
        }
        PackageVersion._version = new PackageVersion(major, minor, patch);
    }

    public static get(): PackageVersion {
        if (!PackageVersion._version) {
            throw new Error(`(PackageVersion) version has not yet been initialized`);
        }
        return PackageVersion._version;
    }
}
