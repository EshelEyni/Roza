import type { BooKDataItemType } from "../../../../shared/types/books";

const nouns: Record<BooKDataItemType, string> = {
  chapters: "chapter",
  characters: "character",
  plotlines: "plotline",
  themes: "theme",
  notes: "note",
};

const capitalize = (value: string) => value[0].toUpperCase() + value.slice(1);

/**
 * All Writing Studio wording that names the kind of item on screen.
 * "Delete" is a soft delete: the item is archived on the server, so planning
 * links and tasks that point at it stay valid.
 */
export function studioItemLabels(type: BooKDataItemType) {
  const noun = nouns[type];
  const Noun = capitalize(noun);
  return {
    noun,
    add: `Add ${noun}`,
    create: `Create a ${noun}`,
    menuHeading: `THIS ${noun.toUpperCase()}`,
    remove: `Delete ${noun}`,
    removeTitle: `Delete this ${noun}?`,
    removeMessage: (name: string) =>
      `Delete “${name}”? You can undo this here before leaving the studio.`,
    removedNotice: `${Noun} deleted.`,
    titleField: `${Noun} title`,
    untitled: `Untitled ${noun}`,
    noMatches: `No matching ${type}.`,
    emptyList: `No ${type} yet.`,
  };
}
