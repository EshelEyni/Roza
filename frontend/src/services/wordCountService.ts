import { SlateCustomElement } from "../../../shared/types/books";

export function countWordsInSlateElements(
  elements: SlateCustomElement[],
): number {
  let wordCount = 0;

  const countWordsInText = (text: string): number => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const traverseElements = (elements: SlateCustomElement[]) => {
    elements.forEach(element => {
      if (!("children" in element)) return;
      element.children.forEach(child => {
        if (!("text" in child)) return;
        wordCount += countWordsInText(child.text);
      });
      traverseElements(element.children as SlateCustomElement[]);
    });
  };

  // Start traversing from the top-level elements
  traverseElements(elements);

  return wordCount;
}
