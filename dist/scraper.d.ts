import * as puppeteer from "puppeteer";
export declare const delay: (ms: number) => Promise<unknown>;
export declare class Scraper {
    constructor();
    page: puppeteer.Page;
    Initialize(): Promise<void>;
    browser: puppeteer.Browser;
    exhaustedSearch: boolean;
    scrapeAndDownload(): Promise<void>;
}
export declare let Importer: Scraper;
//# sourceMappingURL=scraper.d.ts.map