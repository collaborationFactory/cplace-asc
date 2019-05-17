export interface ICompileRequest {
    pluginName: string;
    assetsPath: string;
    mainRepoDir: string;
    isProduction: boolean;
    verbose?: boolean;
    less?: boolean;
    ts?: boolean;
    tsE2E?: boolean;
    compressCss?: boolean;
}

export enum ProcessState {
    DONE = 'done',
    FAILED = 'failed'
}

export interface ICompileResponse {
    state: ProcessState;
    result?: CompilationResult;
}

export interface ICompilerConstructor {
    new(pluginName: string,
        assetsPath: string,
        mainRepoDir: string,
        isProduction: boolean): ICompiler;
}

export enum CompilationResult {
    UNCHANGED = 'unchanged',
    CHANGED = 'modified'
}

export interface ICompiler {
    compile(): Promise<CompilationResult>;
}

export enum ConfigGenerator {
    PLATFORM_PLUGIN = 'cf.cplace.platform',
    PLATFORM_PLUGIN_E2E = 'cf.cplace.platformE2E',
    REL_REPO_ROOT_PREFIX = '../../..',
    TS_CONFIG_JSON = 'tsconfig.json'
}
