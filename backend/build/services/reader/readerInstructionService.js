"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readerInstructionText = readerInstructionText;
/** Flatten only active leaves, preserving the configured section/sentence order. */
function readerInstructionText(group) {
    return Object.values(group)
        .map(value => typeof value === "string" ? value : value ? readerInstructionText(value) : "")
        .filter(Boolean)
        .join("\n");
}
//# sourceMappingURL=readerInstructionService.js.map