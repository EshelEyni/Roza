import { Schema } from "mongoose";
declare const ReaderAiSettingsModel: import("mongoose").Model<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    model: "default" | "gpt-4.1-mini" | "gpt-6-luna" | "gpt-6.1-terra" | "gpt-6.1-sol" | "gpt-6-astra";
    userId: import("mongoose").Types.ObjectId;
    simpleLanguage: boolean;
    customInstructions: string;
    answerLength: "short" | "standard" | "detailed";
}, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    model: "default" | "gpt-4.1-mini" | "gpt-6-luna" | "gpt-6.1-terra" | "gpt-6.1-sol" | "gpt-6-astra";
    userId: import("mongoose").Types.ObjectId;
    simpleLanguage: boolean;
    customInstructions: string;
    answerLength: "short" | "standard" | "detailed";
}> & {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    model: "default" | "gpt-4.1-mini" | "gpt-6-luna" | "gpt-6.1-terra" | "gpt-6.1-sol" | "gpt-6-astra";
    userId: import("mongoose").Types.ObjectId;
    simpleLanguage: boolean;
    customInstructions: string;
    answerLength: "short" | "standard" | "detailed";
} & {
    _id: import("mongoose").Types.ObjectId;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    model: "default" | "gpt-4.1-mini" | "gpt-6-luna" | "gpt-6.1-terra" | "gpt-6.1-sol" | "gpt-6-astra";
    userId: import("mongoose").Types.ObjectId;
    simpleLanguage: boolean;
    customInstructions: string;
    answerLength: "short" | "standard" | "detailed";
}, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    model: "default" | "gpt-4.1-mini" | "gpt-6-luna" | "gpt-6.1-terra" | "gpt-6.1-sol" | "gpt-6-astra";
    userId: import("mongoose").Types.ObjectId;
    simpleLanguage: boolean;
    customInstructions: string;
    answerLength: "short" | "standard" | "detailed";
}>> & import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    model: "default" | "gpt-4.1-mini" | "gpt-6-luna" | "gpt-6.1-terra" | "gpt-6.1-sol" | "gpt-6-astra";
    userId: import("mongoose").Types.ObjectId;
    simpleLanguage: boolean;
    customInstructions: string;
    answerLength: "short" | "standard" | "detailed";
}> & {
    _id: import("mongoose").Types.ObjectId;
}>>;
export { ReaderAiSettingsModel };
