import { jsPDF } from "jspdf";
import { Node } from "slate";
import { Book } from "../../../../shared/types/books";
export function downloadScreenplayPdf(book: Book) {
 const pdf = new jsPDF({unit:"pt",format:"letter"});
 pdf.setFont("courier"); pdf.setFontSize(12);
 let y = 72; let page = 1;
 const newPage = () => {pdf.addPage();page++;y=72;pdf.text(String(page)+".",540,42,{align:"right"});};
 book.chapters.filter(c=>!c.isArchived && c.format === "screenplay").forEach((chapter,i)=>{
   if(i) newPage();
   chapter.text.forEach(block=>{
     const type=block.type;
     const uppercase=["scene_heading","character","transition"].includes(type);
     let text=Node.string(block);if(uppercase)text=text.toUpperCase();
     if(type === "parenthetical")text="("+text.replace(/^\(|\)$/g,"")+")";
     const x=108+(type === "character" ? 158 : type === "dialogue" ? 72 : type === "parenthetical" ? 115 : 0);
     const width=type === "dialogue" ? 252 : type === "parenthetical" ? 180 : 540-x;
     const lines=pdf.splitTextToSize(text || " ",width) as string[];
     if(["character","scene_heading","parenthetical"].includes(type) && y+Math.min(lines.length+3,8)*12>720)newPage();
     for(const line of lines){if(y>720)newPage();pdf.text(line,type === "transition" ? 540 : x,y,type === "transition" ? {align:"right"}:{});y+=12;}
     if(!["character","parenthetical"].includes(type))y+=12;
   });
 });
 pdf.save((book.name.replace(/[<>:"/\\|?*]/g,"_")||"screenplay")+".pdf");
}
