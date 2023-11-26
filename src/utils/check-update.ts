class Version {
    constructor(
        public major: number,
        public minor: number,
        public patch: number
    ) {}

    public static parse(version: string): Version | null {
        const parts = version.split('.');
        const segments: number[] = [-1, -1, -1];

        for (let i = 0; i < parts.length; i++) {
            try {
                segments[i] = parseInt(parts[i], 10);
            } catch (e) {
                return null;
            }
        }

        return new Version(segments[0], segments[1], segments[2]);
    }

    public isNewerThan(other: Version): boolean {
        if (this.major > other.major) {
            return true;
        } else if (this.major < other.major) {
            return false;
        } else if (this.minor > other.minor) {
            return true;
        } else if (this.minor < other.minor) {
            return false;
        } else {
            return this.patch > other.patch;
        }
    }

    public toString(): string {
        return `${this.major || 0}.${this.minor || 0}.${this.patch || 0}`;
    }
}
