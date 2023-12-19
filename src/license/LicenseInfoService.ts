import * as fs from 'fs';
import * as path from 'path';
import { LibraryLicenseInfo, LicenseInfo } from './licenseInfos/LicenseInfos';
import { LGPLLicense } from './licenseInfos/LGPLLicenseInfos';
import { MPLLicenseInfo } from './licenseInfos/MPLLicenseInfos';
import { CCBY25LicenseInfo } from './licenseInfos/CCBY25LicenseInfos';

export const LIBRARY_LICENSE_INFOS_NAME = 'libraryLicenseInfos.json';

export const LGPL = 'LGPL';
export const MPL = 'MPL';
export const CCBY25 = 'CC-BY-2.5';

function handleLibraryLicenceInfo(
    libraryLicenseInfo: LibraryLicenseInfo,
    pathToAssetsFolder: string,
    licenseInfos: LicenseInfo[]
) {
    if (libraryLicenseInfo.licenseFile) {
        const pathToLicenseFile = path.join(
            pathToAssetsFolder,
            libraryLicenseInfo.licenseFile
        );
        if (fs.existsSync(pathToLicenseFile)) {
            libraryLicenseInfo.licenseText = fs
                .readFileSync(pathToLicenseFile)
                .toString()
                .replace(/(\r\n|\n|\r)/gm, ' ')
                .replace(/  +/g, ' ');
        }
    }

    if (isIncludedInLicense(libraryLicenseInfo, LGPL)) {
        licenseInfos.push(new LGPLLicense(libraryLicenseInfo));
    } else if (isIncludedInLicense(libraryLicenseInfo, MPL)) {
        licenseInfos.push(new MPLLicenseInfo(libraryLicenseInfo));
    } else if (isIncludedInLicense(libraryLicenseInfo, CCBY25)) {
        licenseInfos.push(new CCBY25LicenseInfo(libraryLicenseInfo));
    }
}

export function isIncludedInLicense(
    libraryLicenseInfo: LibraryLicenseInfo,
    licenseType: string
): boolean {
    let includesLicenseType = false;
    if (
        libraryLicenseInfo.license
            .toLowerCase()
            .includes(licenseType.toLowerCase())
    ) {
        includesLicenseType = true;
    }
    return includesLicenseType;
}

export function createLibraryLicenseInfos(pathToAssetsFolder: string) {
    let libraryLicenseInfos: LibraryLicenseInfo[] = JSON.parse(
        fs
            .readFileSync(
                path.join(pathToAssetsFolder, LIBRARY_LICENSE_INFOS_NAME)
            )
            .toString()
    );

    let licenseInfos: LicenseInfo[] = [];
    libraryLicenseInfos.forEach((libraryLicenseInfo: LibraryLicenseInfo) => {
        handleLibraryLicenceInfo(
            libraryLicenseInfo,
            pathToAssetsFolder,
            licenseInfos
        );
    });
    let licenseText = '';
    licenseInfos.forEach((licenseInfo: LicenseInfo) => {
        licenseText = licenseText.concat(licenseInfo.licenseText, '\n');
    });
    return licenseText;
}
