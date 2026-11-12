export const annotationColors = ["yellow", "green", "blue", "pink"] as const;
export type AnnotationColor = (typeof annotationColors)[number];
export interface ReaderAnnotationInput {
  cfi: string;
  endCfi?: string;
  text: string;
  chapter: string;
  color: AnnotationColor;
  note: string;
}
export interface ReaderAnnotation extends ReaderAnnotationInput {
  id: string;
}
