import { Schema } from "mongoose";
import { ISlateCustomElement, ISlateCustomText } from "../../types/iTypes";
declare const SlateCustomTextSchema: Schema<ISlateCustomText, import("mongoose").Model<ISlateCustomText, any, any, any, import("mongoose").Document<unknown, any, ISlateCustomText> & ISlateCustomText & Required<{
    _id: unknown;
}>, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ISlateCustomText, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<ISlateCustomText>> & import("mongoose").FlatRecord<ISlateCustomText> & Required<{
    _id: unknown;
}>>;
declare const SlateCustomElementSchema: Schema<ISlateCustomElement, import("mongoose").Model<ISlateCustomElement, any, any, any, import("mongoose").Document<unknown, any, ISlateCustomElement> & ((import("../../../../shared/types/books").ListItemElement & import("mongoose").Document<unknown, any, any> & Required<{
    _id: unknown;
}>) | (import("../../../../shared/types/books").ListElement & import("mongoose").Document<unknown, any, any> & Required<{
    _id: unknown;
}>) | (import("../../../../shared/types/books").ParagraphElement & import("mongoose").Document<unknown, any, any> & Required<{
    _id: unknown;
}>) | (import("../../../../shared/types/books").HeadingOneElement & import("mongoose").Document<unknown, any, any> & Required<{
    _id: unknown;
}>) | (import("../../../../shared/types/books").HeadingTwoElement & import("mongoose").Document<unknown, any, any> & Required<{
    _id: unknown;
}>) | (import("../../../../shared/types/books").BlockQuoteElement & import("mongoose").Document<unknown, any, any> & Required<{
    _id: unknown;
}>)), any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ISlateCustomElement, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<ISlateCustomElement>> & ((import("mongoose").FlatRecord<import("../../../../shared/types/books").ListItemElement & import("mongoose").Document<unknown, any, any>> & Required<{
    _id: unknown;
}>) | (import("mongoose").FlatRecord<import("../../../../shared/types/books").ListElement & import("mongoose").Document<unknown, any, any>> & Required<{
    _id: unknown;
}>) | (import("mongoose").FlatRecord<import("../../../../shared/types/books").ParagraphElement & import("mongoose").Document<unknown, any, any>> & Required<{
    _id: unknown;
}>) | (import("mongoose").FlatRecord<import("../../../../shared/types/books").HeadingOneElement & import("mongoose").Document<unknown, any, any>> & Required<{
    _id: unknown;
}>) | (import("mongoose").FlatRecord<import("../../../../shared/types/books").HeadingTwoElement & import("mongoose").Document<unknown, any, any>> & Required<{
    _id: unknown;
}>) | (import("mongoose").FlatRecord<import("../../../../shared/types/books").BlockQuoteElement & import("mongoose").Document<unknown, any, any>> & Required<{
    _id: unknown;
}>))>;
export { SlateCustomTextSchema, SlateCustomElementSchema };
