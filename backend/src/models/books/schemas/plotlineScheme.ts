import { Schema } from "mongoose";

import { IPlotline } from "../../../types/iTypes";

const plotlineSchema = new Schema<IPlotline>(
  {
    bookId: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide a book id"],
    },
    name: {
      type: String,
      default: "plotline",
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

export { plotlineSchema };
