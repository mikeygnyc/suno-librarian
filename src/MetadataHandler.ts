import * as path from "path";
import * as fs from "fs";

import * as puppeteer from "puppeteer";
import { ISongData } from "./ISongData";
import { AppConfig } from "./ConfigHandler";
import { Importer } from "./scraper";

class MetadataHandler {
  saveMainMetadataFile() {
    if (!AppConfig.saveMetadataJSON) {
      return;
    }
    const metadataPath = path.join(
      AppConfig.downloadRootDirectoryPath,
      "metadata",
      AppConfig.combinedSongsMetadataJsonFile
    );
    const songsArray = Array.from(Importer.allSongs.values());
    fs.writeFileSync(metadataPath, JSON.stringify(songsArray, null, 2));
  }
  async saveSongMetadata(meta: ISongData) {
    if (!AppConfig.saveMetadataSidecarFiles) {
      return;
    }
    const metadataPath = path.join(
      AppConfig.downloadRootDirectoryPath,
      "metadata",
      `${meta.clipId}.json`
    );
    let cloneMeta = Object.assign({}, meta);
    delete cloneMeta.mp3Status;
    delete cloneMeta.flacStatus;
    delete cloneMeta.alacStatus;
    delete cloneMeta.wavStatus;
    fs.writeFileSync(metadataPath, JSON.stringify(cloneMeta, null, 2));
    this.saveLyrics(meta);
    await this.saveImage(meta);
  }
  saveLyrics(metadata:ISongData){
     if (!AppConfig.saveLyricsInTextFiles && !AppConfig.embedLyricsInMetadata) {
      return;
    }
    const metadataPath = path.join(
      AppConfig.downloadRootDirectoryPath,
      "lyrics",
      `${metadata.clipId}.txt`
    );
    fs.writeFileSync(metadataPath, `${metadata.lyrics}`);
  }
  async saveImage(metadata: ISongData) {
    if (AppConfig.saveImages || AppConfig.embedImagesInConvertedFiles) {
      const imageUrl: string = metadata.thumbnail ?? "";
      // const imgUrlArr: string[] = imageUrl.split("/");
      if (imageUrl) {
        let imageFile = `${metadata.clipId}${path.extname(imageUrl)}`;
        console.log(`      ->  Downloading image from ${imageUrl}`);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok && !! imageFile===undefined) {
          console.log(
            `      ->  Failed to fetch image: ${imageResponse.statusText} (${imageUrl})`
          );
        } else {
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          //@ts-ignore
          const imagePath = path.join(
            //@ts-ignore
            AppConfig.imagesDirectoryPath,
             //@ts-ignore
            imageFile
          );
          if (imagePath) {
            console.log(`      ->  Downloaded image to ${imagePath}`);
            fs.writeFileSync(imagePath, imageBuffer);
          }
        }
      }
    }
  }
}

export let ProcessMetadata = new MetadataHandler();

//tone for mp3
//metaflac for flac
//atomic parsley for m4a
