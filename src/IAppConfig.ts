import { IDownloadHandlingConfig } from "./IDownloadHandlingConfig";
import { TAudioFormats } from "./TAudioFormats";

export interface IAppConfig {
  downloadRootDirectory: string;
  audioFormats: TAudioFormats[];
  saveImages: boolean;
  saveMetadataJSON: boolean;
  combinedSongsMetadataJsonFile: string;
  embedMetadataInCovertedFiles: boolean;
  embedImagesInConvertedFiles: boolean;
  deleteImagesAfterEmbedding: boolean;
  useSongTitleInFilenames: boolean;
  chromeExecutablePath: string;
  chromeTempUserDataDir: string;
  copyDownloadsToOtherLocation: IDownloadHandlingConfig[];
  wavDirectory?: string;
  mp3Directory?: string;
  flacDirectory?: string;
  alacDirectory?: string;
  imageDirectory?: string;
  metadataDirectory?: string;
}
