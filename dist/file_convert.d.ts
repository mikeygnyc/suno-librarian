import type { ISongData } from "./ISongData.js";
export declare function convertWavToFlacAndAlac(metadata: ISongData): Promise<{
    flac: string;
    alac: string;
    wav: string;
}>;
export declare function escapeFfmpegMetadata(value: string | null): string;
//# sourceMappingURL=file_convert.d.ts.map