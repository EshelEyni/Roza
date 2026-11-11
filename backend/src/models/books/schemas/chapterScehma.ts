import { taskBoardSchema } from "./taskBoardSchema";
import { Schema } from "mongoose";
import { IChapter } from "../../../types/iTypes";
import { SlateCustomElementSchema } from "../../schemas/slateElementSchema";
import { getDefaultSlateElement } from "../../../services/util/utilService";

const pointSchema = new Schema(
  {
    path: {
      type: [Number],
      required: true,
      validate: (path: number[]) =>
        path.length > 0 && path.every((n) => Number.isInteger(n) && n >= 0),
    },
    offset: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
  },
  { _id: false },
);
const annotationSchema = new Schema(
  {
    id: { type: String, required: true },
    general: { type: Boolean, default: undefined },
    content: { type: String, default: "", maxlength: 50000 },
    quote: { type: String, default: "", maxlength: 500 },
    anchor: {
      type: new Schema(
        {
          anchor: { type: pointSchema, required: true },
          focus: { type: pointSchema, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { _id: false },
);

const linkSchema = new Schema(
  {
    entityId: { type: String, required: true, match: /^[a-f0-9]{24}$/i },
    note: { type: String, default: "", maxlength: 50000 },
  },
  { _id: false },
);
const planningSchema = new Schema(
  {
    themes: [linkSchema],
    plotlines: [linkSchema],
    characters: [linkSchema],
  },
  { _id: false },
);
const chapterSchema = new Schema<IChapter>(
  {
    taskBoard: { type: taskBoardSchema, default: undefined },
    planning: { type: planningSchema, default: undefined },
    annotations: { type: [annotationSchema], default: undefined },
    bookId: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide a book id"],
    },
    format: { type: String, enum: ["prose", "screenplay"], default: "prose" },
    name: {
      type: String,
      default: "פרק חדש",
      trim: true,
    },
    description: {
      type: [SlateCustomElementSchema],
      default: getDefaultSlateElement(),
    },
    text: {
      type: [SlateCustomElementSchema],
      default: getDefaultSlateElement(),
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ["chapters"],
      default: "chapters",
    },
  },
  {
    toObject: {
      virtuals: true,
    },
    toJSON: {
      virtuals: true,
    },
    timestamps: true,
  },
);

export { chapterSchema };
