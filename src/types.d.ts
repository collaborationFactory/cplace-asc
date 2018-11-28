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


export interface StringObj<T> {
    [key: string]: T
}
