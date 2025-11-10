/**
 * Stores the JFrog credentials loaded either from environment variables or from the gradle properties.
 */
export class RegistryCredentials {
    private constructor() {}

    private static credentials: { username: string; token: string } = {
        username: '',
        token: '',
    };

    public static setCredentials(username: string, token: string): void {
        RegistryCredentials.credentials = { username, token };
    }

    public static getCredentials(): { username: string; token: string } {
        return RegistryCredentials.credentials;
    }
}
