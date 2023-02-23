import { ProcessNodeVersion } from '../model/ProcessNodeVersion';
import { SupportedNodeVersion } from '../model/SupportedNodeVersion';
import { cerr, debug } from '../utils';
import { CplaceVersion } from '../model/CplaceVersion';

export class NodeVersionUtils {
    private processNodeVersion = new ProcessNodeVersion();
    private supportedNodeVersion = new SupportedNodeVersion();

    public processVersion(): string | undefined {
        return this.processNodeVersion.toString();
    }

    public supportedVersion(): string | undefined {
        return this.supportedNodeVersion.toString();
    }

    public versionsDefined(): boolean {
        return (
            this.supportedNodeVersion.isDefined() &&
            this.processNodeVersion.isDefined()
        );
    }

    public strictVersionEqual(): boolean {
        this.compareDebugLog();
        return this.processVersion() === this.supportedVersion();
    }

    public majorVersionEqual(cplaceVersion: CplaceVersion): boolean {
        this.compareDebugLog();
        if (cplaceVersion.major <= 5 && cplaceVersion.minor <= 12) {
            console.log(
                `⟲ cplaceVersion ${CplaceVersion.toString()} is less or equal to 5.12.0 -> all node versions are allowed.`
            );
            return true;
        }
        return (
            this.processNodeVersion.major === this.supportedNodeVersion.major
        );
    }

    public minorVersionEqual(): boolean {
        this.compareDebugLog();
        return (
            this.processNodeVersion.minor === this.supportedNodeVersion.minor
        );
    }

    public patchVersionEqual(): boolean {
        this.compareDebugLog();
        return (
            this.processNodeVersion.patch === this.supportedNodeVersion.patch
        );
    }

    private compareDebugLog() {
        debug(
            `Comparing ${this.processNodeVersion} ${this.supportedNodeVersion}`
        );
    }
}
