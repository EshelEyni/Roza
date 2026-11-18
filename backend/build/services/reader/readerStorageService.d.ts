import mongoose from "mongoose";
declare function getReaderBucket(): mongoose.mongo.GridFSBucket;
declare function saveReaderFile(buffer: Buffer, filename: string, userId: string): Promise<mongoose.mongo.BSON.ObjectId>;
declare function removeReaderFile(id: mongoose.Types.ObjectId): Promise<void>;
export { getReaderBucket, saveReaderFile, removeReaderFile };
