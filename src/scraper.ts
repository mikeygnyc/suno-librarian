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
      await this.getDataFromPage(this.session);
    } catch (error) {
      console.error("A critical error occurred:", error);
    } finally {
      if (this.browser) {
        await this.browser.disconnect();
        console.log("Disconnected from the browser.");
      }
    }
  }
  currentScrollContainer!: puppeteer.ElementHandle<Element>;
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
    this.currentScrollContainer = scrollContainer;
    return;
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
  allSongs = new Map<string, ISongData>();
  async getDataFromPage(session: puppeteer.CDPSession) {
    // --- LOAD AND PREPARE DATA ---
    console.log("Starting data loading...");
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
        existingSongs.forEach((song) => this.allSongs.set(song.clipId, song));
      } catch (error) {}
      console.log(`Loaded ${this.allSongs.size} songs from file.`);
    }

    // Scrape page for all songs to discover new ones
    await this.discoverSongs();
    while (this.morePagesAvailable) {
      const songsToProcess = await this.buildProcessingQueue();
      if (songsToProcess.length === 0) {
        console.log(
          "All discovered songs have already been downloaded. Exiting."
        );
        return;
        // if (this.exhaustedSearch) {
        //   console.log(
        //     "All discovered songs have already been downloaded. Exiting."
        //   );
        //   return;
        // } else {
        //   this.exhaustedSearch = true;
        // }

        // if (!(await GlobalPageMethods.clickNextPageButton(this.page))) {
        //   console.log("--- All songs discovered. No more pages found. ---");
        //   return;
        // } else {
        //   console.log("Moving to next page");
        //   await delay(5000);
        //   this.session.detach();
        //   await this.scrapeAndDownload();
        // }
      }
      // --- START PROCESSING ---

      await this.processSongs(songsToProcess);
      await delay(3000);
      console.log("--- All songs have been processed on this this.page. ---");
    }

    // if (!(await GlobalPageMethods.clickNextPageButton(this.page))) {
    //   console.log("--- No more pages found. ---");
    // } else {
    //   await delay(5000);
    //   this.session.detach();
    //   await this.scrapeAndDownload();
    // }
    return;
  }
  private async buildProcessingQueue(): Promise<ISongData[]> {
    // Create a queue of previously processed songs that need loading/downloading
    const songsToProcess = Array.from(this.allSongs.values()).filter(
      (song) =>
        (AppConfig.useSunoMp3FileIfAvailable &&
          AppConfig.audioFormats.includes("mp3") &&
          song.mp3Status !== "DOWNLOADED" &&
          song.mp3Status !== "CREATED") ||
        song.wavStatus !== "DOWNLOADED"
    );

    console.log(
      `Total songs: ${this.allSongs.size}. Songs to process: ${songsToProcess.length}.`
    );
    ProcessMetadata.saveMainMetadataFile(); // Save the merged list right away
    return songsToProcess;
  }
  private async processSongs(songsToProcess: ISongData[]) {
    for (const [index, song] of songsToProcess.entries()) {
      console.log(
        `\n--- [${index + 1}/${songsToProcess.length}] Processing: ${
          song.title
        } (${song.clipId}) ---`
      );
      const songObject = this.allSongs.get(song.clipId)!;

      const songRow = await GlobalPageMethods.scrollSongIntoView(
        this.page,
        song.clipId
      );
      if (!songRow) {
        console.error(
          `Skipping "${song.title}" as it could not be scrolled into view.`
        );
        songObject.mp3Status = "SKIPPED";
        songObject.wavStatus = "SKIPPED";
        songObject.flacStatus = "SKIPPED";
        songObject.alacStatus = "SKIPPED";
        ProcessMetadata.saveMainMetadataFile();
        continue;
      }

      // --- MP3 Download ---
      await this.downloadMp3(songObject);
      // --- WAV Download ---
      await this.downloadWav(songObject, song);
      ProcessMetadata.saveMainMetadataFile();
      console.log(`--- Finished processing "${song.title}". Pausing... ---`);
    }
    return;
  }

  private async downloadWav(songObject: ISongData, song: ISongData) {
    //don't do it if only mp3 is selected and use suno if available is selected
    let proceed: boolean = false;
    if (AppConfig.audioFormats.length > 1) {
      proceed = true;
    } else {
      if (AppConfig.audioFormats.includes("mp3")) {
        if (!AppConfig.useSunoMp3FileIfAvailable) {
          proceed = true;
        }
      } else {
        proceed = true;
      }
    }
    if (!proceed) {
      return;
    }
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

        await GlobalPageMethods.scrollSongIntoView(this.page, song.clipId); // Re-center element
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
        console.log("  -> Waiting for file generation (up to 45 seconds)...");

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
    }
  }

  private async downloadMp3(songObject: ISongData) {
    if (
      !AppConfig.audioFormats.includes("mp3") ||
      !AppConfig.useSunoMp3FileIfAvailable
    ) {
      return;
    }
    if (songObject.mp3Status !== "DOWNLOADED") {
      try {
        console.log("  -> Downloading MP3...");
        await this.page.keyboard.press("Escape");
        await delay(200);
        if (
          !(await GlobalPageMethods.clickVisibleMoreButton(
            this.page,
            songObject.clipId
          ))
        )
          throw new Error("More button not clickable for MP3");
        const downloadMenuItem = await this.page.waitForSelector(
          "xpath///button[.//span[text()='Download']]",
          { visible: true, timeout: 5000 }
        );
        if (downloadMenuItem) {
          await downloadMenuItem.hover();
          const mp3Button = await this.page.waitForSelector(
            'button[aria-label="MP3 Audio"]',
            { visible: true, timeout: 5000 }
          );
          if (mp3Button) {
            await mp3Button.click();
            await this.page.waitForSelector('button[aria-label="MP3 Audio"]', {
              hidden: true,
              timeout: 10000,
            });
            songObject.mp3Status = "DOWNLOADED";
            console.log("  -> MP3 download successful.");
          } else {
            throw new Error("Could not find the mp3 button");
          }
        } else {
          throw new Error("Could not find the download menu item");
        }
      } catch (e: any) {
        console.error(`  -> MP3 download FAILED: ${e.message}`);
        songObject.mp3Status = "FAILED";
        await this.page.keyboard.press("Escape"); // Reset state
      }
      ProcessMetadata.saveMainMetadataFile(); // Save status immediately
      await delay(1000);
    }
    return;
  }

  private async discoverSongs() {
    if (this.pagesSearched > 0) {
      this.morePagesAvailable = await GlobalPageMethods.paginationOps(
        this.page,
        true
      );
    } else {
      await this.findScrollContainer();
    }
    if (this.morePagesAvailable) {
      console.log(`Moving to next page to discover more songs..`);
      await delay(5000);
    } else {
      if (this.pagesSearched > 0) {
        console.log(
          `Discovery complete. Total songs discovered: ${this.allSongs.size}.`
        );
      }
    }

    // 1. Extract ONLY simple DOM data inside $$eval
    const discoveredSongsBasic = await this.page.$$eval(
      'div[data-testid="song-row"]',
      (rows) =>
        rows.map((row) => {
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
          const modelEl = Array.from(row.querySelectorAll("span")).find((el) =>
            el.textContent?.trim().startsWith("v")
          );
          const model = modelEl?.textContent?.trim() || null;
          const likedEl = row.querySelector(
            'button[aria-label="Playbar: Like"]'
          );
          const liked =
            likedEl?.classList.contains("text-foreground-primary") ?? false;

          return {
            clipId,
            title,
            style,
            thumbnail,
            duration,
            model,
            liked,
          };
        })
    );

    // 2. Now process each row with async Node-side logic
    const discoveredSongs: ISongData[] = [];

    for (const item of discoveredSongsBasic) {
      if (!item.clipId) continue;

      const clipId = item.clipId;

      const songUrl = `https://suno.com/song/${clipId}`;

      const artistXpath = `/html/body/div[2]/div[1]/div[2]/div[1]/div/div[3]/div/div/div[1]/div[2]/div[2]/div[1]/div/a`;

      const artistName = await GlobalPageMethods.getValueFromElementByXpath(
        this.page,
        artistXpath,
        "Unknown Artist",
        "title"
      );

      const lyricsXpath = `/html/body/div[2]/div[1]/div[2]/div[1]/div/div[3]/div/div/div[1]/div[2]/span[1]`;
      const lyrics = await GlobalPageMethods.getValueFromElementByXpath(
        this.page,
        lyricsXpath,
        "[Instrumental]"
      );

      const creationDateXpath = `/html/body/div[2]/div[1]/div[2]/div[1]/div/div[3]/div/div/div[1]/div[2]/span[2]`;
      const creationDateStr =
        await GlobalPageMethods.getValueFromElementByXpath(
          this.page,
          creationDateXpath,
          "1970-01-01T00:00:00Z"
        );
      const creationDate = new Date(creationDateStr);

      const remixParentXpath = `/html/body/div[2]/div[1]/div[2]/div[1]/div/div[3]/div/div/div[1]/div[2]/div[4]/div/div/div/div[2]/div/div[2]/a`;
      const remixParentHref =
        await GlobalPageMethods.getValueFromElementByXpath(
          this.page,
          remixParentXpath,
          "",
          "href"
        );
      const remixParent = remixParentHref?.split("/")[2] || null;

      // Controls
      const controlValsMap = new Map<string, string>();
      for (let i = 1; i <= 3; i++) {
        const nameXpath = `/html/body/div[2]/div[1]/div[2]/div[1]/div/div[3]/div/div/div[1]/div[2]/div[3]/ul/li[${i}]/span[1]/text()[1]`;
        const valXpath = `/html/body/div[2]/div[1]/div[2]/div[1]/div/div[3]/div/div/div[1]/div[2]/div[3]/ul/li[${i}]/span[2]`;

        const key = await GlobalPageMethods.getValueFromElementByXpath(
          this.page,
          nameXpath,
          ""
        );
        const val = await GlobalPageMethods.getValueFromElementByXpath(
          this.page,
          valXpath,
          ""
        );

        if (key && val) controlValsMap.set(key, val);
      }

      const weirdness = parseInt(controlValsMap.get("Weirdness") ?? "50%");
      const styleStrength = parseInt(
        controlValsMap.get("Style Strength") ?? "50%"
      );
      const audioStrength = parseInt(
        controlValsMap.get("Audio Strength") ?? "25%"
      );

      discoveredSongs.push({
        title: item.title,
        clipId,
        songUrl,
        style: item.style,
        thumbnail: item.thumbnail,
        model: item.model,
        duration: item.duration,
        liked: item.liked,
        mp3Status: "PENDING",
        wavStatus: "PENDING",
        alacStatus: "PENDING",
        flacStatus: "PENDING",
        artistName,
        lyrics,
        creationDate,
        weirdness,
        styleStrength,
        audioStrength,
        remixParent,
        tags: [],
      });
    }

   

    // Merge discovered songs with existing data
    let foundThisPass: number = 0;
    for (const song of discoveredSongs) {
      if (!this.allSongs.has(song.clipId)) {
        this.allSongs.set(song.clipId, song);
        foundThisPass++;
        await ProcessMetadata.saveSongMetadata(song);
      }
    }
    this.pagesSearched++;
    this.totalDiscoveredSongs = foundThisPass + this.totalDiscoveredSongs;
    console.log(
      `Discovered ${foundThisPass} songs on page ${GlobalPageMethods.currentPage}, ${this.totalDiscoveredSongs} total so far.`
    );
    ProcessMetadata.saveMainMetadataFile();
  }
  totalDiscoveredSongs: number = 0;
  morePagesAvailable: boolean = true;
  pagesSearched: number = 0;

  private async extractMetadata(row: puppeteerElementHandle<HTMLDivElement>) {}
}

export let Importer = new Scraper();
