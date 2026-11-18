import { Schema } from "mongoose";
export declare const ReaderFlagModel: import("mongoose").Model<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    text?: unknown;
    context?: unknown;
    userId?: import("mongoose").Types.ObjectId | null | undefined;
    bookId?: import("mongoose").Types.ObjectId | null | undefined;
    chapter?: unknown;
    endCfi?: unknown;
    cfi?: unknown;
    reviewed?: unknown;
}, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    text?: unknown;
    context?: unknown;
    userId?: import("mongoose").Types.ObjectId | null | undefined;
    bookId?: import("mongoose").Types.ObjectId | null | undefined;
    chapter?: unknown;
    endCfi?: unknown;
    cfi?: unknown;
    reviewed?: unknown;
}> & {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    text?: unknown;
    context?: unknown;
    userId?: import("mongoose").Types.ObjectId | null | undefined;
    bookId?: import("mongoose").Types.ObjectId | null | undefined;
    chapter?: unknown;
    endCfi?: unknown;
    cfi?: unknown;
    reviewed?: unknown;
} & {
    _id: import("mongoose").Types.ObjectId;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
    toJSON: {
        virtuals: true;
        transform: (_doc: import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
            text: string;
            context: string;
            userId: import("mongoose").Types.ObjectId;
            bookId: import("mongoose").Types.ObjectId;
            chapter: string;
            endCfi: string;
            cfi: string;
            reviewed: boolean;
        }>> & import("mongoose").FlatRecord<{
            text: string;
            context: string;
            userId: import("mongoose").Types.ObjectId;
            bookId: import("mongoose").Types.ObjectId;
            chapter: string;
            endCfi: string;
            cfi: string;
            reviewed: boolean;
        }> & {
            _id: import("mongoose").Types.ObjectId;
        }, result: Record<string, any>) => void;
    };
}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    text: string;
    context: string;
    userId: import("mongoose").Types.ObjectId;
    bookId: import("mongoose").Types.ObjectId;
    chapter: string;
    endCfi: string;
    cfi: string;
    reviewed: boolean;
}, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    text: string;
    context: string;
    userId: import("mongoose").Types.ObjectId;
    bookId: import("mongoose").Types.ObjectId;
    chapter: string;
    endCfi: string;
    cfi: string;
    reviewed: boolean;
}>> & import("mongoose").FlatRecord<{
    text: string;
    context: string;
    userId: import("mongoose").Types.ObjectId;
    bookId: import("mongoose").Types.ObjectId;
    chapter: string;
    endCfi: string;
    cfi: string;
    reviewed: boolean;
}> & {
    _id: import("mongoose").Types.ObjectId;
}>>;
