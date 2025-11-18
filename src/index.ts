import * as puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { convertWavToFlacAndAlac } from "./file_convert";
import { ISongData } from "./ISongData";
import { TDownloadStatus } from "./TDownloadStatus";
import { AppConfig } from "./ConfigHandler";
import { Importer } from "./Scraper";

// A helper function for creating pauses

class Initializer {
  constructor() {
    this.setupDownloadDirs();
    this.SetupCopyDirs();
  }
  setupDownloadDirs() {
    const downloadRootDirectory = path.resolve(AppConfig.downloadRootDirectory);
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
      AppConfig.metadataDirectory = metadataDir;
    }
    if (AppConfig.saveImages) {
      const imagesDir = path.join(downloadRootDirectory, "images");
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      AppConfig.imageDirectory = imagesDir;
    }
  }
  SetupCopyDirs() {
    if (AppConfig.copyDownloadsToOtherLocation.length > 0) {
      AppConfig.copyDownloadsToOtherLocation.forEach((copyConfig) => {
        copyConfig.formats.forEach((format) => {
          const formatDir = path.join(copyConfig.directory, format);
          if (!fs.existsSync(formatDir)) {
            fs.mkdirSync(formatDir, { recursive: true });
          }
        });
        if (AppConfig.saveImages) {
          const imagesDir = path.join(copyConfig.directory, "images");
          if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
          }
        }
      });
    }
  }
}

let AppInitializer = new Initializer();
Importer.scrapeAndDownload();
