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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Importer = exports.Scraper = exports.delay = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const puppeteer = __importStar(require("puppeteer"));
const ConfigHandler_js_1 = require("./ConfigHandler.js");
const MetadataHandler_js_1 = require("./MetadataHandler.js");
const readlinePs = __importStar(require("readline/promises"));
const pagemethods_js_1 = require("./pagemethods.js");
const FileHandler_js_1 = require("./FileHandler.js");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
exports.delay = delay;
class Scraper {
    constructor() { }
    page;
    async Initialize() {
        const tmpDir = path.parse(ConfigHandler_js_1.AppConfig.chromeTempUserDataDirPath).dir;
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
            console.error("Could not find the target this.page.");
            throw new Error("Could not find the target this.page.");
        }
        else {
            console.log("Scraper initialized");
        }
    }
    browser;
    exhaustedSearch = false;
    async scrapeAndDownload() {
        try {
            const session = await this.browser.target().createCDPSession();
            await session.send("Browser.setDownloadBehavior", {
                behavior: "allowAndName",
                downloadPath: ConfigHandler_js_1.AppConfig.downloadRootDirectoryPath,
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
            if (this.page.url().includes("accounts.suno.com")) {
                const rl = readlinePs.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });
                await rl.question("Login required. Please login on chrome and press enter when logged in ");
                rl.close();
                await this.page.goto("https://suno.com/me");
                console.log(`Successfully connected to page: ${this.page.url()}`);
            }
            // --- LOAD AND PREPARE DATA ---
            const allSongs = new Map();
            const metadataPath = path.join(ConfigHandler_js_1.AppConfig.downloadRootDirectoryPath, "metadata", "songs_metadata.json");
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
            const scrollContainers = await this.page.$$(scrollContainerSelector);
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
                    mp3Status: "PENDING",
                    wavStatus: "PENDING",
                    alacStatus: "PENDING",
                    flacStatus: "PENDING",
                    liked: liked,
                    artist: null,
                    lyrics: null,
                    creationDate: null,
                    weirdness: 50,
                    styleStrength: 50,
                    audioStrength: 25,
                    remixParent: null,
                    tags: [],
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
                if (!(await pagemethods_js_1.GlobalPageMethods.clickNextPageButton(this.page))) {
                    console.log("--- All songs discoverd. No more pages found. ---");
                    return;
                }
                else {
                    console.log("Moving to next page");
                    await (0, exports.delay)(5000);
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
                const songRow = await pagemethods_js_1.GlobalPageMethods.scrollSongIntoView(this.page, scrollContainer, song.clipId);
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
                    //     await this.page.keyboard.press('Escape');
                    //     await delay(200);
                    //     if (!(await clickVisibleMoreButton(page, song.clipId)))
                    //         throw new Error('More button not clickable for MP3');
                    //     const downloadMenuItem = await this.page.waitForSelector(
                    //         "xpath///button[.//span[text()='Download']]",
                    //         { visible: true, timeout: 5000 }
                    //     );
                    //     await downloadMenuItem.hover();
                    //     const mp3Button = await this.page.waitForSelector(
                    //         'button[aria-label="MP3 Audio"]',
                    //         { visible: true, timeout: 5000 }
                    //     );
                    //     await mp3Button.click();
                    //     await this.page.waitForSelector(
                    //         'button[aria-label="MP3 Audio"]',
                    //         { hidden: true, timeout: 10000 }
                    //     );
                    //     songObject.mp3Status = 'DOWNLOADED';
                    //     console.log('  -> MP3 download successful.');
                    // } catch (e: any) {
                    //     console.error(`  -> MP3 download FAILED: ${e.message}`);
                    //     songObject.mp3Status = 'FAILED';
                    //     await this.page.keyboard.press('Escape'); // Reset state
                    // }
                    MetadataHandler_js_1.ProcessMetadata.saveSongsMetadata(allSongs); // Save status immediately
                    await (0, exports.delay)(1000);
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
                        await pagemethods_js_1.GlobalPageMethods.scrollSongIntoView(this.page, scrollContainer, song.clipId); // Re-center element
                        await this.page.keyboard.press("Escape");
                        await (0, exports.delay)(200);
                        if (!(await pagemethods_js_1.GlobalPageMethods.clickVisibleMoreButton(this.page, song.clipId)))
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
                        await pagemethods_js_1.GlobalPageMethods.waitUntilDownload(session, songObject.clipId);
                        await this.page.waitForFunction((xpath) => !document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue, {}, modalTitleXPath.replace("xpath/", ""));
                        songObject.wavStatus = "DOWNLOADED";
                        console.log("  -> WAV download successful.");
                        FileHandler_js_1.Converter.convertWav(songObject).then(() => {
                            FileHandler_js_1.Converter.copyToOtherLocations(songObject);
                        });
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
            await (0, exports.delay)(3000);
            console.log("--- All songs have been processed on this this.page. ---");
            if (!(await pagemethods_js_1.GlobalPageMethods.clickNextPageButton(this.page))) {
                console.log("--- No more pages found. ---");
            }
            else {
                await (0, exports.delay)(5000);
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