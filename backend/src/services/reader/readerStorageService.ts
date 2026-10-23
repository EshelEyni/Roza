import mongoose from "mongoose";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { AppError } from "../error/errorService";

function getReaderBucket() {
  if (!mongoose.connection.db) throw new AppError("Database is unavailable.", 503);
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "reader_files" });
}

async function saveReaderFile(buffer: Buffer, filename: string, userId: string) {
  const bucket = getReaderBucket();
  const upload = bucket.openUploadStream(filename, { metadata: { userId } });
  try {
    await pipeline(Readable.from(buffer), upload);
    return upload.id;
  } catch (error) {
    await upload.abort().catch(() => undefined);
    throw error;
  }
}

async function removeReaderFile(id: mongoose.Types.ObjectId) {
  await getReaderBucket().delete(id);
}

export { getReaderBucket, saveReaderFile, removeReaderFile };
