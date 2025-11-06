interface ArtifactoryRepositoryResponse {
    key: string,
    description: string
    type: string,
    url: string,
    packageType: string
}

export class RegistryResolver {
    private static readonly API_LOCAL_REGISTRIES_ENDPOINT = 'repositories';
    private static readonly API_LOCAL_REGISTRIES_QUERY_PARAMS = '?type=local&packageType=npm';
    private static readonly API_STORAGE_ENDPOINT = 'storage';

    private artifactoryBaseUrl: string;

    constructor(artifactoryBaseUrl: string) {
        // Ensure the base URL ends with a slash
        this.artifactoryBaseUrl = artifactoryBaseUrl.endsWith('/')
            ? artifactoryBaseUrl
            : `${artifactoryBaseUrl}/`;
    }

    /**
     * Fetch all local npm registries from the Artifactory instance.
     *
     * @param npmBasicAuthToken Basic auth token for npm (Base64 encoded 'username:token')
     * @returns A promise that resolves to an array of local npm registry URLs.
     */
    public async getAllLocalNpmRegistries(npmBasicAuthToken: string): Promise<string[]> {
        const url = `${this.artifactoryBaseUrl}${RegistryResolver.API_LOCAL_REGISTRIES_ENDPOINT}${RegistryResolver.API_LOCAL_REGISTRIES_QUERY_PARAMS}`;

        const authHeader = 'Basic ' + npmBasicAuthToken;

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': authHeader,
                },
            });

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch registries: ${response.status} ${response.statusText}`
                );
            }

            const repositories = await response.json();

            // Extract repository keys (names) from the response
            return repositories.map((repo: ArtifactoryRepositoryResponse) => repo.key);
        } catch (error: any) {
            throw new Error(
                `Error fetching local npm registries: ${error.message}`
            );
        }
    }

    /**
     * Get all managed scopes from the provided list of registries.
     *
     * @param registries Array of registry names to query
     * @param npmBasicAuthToken Basic auth token for npm (Base64 encoded 'username:token')
     * @returns A promise that resolves to an array of unique scope names
     */
    public async getManagedScopes(registries: string[], npmBasicAuthToken: string): Promise<Set<string>> {
        const allScopes: Set<string> = new Set();

        const authHeader = 'Basic ' + npmBasicAuthToken;

        for (const registry of registries) {
            const url = `${this.artifactoryBaseUrl}${RegistryResolver.API_STORAGE_ENDPOINT}/${registry}`;

            try {
                const response = await fetch(url, {
                    headers: {
                        'Authorization': authHeader,
                    },
                });

                if (!response.ok) {
                    console.warn(
                        `Failed to fetch storage info for ${registry}: ${response.status} ${response.statusText}`
                    );
                    continue;
                }

                const data = await response.json();

                // Extract scopes from children
                if (data.children && Array.isArray(data.children)) {
                    data.children.forEach((child: any) => {
                        if (child.uri) {
                            // Remove leading slash and extract scope name
                            const scopeName = child.uri.replace(/^\//, '').replace(/\/$/, '');

                            // Only include if it starts with @
                            if (scopeName.startsWith('@')) {
                                allScopes.add(scopeName);
                            }
                        }
                    });
                }
            } catch (error: any) {
                console.warn(
                    `Error fetching scopes for registry ${registry}: ${error.message}`
                );
                continue;
            }
        }

        // read for any additional scopes from the ENV_NPM_MANAGED_SCOPES environment variable
        const additionalScopesEnv = process.env.ENV_NPM_MANAGED_SCOPES;
        if (additionalScopesEnv) {
            const additionalScopes = additionalScopesEnv.split(',').map(s => s.trim()).filter(s => s.startsWith('@'));
            additionalScopes.forEach(scope => allScopes.add(scope));
        }

        return allScopes;
    }
}
