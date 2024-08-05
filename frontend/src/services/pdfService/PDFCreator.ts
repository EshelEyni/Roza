import { jsPDF } from "jspdf";
import { Chapter } from "../../../../shared/types/books";
import alefRegular from "./font";
import { Language } from "../../../../shared/types/system";

type CreateBookChapterPdfParams = {
  chapter: Chapter;
  lang: Language;
};

class PDFCreator {
  private static YPosition = 10;

  private doc: jsPDF;

  constructor(lang: Language) {
    this.doc = new jsPDF({
      orientation: "p",
      unit: "px",
      format: "a4",
      putOnlyUsedFonts: true,
      compress: true,
    });
    this.addAlefFont();
    this.doc.setLanguage(lang);
    this.doc.setFont("Alef");
    this.doc.setR2L(true);
  }

  private addAlefFont() {
    this.doc.addFileToVFS("Alef-Regular.ttf", alefRegular);
    this.doc.addFont("Alef-Regular.ttf", "Alef", "normal");
  }

  private setChapterTitle(chapter: Chapter) {
    this.doc.setFontSize(16);
    const pageWidth = this.doc.internal.pageSize.getWidth();
    this.doc.text(
      chapter.name,
      pageWidth - pageWidth / 2,
      PDFCreator.YPosition,
      {
        align: "center",
      },
    );
    PDFCreator.YPosition += 20;
  }

  public createBookChapterPdf({ chapter, lang }: CreateBookChapterPdfParams) {
    this.setChapterTitle(chapter);
    return this.doc.output("blob");
  }
}

export { PDFCreator };
