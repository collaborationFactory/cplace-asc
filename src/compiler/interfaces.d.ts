export interface ICompileRequest {
    pluginName: string;
    assetsPath: string;
    mainRepoDir: string;
    isProduction: boolean;
    verbose?: boolean;
    less?: boolean;
    ts?: boolean;
    compressCss?: boolean;
}

export interface ICompilerConstructor {
    new(pluginName: string,
        assetsPath: string,
        mainRepoDir: string,
        isProduction: boolean): ICompiler;
}

export interface ICompiler {
    compile(): Promise<void>;
}
