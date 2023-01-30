export const DEFAULT_TEST_TOKEN =
    'bWF4Lm11c3Rlcm1hbm5AY29sbGFib3JhdGlvbi1mYWN0b3J5LmRlOnRva2Vu';
export const DEFAULT_TEST_EMAIL = 'max.mustermann@collaboration-factory.de';

export function getTestRegistryCredentials(
    scope: string,
    registry: string,
    token: string = DEFAULT_TEST_TOKEN,
    email: string = DEFAULT_TEST_EMAIL
): string {
    const scopeData = scope ? `${scope}:` : '';
    return `\n${scopeData}registry=https://cplace.jfrog.io/artifactory/api/npm/${registry}/\n`
        .concat(
            `//cplace.jfrog.io/artifactory/api/npm/${registry}/:_auth=${token}\n`
        )
        .concat(
            `//cplace.jfrog.io/artifactory/api/npm/${registry}/:always-auth=true\n`
        )
        .concat(
            `//cplace.jfrog.io/artifactory/api/npm/${registry}/:email=${email}\n`
        );
}
