import * as fs from 'fs';
import * as path from 'path';

export function generateBuildGradleFile(pluginPath: string, pluginDependencies: string[]): void {
    let content = "";
    content += "dependencies {\n";
    pluginDependencies.forEach((dependency) => {
        content += `    cpalcePLugin ${dependency}\n`
    });

    content += "}\n";

    fs.writeFileSync(path.resolve(pluginPath, 'build.gradle'), content, {
        encoding: 'utf8',
    });
}

export function generateSimplePluginDescriptor(pluginPath: string, name: string, pluginDependencies: string[]): void {
    let content = {
        name: name,
        dependencies: pluginDependencies
    }

    fs.writeFileSync(path.resolve(pluginPath, 'pluginDescriptor.json'), JSON.stringify(content, null, 4), {
        encoding: 'utf8',
    });
}

export function generateExtendedPluginDescriptor(pluginPath: string, name: string, group: string, repoName: string, pluginDependencies: any[]): void {
    let content = {
        name: name,
        group: group,
        repoName: repoName,
        dependencies: pluginDependencies
    }

    fs.writeFileSync(path.resolve(pluginPath, 'pluginDescriptor.json'), JSON.stringify(content, null, 4), {
        encoding: 'utf8',
    });
}

export function generatePackageJson(location: string, name: string, version: string): void {
    let content = {
        name: name,
        version: version
    }

    fs.writeFileSync(path.resolve(location, 'package.json'), JSON.stringify(content, null, 4), {
        encoding: 'utf8',
    });
}

export function generateParentRepos(location: string, names: string[]): void {
    let content = {}
    names.forEach((name) => content[`${name}`] = {})

    fs.writeFileSync(path.resolve(location, 'parent-repos.json'), JSON.stringify(content, null, 4), {
        encoding: 'utf8',
    });
}

export function generateVersionGradle(location: string, version: string): void {
    let content = `ext {
        currentVersion= '${version}'
    };`

    fs.writeFileSync(path.resolve(location, 'version.gradle'), content, {
        encoding: 'utf8',
    });
}
