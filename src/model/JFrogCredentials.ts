/**
 * Stores the JFrog credentials loaded either from environment variables or from the gradle properties.
 */
export class JFrogCredentials {
    private constructor() {}

    private static credentials: { username: string; token: string } = { username: '', token: '' };

    public static setCredentials(username: string, token: string): void {
        JFrogCredentials.credentials = { username, token };
    }

    public static getCredentials(): { username: string; token: string } {
        return JFrogCredentials.credentials;
    }
}
