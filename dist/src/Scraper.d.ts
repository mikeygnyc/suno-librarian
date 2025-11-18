import * as puppeteer from "puppeteer";
export declare class Scraper {
    constructor();
    page: puppeteer.Page;
    Initialize(): Promise<void>;
    scrollSongIntoView(page: puppeteer.Page, scrollContainer: puppeteer.ElementHandle<HTMLDivElement>, clipId: string): Promise<puppeteer.ElementHandle | null>;
    clickVisibleMoreButton(page: puppeteer.Page, clipId: string): Promise<boolean>;
    clickNextPageButton(page: puppeteer.Page | undefined): Promise<boolean>;
    clickPreviousPageButton(page: puppeteer.Page): Promise<boolean>;
    waitUntilDownload(session: puppeteer.CDPSession, fileName?: string): Promise<string>;
    browser: puppeteer.Browser;
    exhaustedSearch: boolean;
    scrapeAndDownload(): Promise<void>;
}
export declare let Importer: Scraper;
//# sourceMappingURL=scraper.d.ts.map