import * as puppeteer from "puppeteer";
export declare class PageMethods {
    constructor();
    scrollSongIntoView(page: puppeteer.Page, scrollContainer: puppeteer.ElementHandle<HTMLDivElement>, clipId: string): Promise<puppeteer.ElementHandle | null>;
    clickVisibleMoreButton(page: puppeteer.Page, clipId: string): Promise<boolean>;
    clickNextPageButton(page: puppeteer.Page | undefined): Promise<boolean>;
    clickPreviousPageButton(page: puppeteer.Page): Promise<boolean>;
    waitUntilDownload(session: puppeteer.CDPSession, fileName?: string): Promise<string>;
}
export declare let GlobalPageMethods: PageMethods;
//# sourceMappingURL=pagemethods.d.ts.map