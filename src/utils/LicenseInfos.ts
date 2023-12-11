import * as fs from 'fs';
import * as path from 'path';

export interface libraryLicenseInfos {
    product: string;
    component: string;
    copyright: string;
    licenseFile: string;
    licenseText: string;
}

export const LIBRARY_LICENSE_INFOS_NAME = 'libraryLicenseInfos.json';

export function createLibraryLicenseInfos(pathToAssetsFolder: string): string {
    const pathToLibraryInfos = path.join(
        pathToAssetsFolder,
        LIBRARY_LICENSE_INFOS_NAME
    );
    if (pathToLibraryInfos) {
        let libraryLicenseInfos: libraryLicenseInfos[] = JSON.parse(
            fs
                .readFileSync(
                    path.join(pathToAssetsFolder, LIBRARY_LICENSE_INFOS_NAME)
                )
                .toString()
        );
        libraryLicenseInfos.map((libraryLicenseInfo) => {
            if (libraryLicenseInfo.licenseFile) {
                const pathToInfos = path.join(
                    pathToAssetsFolder,
                    libraryLicenseInfo.licenseFile
                );
                if (fs.existsSync(pathToInfos)) {
                    console.log('reading: ' + pathToInfos);
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
        libraryLicenseInfos.forEach((libraryLicenseInfo) => {
            licenseTexts +=
                'Component: ' +
                libraryLicenseInfo.product +
                ' ' +
                libraryLicenseInfo.component +
                '\n';
            licenseTexts += 'Copyright: ' + libraryLicenseInfo.copyright + '\n';
            licenseTexts +=
                'License Text: ' + libraryLicenseInfo.licenseText + '\n';
        });
        return licenseTexts;
    } else {
        console.log('No License Infos were found in' + pathToLibraryInfos);
        return '';
    }
}
