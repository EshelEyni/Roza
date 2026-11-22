/**
 * Port of Roza's Mongoose book schemas (C:\dev\Roza\backend\src\models\books).
 * Used to cast and validate documents exactly the way the Roza backend would,
 * so defaults, _ids and enums match. Keep in sync when Roza's schemas change.
 */
import { Connection, Schema } from "mongoose";

const defaultSlate = () => [{ type: "paragraph", children: [{ text: "" }] }];

export const slateElementSchema = new Schema({
  type: { type: String, required: true },
  children: [{ type: Schema.Types.Mixed, default: [] }],
  align: { type: String, enum: ["left", "center", "right", "justify"] },
});

const text = { type: String, required: true, trim: true, maxlength: 500 };
const id = { type: String, required: true, maxlength: 100 };
const taskBoardSchema = new Schema(
  {
    lists: [
      new Schema(
        {
          id,
          title: text,
          cards: [
            new Schema(
              {
                id,
                title: text,
                chapterId: { type: String, default: "", maxlength: 100 },
                completed: { type: Boolean, default: false },
                description: { type: String, default: "", maxlength: 100000 },
                dueDate: {
                  type: String,
                  default: "",
                  validate: (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
                },
                checklist: [new Schema({ id, title: text, done: { type: Boolean, default: false } }, { _id: false })],
                labels: [
                  new Schema(
                    { id, title: text, color: { type: String, required: true, match: /^#[0-9a-f]{6}$/i } },
                    { _id: false },
                  ),
                ],
                createdAt: { type: String, required: true },
                updatedAt: { type: String, required: true },
              },
              { _id: false },
            ),
          ],
        },
        { _id: false },
      ),
    ],
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
  { themes: [linkSchema], plotlines: [linkSchema], characters: [linkSchema] },
  { _id: false },
);

const pointSchema = new Schema(
  {
    path: {
      type: [Number],
      required: true,
      validate: (path: number[]) => path.length > 0 && path.every((n) => Number.isInteger(n) && n >= 0),
    },
    offset: { type: Number, required: true, min: 0, validate: Number.isInteger },
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
        { anchor: { type: pointSchema, required: true }, focus: { type: pointSchema, required: true } },
        { _id: false },
      ),
      default: null,
    },
  },
  { _id: false },
);
const draftSchema = new Schema(
  {
    id: { type: String, required: true },
    chapterId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    text: { type: [slateElementSchema], required: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    annotations: { type: [annotationSchema], default: undefined },
    format: { type: String, enum: ["prose", "screenplay"] },
  },
  { _id: false },
);

const subOptions = { timestamps: true } as const;

export const chapterSchema = new Schema(
  {
    drafts: { type: [draftSchema], default: undefined },
    taskBoard: { type: taskBoardSchema, default: undefined },
    planning: { type: planningSchema, default: undefined },
    annotations: { type: [annotationSchema], default: undefined },
    bookId: { type: Schema.Types.ObjectId, required: true },
    format: { type: String, enum: ["prose", "screenplay"], default: "prose" },
    name: { type: String, default: "פרק חדש", trim: true },
    description: { type: [slateElementSchema], default: defaultSlate },
    text: { type: [slateElementSchema], default: defaultSlate },
    isArchived: { type: Boolean, default: false },
    type: { type: String, enum: ["chapters"], default: "chapters" },
  },
  subOptions,
);

const colored = (kind: string, defaultName?: string) =>
  new Schema(
    {
      color: { type: String, default: "", validate: (v: string) => !v || /^#[0-9a-f]{6}$/i.test(v) },
      bookId: { type: Schema.Types.ObjectId, required: true },
      name: defaultName
        ? { type: String, default: defaultName, trim: true }
        : { type: String, required: [true, "Please provide a name"], trim: true },
      description: { type: [slateElementSchema], default: defaultSlate },
      isArchived: { type: Boolean, default: false },
      type: { type: String, enum: [kind], default: kind },
    },
    subOptions,
  );

export const characterSchema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, default: "character", trim: true },
    description: { type: [slateElementSchema], default: defaultSlate },
    isArchived: { type: Boolean, default: false },
    type: { type: String, enum: ["characters"], default: "characters" },
  },
  subOptions,
);
export const themeSchema = colored("themes");
export const plotlineSchema = colored("plotlines", "plotline");
export const noteSchema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, default: "" },
    text: { type: [slateElementSchema], default: defaultSlate },
    isArchived: { type: Boolean, default: false },
    type: { type: String, enum: ["notes"], default: "notes" },
  },
  subOptions,
);

export const bookSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: [true, "Please provide a user Id"] },
    name: { type: String, required: [true, "Please provide a name"], trim: true },
    taskBoard: { type: taskBoardSchema, default: undefined },
    chapters: [chapterSchema],
    characters: [characterSchema],
    themes: [themeSchema],
    plotlines: [plotlineSchema],
    notes: [noteSchema],
    filterBy: {
      type: String,
      enum: ["chapters", "characters", "themes", "plotlines", "notes"],
      default: "chapters",
    },
    isArchived: { type: Boolean, default: false },
    isReadMode: { type: Boolean, default: false },
    wordGoal: { type: Number, min: 1, max: 10_000_000, validate: Number.isInteger },
  },
  { timestamps: true },
);

export const bookModelFor = (conn: Connection) =>
  conn.models.StagingRoomBook || conn.model("StagingRoomBook", bookSchema, "books");
