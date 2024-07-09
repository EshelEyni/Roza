import { IReference } from "@rozaeyni/common";
import { Document, Schema } from "mongoose";

const referenceSchema = new Schema<IReference>(
  {
    page: {
      type: Number,
    },
    text: {
      type: String,
      trim: true,
    },
    imgUrls: {
      type: [String],
    },
  },
  {
    toObject: {
      virtuals: true,
      transform: (_: Document, ret: Record<string, unknown>) => {
        delete ret._id;
        return ret;
      },
    },
    toJSON: {
      virtuals: true,
      transform: (_: Document, ret: Record<string, unknown>) => {
        delete ret._id;
        return ret;
      },
    },
    timestamps: true,
  },
);

export { referenceSchema };
