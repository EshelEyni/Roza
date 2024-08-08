import { jsPDF } from "jspdf";
import {
  BlockQuoteElement,
  Chapter,
  HeadingOneElement,
  HeadingTwoElement,
  ListElement,
  ListItemElement,
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
    isBullet,
  }: {
    align?: SlateElementAlign;
    isBlockQuote?: boolean;
    isBullet?: boolean;
  }) {
    if (!align) align = this.dir as SlateElementAlign;
    let XMargin = 10;
    if (isBlockQuote) XMargin = 20;
    if (isBullet) XMargin = 15;
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

  private drawBullet(x: number, y: number) {
    this.doc.circle(x, y - 2, 1, "F");
  }

  private drawUnderline(x: number, y: number, width: number) {
    this.doc.setLineWidth(0.5);
    const widthToDraw = this.dir === "left" ? width : -width;
    this.doc.line(x, y + 1, x + widthToDraw, y + 1);
  }

  public createBookChapterPdf({ chapter }: CreateBookChapterPdfParams) {
    this.setChapterTitle(chapter);
    this.addTextFromElements(chapter.description);
    this.addTextFromElements(chapter.text);
    return this.doc.output("blob");
  }

  private setChapterTitle(chapter: Chapter) {
    this.doc.setFontSize(16);
    this.doc.setFont("Font", "bold");
    this.setXPosition({ align: "center" });
    this.doc.text(chapter.name, this.XPosition, this.YPosition, {
      align: "center",
    });
    this.YPosition += 14;
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
        case "bulleted-list":
          this.addBulletedList(el);
          break;
        case "numbered-list":
          this.addNumberedList(el);
          break;
        default:
          break;
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

  private addBulletedList(list: ListElement) {
    const { children } = list;
    for (const child of children) {
      this.addListItem({ item: child, type: "bulleted-list" });
    }
  }

  private addNumberedList(list: ListElement) {
    const { children } = list;
    children.forEach((child, index) => {
      this.addListItem({
        item: child,
        type: "numbered-list",
        number: index + 1,
      });
    });
  }

  private addListItem({
    item,
    type,
    number,
  }: {
    item: ListItemElement;
    type: "bulleted-list" | "numbered-list";
    number?: number;
  }) {
    if (type === "bulleted-list")
      this.drawBullet(this.XPosition, this.YPosition);

    const { children, align } = item;
    for (const child of children) {
      const textToRender = number ? `${number}. ${child.text}` : child.text;
      this.doc.setFontSize(9);
      this.setFontStyle(child);
      this.setXPosition({ align, isBullet: type === "bulleted-list" });
      this.doc.text(textToRender, this.XPosition, this.YPosition, {
        align: this.getTextAlign(align),
      });
      if (child.underline)
        this.drawUnderline(
          this.XPosition,
          this.YPosition,
          this.doc.getTextWidth(child.text),
        );
      this.setXPosition({ align });
      this.YPosition += 9;
    }
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

    if (textItem.underline)
      this.drawUnderline(
        this.XPosition,
        this.YPosition,
        this.doc.getTextWidth(textItem.text),
      );
    this.YPosition += fontSize;
  }
}

export { PDFCreator };
