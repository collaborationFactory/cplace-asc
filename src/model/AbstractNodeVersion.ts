import { cwarn } from '../utils';

export abstract class AbstractNodeVersion {
    public major: string | undefined;
    public minor: string | undefined;
    public patch: string | undefined;

    public toString(): string | undefined {
        if (this.major && this.minor && this.patch) {
            return [this.major, this.minor, this.patch].join('.');
        } else {
            console.warn(cwarn`Can not get Node version!`);
        }
    }

    public isDefined(): boolean {
        return !!this.toString();
    }

    protected setVersions(major: string, minor: string, patch: string) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
    }

    protected semanticVersions(version: string): string[] {
        return version.split('.');
    }
}
