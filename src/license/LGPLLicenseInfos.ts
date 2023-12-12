import * as fs from 'fs';
import * as path from 'path';
import { LicenseInfo } from "./LicenseInfos";


export class LGPLLicense extends LicenseInfo {
  
  getTextLicenseTextToPrepend() {
    return 'Modifications of the proprietary software in your product for your own and reverse engineering to debug such modifications are hereby permitted to the extent that such software components are linked to program libraries under the GNU Lesser General Public License (LGPL). However, you may not pass on to third parties the knowledge gained from reverse engineering or debugging, the information gained from re-engineering or the modified software itself. Please note that any modification is at your own risk and any warranty for defects resulting from the modification is void. In addition, the product may not be suitable for the intended use. This provision takes precedence over all other contractual provisions between you and collaboration Factory AG, Arnulfstr. 34, 80335 München.';
  }

}



