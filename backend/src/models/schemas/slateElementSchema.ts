import { Schema } from "mongoose";
import { ISlateCustomElement, ISlateCustomText } from "../../types/iTypes";

const SlateCustomTextSchema = new Schema<ISlateCustomText>({
  text: {
    type: String,
    required: true,
  },
  bold: {
    type: Boolean,
    default: false,
  },
  italic: {
    type: Boolean,
    default: false,
  },
  underline: {
    type: Boolean,
    default: false,
  },
});

const SlateCustomElementSchema = new Schema<ISlateCustomElement>({
  type: {
    type: String,
    required: true,
  },
  children: [
    {
      type: Schema.Types.Mixed,
    },
  ],
  align: {
    type: String,
    enum: ["left", "center", "right", "justify"],
  },
});

export { SlateCustomTextSchema, SlateCustomElementSchema };
