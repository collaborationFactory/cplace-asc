import { LGPLLicense } from "./LGPLLicenseInfos";
import { LibraryLicenseInfo, LicenseInfo } from "./LicenseInfos";
import { CplaceLicense } from "./CplaceLicense";
import * as fs from "fs";
import * as path from "node:path";
import { OtherLicense } from "./OtherLicense";

export const LIBRARY_LICENSE_INFOS_NAME = 'libraryLicenseInfos.json';

function handleLibraryLicenceInfo(libraryLicenseInfo: LibraryLicenseInfo, pathToAssetsFolder: string, licenseInfos: LicenseInfo[]) {
  if (libraryLicenseInfo.licenseFile) {
    const pathToLicenseFile = path.join(
      pathToAssetsFolder,
      libraryLicenseInfo.licenseFile
    );
    if (fs.existsSync(pathToLicenseFile)) {
      libraryLicenseInfo.licenseText = fs
        .readFileSync(pathToLicenseFile)
        .toString().replace(/(\r\n|\n|\r)/gm, '');
    }
  } else {
    console.log(
      `Expected License File for ${libraryLicenseInfo.product} ${libraryLicenseInfo.component} does not exist ${libraryLicenseInfo.licenseFile}`
    );
  }

  if (
    (
      libraryLicenseInfo.license
        .toLowerCase()
        .includes('commercial license') &&
      libraryLicenseInfo.license
        .toLowerCase()
        .includes('collaboration factory')
    )
  ) {
    licenseInfos.push(new CplaceLicense(libraryLicenseInfo));
  } else if (isLgpl(libraryLicenseInfo)) {
    licenseInfos.push(new LGPLLicense(libraryLicenseInfo));
  } else {
    licenseInfos.push(new OtherLicense(libraryLicenseInfo));
  }
}

export function isLgpl(libraryLicenseInfo: LibraryLicenseInfo): boolean {
  let includesLgpl = false;
  if (libraryLicenseInfo.license.toLowerCase().includes('lgpl')) {
    includesLgpl = true;
  }
  if (
    libraryLicenseInfo.additionalLicenses &&
    libraryLicenseInfo.additionalLicenses.length > 0
  ) {
    libraryLicenseInfo.additionalLicenses.forEach(
      (additionalLicense: string) => {
        if (additionalLicense.toLowerCase().includes('lgpl')) {
          includesLgpl = true;
        }
      }
    );
  }
  return includesLgpl;
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
    handleLibraryLicenceInfo(libraryLicenseInfo, pathToAssetsFolder, licenseInfos);
  });
  let licenseText = '';
  licenseInfos.forEach((licenseInfo: LicenseInfo) => {
    licenseText = licenseText.concat(licenseInfo.licenseText, '\n');
  })
  return licenseText;
}
