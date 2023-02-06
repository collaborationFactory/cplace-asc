import { AbstractNodeVersion } from './AbstractNodeVersion';
import { debug } from '../utils';

export class ProcessNodeVersion extends AbstractNodeVersion {
    constructor() {
        super();
        debug('Checking process node version');
        const processVersion = process.version.replace(/\D/, '');
        const processSemanticVersions = processVersion.split('.');
        this.setVersions(
            processSemanticVersions[0],
            processSemanticVersions[1],
            processSemanticVersions[2]
        );
    }
}
