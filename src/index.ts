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
    const downloadRootDirectory = path.resolve(AppConfig.downloadRootDirectoryPath);
    if (!fs.existsSync(downloadRootDirectory)) {
      fs.mkdirSync(downloadRootDirectory, { recursive: true });
    }
    AppConfig.audioFormats.forEach((format) => {
      const formatDir = path.join(downloadRootDirectory, format);
      if (!fs.existsSync(formatDir)) {
        fs.mkdirSync(formatDir, { recursive: true });
      }
      (AppConfig as any)[`${format}Directory`] = formatDir;
    });
    if (AppConfig.saveMetadataJSON) {
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
      AppConfig.imageDirectoryPath = imagesDir;
    }
  }
  SetupCopyDirs() {
    if (AppConfig.copyDownloadsToOtherLocation.length > 0) {
      AppConfig.copyDownloadsToOtherLocation.forEach((copyConfig) => {
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
      });
    }
  }
}

let AppInitializer = new Initializer();
async function dostart() {
  await Importer.Initialize();
  Importer.scrapeAndDownload();
}
dostart();