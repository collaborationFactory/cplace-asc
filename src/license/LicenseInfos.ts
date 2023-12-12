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

    protected abstract getTextLicenseTextToPrepend(): string;

    constructor(libraryLicenseInfo: LibraryLicenseInfo) {
        this.libraryLicenseInfo = libraryLicenseInfo;
        this.generateLicenseTexts();
    }

    public generateLicenseTexts(): void {
        if (this.libraryLicenseInfo) {
            this._licenseText = this._licenseText.concat(
                '// Component: ' +
                    this.libraryLicenseInfo.product +
                    ' ' +
                    this.libraryLicenseInfo.component +
                    '    '
            );
            this._licenseText = this._licenseText.concat(
                'Copyright: ' + this.libraryLicenseInfo.copyright + '    '
            );
            this._licenseText = this._licenseText.concat(
                'License: ' + this.libraryLicenseInfo.license + '    '
            );
            if (
                this.libraryLicenseInfo.additionalLicenses &&
                this.libraryLicenseInfo.additionalLicenses.length > 0
            ) {
                this._licenseText = this._licenseText.concat(
                    'Additional Licenses: ' +
                        this.libraryLicenseInfo.additionalLicenses.join(', ') +
                        '    '
                );
            }
            this._licenseText = this._licenseText.concat(
                this.getTextLicenseTextToPrepend()
            );
            this._licenseText = this._licenseText.concat(
                'License Text: ' + this.libraryLicenseInfo.licenseText + '    '
            );
        }
    }
}
