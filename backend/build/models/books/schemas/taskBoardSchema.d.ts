import { Schema } from "mongoose";
export declare const taskBoardSchema: Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    _id: false;
}, {
    lists: import("mongoose").Types.DocumentArray<{
        id: string;
        title: string;
        cards: import("mongoose").Types.DocumentArray<{
            completed: boolean;
            id: string;
            createdAt: string;
            updatedAt: string;
            title: string;
            chapterId: string;
            description: string;
            dueDate: string;
            checklist: import("mongoose").Types.DocumentArray<{
                id: string;
                title: string;
                done: boolean;
            }>;
            labels: import("mongoose").Types.DocumentArray<{
                id: string;
                title: string;
                color: string;
            }>;
        }>;
    }>;
}, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    lists: import("mongoose").Types.DocumentArray<{
        id: string;
        title: string;
        cards: import("mongoose").Types.DocumentArray<{
            completed: boolean;
            id: string;
            createdAt: string;
            updatedAt: string;
            title: string;
            chapterId: string;
            description: string;
            dueDate: string;
            checklist: import("mongoose").Types.DocumentArray<{
                id: string;
                title: string;
                done: boolean;
            }>;
            labels: import("mongoose").Types.DocumentArray<{
                id: string;
                title: string;
                color: string;
            }>;
        }>;
    }>;
}>> & import("mongoose").FlatRecord<{
    lists: import("mongoose").Types.DocumentArray<{
        id: string;
        title: string;
        cards: import("mongoose").Types.DocumentArray<{
            completed: boolean;
            id: string;
            createdAt: string;
            updatedAt: string;
            title: string;
            chapterId: string;
            description: string;
            dueDate: string;
            checklist: import("mongoose").Types.DocumentArray<{
                id: string;
                title: string;
                done: boolean;
            }>;
            labels: import("mongoose").Types.DocumentArray<{
                id: string;
                title: string;
                color: string;
            }>;
        }>;
    }>;
}> & {
    _id: import("mongoose").Types.ObjectId;
}>;
