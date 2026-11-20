export const readerSelectionColor = "#d99c62";
export const readingWordTextColor = "#24160c";
export const readingSentenceTint = "#ebb78f";

export function readingSentenceBackground(color = readingSentenceTint) {
  return (color === readerSelectionColor ? readingSentenceTint : color) + "4d";
}
export const readerPassageColor = "#f2e66b";
export const readerMarkTextColor = "#28231e";
