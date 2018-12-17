export interface ICompileRequest {
    pluginName: string;
    assetsPath: string;
    mainRepoDir: string;
    verbose?: boolean;
    less?: boolean;
    ts?: boolean;
    compressCss?: boolean;
}

export interface ICompilerConstructor {
    new(pluginName: string, assetsPath: string, mainRepoDir: string): ICompiler;
}

export interface ICompiler {
    compile(): Promise<void>;
}
