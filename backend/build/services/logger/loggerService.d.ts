declare function debug(...args: any[]): void;
declare function info(...args: string[]): void;
declare function success(...args: string[]): void;
declare function warn(...args: string[]): void;
declare function error(...args: Array<string | Error>): void;
export declare const logger: {
    debug: typeof debug;
    info: typeof info;
    success: typeof success;
    warn: typeof warn;
    error: typeof error;
};
export {};
