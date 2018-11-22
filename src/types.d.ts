export interface IRunConfig {
    plugins: string[];
}

export type LessEntryFile = 'plugin' | 'cplace';

export interface ICompileRequest {
    pluginName: string;
    assetsPath: string;
    less?: boolean;
    ts?: boolean;
}

export interface ICompileResponse {
    pluginName: string;
    tsStats?: any;
    lessStats?: any;
}

export interface ICompiler {
    compile(): Promise<any>;
}

export interface ICompilerConstructor {
    new(pluginName: string, path: string): ICompiler;
}


export interface StringObj<T> {
    [key: string]: T
}
