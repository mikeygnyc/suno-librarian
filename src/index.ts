import fs from "fs";
import path from "path";
import { AppConfig } from "./ConfigHandler.js";
import { Importer } from "./scraper.js";

// A helper function for creating pauses

class Initializer {
  constructor() {
    this.setupDownloadDirs();
    this.SetupCopyDirs();
  }
  setupDownloadDirs() {
    const downloadRootDirectory = path.resolve(
      AppConfig.downloadRootDirectoryPath
    );
    if (!fs.existsSync(downloadRootDirectory)) {
      fs.mkdirSync(downloadRootDirectory, { recursive: true });
    }
    AppConfig.audioFormats.forEach((format) => {
        const formatDir = path.join(downloadRootDirectory, format);
        if (!fs.existsSync(formatDir)) {
          fs.mkdirSync(formatDir, { recursive: true });
        }
        (AppConfig as any)[`${format}DirectoryPath`] = formatDir;
    });
    if (AppConfig.saveMetadataJSON || AppConfig.saveMetadataSidecarFiles) {
      const metadataDir = path.join(downloadRootDirectory, "metadata");
      if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true });
      }
      AppConfig.metadataDirectoryPath = metadataDir;
    }
    if (AppConfig.saveImages) {
      const imagesDir = path.join(downloadRootDirectory, "images");
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      AppConfig.imagesDirectoryPath = imagesDir;
    }
    if (AppConfig.embedLyricsInMetadata||AppConfig.saveLyricsInTextFiles) {
      const lyricsDir = path.join(downloadRootDirectory, "lyrics");
      if (!fs.existsSync(lyricsDir)) {
        fs.mkdirSync(lyricsDir, { recursive: true });
      }
      AppConfig.lyricsDirectoryPath = lyricsDir;
    }
  }
  SetupCopyDirs() {
    if (AppConfig.copyDownloadsToOtherLocation) {
      AppConfig.otherLocationConfig.forEach((copyConfig) => {
        copyConfig.formats.forEach((format) => {
          const formatDir = path.join(copyConfig.directoryPath, format);
          if (!fs.existsSync(formatDir)) {
            fs.mkdirSync(formatDir, { recursive: true });
          }
        });
        if (AppConfig.saveImages) {
          const imagesDir = path.join(copyConfig.directoryPath, "images");
          if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
          }
        }
        if (AppConfig.saveMetadataJSON || AppConfig.saveMetadataSidecarFiles) {
          const metadataDir = path.join(copyConfig.directoryPath, "metadata");
          if (!fs.existsSync(metadataDir)) {
            fs.mkdirSync(metadataDir, { recursive: true });
          }
        }
        if (AppConfig.embedLyricsInMetadata||AppConfig.saveLyricsInTextFiles) {
          const lyricsDir = path.join(copyConfig.directoryPath, "lyrics");
          if (!fs.existsSync(lyricsDir)) {
            fs.mkdirSync(lyricsDir, { recursive: true });
          }
        }
      });
    }
  }
}
console.log(process.env.PATH);
let AppInitializer = new Initializer();
async function dostart() {
  await Importer.Initialize();
  Importer.scrapeAndDownload();
}
dostart();
