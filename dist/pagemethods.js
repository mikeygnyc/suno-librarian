"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalPageMethods = exports.PageMethods = void 0;
const path_1 = __importDefault(require("path"));
const scraper_1 = require("./scraper");
const puppeteer = __importStar(require("puppeteer"));
const fs_1 = __importDefault(require("fs"));
class PageMethods {
    constructor() { }
    async scrollSongIntoView(page, scrollContainer, clipId) {
        const songSelector = `div[data-clip-id="${clipId}"]`;
        let songRow = await scrollContainer.$(songSelector);
        if (songRow) {
            await songRow.evaluate((el) => el.scrollIntoView({ block: "center" }));
            await (0, scraper_1.delay)(500);
            return songRow;
        }
        console.log(`  -> Song ${clipId} not visible. Scrolling to find...`);
        let stallCount = 0;
        while (stallCount < 2) {
            await scrollContainer.evaluate((el) => {
                el.scrollTop += el.clientHeight * 0.8;
            });
            await (0, scraper_1.delay)(1500);
            songRow = await scrollContainer.$(songSelector);
            if (songRow) {
                await songRow.evaluate((el) => el.scrollIntoView({ block: "center" }));
                await (0, scraper_1.delay)(500);
                console.log(`  -> Found ${clipId} after scrolling.`);
                return songRow;
            }
            const isAtBottom = await scrollContainer.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 20);
            if (isAtBottom) {
                console.log("  -> Reached bottom. Resetting to top for another pass.");
                await scrollContainer.evaluate((el) => el.scrollTo(0, 0));
                stallCount++;
                await (0, scraper_1.delay)(1500);
            }
        }
        console.error(`  -> Could not find song ${clipId} after scrolling.`);
        return null;
    }
    async clickVisibleMoreButton(page, clipId) {
        const moreButtonSelector = `div[data-clip-id="${clipId}"] button[aria-label="More menu contents"]`;
        const buttons = await page.$$(moreButtonSelector);
        if (buttons.length === 0)
            return false;
        for (const button of buttons) {
            if (await button.isIntersectingViewport()) {
                await button.click();
                return true;
            }
        }
        return false;
    }
    async clickNextPageButton(page) {
        if (!page) {
            return false;
        }
        //for whatever reason next does not have an aria label but previous does
        const nextButton = puppeteer.Locator.race([
            page.locator("div.md\\:flex > div > div.flex-col > div button:nth-of-type(2) > svg"),
            page.locator('::-p-xpath(//*[@id=\\"main-container\\"]/div[2]/div/div[2]/div/div[2]/div/div/div[2]/div/button[2]/svg)'),
            page.locator(":scope >>> div.md\\:flex > div > div.flex-col > div button:nth-of-type(2) > svg"),
        ]).setTimeout(5000);
        if (nextButton) {
            await nextButton.click();
            return true;
        }
        return false;
    }
    async clickPreviousPageButton(page) {
        const nextButton = puppeteer.Locator.race([
            page.locator('::-p-aria(Previous Page) >>>> ::-p-aria([role=\\"image\\"])'),
            page.locator("div.md\\:flex > div > div.flex-col > div button:nth-of-type(1) > svg"),
            page.locator('::-p-xpath(//*[@id=\\"main-container\\"]/div[2]/div/div[2]/div/div[2]/div/div/div[2]/div/button[1]/svg)'),
            page.locator(":scope >>> div.md\\:flex > div > div.flex-col > div button:nth-of-type(1) > svg"),
        ]).setTimeout(5000);
        if (nextButton) {
            await nextButton.click();
            return true;
        }
        return false;
    }
    async waitUntilDownload(session, fileName = "") {
        return new Promise((resolve, reject) => {
            const handler = (e) => {
                if (e.state === "completed") {
                    // Remove listener before resolving
                    session.off("Browser.downloadProgress", handler);
                    const downloadPath = path_1.default.resolve(__dirname, "downloads", "wav");
                    if (e.filePath) {
                        const originalFileName = e.filePath;
                        const newFileName = `${fileName}.wav`;
                        const newFilePath = path_1.default.join(downloadPath, newFileName);
                        fs_1.default.renameSync(originalFileName, newFilePath);
                        console.log(`    ->File renamed from ${e.guid} to ${newFileName}`);
                    }
                    resolve(fileName);
                }
                else if (e.state === "canceled") {
                    // Remove listener before rejecting
                    session.off("Browser.downloadProgress", handler);
                    reject(new Error("Download was canceled"));
                }
            };
            // Attach listener
            session.on("Browser.downloadProgress", handler);
        });
    }
}
exports.PageMethods = PageMethods;
exports.GlobalPageMethods = new PageMethods();
//# sourceMappingURL=pagemethods.js.map