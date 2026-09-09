import { AbstractNodeVersion } from './AbstractNodeVersion';

export class SupportedNodeVersion extends AbstractNodeVersion {
    private static readonly SUPPORTED_NODE_VERSION = '24.20.0';

    constructor() {
        super();
        const supportedNodeSemanticVersions = this.semanticVersions(
            SupportedNodeVersion.SUPPORTED_NODE_VERSION
        );
        this.setVersions(
            supportedNodeSemanticVersions[0],
            supportedNodeSemanticVersions[1],
            supportedNodeSemanticVersions[2]
        );
        console.log(`⟲ Currently supported Node version: ${this.toString()}`);
    }
}
