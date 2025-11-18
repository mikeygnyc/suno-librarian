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
exports.Importer = exports.Scraper = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const puppeteer = __importStar(require("puppeteer"));
const chalk_1 = __importDefault(require("chalk"));
const ConfigHandler_js_1 = require("./ConfigHandler.js");
const file_convert_js_1 = require("./file_convert.js");
const MetadataHandler_js_1 = require("./MetadataHandler.js");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
class Scraper {
    constructor() {
    }
    page;
    async Initialize() {
        const tmpDir = path.parse(ConfigHandler_js_1.AppConfig.chromeTempUserDataDir).dir;
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }
        if (!this.browser) {
            console.log("Connecting to the browser...");
            this.browser = await puppeteer.launch({
                headless: false, // Set to true for headless mode, false for visible browser
                executablePath: ConfigHandler_js_1.AppConfig.chromeExecutablePath,
                args: ["--remote-debugging-port=9222", `--user-data-dir=${tmpDir}`],
            });
            this.page = await this.browser.newPage();
            await this.page.goto("https://suno.com/me");
        }
        else {
            let pgTmp = (await this.browser.pages()).find((p) => p.url().includes("suno.com"));
            if (pgTmp) {
                this.page = pgTmp;
            }
            else {
                this.page = await this.browser.newPage();
                await this.page.goto("https://suno.com/me");
            }
        }
        if (!this.page) {
            console.error(chalk_1.default.redBright, "Could not find the target page.");
            throw new Error("Could not find the target page.");
        }
        else {
            console.log("Scraper initialized");
        }
    }
    async scrollSongIntoView(page, scrollContainer, clipId) {
        const songSelector = `div[data-clip-id="${clipId}"]`;
        let songRow = await scrollContainer.$(songSelector);
        if (songRow) {
            await songRow.evaluate((el) => el.scrollIntoView({ block: "center" }));
            await delay(500);
            return songRow;
        }
        console.log(`  -> Song ${clipId} not visible. Scrolling to find...`);
        let stallCount = 0;
        while (stallCount < 2) {
            await scrollContainer.evaluate((el) => {
                el.scrollTop += el.clientHeight * 0.8;
            });
            await delay(1500);
            songRow = await scrollContainer.$(songSelector);
            if (songRow) {
                await songRow.evaluate((el) => el.scrollIntoView({ block: "center" }));
                await delay(500);
                console.log(`  -> Found ${clipId} after scrolling.`);
                return songRow;
            }
            const isAtBottom = await scrollContainer.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 20);
            if (isAtBottom) {
                console.log("  -> Reached bottom. Resetting to top for another pass.");
                await scrollContainer.evaluate((el) => el.scrollTo(0, 0));
                stallCount++;
                await delay(1500);
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
                    const downloadPath = path.resolve(__dirname, "downloads", "wav");
                    if (e.filePath) {
                        const originalFileName = e.filePath;
                        const newFileName = `${fileName}.wav`;
                        const newFilePath = path.join(downloadPath, newFileName);
                        fs.renameSync(originalFileName, newFilePath);
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
    browser;
    exhaustedSearch = false;
    async scrapeAndDownload() {
        try {
            const session = await this.browser.target().createCDPSession();
            await session.send("Browser.setDownloadBehavior", {
                behavior: "allowAndName",
                downloadPath: ConfigHandler_js_1.AppConfig.downloadRootDirectory,
                eventsEnabled: true,
            });
            session.removeAllListeners("Browser.downloadWillBegin");
            session.removeAllListeners("Browser.downloadProgress");
            session.on("Browser.downloadWillBegin", (event) => {
                console.log(`    -> Download will begin for browser guid ${event.guid} - ${event.suggestedFilename} from ${event.url}`);
            });
            // Listen for downloadProgress event
            session.on("Browser.downloadProgress", (event) => {
                if (event.state === "completed") {
                    console.log(`    -> Download completed for browser guid ${event.guid}`);
                }
                else if (event.state === "canceled") {
                    console.log(`    -> Download canceled for browser guid  ${event.guid}`);
                }
            });
            console.log(`Successfully connected to page: ${this.page.url()}`);
            // --- LOAD AND PREPARE DATA ---
            const allSongs = new Map();
            const songsDir = path.join(__dirname, "songs");
            const metadataPath = path.join(songsDir, "songs_metadata.json");
            if (fs.existsSync(metadataPath)) {
                console.log("Found existing metadata file. Loading...");
                try {
                    const existingSongs = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
                    existingSongs.forEach((song) => allSongs.set(song.clipId, song));
                }
                catch (error) { }
                console.log(`Loaded ${allSongs.size} songs from file.`);
            }
            const scrollContainerSelector = 'div[id*="tabpanel-songs"]';
            await this.page.waitForSelector(scrollContainerSelector);
            //@ts-ignore
            const scrollContainers = await page.$$(scrollContainerSelector);
            const scrollContainer = scrollContainers?.[1];
            if (!scrollContainer)
                throw new Error("Could not find the song list's scrollable container.");
            console.log("Successfully identified the nested scroll container.");
            // Scrape page for all songs to discover new ones
            const discoveredSongs = await this.page.$$eval('div[data-testid="song-row"]', (rows) => rows
                .map((row) => {
                const clipId = row.getAttribute("data-clip-id") || "";
                const titleEl = row.querySelector("span[title] a span");
                const title = titleEl ? titleEl.textContent : "Untitled";
                const styleEl = row.querySelector("div.flex.flex-row > div[title]");
                const style = styleEl?.getAttribute("title") || null;
                const imgEl = row.querySelector('img[alt="Song Image"]');
                const thumbnail = imgEl?.getAttribute("data-src") ||
                    imgEl?.getAttribute("src") ||
                    null;
                const durationEl = row.querySelector('div[aria-label="Play Song"] span.absolute');
                const duration = durationEl?.textContent?.trim() || null;
                const modelEl = Array.from(row.querySelectorAll("span")).find((el) => el.textContent?.trim().startsWith("v"));
                const model = modelEl?.textContent?.trim() || null;
                const songUrl = `https://suno.com/song/${clipId}`;
                const likedEl = row.querySelector('button[aria-label="Playbar: Like"]');
                const liked = likedEl?.classList.contains("text-foreground-primary") || false;
                return {
                    title,
                    clipId,
                    songUrl,
                    style,
                    thumbnail,
                    model,
                    duration,
                    mp3Status: "DOWNLOADED",
                    wavStatus: "PENDING",
                    liked: liked,
                };
            })
                .filter((song) => song.clipId));
            let foundNew = false;
            // Merge discovered songs with existing data
            discoveredSongs.forEach((song) => {
                if (!allSongs.has(song.clipId)) {
                    allSongs.set(song.clipId, song);
                    foundNew = true;
                    this.exhaustedSearch = false;
                }
            });
            // Create a queue of songs that actually need processing
            const songsToProcess = Array.from(allSongs.values()).filter((song) => song.mp3Status !== "DOWNLOADED" || song.wavStatus !== "DOWNLOADED");
            if (songsToProcess.length === 0) {
                if (this.exhaustedSearch) {
                    console.log("All discovered songs have already been downloaded. Exiting.");
                    return;
                }
                else {
                    this.exhaustedSearch = true;
                }
                if (!(await this.clickNextPageButton(this.page))) {
                    console.log("--- All songs discoverd. No more pages found. ---");
                    return;
                }
                else {
                    console.log("Moving to next page");
                    await delay(5000);
                    session.detach();
                    await this.scrapeAndDownload();
                }
            }
            console.log(`Total songs: ${allSongs.size}. Songs to process: ${songsToProcess.length}.`);
            MetadataHandler_js_1.ProcessMetadata.saveSongsMetadata(allSongs); // Save the merged list right away
            // --- START PROCESSING ---
            for (const [index, song] of songsToProcess.entries()) {
                console.log(`\n--- [${index + 1}/${songsToProcess.length}] Processing: ${song.title} (${song.clipId}) ---`);
                const songObject = allSongs.get(song.clipId);
                const songRow = await this.scrollSongIntoView(this.page, scrollContainer, song.clipId);
                if (!songRow) {
                    console.error(`Skipping "${song.title}" as it could not be scrolled into view.`);
                    songObject.mp3Status = "SKIPPED";
                    songObject.wavStatus = "SKIPPED";
                    MetadataHandler_js_1.ProcessMetadata.saveSongsMetadata(allSongs);
                    continue;
                }
                // --- MP3 Download ---
                if (songObject.mp3Status !== "DOWNLOADED") {
                    songObject.mp3Status = "DOWNLOADED"; //wav only
                    // try {
                    //     console.log('  -> Downloading MP3...');
                    //     await page.keyboard.press('Escape');
                    //     await delay(200);
                    //     if (!(await clickVisibleMoreButton(page, song.clipId)))
                    //         throw new Error('More button not clickable for MP3');
                    //     const downloadMenuItem = await page.waitForSelector(
                    //         "xpath///button[.//span[text()='Download']]",
                    //         { visible: true, timeout: 5000 }
                    //     );
                    //     await downloadMenuItem.hover();
                    //     const mp3Button = await page.waitForSelector(
                    //         'button[aria-label="MP3 Audio"]',
                    //         { visible: true, timeout: 5000 }
                    //     );
                    //     await mp3Button.click();
                    //     await page.waitForSelector(
                    //         'button[aria-label="MP3 Audio"]',
                    //         { hidden: true, timeout: 10000 }
                    //     );
                    //     songObject.mp3Status = 'DOWNLOADED';
                    //     console.log('  -> MP3 download successful.');
                    // } catch (e: any) {
                    //     console.error(`  -> MP3 download FAILED: ${e.message}`);
                    //     songObject.mp3Status = 'FAILED';
                    //     await page.keyboard.press('Escape'); // Reset state
                    // }
                    MetadataHandler_js_1.ProcessMetadata.saveSongsMetadata(allSongs); // Save status immediately
                    await delay(1000);
                }
                // --- WAV Download ---
                if (songObject.wavStatus !== "DOWNLOADED") {
                    try {
                        console.log("  -> Downloading WAV...");
                        const checkForExistDialog = "xpath///span[contains(text(), 'Download WAV Audio')]";
                        let existDialog = await this.page.$(checkForExistDialog);
                        if (existDialog) {
                            const findModalCloseSearch = 'button[aria-label="Close"]:not(.chakra-popover__close-btn)';
                            let modalClose = await this.page.$(findModalCloseSearch);
                            if (modalClose) {
                                modalClose.click();
                                console.log(`Closing stuck modal`);
                            }
                        }
                        await this.scrollSongIntoView(this.page, scrollContainer, song.clipId); // Re-center element
                        await this.page.keyboard.press("Escape");
                        await delay(200);
                        if (!(await this.clickVisibleMoreButton(this.page, song.clipId)))
                            throw new Error("More button not clickable for WAV");
                        const downloadMenuItemWav = await this.page.waitForSelector("xpath///button[.//span[text()='Download']]", { visible: true, timeout: 10000 });
                        if (downloadMenuItemWav) {
                            await downloadMenuItemWav.hover();
                        }
                        else {
                            throw `Could not find download download menu item - wav for ${song.clipId}`;
                        }
                        const wavButton = await this.page.waitForSelector('button[aria-label="WAV Audio"]', { visible: true, timeout: 10000 });
                        if (wavButton) {
                            await wavButton.click();
                        }
                        else {
                            throw `Could not find download wav button for ${song.clipId}`;
                        }
                        const modalTitleXPath = "xpath///span[contains(text(), 'Download WAV Audio')]";
                        await this.page.waitForSelector(modalTitleXPath, {
                            visible: true,
                            timeout: 15000,
                        });
                        console.log("  -> Waiting for file generation (up to 45 seconds)...");
                        const downloadButtonXPath = "//button[.//span[contains(text(), 'Download File')]]";
                        const readyDownloadButtonSelector = `xpath/${downloadButtonXPath}[not(@disabled)]`;
                        const downloadButtonElement = await this.page.waitForSelector(readyDownloadButtonSelector, { timeout: 60000 });
                        if (downloadButtonElement) {
                            await downloadButtonElement.click();
                        }
                        else {
                            throw `Could not find download button element for ${song.clipId}`;
                        }
                        await this.waitUntilDownload(session, songObject.clipId);
                        await this.page.waitForFunction((xpath) => !document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue, {}, modalTitleXPath.replace("xpath/", ""));
                        songObject.wavStatus = "DOWNLOADED";
                        console.log("  -> WAV download successful.");
                        (0, file_convert_js_1.convertWavToFlacAndAlac)(songObject);
                    }
                    catch (e) {
                        console.error(`  -> WAV download FAILED: ${e.message}`);
                        songObject.wavStatus = "FAILED";
                        await this.page.keyboard.press("Escape"); // Reset state
                    }
                    MetadataHandler_js_1.ProcessMetadata.saveSongsMetadata(allSongs); // Save status immediately
                }
                console.log(`--- Finished processing "${song.title}". Pausing... ---`);
            }
            await delay(3000);
            console.log("--- All songs have been processed on this page. ---");
            if (!(await this.clickNextPageButton(this.page))) {
                console.log("--- No more pages found. ---");
            }
            else {
                await delay(5000);
                session.detach();
                await this.scrapeAndDownload();
            }
        }
        catch (error) {
            console.error("A critical error occurred:", error);
        }
        finally {
            if (this.browser) {
                await this.browser.disconnect();
                console.log("Disconnected from the browser.");
            }
        }
    }
}
exports.Scraper = Scraper;
exports.Importer = new Scraper();
//# sourceMappingURL=scraper.js.map