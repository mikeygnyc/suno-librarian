import { TFileStatus } from "./TDownloadStatus";

export interface ISongData {
  title?: string|null;
  clipId: string;
  style?: string|null;
  thumbnail?: string|null;
  model?: string|null;
  duration?: string|null;
  mp3Status: TFileStatus;
  flacStatus: TFileStatus;
  alacStatus: TFileStatus;
  wavStatus: TFileStatus;
  songUrl: string;
  liked: boolean;
  artistName?: string|null;
  lyrics?: string|null;
  creationDate?: Date|null;
  weirdness: number;
  styleStrength:number;
  audioStrength:number;
  remixParent?:string|null;
  tags?: string[];
}
