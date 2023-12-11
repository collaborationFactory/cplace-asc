import * as fs from 'fs';
import * as path from 'path';

export interface LibraryLicenseInfo {
    product: string;
    component: string;
    copyright: string;
    license: string;
    additionalLicenses: string[];
    licenseFile: string;
    licenseText: string;
}

export const LIBRARY_LICENSE_INFOS_NAME = 'libraryLicenseInfos.json';

export const ADDITIONAL_LGPL_TEXT =
    'Modifications of the proprietary software in your product for your own and reverse engineering to debug such modifications are hereby permitted to the extent that such software components are linked to program libraries under the GNU Lesser General Public License (LGPL). However, you may not pass on to third parties the knowledge gained from reverse engineering or debugging, the information gained from re-engineering or the modified software itself. Please note that any modification is at your own risk and any warranty for defects resulting from the modification is void. In addition, the product may not be suitable for the intended use. This provision takes precedence over all other contractual provisions between you and collaboration Factory AG, Arnulfstr. 34, 80335 München.';

export function createLibraryLicenseInfos(pathToAssetsFolder: string): string {
    let libraryLicenseInfos: LibraryLicenseInfo[] = JSON.parse(
        fs
            .readFileSync(
                path.join(pathToAssetsFolder, LIBRARY_LICENSE_INFOS_NAME)
            )
            .toString()
    );
    libraryLicenseInfos.forEach((libraryLicenseInfo: LibraryLicenseInfo) => {
        if (libraryLicenseInfo.licenseFile) {
            const pathToInfos = path.join(
                pathToAssetsFolder,
                libraryLicenseInfo.licenseFile
            );
            if (fs.existsSync(pathToInfos)) {
                libraryLicenseInfo.licenseText = fs
                    .readFileSync(pathToInfos)
                    .toString();
            }
        } else {
            console.error(
                'Expected License File does not exist: ' +
                    libraryLicenseInfo.licenseFile
            );
        }
    });

    let licenseTexts = '';
    libraryLicenseInfos.forEach((libraryLicenseInfo: LibraryLicenseInfo) => {
        let includesLgpl = false;
        if (libraryLicenseInfo.license.toLowerCase().includes('lgpl')) {
            includesLgpl = true;
        }
        if (
            libraryLicenseInfo.additionalLicenses &&
            libraryLicenseInfo.additionalLicenses.length > 0
        ) {
            libraryLicenseInfo.additionalLicenses.forEach(
                (additionalLicense) => {
                    if (additionalLicense.toLowerCase().includes('lgpl')) {
                        includesLgpl = true;
                    }
                }
            );
        }
        if (includesLgpl) {
            licenseTexts = licenseTexts.concat(ADDITIONAL_LGPL_TEXT + '\n');
        }

        licenseTexts = licenseTexts.concat(
            'Component: ' +
                libraryLicenseInfo.product +
                ' ' +
                libraryLicenseInfo.component +
                '\n'
        );
        licenseTexts = licenseTexts.concat(
            'Copyright: ' + libraryLicenseInfo.copyright + '\n'
        );
        licenseTexts = licenseTexts.concat(
            'License Text: ' + libraryLicenseInfo.licenseText + '\n'
        );
    });
    return licenseTexts;
}
