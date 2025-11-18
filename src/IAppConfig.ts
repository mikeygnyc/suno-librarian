import { IDownloadHandlingConfig } from "./IDownloadHandlingConfig";
import { TAudioFormats } from "./TAudioFormats";

export interface IAppConfig {
  downloadRootDirectoryPath: string;
  audioFormats: TAudioFormats[];
  saveImages: boolean;
  saveMetadataJSON: boolean;
  combinedSongsMetadataJsonFile: string;
  embedMetadataInCovertedFiles: boolean;
  embedImagesInConvertedFiles: boolean;
  deleteImagesAfterEmbedding: boolean;
  useSongTitleInFilenames: boolean;
  chromeExecutablePath: string;
  chromeTempUserDataDirPath: string;
  copyDownloadsToOtherLocation: IDownloadHandlingConfig[];
  wavDirectoryPath?: string;
  mp3DirectoryPath?: string;
  flacDirectoryPath?: string;
  alacDirectoryPath?: string;
  imageDirectoryPath?: string;
  metadataDirectoryPath?: string;
}
