import { AbstractNodeVersion } from './AbstractNodeVersion';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { debug } from '../utils';

export class ProjectNodeVersion extends AbstractNodeVersion {
    constructor() {
        super();
        debug('Checking project node version');
        const nvmrcContent = this.getNvmrcContent();
        if (!nvmrcContent) {
            return;
        }
        const projectNodeSemanticVersions = nvmrcContent.split('.');
        this.setVersions(
            projectNodeSemanticVersions[0],
            projectNodeSemanticVersions[1],
            projectNodeSemanticVersions[2]
        );
    }

    private getNvmrcContent(): string | undefined {
        const nvmrcPath = resolve(process.cwd(), '.nvmrc');
        debug(`Looking for: ${nvmrcPath}`);
        if (!existsSync(nvmrcPath)) {
            debug(`${nvmrcPath} not found`);
            return;
        }
        return readFileSync(nvmrcPath, { encoding: 'utf-8' });
    }
}
