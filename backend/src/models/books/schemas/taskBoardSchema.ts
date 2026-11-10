import { Schema } from "mongoose";
const text = { type: String, required: true, trim: true, maxlength: 500 };
const id = { type: String, required: true, maxlength: 100 };
const item = new Schema(
  { id, title: text, done: { type: Boolean, default: false } },
  { _id: false },
);
const label = new Schema(
  {
    id,
    title: text,
    color: { type: String, required: true, match: /^#[0-9a-f]{6}$/i },
  },
  { _id: false },
);
const card = new Schema(
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
    checklist: [item],
    labels: [label],
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { _id: false },
);
const list = new Schema({ id, title: text, cards: [card] }, { _id: false });
export const taskBoardSchema = new Schema({ lists: [list] }, { _id: false });
