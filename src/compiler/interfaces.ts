export interface ICompileRequest {
    pluginName: string;
    dependencyPaths: string[];
    assetsPath: string;
    mainRepoDir: string;
    isProduction: boolean;
    verbose?: boolean;
    less?: boolean;
    ts?: boolean;
    openAPIYaml?: boolean;
    vendor?: boolean;
    tsE2E?: boolean;
    compressCss?: boolean;
}

export enum ProcessState {
    DONE = 'done',
    FAILED = 'failed',
}

export interface ICompileResponse {
    state: ProcessState;
    result?: CompilationResult;
}

export interface ICompilerConstructor {
    new (
        pluginName: string,
        dependencyPaths: string[],
        assetsPath: string,
        mainRepoDir: string,
        isProduction: boolean
    ): ICompiler;
}

export enum CompilationResult {
    UNCHANGED = 'unchanged',
    CHANGED = 'modified',
}

export interface ICompiler {
    compile(): Promise<CompilationResult>;
}
