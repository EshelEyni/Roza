declare function connectToTestDB({ isRemoteDB }?: {
    isRemoteDB?: boolean | undefined;
}): Promise<void>;
declare function disconnectFromTestDB(): Promise<void>;
export { connectToTestDB, disconnectFromTestDB };
