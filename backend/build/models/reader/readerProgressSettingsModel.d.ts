import { Schema } from "mongoose";
export declare const ReaderProgressSettingsModel: import("mongoose").Model<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    defaultProgressDisplay: "percentage" | "section" | "book";
}, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    defaultProgressDisplay: "percentage" | "section" | "book";
}> & {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    defaultProgressDisplay: "percentage" | "section" | "book";
} & {
    _id: import("mongoose").Types.ObjectId;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    defaultProgressDisplay: "percentage" | "section" | "book";
}, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    defaultProgressDisplay: "percentage" | "section" | "book";
}>> & import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    defaultProgressDisplay: "percentage" | "section" | "book";
}> & {
    _id: import("mongoose").Types.ObjectId;
}>>;
