export interface ICompilerConstructor {
    new(pluginName: string, path: string): ICompiler;
}

export interface ICompiler {
    compile(): Promise<any>;
}
