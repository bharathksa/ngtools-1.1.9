import * as ts from 'typescript';
import * as fs from 'fs';
export interface OnErrorFn {
    (message: string): void;
}
export declare class VirtualStats implements fs.Stats {
    protected _path: string;
    protected _ctime: Date;
    protected _mtime: Date;
    protected _atime: Date;
    protected _btime: Date;
    protected _dev: number;
    protected _ino: number;
    protected _mode: number;
    protected _uid: any;
    protected _gid: any;
    constructor(_path: string);
    isFile(): boolean;
    isDirectory(): boolean;
    isBlockDevice(): boolean;
    isCharacterDevice(): boolean;
    isSymbolicLink(): boolean;
    isFIFO(): boolean;
    isSocket(): boolean;
    readonly dev: number;
    readonly ino: number;
    readonly mode: number;
    readonly nlink: number;
    readonly uid: any;
    readonly gid: any;
    readonly rdev: number;
    readonly size: number;
    readonly blksize: number;
    readonly blocks: number;
    readonly atime: Date;
    readonly mtime: Date;
    readonly ctime: Date;
    readonly birthtime: Date;
}
export declare class VirtualDirStats extends VirtualStats {
    constructor(_fileName: string);
    isDirectory(): boolean;
    readonly size: number;
}
export declare class VirtualFileStats extends VirtualStats {
    private _content;
    private _sourceFile;
    constructor(_fileName: string, _content: string);
    content: string;
    getSourceFile(languageVersion: ts.ScriptTarget, setParentNodes: boolean): ts.SourceFile;
    isFile(): boolean;
    readonly size: number;
}
export declare class WebpackCompilerHost implements ts.CompilerHost {
    private _options;
    private _delegate;
    private _files;
    private _directories;
    private _changed;
    private _basePath;
    private _setParentNodes;
    constructor(_options: ts.CompilerOptions, basePath: string);
    private _normalizePath(path);
    private _resolve(path);
    private _setFileContent(fileName, content);
    populateWebpackResolver(resolver: any): void;
    fileExists(fileName: string): boolean;
    readFile(fileName: string): string;
    directoryExists(directoryName: string): boolean;
    getFiles(path: string): string[];
    getDirectories(path: string): string[];
    getSourceFile(fileName: string, languageVersion: ts.ScriptTarget, onError?: OnErrorFn): ts.SourceFile;
    getCancellationToken(): ts.CancellationToken;
    getDefaultLibFileName(options: ts.CompilerOptions): string;
    readonly writeFile: (fileName: string, data: string, writeByteOrderMark: boolean, onError?: (message: string) => void, sourceFiles?: ts.SourceFile[]) => void;
    getCurrentDirectory(): string;
    getCanonicalFileName(fileName: string): string;
    useCaseSensitiveFileNames(): boolean;
    getNewLine(): string;
}
