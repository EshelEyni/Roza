import { Schema } from "mongoose";
export declare const ReaderAnnotationModel: import("mongoose").Model<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    text?: unknown;
    userId?: import("mongoose").Types.ObjectId | null | undefined;
    color?: unknown;
    bookId?: import("mongoose").Types.ObjectId | null | undefined;
    note?: unknown;
    chapter?: unknown;
    endCfi?: unknown;
    cfi?: unknown;
    flagged?: unknown;
}, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    text?: unknown;
    userId?: import("mongoose").Types.ObjectId | null | undefined;
    color?: unknown;
    bookId?: import("mongoose").Types.ObjectId | null | undefined;
    note?: unknown;
    chapter?: unknown;
    endCfi?: unknown;
    cfi?: unknown;
    flagged?: unknown;
}> & {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    text?: unknown;
    userId?: import("mongoose").Types.ObjectId | null | undefined;
    color?: unknown;
    bookId?: import("mongoose").Types.ObjectId | null | undefined;
    note?: unknown;
    chapter?: unknown;
    endCfi?: unknown;
    cfi?: unknown;
    flagged?: unknown;
} & {
    _id: import("mongoose").Types.ObjectId;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
    toJSON: {
        virtuals: true;
        transform: (_doc: import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
            text: string;
            userId: import("mongoose").Types.ObjectId;
            color: "none" | "yellow" | "green" | "blue" | "pink";
            bookId: import("mongoose").Types.ObjectId;
            note: string;
            chapter: string;
            endCfi: string;
            cfi: string;
            flagged: boolean;
        }>> & import("mongoose").FlatRecord<{
            text: string;
            userId: import("mongoose").Types.ObjectId;
            color: "none" | "yellow" | "green" | "blue" | "pink";
            bookId: import("mongoose").Types.ObjectId;
            note: string;
            chapter: string;
            endCfi: string;
            cfi: string;
            flagged: boolean;
        }> & {
            _id: import("mongoose").Types.ObjectId;
        }, result: Record<string, any>) => void;
    };
}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    text: string;
    userId: import("mongoose").Types.ObjectId;
    color: "none" | "yellow" | "green" | "blue" | "pink";
    bookId: import("mongoose").Types.ObjectId;
    note: string;
    chapter: string;
    endCfi: string;
    cfi: string;
    flagged: boolean;
}, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    text: string;
    userId: import("mongoose").Types.ObjectId;
    color: "none" | "yellow" | "green" | "blue" | "pink";
    bookId: import("mongoose").Types.ObjectId;
    note: string;
    chapter: string;
    endCfi: string;
    cfi: string;
    flagged: boolean;
}>> & import("mongoose").FlatRecord<{
    text: string;
    userId: import("mongoose").Types.ObjectId;
    color: "none" | "yellow" | "green" | "blue" | "pink";
    bookId: import("mongoose").Types.ObjectId;
    note: string;
    chapter: string;
    endCfi: string;
    cfi: string;
    flagged: boolean;
}> & {
    _id: import("mongoose").Types.ObjectId;
}>>;
