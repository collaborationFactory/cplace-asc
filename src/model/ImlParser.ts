declare function require(name: string): any;

const fs = require('fs');
const parseString = require('xml2js').parseString;

export interface IImlModuleDependency {
    moduleName: string;
    isTestScoped: boolean;
}

export class ImlParser {
    private _module: any;

    constructor(private pathToIml: string) {
        if (!fs.existsSync(pathToIml)) {
            throw Error(`IML ${pathToIml} does not exist`);
        }
        this.parseFile();
    }

    public getReferencedModules(): IImlModuleDependency[] {
        const components = this._module.component as any[];
        let result: IImlModuleDependency[] = [];

        if (components) {
            components.forEach(component => {
                if (component.$.name === 'NewModuleRootManager') {
                    result = ImlParser.getReferencedModulesFromManager(component);
                }
            });
        }

        return result;
    }

    private parseFile(): void {
        if (this._module) {
            return;
        }

        const imlContent = fs.readFileSync(this.pathToIml, 'utf8');
        parseString(imlContent, (err: any, result: any) => {
            this._module = result.module;
        });
    }

    private static getReferencedModulesFromManager(component: any): IImlModuleDependency[] {
        const entries = component.orderEntry as any[];
        if (!entries) {
            return [];
        }

        return entries
            .filter(entry => entry.$.type && entry.$.type === 'module')
            .map(entry => {
                return {
                    moduleName: entry.$['module-name'],
                    isTestScoped: entry.$['scope'] === 'TEST'
                };
            })
            .filter(dep => {
                return !!dep.moduleName;
            });
    }
}
