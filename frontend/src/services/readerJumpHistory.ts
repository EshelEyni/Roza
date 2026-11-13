export type ReaderPageInfo = { page: number; label: string };
export type ReaderReturnPoint = ReaderPageInfo & { cfi: string };
/** Track intentional jumps and rapid page sweeps without recording normal reading. */
export class ReaderJumpHistory {
  private previous: {cfi: string; at: number} | null = null;
  private sweep: {cfi: string; at: number} | null = null;
  private link: {cfi:string; at:number} | null = null;
  private version = 0;
  private returning = false;
  private point: ReaderReturnPoint | null = null;
  constructor(private changed: (point: ReaderReturnPoint | null) => void) {}
  markLink(cfi?: string, at = Date.now()) { const origin = cfi || this.previous?.cfi; this.link = origin ? {cfi:origin,at} : null; }
  async visit(cfi: string, describe: (cfi: string) => Promise<ReaderPageInfo | null>, at = Date.now()) {
    if (this.previous?.cfi === cfi) return;
    const previous = this.previous;
    this.previous = {cfi, at};
    const link = this.link && at - this.link.at <= 5000 ? this.link.cfi : null; this.link = null;
    if (!previous || this.returning) { this.sweep = this.previous; return; }
    // The jump that creates a return point is already recorded. The next
    // location change consumes it instead of creating another point in the sweep.
    if (this.point) {
      ++this.version;
      this.dismiss();
      this.sweep = this.previous;
      return;
    }
    const origin = link ? {cfi:link,at} : at - previous.at <= 1500 ? this.sweep || previous : previous;
    this.sweep = origin;
    const version = ++this.version;
    const [from,to] = await Promise.all([describe(origin.cfi),describe(cfi)]);
    if (version !== this.version || !from || !to || this.returning) return;
    if (Math.abs(to.page - from.page) > 5 || (link && to.page !== from.page)) {
      this.point = {...from,cfi:origin.cfi}; this.changed(this.point);
    }
  }
  async goBack(navigate: (cfi: string) => Promise<void>) {
    const point = this.point; if (!point || this.returning) return;
    ++this.version; this.returning = true; this.link = null;
    try {
      await navigate(point.cfi);
      this.previous = {cfi:point.cfi,at:Date.now()}; this.sweep = this.previous;
      this.point = null; this.changed(null);
    } finally { this.returning = false; }
  }
  dismiss() { this.point = null; this.changed(null); }
  cancel() { ++this.version; }
}
