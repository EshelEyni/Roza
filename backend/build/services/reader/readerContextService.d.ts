import type { ReaderPassage } from "../../../../shared/types/readerChat";
declare const MAX_CONTEXT_CHARS: 16000;
declare const MAX_PASSAGE_CHARS: 20000;
declare class ReaderContext {
    private sections;
    private navigation;
    private chapters?;
    private index?;
    get cacheBytes(): number;
    private searchIndex;
    constructor(buffer: Buffer);
    private section;
    private chapterIndex;
    private accessiblePosition;
    private chapterAt;
    bookContents(currentCfi: string, allow: boolean, start?: number): {
        currentChapter: string;
        spoilerRestricted: boolean;
        note: string;
        chapters: {
            id: string;
            title: string;
        }[];
        nextStart: number | null;
    };
    readChapter(currentCfi: string, allow: boolean, chapterId: string, start?: number, maxChars?: number): {
        error: string;
        chapter?: undefined;
        title?: undefined;
        excerpts?: undefined;
        nextStart?: undefined;
        complete?: undefined;
        restricted?: undefined;
        note?: undefined;
    } | {
        chapter: string;
        title: string;
        excerpts: {
            label: string;
            text: string;
        }[];
        nextStart: number | null;
        complete: boolean;
        restricted: boolean;
        note: string | undefined;
        error?: undefined;
    };
    readBook(currentCfi: string, allow: boolean, chapterId: string, start?: number): {
        next: null;
        error: string;
        chapter?: undefined;
        title?: undefined;
        excerpts?: undefined;
        nextStart?: undefined;
        complete?: undefined;
        restricted?: undefined;
        note?: undefined;
    } | {
        next: null;
        chapter: string;
        title: string;
        excerpts: {
            label: string;
            text: string;
        }[];
        nextStart: number | null;
        complete: boolean;
        restricted: boolean;
        note: string | undefined;
        error?: undefined;
    } | {
        next: {
            chapter: string;
            start: number;
        } | null;
        coverage: string;
        chapter: string;
        title: string;
        excerpts: {
            label: string;
            text: string;
        }[];
        nextStart: number | null;
        complete: boolean;
        restricted: boolean;
        note: string | undefined;
        error?: undefined;
    };
    isAtOrBefore(earlier: string, current: string): boolean;
    private comparePositions;
    passage(cfi: string, endCfi?: string): {
        cfi: string;
        endCfi: string;
        text: string;
    } | {
        cfi: string;
        text: string;
        endCfi?: undefined;
    };
    retrieve(question: string, currentCfi: string, spoilersAllowed: boolean, selected?: ReaderPassage | string, passageEndCfi?: string): {
        passage: string;
        context: {
            label: string;
            text: string;
        }[];
    };
    private retrieveAtPosition;
}
export { ReaderContext, MAX_CONTEXT_CHARS, MAX_PASSAGE_CHARS };
