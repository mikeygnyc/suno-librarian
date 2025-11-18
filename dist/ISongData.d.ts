import { TFileStatus } from "./TDownloadStatus";
export interface ISongData {
    title: string | null;
    clipId: string;
    style: string | null;
    thumbnail: string | null;
    model: string | null;
    duration: string | null;
    mp3Status: TFileStatus;
    wavStatus: TFileStatus;
    songUrl: string;
    liked: boolean;
}
//# sourceMappingURL=ISongData.d.ts.map