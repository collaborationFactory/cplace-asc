import * as fs from 'fs';
import * as path from 'path';
import { LicenseInfo } from "./LicenseInfos";


export class OtherLicense extends LicenseInfo {
  protected getTextLicenseTextToPrepend(): string {
    return "";
  }

}



