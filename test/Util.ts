import * as rimraf from "rimraf";
import * as fs from "fs";
import * as path from "path";

export function removeTestFolder(basePath: string) {
    if (fs.existsSync(path.join(basePath))) {
        console.log('cleaning testfolder', path.join(basePath));
        rimraf.sync(path.join(basePath));
    }
}
