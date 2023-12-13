import * as fs from 'fs';
import * as path from 'path';
import { LicenseInfo } from './LicenseInfos';

export class CCBY25LicenseInfo extends LicenseInfo {
  getLicenseDisclaimer() {
        return '';
    }
}
