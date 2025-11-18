"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ConfigHandler_js_1 = require("./ConfigHandler.js");
const scraper_js_1 = require("./scraper.js");
// A helper function for creating pauses
class Initializer {
    constructor() {
        this.setupDownloadDirs();
        this.SetupCopyDirs();
    }
    setupDownloadDirs() {
        const downloadRootDirectory = path_1.default.resolve(ConfigHandler_js_1.AppConfig.downloadRootDirectory);
        if (!fs_1.default.existsSync(downloadRootDirectory)) {
            fs_1.default.mkdirSync(downloadRootDirectory, { recursive: true });
        }
        ConfigHandler_js_1.AppConfig.audioFormats.forEach((format) => {
            const formatDir = path_1.default.join(downloadRootDirectory, format);
            if (!fs_1.default.existsSync(formatDir)) {
                fs_1.default.mkdirSync(formatDir, { recursive: true });
            }
            ConfigHandler_js_1.AppConfig[`${format}Directory`] = formatDir;
        });
        if (ConfigHandler_js_1.AppConfig.saveMetadataJSON) {
            const metadataDir = path_1.default.join(downloadRootDirectory, "metadata");
            if (!fs_1.default.existsSync(metadataDir)) {
                fs_1.default.mkdirSync(metadataDir, { recursive: true });
            }
            ConfigHandler_js_1.AppConfig.metadataDirectory = metadataDir;
        }
        if (ConfigHandler_js_1.AppConfig.saveImages) {
            const imagesDir = path_1.default.join(downloadRootDirectory, "images");
            if (!fs_1.default.existsSync(imagesDir)) {
                fs_1.default.mkdirSync(imagesDir, { recursive: true });
            }
            ConfigHandler_js_1.AppConfig.imageDirectory = imagesDir;
        }
    }
    SetupCopyDirs() {
        if (ConfigHandler_js_1.AppConfig.copyDownloadsToOtherLocation.length > 0) {
            ConfigHandler_js_1.AppConfig.copyDownloadsToOtherLocation.forEach((copyConfig) => {
                copyConfig.formats.forEach((format) => {
                    const formatDir = path_1.default.join(copyConfig.directory, format);
                    if (!fs_1.default.existsSync(formatDir)) {
                        fs_1.default.mkdirSync(formatDir, { recursive: true });
                    }
                });
                if (ConfigHandler_js_1.AppConfig.saveImages) {
                    const imagesDir = path_1.default.join(copyConfig.directory, "images");
                    if (!fs_1.default.existsSync(imagesDir)) {
                        fs_1.default.mkdirSync(imagesDir, { recursive: true });
                    }
                }
            });
        }
    }
}
let AppInitializer = new Initializer();
async function dostart() {
    await scraper_js_1.Importer.Initialize();
    scraper_js_1.Importer.scrapeAndDownload();
}
dostart();
//# sourceMappingURL=index.js.map