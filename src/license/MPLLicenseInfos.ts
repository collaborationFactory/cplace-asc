import * as fs from 'fs';
import * as path from 'path';
import { LicenseInfo } from './LicenseInfos';

export class MPLLicenseInfo extends LicenseInfo {
    getTextLicenseTextToPrepend() {
        return '';
    }
}
