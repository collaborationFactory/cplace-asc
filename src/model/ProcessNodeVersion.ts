import { AbstractNodeVersion } from './AbstractNodeVersion';

export class ProcessNodeVersion extends AbstractNodeVersion {
    constructor() {
        super();
        const processVersion = process.version.replace(/\D/, '');
        const processSemanticVersions = this.semanticVersions(processVersion);
        this.setVersions(
            processSemanticVersions[0],
            processSemanticVersions[1],
            processSemanticVersions[2]
        );
        console.log(`⟲ You are using node version: ${this.toString()}`);
    }
}
