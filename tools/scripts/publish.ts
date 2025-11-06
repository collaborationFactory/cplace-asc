import { execSync } from 'child_process';
import { CPLACE_ASC_DIST } from './shared';
import { resolve } from 'path';

async function publishToArtifactory() {
    console.log(`Publishing release candidate to private registry...`);

    // generate local .npmrc for publishing to private registry
    const registry = process.env.ARTIFACTORY_PUBLISH_REGISTRY;
    const actor = process.env.ARTIFACTORY_PUBLISH_ACTOR;
    const token = process.env.ARTIFACTORY_PUBLISH_TOKEN;

    if (!registry || !actor || !token) {
        throw Error('Missing Artifactory environment variables');
    }

    const basicAuth = Buffer.from(`${actor}:${token}`).toString('base64');
    const url = `https://cplace.jfrog.io/artifactory/api/npm/${registry}/auth/cplace`;

    const res = await fetch(url, {
        headers: { Authorization: `Basic ${basicAuth}` }
    });
    if (!res.ok) {
        throw new Error(`Failed fetching npm auth info: ${res.status} ${res.statusText}`);
    }
    const npmrcContent = await res.text();

    require('fs').writeFileSync('.npmrc', npmrcContent, { encoding: 'utf-8' });

    console.log('.npmrc created for private registry publish');

    execSync(`npm publish --workspaces --include-workspace-root --tag rc`);
    console.log(`Release candidate published to private registry!`);
    process.exit(0);
}

async function doPublish() {
    const tag = process.env.TAG;

    if (!tag) {
        throw Error('No tag provided!');
    }

    const version = tag.split('v')[1];
    const isSnapshot = version?.includes('SNAPSHOT');

    console.log(`Building cplace-asc...`);
    const buildScriptPath = resolve(__dirname, 'build.ts');
    console.log(execSync(`npx ts-node ${buildScriptPath} ${version}`).toString());
    console.log(`cplace-asc successfully built!`);
    process.chdir(CPLACE_ASC_DIST);
    console.log(`Publishing cplace-asc...`);

    if (version.match(/-rc\.\d+$/)) {
        await publishToArtifactory();
    } else {
        console.log(`Publishing cplace-asc to npmjs.org`);
        execSync(
            `npm publish --workspaces --include-workspace-root ${
                isSnapshot ? '--tag snapshot' : ''
            }`
        );
        console.log(`cplace-asc published to npmjs.org!`);
    }
    console.log(`cplace-asc published!`);
}

doPublish()