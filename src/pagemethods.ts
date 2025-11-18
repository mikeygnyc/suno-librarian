import path from "path";
import { delay } from "./scraper";
import * as puppeteer from "puppeteer";
import fs from "fs";
export class PageMethods {
  constructor() {}
  async scrollSongIntoView(
    page: puppeteer.Page,
    scrollContainer: puppeteer.ElementHandle<HTMLDivElement>,
    clipId: string
  ): Promise<puppeteer.ElementHandle | null> {
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

      const isAtBottom = await scrollContainer.evaluate(
        (el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 20
      );

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
  async clickVisibleMoreButton(
    page: puppeteer.Page,
    clipId: string
  ): Promise<boolean> {
    const moreButtonSelector = `div[data-clip-id="${clipId}"] button[aria-label="More menu contents"]`;
    const buttons = await page.$$(moreButtonSelector);
    if (buttons.length === 0) return false;

    for (const button of buttons) {
      if (await button.isIntersectingViewport()) {
        await button.click();
        return true;
      }
    }
    return false;
  }

  async clickNextPageButton(
    page: puppeteer.Page | undefined
  ): Promise<boolean> {
    if (!page) {
      return false;
    }
    //for whatever reason next does not have an aria label but previous does
    const nextButton = puppeteer.Locator.race([
      page.locator(
        "div.md\\:flex > div > div.flex-col > div button:nth-of-type(2) > svg"
      ),
      page.locator(
        '::-p-xpath(//*[@id=\\"main-container\\"]/div[2]/div/div[2]/div/div[2]/div/div/div[2]/div/button[2]/svg)'
      ),
      page.locator(
        ":scope >>> div.md\\:flex > div > div.flex-col > div button:nth-of-type(2) > svg"
      ),
    ]).setTimeout(5000);
    if (nextButton) {
      await nextButton.click();
      return true;
    }
    return false;
  }

  async clickPreviousPageButton(page: puppeteer.Page): Promise<boolean> {
    const nextButton = puppeteer.Locator.race([
      page.locator(
        '::-p-aria(Previous Page) >>>> ::-p-aria([role=\\"image\\"])'
      ),
      page.locator(
        "div.md\\:flex > div > div.flex-col > div button:nth-of-type(1) > svg"
      ),
      page.locator(
        '::-p-xpath(//*[@id=\\"main-container\\"]/div[2]/div/div[2]/div/div[2]/div/div/div[2]/div/button[1]/svg)'
      ),
      page.locator(
        ":scope >>> div.md\\:flex > div > div.flex-col > div button:nth-of-type(1) > svg"
      ),
    ]).setTimeout(5000);
    if (nextButton) {
      await nextButton.click();
      return true;
    }
    return false;
  }

  async waitUntilDownload(
    session: puppeteer.CDPSession,
    fileName: string = ""
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const handler = (e: puppeteer.Protocol.Browser.DownloadProgressEvent) => {
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
        } else if (e.state === "canceled") {
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

export let GlobalPageMethods = new PageMethods();