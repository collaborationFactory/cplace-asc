import * as path from 'path';
import * as fs from 'fs';
import {cgreen, debug, GREEN_CHECK, RED_CROSS} from './console';
import * as https from 'https';
import {Socket} from 'net';

export async function checkForUpdate(): Promise<void> {
    process.stdout.write(cgreen`⇢` + ` Checking whether newer version is available... `);

    try {
        const packageJsonContent = fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);
        const currentVersion = Version.parse(packageJson.version);
        if (!currentVersion) {
            process.stdout.write(RED_CROSS + '\n');
            debug(`[UpdateCheck] Could not check whether a newer version is available, continuing...`);
            return;
        }

        const remoteVersion = await getRemoteVersionFromRegistry(packageJson.name);
        if (!remoteVersion) {
            process.stdout.write(RED_CROSS + '\n');
            debug(`[UpdateCheck] Could not check whether a newer version is available, continuing...`);
            return;
        }

        process.stdout.write(GREEN_CHECK + '\n');

        if (remoteVersion.isNewerThan(currentVersion)) {
            console.log(cgreen`!---------------------------------------------!`);
            console.log(cgreen`! A newer version of @cplace/asc is available !`);
            console.log(cgreen`! -> Please update to the latest version:     !`);
            console.log(cgreen`!    npm install -g @cplace/asc               !`);
            console.log(cgreen`!---------------------------------------------!`);
        }
        console.log();
    } catch (e) {
        process.stdout.write(RED_CROSS + '\n');
        debug(`[UpdateCheck] Failed to check whether an update is available, continuing...`);
        debug(e);
    }
}

async function getRemoteVersionFromRegistry(packageName: string): Promise<Version | null> {
    try {
        const p = new Promise<string>((resolve, reject) => {
            const req = https.request({
                method: 'GET',
                hostname: 'registry.npmjs.org',
                path: `/-/package/${packageName}/dist-tags`,
                timeout: 2000
            }, res => {
                let data = '';
                res.on('data', chunk => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve(data);
                });
            });
            req.on('socket', (socket: Socket) => {
                socket.setTimeout(2000);
                socket.on('timeout', () => {
                    req.abort();
                });
            });
            req.on('error', err => {
                reject(err);
            });
            req.end();
        });
        const body = await p;
        const content = JSON.parse(body);
        return Version.parse(content.latest);
    } catch (e) {
        debug(e);
        return null;
    }
}

class Version {
    constructor(public major: number, public minor: number, public patch: number) {
    }

    public static parse(version: string): Version | null {
        const parts = version.split('.');
        const segments: number[] = [-1, -1, -1];

        for (let i = 0; i < parts.length; i++) {
            try {
                segments[i] = parseInt(parts[i], 10);
            } catch (e) {
                return null;
            }
        }

        return new Version(segments[0], segments[1], segments[2]);
    }

    public isNewerThan(other: Version): boolean {
        if (this.major > other.major) {
            return true;
        } else if (this.major < other.major) {
            return false;
        } else if (this.minor > other.minor) {
            return true;
        } else if (this.minor < other.minor) {
            return false;
        } else {
            return this.patch > other.patch;
        }
    }
}