"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePlanning = validatePlanning;
const record = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Invalid chapter planning record.");
    return value;
};
const records = (value) => {
    if (value === undefined)
        return [];
    if (!Array.isArray(value))
        throw new Error("Invalid chapter planning collection.");
    return value.map(record);
};
function validatePlanning(value, bookId) {
    const book = record(value);
    const kinds = ["characters", "themes", "plotlines"];
    const id = (item) => String(item._id || item.id || "");
    const chapterIds = new Set(records(book.chapters).map(id));
    const libraries = Object.fromEntries(kinds.map(kind => [kind, new Set(records(book[kind]).map(id))]));
    for (const kind of ["chapters", ...kinds, "notes"]) {
        const seen = new Set();
        for (const item of records(book[kind])) {
            if (item.bookId && String(item.bookId) !== bookId)
                throw new Error("A manuscript item belongs to another book.");
            const key = id(item);
            if (key && seen.has(key))
                throw new Error("Duplicate manuscript item.");
            seen.add(key);
        }
    }
    for (const chapter of records(book.chapters)) {
        const draftIds = new Set();
        for (const draft of records(chapter.drafts)) {
            if (draft.chapterId !== id(chapter))
                throw new Error("A draft belongs to another chapter.");
            if (typeof draft.id !== "string" || !draft.id || draftIds.has(draft.id))
                throw new Error("Invalid or duplicate chapter draft.");
            draftIds.add(draft.id);
            if (typeof draft.name !== "string" || !draft.name.trim() || draft.name.length > 200 ||
                !Array.isArray(draft.text) || !draft.text.length ||
                typeof draft.createdAt !== "string" || !Number.isFinite(Date.parse(draft.createdAt)) ||
                typeof draft.updatedAt !== "string" || !Number.isFinite(Date.parse(draft.updatedAt)))
                throw new Error("Invalid chapter draft.");
        }
        if (chapter.planning === undefined)
            continue;
        const planning = record(chapter.planning);
        for (const kind of kinds) {
            const seen = new Set();
            for (const link of records(planning[kind])) {
                if (typeof link.entityId !== "string" || !libraries[kind].has(link.entityId))
                    throw new Error("A story element does not belong to this book.");
                if (seen.has(link.entityId))
                    throw new Error("Duplicate chapter association.");
                seen.add(link.entityId);
            }
        }
    }
    for (const board of [book.taskBoard, ...records(book.chapters).map(c => c.taskBoard)]) {
        if (board === undefined)
            continue;
        for (const list of records(record(board).lists))
            for (const card of records(list.cards))
                if (card.chapterId && !chapterIds.has(String(card.chapterId)))
                    throw new Error("A task chapter does not belong to this book.");
    }
}
//# sourceMappingURL=planningValidation.js.map