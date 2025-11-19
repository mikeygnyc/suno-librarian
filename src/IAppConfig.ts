import { IDownloadHandlingConfig } from "./IDownloadHandlingConfig";
import { TAudioFormats } from "./TAudioFormats";

export interface IAppConfig {
  downloadRootDirectoryPath: string;
  audioFormats: TAudioFormats[];
  useSunoMp3FileIfAvailable: boolean;
  convertedMp3BitrateKbps: number;
  saveImages: boolean;
  saveMetadataJSON: boolean;
  combinedSongsMetadataJsonFile: string;
  embedMetadataInCovertedFiles: boolean;
  embedImagesInConvertedFiles: boolean;
  deleteImagesAfterEmbedding: boolean;
  useSongTitleInFilenames: boolean;
  chromeExecutablePath: string;
  chromeTempUserDataDirPath: string;
  copyDownloadsToOtherLocation: boolean;
  otherLocationConfig: IDownloadHandlingConfig[];
  wavDirectoryPath?: string;
  mp3DirectoryPath?: string;
  flacDirectoryPath?: string;
  alacDirectoryPath?: string;
  imageDirectoryPath?: string;
  metadataDirectoryPath?: string;
}
