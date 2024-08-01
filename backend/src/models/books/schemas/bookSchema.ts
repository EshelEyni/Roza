import { Document, Query, Schema } from "mongoose";
import { chapterSchema } from "./chapterScehma";
import { IBook, IChapter, ICharacter, INote, IPlotline, ITheme } from "../../../types/iTypes";
import { characterSchema } from "./characterSchema";
import { themeSchema } from "./themeSchema";
import { plotlineSchema } from "./plotlineScheme";
import { noteSchema } from "./noteSchema";

const bookSchema = new Schema<IBook>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide a user Id"],
    },
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
    },
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
    isArchived: {
      type: Boolean,
      default: false,
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

bookSchema.index({
  name: "text",
  "chapters.text": "text",
  "characters.description": "text",
  "themes.description": "text",
  "plotlines.description": "text",
  "notes.text": "text",
});

bookSchema.pre(/^find/, async function (this: Query<Document, Document>, next) {
  this.find({ isArchived: { $ne: true } });
  next();
});

bookSchema.post(/^find/, async function (data, next) {
  if (!data) return next();
  if (Array.isArray(data)) for (const doc of data) filterArchivedItems(doc);
  else filterArchivedItems(data);
  next();
});

function filterArchivedItems(doc: IBook) {
  if (!doc) return;
  if (doc.chapters && doc.chapters.length)
    doc.chapters = doc.chapters.filter((c: IChapter) => !c.isArchived);
  if (doc.characters && doc.characters.length)
    doc.characters = doc.characters.filter((c: ICharacter) => !c.isArchived);
  if (doc.themes && doc.themes.length) doc.themes = doc.themes.filter((t: ITheme) => !t.isArchived);
  if (doc.plotlines && doc.plotlines.length)
    doc.plotlines = doc.plotlines.filter((p: IPlotline) => !p.isArchived);
  if (doc.notes && doc.notes.length) doc.notes = doc.notes.filter((n: INote) => !n.isArchived);
}

export { bookSchema };
