import * as path from "path";
import * as fs from "fs";

import * as puppeteer from "puppeteer";
import { ISongData } from "./ISongData";
import { AppConfig } from "./ConfigHandler";

class MetadataHandler {
  saveSongsMetadata(songs: Map<string, ISongData>) {
    if (!AppConfig.saveMetadataJSON) {
      return;
    }
    const metadataPath = path.join(AppConfig.downloadRootDirectory,"metadata", AppConfig.combinedSongsMetadataJsonFile);
    const songsArray = Array.from(songs.values());
    fs.writeFileSync(metadataPath, JSON.stringify(songsArray, null, 2));
  }
}

export let ProcessMetadata = new MetadataHandler();