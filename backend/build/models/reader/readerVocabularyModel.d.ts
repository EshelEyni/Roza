export declare const ReaderVocabularyModel: import("mongoose").Model<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    headword: string;
    reviewHiddenBookIds: import("mongoose").Types.ObjectId[];
    reviewedBookIds: import("mongoose").Types.ObjectId[];
    entry: any;
    lookupCount: number;
    observedForms: string[];
    bookIds: import("mongoose").Types.ObjectId[];
    firstLookedUpAt: Date;
    lastLookedUpAt: Date;
}, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    headword: string;
    reviewHiddenBookIds: import("mongoose").Types.ObjectId[];
    reviewedBookIds: import("mongoose").Types.ObjectId[];
    entry: any;
    lookupCount: number;
    observedForms: string[];
    bookIds: import("mongoose").Types.ObjectId[];
    firstLookedUpAt: Date;
    lastLookedUpAt: Date;
}> & {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    headword: string;
    reviewHiddenBookIds: import("mongoose").Types.ObjectId[];
    reviewedBookIds: import("mongoose").Types.ObjectId[];
    entry: any;
    lookupCount: number;
    observedForms: string[];
    bookIds: import("mongoose").Types.ObjectId[];
    firstLookedUpAt: Date;
    lastLookedUpAt: Date;
} & {
    _id: import("mongoose").Types.ObjectId;
}, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    headword: string;
    reviewHiddenBookIds: import("mongoose").Types.ObjectId[];
    reviewedBookIds: import("mongoose").Types.ObjectId[];
    entry: any;
    lookupCount: number;
    observedForms: string[];
    bookIds: import("mongoose").Types.ObjectId[];
    firstLookedUpAt: Date;
    lastLookedUpAt: Date;
}, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    headword: string;
    reviewHiddenBookIds: import("mongoose").Types.ObjectId[];
    reviewedBookIds: import("mongoose").Types.ObjectId[];
    entry: any;
    lookupCount: number;
    observedForms: string[];
    bookIds: import("mongoose").Types.ObjectId[];
    firstLookedUpAt: Date;
    lastLookedUpAt: Date;
}>> & import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    headword: string;
    reviewHiddenBookIds: import("mongoose").Types.ObjectId[];
    reviewedBookIds: import("mongoose").Types.ObjectId[];
    entry: any;
    lookupCount: number;
    observedForms: string[];
    bookIds: import("mongoose").Types.ObjectId[];
    firstLookedUpAt: Date;
    lastLookedUpAt: Date;
}> & {
    _id: import("mongoose").Types.ObjectId;
}>>;
export declare const ReaderLookupModel: import("mongoose").Model<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    bookId: import("mongoose").Types.ObjectId;
    location: string;
    word: string;
    headword: string;
    requestId: string;
    provider: "auto" | "google";
}, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    bookId: import("mongoose").Types.ObjectId;
    location: string;
    word: string;
    headword: string;
    requestId: string;
    provider: "auto" | "google";
}> & {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    bookId: import("mongoose").Types.ObjectId;
    location: string;
    word: string;
    headword: string;
    requestId: string;
    provider: "auto" | "google";
} & {
    _id: import("mongoose").Types.ObjectId;
}, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    bookId: import("mongoose").Types.ObjectId;
    location: string;
    word: string;
    headword: string;
    requestId: string;
    provider: "auto" | "google";
}, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    bookId: import("mongoose").Types.ObjectId;
    location: string;
    word: string;
    headword: string;
    requestId: string;
    provider: "auto" | "google";
}>> & import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    userId: import("mongoose").Types.ObjectId;
    bookId: import("mongoose").Types.ObjectId;
    location: string;
    word: string;
    headword: string;
    requestId: string;
    provider: "auto" | "google";
}> & {
    _id: import("mongoose").Types.ObjectId;
}>>;
