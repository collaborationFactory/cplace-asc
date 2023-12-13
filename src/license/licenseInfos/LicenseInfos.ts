export interface LibraryLicenseInfo {
    product: string;
    component: string;
    copyright: string;
    license: string;
    additionalLicenses: string[];
    licenseFile: string;
    licenseText: string;
}

export abstract class LicenseInfo {
    get licenseText(): string {
        return this._licenseText;
    }

    private _licenseText = '';
    private libraryLicenseInfo: LibraryLicenseInfo | undefined;

    protected abstract getLicenseDisclaimer(): string;

    constructor(libraryLicenseInfo: LibraryLicenseInfo) {
        this.libraryLicenseInfo = libraryLicenseInfo;
        this.generateLicenseTexts();
    }

    public generateLicenseTexts(): void {
        if (this.libraryLicenseInfo) {
            this._licenseText = this._licenseText.concat(
                '// [Component] ' +
                    this.libraryLicenseInfo.product +
                    ' ' +
                    this.libraryLicenseInfo.component +
                    '    '
            );
            this._licenseText = this._licenseText.concat(
                '[Copyright] ' + this.libraryLicenseInfo.copyright + '    '
            );
            this._licenseText = this._licenseText.concat(
                '[License] ' + this.libraryLicenseInfo.license + '    '
            );
            this._licenseText = this._licenseText.concat(
                '[License Text] ' + this.libraryLicenseInfo.licenseText + '    '
            );
            if (this.getLicenseDisclaimer()) {
                this._licenseText = this._licenseText.concat(
                    '[Disclaimer] ' + this.getLicenseDisclaimer()
                );
            }
        }
    }
}
