import * as path from "path";
import * as fs from "fs";
import * as puppeteer from "puppeteer";
import { AppConfig } from "./ConfigHandler.js";
import { ISongData } from "./ISongData.js";
import { TFileStatus } from "./TDownloadStatus.js";
import { ProcessMetadata } from "./MetadataHandler.js";
import * as readlinePs from "readline/promises";
import { GlobalPageMethods } from "./pagemethods.js";
import { Converter } from "./FileHandler.js";
export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
export class Scraper {
  constructor() {}
  page!: puppeteer.Page;
  async Initialize() {
    const tmpDir = path.parse(AppConfig.chromeTempUserDataDirPath).dir;
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    if (!this.browser) {
      console.log("Connecting to the browser...");
      this.browser = await puppeteer.launch({
        headless: false, // Set to true for headless mode, false for visible browser
        executablePath: AppConfig.chromeExecutablePath,
        args: ["--remote-debugging-port=9222", `--user-data-dir=${tmpDir}`],
      });

      this.page = await this.browser.newPage();
      await this.page.goto("https://suno.com/me");
    } else {
      let pgTmp = (await this.browser.pages()).find((p) =>
        p.url().includes("suno.com")
      );
      if (pgTmp) {
        this.page = pgTmp;
      } else {
        this.page = await this.browser.newPage();
        await this.page.goto("https://suno.com/me");
      }
    }
    if (!this.page) {
      console.error("Could not find the target this.page.");
      throw new Error("Could not find the target this.page.");
    } else {
      console.log("Scraper initialized");
    }
  }

  browser!: puppeteer.Browser;
  exhaustedSearch: boolean = false;
  session!: puppeteer.CDPSession;
  async scrapeAndDownload() {
    try {
      await this.sessionStarter();
      console.log(`Successfully connected to page: ${this.page.url()}`);
      if (this.page.url().includes("accounts.suno.com")) {
        const rl = readlinePs.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        await rl.question(
          "Login required. Please login on chrome and press enter when logged in "
        );
        rl.close();
        await this.page.goto("https://suno.com/me");
        console.log(`Successfully connected to page: ${this.page.url()}`);
      }
      this.getDataFromPage(this.session);
      // --- LOAD AND PREPARE DATA ---
      console.log("Starting data loading...");
      const allSongs = new Map<string, ISongData>();
      const metadataPath = path.join(
        AppConfig.downloadRootDirectoryPath,
        "metadata",
        "songs_metadata.json"
      );

      if (fs.existsSync(metadataPath)) {
        console.log("Found existing metadata file. Loading...");
        try {
          const existingSongs: ISongData[] = JSON.parse(
            fs.readFileSync(metadataPath, "utf-8")
          );
          existingSongs.forEach((song) => allSongs.set(song.clipId, song));
        } catch (error) {}
        console.log(`Loaded ${allSongs.size} songs from file.`);
      }

      let scrollContainer = await this.findScrollContainer();

      // Scrape page for all songs to discover new ones
      await this.discoverSongs(allSongs, this.session);

      // Create a queue of previously processed songs that need loading/downloading
      const songsToProcess = Array.from(allSongs.values()).filter(
        (song) =>
          (AppConfig.useSunoMp3FileIfAvailable &&
            AppConfig.audioFormats.includes("mp3") &&
            song.mp3Status !== "DOWNLOADED" &&
            song.mp3Status !== "CREATED") ||
          song.wavStatus !== "DOWNLOADED"
      );

      if (songsToProcess.length === 0) {
        if (this.exhaustedSearch) {
          console.log(
            "All discovered songs have already been downloaded. Exiting."
          );
          return;
        } else {
          this.exhaustedSearch = true;
        }

        if (!(await GlobalPageMethods.clickNextPageButton(this.page))) {
          console.log("--- All songs discoverd. No more pages found. ---");
          return;
        } else {
          console.log("Moving to next page");
          await delay(5000);
          this.session.detach();
          await this.scrapeAndDownload();
        }
      }

      console.log(
        `Total songs: ${allSongs.size}. Songs to process: ${songsToProcess.length}.`
      );
      ProcessMetadata.saveSongsMetadata(allSongs); // Save the merged list right away

      // --- START PROCESSING ---

      for (const [index, song] of songsToProcess.entries()) {
        console.log(
          `\n--- [${index + 1}/${songsToProcess.length}] Processing: ${
            song.title
          } (${song.clipId}) ---`
        );
        const songObject = allSongs.get(song.clipId)!;

        const songRow = await GlobalPageMethods.scrollSongIntoView(
          this.page,
          scrollContainer as puppeteer.ElementHandle<HTMLDivElement>,
          song.clipId
        );
        if (!songRow) {
          console.error(
            `Skipping "${song.title}" as it could not be scrolled into view.`
          );
          songObject.mp3Status = "SKIPPED";
          songObject.wavStatus = "SKIPPED";
          ProcessMetadata.saveSongsMetadata(allSongs);
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
          ProcessMetadata.saveSongsMetadata(allSongs); // Save status immediately
          await delay(1000);
        }

        // --- WAV Download ---
        if (songObject.wavStatus !== "DOWNLOADED") {
          try {
            console.log("  -> Downloading WAV...");
            const checkForExistDialog =
              "xpath///span[contains(text(), 'Download WAV Audio')]";
            let existDialog = await this.page.$(checkForExistDialog);
            if (existDialog) {
              const findModalCloseSearch =
                'button[aria-label="Close"]:not(.chakra-popover__close-btn)';
              let modalClose = await this.page.$(findModalCloseSearch);
              if (modalClose) {
                modalClose.click();
                console.log(`Closing stuck modal`);
              }
            }

            await GlobalPageMethods.scrollSongIntoView(
              this.page,
              scrollContainer as puppeteer.ElementHandle<HTMLDivElement>,
              song.clipId
            ); // Re-center element
            await this.page.keyboard.press("Escape");
            await delay(200);

            if (
              !(await GlobalPageMethods.clickVisibleMoreButton(
                this.page,
                song.clipId
              ))
            )
              throw new Error("More button not clickable for WAV");

            const downloadMenuItemWav = await this.page.waitForSelector(
              "xpath///button[.//span[text()='Download']]",
              { visible: true, timeout: 10000 }
            );
            if (downloadMenuItemWav) {
              await downloadMenuItemWav.hover();
            } else {
              throw `Could not find download download menu item - wav for ${song.clipId}`;
            }

            const wavButton = await this.page.waitForSelector(
              'button[aria-label="WAV Audio"]',
              { visible: true, timeout: 10000 }
            );
            if (wavButton) {
              await wavButton.click();
            } else {
              throw `Could not find download wav button for ${song.clipId}`;
            }

            const modalTitleXPath =
              "xpath///span[contains(text(), 'Download WAV Audio')]";
            await this.page.waitForSelector(modalTitleXPath, {
              visible: true,
              timeout: 15000,
            });
            console.log(
              "  -> Waiting for file generation (up to 45 seconds)..."
            );

            const downloadButtonXPath =
              "//button[.//span[contains(text(), 'Download File')]]";
            const readyDownloadButtonSelector = `xpath/${downloadButtonXPath}[not(@disabled)]`;
            const downloadButtonElement = await this.page.waitForSelector(
              readyDownloadButtonSelector,
              { timeout: 60000 }
            );
            if (downloadButtonElement) {
              await downloadButtonElement.click();
            } else {
              throw `Could not find download button element for ${song.clipId}`;
            }

            await GlobalPageMethods.waitUntilDownload(
              this.session,
              songObject.clipId
            );
            await this.page.waitForFunction(
              (xpath) =>
                !document.evaluate(
                  xpath,
                  document,
                  null,
                  XPathResult.FIRST_ORDERED_NODE_TYPE,
                  null
                ).singleNodeValue,
              {},
              modalTitleXPath.replace("xpath/", "")
            );

            songObject.wavStatus = "DOWNLOADED";
            console.log("  -> WAV download successful.");
            Converter.convertWav(songObject).then(() => {
              Converter.copyToOtherLocations(songObject);
            });
          } catch (e: any) {
            console.error(`  -> WAV download FAILED: ${e.message}`);
            songObject.wavStatus = "FAILED";
            await this.page.keyboard.press("Escape"); // Reset state
          }
          ProcessMetadata.saveSongsMetadata(allSongs); // Save status immediately
        }

        console.log(`--- Finished processing "${song.title}". Pausing... ---`);
      }
      await delay(3000);
      console.log("--- All songs have been processed on this this.page. ---");
      if (!(await GlobalPageMethods.clickNextPageButton(this.page))) {
        console.log("--- No more pages found. ---");
      } else {
        await delay(5000);
        this.session.detach();
        await this.scrapeAndDownload();
      }
    } catch (error) {
      console.error("A critical error occurred:", error);
    } finally {
      if (this.browser) {
        await this.browser.disconnect();
        console.log("Disconnected from the browser.");
      }
    }
  }
  async findScrollContainer() {
    const scrollContainerSelector = 'div[id*="tabpanel-songs"]';
    await this.page.waitForSelector(scrollContainerSelector, {
      timeout: 30000,
    });
    //@ts-ignore
    const scrollContainers = await this.page.$$<HTMLDivElement>(
      scrollContainerSelector
    );
    const scrollContainer = scrollContainers?.[1];
    if (!scrollContainer)
      throw new Error("Could not find the song list's scrollable container.");
    console.log("Successfully identified the nested scroll container.");
    return scrollContainer;
  }

  async sessionStarter() {
    this.session = await this.browser.target().createCDPSession();
    await this.session.send("Browser.setDownloadBehavior", {
      behavior: "allowAndName",
      downloadPath: AppConfig.downloadRootDirectoryPath,
      eventsEnabled: true,
    });
    this.session.removeAllListeners("Browser.downloadWillBegin");
    this.session.removeAllListeners("Browser.downloadProgress");
    this.session.on("Browser.downloadWillBegin", (event) => {
      console.log(
        `    -> Download will begin for browser guid ${event.guid} - ${event.suggestedFilename} from ${event.url}`
      );
    });

    // Listen for downloadProgress event
    this.session.on("Browser.downloadProgress", (event) => {
      if (event.state === "completed") {
        console.log(`    -> Download completed for browser guid ${event.guid}`);
      } else if (event.state === "canceled") {
        console.log(`    -> Download canceled for browser guid  ${event.guid}`);
      }
    });
    return this.session;
  }

  async getDataFromPage(session: puppeteer.CDPSession) {}

  private async discoverSongs(
    allSongs: Map<string, ISongData>,
    session: puppeteer.CDPSession,
    previousDiscoverCtr: number = 0
  ) {
    const rows = await this.page.$$('div[data-testid="song-row"]');
    const discoveredSongs: ISongData[] = await this.page.$$eval(
      'div[data-testid="song-row"]',
      (rows) =>
        rows
          .map((row) => {
            const clipId = row.getAttribute("data-clip-id") || "";
            const titleEl = row.querySelector("span[title] a span");
            const title = titleEl ? titleEl.textContent : "Untitled";
            const styleEl = row.querySelector("div.flex.flex-row > div[title]");
            const style = styleEl?.getAttribute("title") || null;
            const imgEl = row.querySelector('img[alt="Song Image"]');
            const thumbnail =
              imgEl?.getAttribute("data-src") ||
              imgEl?.getAttribute("src") ||
              null;
            const durationEl = row.querySelector(
              'div[aria-label="Play Song"] span.absolute'
            );
            const duration = durationEl?.textContent?.trim() || null;
            const modelEl = Array.from(row.querySelectorAll("span")).find(
              (el) => el.textContent?.trim().startsWith("v")
            );
            const model = modelEl?.textContent?.trim() || null;
            const songUrl = `https://suno.com/song/${clipId}`;
            const likedEl = row.querySelector(
              'button[aria-label="Playbar: Like"]'
            );
            const liked =
              likedEl?.classList.contains("text-foreground-primary") || false;
            return {
              title,
              clipId,
              songUrl,
              style,
              thumbnail,
              model,
              duration,
              mp3Status: "PENDING" as TFileStatus,
              wavStatus: "PENDING" as TFileStatus,
              alacStatus: "PENDING" as TFileStatus,
              flacStatus: "PENDING" as TFileStatus,
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
          .filter((song) => song.clipId)
    );
    // Merge discovered songs with existing data
    let foundThisPass:number = 0;
    discoveredSongs.forEach((song) => {
      if (!allSongs.has(song.clipId)) {
        allSongs.set(song.clipId, song);
        foundThisPass++;
      }
    });
    let totalDiscovered = foundThisPass + previousDiscoverCtr;
    console.log(
      `Discovered ${foundThisPass} songs on page ${GlobalPageMethods.currentPage}, ${totalDiscovered} total so far.`
    );
    ProcessMetadata.saveSongsMetadata(allSongs);
    const nextPageFound = await GlobalPageMethods.paginationOps(
      this.page,
      true
    );
    if (nextPageFound) {
      console.log(`Moving to next page to discover more songs..`);
      await delay(5000);
      await this.discoverSongs(allSongs, session, totalDiscovered);
    } else {
      console.log(
        `Discovery complete. Total songs discovered: ${allSongs.size}.`
      );
    }
  }
}

export let Importer = new Scraper();
