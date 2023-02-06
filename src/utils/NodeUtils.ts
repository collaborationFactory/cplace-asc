import { ProcessNodeVersion } from '../model/ProcessNodeVersion';
import { ProjectNodeVersion } from '../model/ProjectNodeVersion';

export class NodeVersionUtils {
    private processNodeVersion = new ProcessNodeVersion();
    private projectNodeVersion = new ProjectNodeVersion();

    public processVersion() {
        return this.processNodeVersion.toString();
    }

    public projectVersion() {
        return this.projectNodeVersion.toString();
    }

    public versionsDefined(): boolean {
        return (
            this.projectNodeVersion.isDefined() &&
            this.processNodeVersion.isDefined()
        );
    }

    public strictVersionEqual(): boolean {
        return this.processVersion() === this.projectVersion();
    }

    public majorVersionEqual(): boolean {
        return this.processNodeVersion.major === this.projectNodeVersion.major;
    }

    public minorVersionEqual(): boolean {
        return this.processNodeVersion.minor === this.projectNodeVersion.minor;
    }

    public patchVersionEqual(): boolean {
        return this.processNodeVersion.patch === this.projectNodeVersion.patch;
    }
}
