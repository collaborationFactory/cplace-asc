import * as fs from 'fs';
import * as path from 'path';
import { LicenseInfo } from './LicenseInfos';

export class CplaceLicense extends LicenseInfo {
    protected getTextLicenseTextToPrepend(): string {
        return '';
    }
}
