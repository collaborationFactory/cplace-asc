import { LGPLLicense } from './LGPLLicenseInfos';
import { LibraryLicenseInfo, LicenseInfo } from './LicenseInfos';
import * as fs from 'fs';
import * as path from 'node:path';
import { CCBY25LicenseInfo } from './CCBY25LicenseInfos';
import { MPLLicenseInfo } from './MPLLicenseInfos';

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
                .replace(/(\r\n|\n|\r)/gm, '');
        }
    } else {
        console.log(
            `Expected License File for ${libraryLicenseInfo.product} ${libraryLicenseInfo.component} does not exist ${libraryLicenseInfo.licenseFile}`
        );
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

export function isIncludedInAdditionalLicenses(
    libraryLicenseInfo: LibraryLicenseInfo,
    licenseType: string
): boolean {
    let includesLicenseType = false;
    if (
        libraryLicenseInfo.additionalLicenses &&
        libraryLicenseInfo.additionalLicenses.length > 0
    ) {
        libraryLicenseInfo.additionalLicenses.forEach(
            (additionalLicense: string) => {
                if (
                    additionalLicense
                        .toLowerCase()
                        .includes(licenseType.toLowerCase())
                ) {
                    includesLicenseType = true;
                }
            }
        );
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
