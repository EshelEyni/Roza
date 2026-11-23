export interface ManuscriptFindOptions {
  matchCase: boolean;
  wholeWord: boolean;
}

export interface TextMatch {
  /** Index of the paragraph the match is in. */
  paragraph: number;
  start: number;
  end: number;
}

const wordCharacter = String.raw`[\p{L}\p{M}\p{N}_]`;

/**
 * Finds `query` in plain paragraph strings. Writing Studio and the Staging Room use the same rules:
 * match case is optional, and whole word treats letters, marks (Hebrew niqqud), digits and _ as word characters.
 * Matches never cross paragraphs.
 */
export function findTextMatches(paragraphs: readonly string[], query: string, options: ManuscriptFindOptions): TextMatch[] {
  if (!query) return [];
  const literal = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const source = options.wholeWord ? `(?<!${wordCharacter})${literal}(?!${wordCharacter})` : literal;
  const pattern = new RegExp(source, options.matchCase ? "gu" : "giu");
  const matches: TextMatch[] = [];
  paragraphs.forEach((text, paragraph) => {
    for (const match of text.matchAll(pattern)) {
      matches.push({ paragraph, start: match.index!, end: match.index! + match[0].length });
    }
  });
  return matches;
}
