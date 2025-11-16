declare module 'pdfkit' {
  export default PDFDocument;
  
  class PDFDocument {
    constructor(options?: any);
    pipe(destination: any): any;
    fontSize(size: number): this;
    text(text: string, x?: number, y?: number, options?: any): this;
    moveDown(lines?: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    stroke(): this;
    end(): void;
  }
}

