import { Schema } from "mongoose";
export declare const ReaderKeyboardSettingsModel: import("mongoose").Model<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    unit: "words" | "sentences";
    count: number;
}, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    unit: "words" | "sentences";
    count: number;
}> & {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    unit: "words" | "sentences";
    count: number;
} & {
    _id: import("mongoose").Types.ObjectId;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    unit: "words" | "sentences";
    count: number;
}, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    unit: "words" | "sentences";
    count: number;
}>> & import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    unit: "words" | "sentences";
    count: number;
}> & {
    _id: import("mongoose").Types.ObjectId;
}>>;
