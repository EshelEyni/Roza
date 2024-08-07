import { jsPDF } from "jspdf";
import {
  BlockQuoteElement,
  Chapter,
  HeadingOneElement,
  HeadingTwoElement,
  ParagraphElement,
  SlateCustomElement,
  SlateCustomText,
  SlateElementAlign,
} from "../../../../shared/types/books";
import fontRegular from "./font";
import fontItalic from "./fontItalic";
import fontBold from "./fontBold";
import fontItalicBold from "./fontBold";
import { Language } from "../../../../shared/types/system";

type CreateBookChapterPdfParams = {
  chapter: Chapter;
};

class PDFCreator {
  private YPosition = 10;
  private XPosition = 10;
  private pageWidth = 0;
  private dir = "left";
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
    this.doc.setFont("Font", "normal");
    this.doc.setR2L(lang === "he");
    this.dir = lang === "he" ? "right" : "left";
    this.YPosition = 10;
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.setPageBackgroundColor("#EADAC7");
    this.doc.setTextColor("#2A1F19");
  }

  private setPageBackgroundColor(color: string) {
    const pageWidth = this.doc.internal.pageSize.getWidth();
    const pageHeight = this.doc.internal.pageSize.getHeight();

    this.doc.setFillColor(color);
    this.doc.rect(0, 0, pageWidth, pageHeight, "F");
  }

  private addAlefFont() {
    this.doc.addFileToVFS("Font-Regular.ttf", fontRegular);
    this.doc.addFileToVFS("Font-Italic.ttf", fontItalic);
    this.doc.addFileToVFS("Font-Bold.ttf", fontBold);
    this.doc.addFileToVFS("Font-BoldItalic.ttf", fontItalicBold);
    this.doc.addFont("Font-Regular.ttf", "Font", "normal");
    this.doc.addFont("Font-Italic.ttf", "Font", "italic");
    this.doc.addFont("Font-Bold.ttf", "Font", "bold");
    this.doc.addFont("Font-BoldItalic.ttf", "Font", "bolditalic");
  }

  private setXPosition({
    align,
    isBlockQuote,
  }: {
    align?: SlateElementAlign;
    isBlockQuote?: boolean;
  }) {
    if (!align) align = this.dir as SlateElementAlign;
    const XMargin = isBlockQuote ? 20 : 10;
    switch (align) {
      case "left":
        this.XPosition = XMargin;
        break;
      case "center":
        this.XPosition = this.pageWidth - this.pageWidth / 2;
        break;
      case "right":
        this.XPosition = this.pageWidth - XMargin;
        break;
      case "justify":
        this.doc.text("justify", this.XPosition, this.YPosition, {
          align: "justify",
        });
        break;
      default:
        break;
    }
  }

  private getTextAlign(align?: SlateElementAlign) {
    return align ?? (this.dir as SlateElementAlign);
  }

  private setFontStyle(text: SlateCustomText) {
    let style = "normal";
    if (text.bold && text.italic) style = "bolditalic";
    else if (text.bold) style = "bold";
    else if (text.italic) style = "italic";
    this.doc.setFont("Font", style);
  }

  private setChapterTitle(chapter: Chapter) {
    this.doc.setFontSize(12);
    this.setXPosition({ align: "center" });
    this.doc.text(chapter.name, this.XPosition, this.YPosition, {
      align: "center",
    });
    this.YPosition += 14;
  }

  public createBookChapterPdf({ chapter }: CreateBookChapterPdfParams) {
    this.setChapterTitle(chapter);
    this.addTextFromElements(chapter.description);
    return this.doc.output("blob");
  }

  private addTextFromElements(elements: SlateCustomElement[]) {
    for (const el of elements) {
      switch (el.type) {
        case "paragraph":
          this.addParagraph(el);
          break;
        case "heading-one":
          this.addHeadingOne(el);
          break;
        case "heading-two":
          this.addHeadingTwo(el);
          break;
        case "block-quote":
          this.addBlockQuote(el);
          break;
        // case "bulleted-list":
        //   this.addBulletedList(el.children);
        //   break;
        // case "numbered-list":
        //   this.addNumberedList(el.children);
        //   break;
        // default:
        //   break;
      }
    }
  }

  private addParagraph(paragraph: ParagraphElement) {
    const { children, align } = paragraph;
    for (const child of children)
      this.addTextElement({ textItem: child, align, fontSize: 9 });
  }

  private addHeadingOne(headingOne: HeadingOneElement) {
    const { children, align } = headingOne;
    for (const child of children)
      this.addTextElement({ textItem: child, align, fontSize: 12 });
  }

  private addHeadingTwo(headingTwo: HeadingTwoElement) {
    const { children, align } = headingTwo;
    for (const child of children)
      this.addTextElement({ textItem: child, align, fontSize: 10 });
  }

  private addBlockQuote(blockQuote: BlockQuoteElement) {
    const { children, align } = blockQuote;

    for (const child of children) {
      this.doc.setFontSize(9);
      this.doc.setFont("Font", "italic");
      this.setXPosition({ align, isBlockQuote: true });
      this.doc.text(child.text, this.XPosition, this.YPosition, {
        align: this.getTextAlign(align),
      });
      this.YPosition += 9;
    }

    this.doc.setFont("Font", "normal");
  }

  private addTextElement({
    textItem,
    align,
    fontSize,
  }: {
    textItem: SlateCustomText;
    align?: SlateElementAlign;
    fontSize: number;
  }) {
    this.doc.setFontSize(fontSize);
    this.setFontStyle(textItem);
    this.setXPosition({ align });
    this.doc.text(textItem.text, this.XPosition, this.YPosition, {
      align: this.getTextAlign(align),
    });
    this.YPosition += fontSize;
  }
}

export { PDFCreator };
