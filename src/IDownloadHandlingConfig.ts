import { TAudioFormats } from "./TAudioFormats";

export interface IDownloadHandlingConfig {
  formats: TAudioFormats[];
  directory: string;
  retainOriginalFile: boolean;
}
