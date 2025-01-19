import { SlateCustomElement } from "../../../shared/types/books";

export function countWordsInSlateElements(
  elements: SlateCustomElement[],
): number {
  let wordCount = 0;

  // Helper function to count words in a text string
  const countWordsInText = (text: string): number => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  // Recursive function to traverse the elements
  const traverseElements = (elements: SlateCustomElement[]) => {
    elements.forEach(element => {
      if ("children" in element) {
        // If the element has children, check if they're text nodes
        element.children.forEach(child => {
          if ("text" in child) {
            wordCount += countWordsInText(child.text);
          }
        });

        // Recursively process child elements
        traverseElements(element.children as SlateCustomElement[]);
      }
    });
  };

  // Start traversing from the top-level elements
  traverseElements(elements);

  return wordCount;
}
