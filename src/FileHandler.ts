import * as fs from "fs";
import { AppConfig } from "./ConfigHandler";
import { ISongData } from "./ISongData";
import { TAudioFormats } from "./TAudioFormats";
import { promisify } from "util";
import { execFile } from "child_process";
import { IDownloadHandlingConfig } from "./IDownloadHandlingConfig";
import path from "path";
const asyncCopyFile = promisify(fs.copyFile);
const asyncDeleteFile = promisify(fs.rm);
const execFileAsync = promisify(execFile);

export class FileHandler {
  async convertWav(metadata: ISongData) {
    const wavFilePath = `${AppConfig.wavDirectoryPath}/${metadata.clipId}.wav`;
    if (!fs.existsSync(wavFilePath)) {
      throw new Error(`WAV file not found for clipId ${metadata.clipId}`);
    }
    for(const format of AppConfig.audioFormats){
      if (format === "wav") {
        console.log(
          `        ->  WAV format selected, no conversion needed for ${metadata.clipId}`
        );
      }
      if (format === "flac") {
        const flacPath = `${AppConfig.flacDirectoryPath}/${metadata.clipId}.flac`;
        console.log(`        ->  Converting ${metadata.clipId} to flac`);
        await execFileAsync(
          "ffmpeg",
          this.createFfmpegExecArgs(flacPath, wavFilePath, "flac")
        );
      }
      if (format === "alac") {
        const alacPath = `${AppConfig.alacDirectoryPath}/${metadata.clipId}.m4a`;
        console.log(`        ->  Converting ${metadata.clipId} to alac`);
        await execFileAsync(
          "ffmpeg",
          this.createFfmpegExecArgs(alacPath, wavFilePath, "alac")
        );
      }
      if (format === "mp3") {
        if (AppConfig.useSunoMp3FileIfAvailable) {
          console.log(
            `        ->  MP3 format selected, no conversion needed for ${metadata.clipId}`
          );
        } else {
          const mp3Path = `${AppConfig.mp3DirectoryPath}/${metadata.clipId}.mp3`;
          console.log(`        ->  Converting ${metadata.clipId} to mp3`);
          await execFileAsync(
            "ffmpeg",
            this.createFfmpegExecArgs(mp3Path, wavFilePath, "mp3")
          );
        }
      }
    }
    
    return;
  }
  async saveImage(metadata: ISongData) {
    let fullImagePath: string = "";
    if (AppConfig.saveImages || AppConfig.embedImagesInConvertedFiles) {
      const imageUrl: string = metadata.thumbnail ?? "";
      const imgUrlArr: string[] = imageUrl.split("/");
      if (imgUrlArr && imgUrlArr.length > 0) {
        console.log(`      ->  Downloading image from ${imageUrl}`);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          console.log(
            `      ->  Failed to fetch image: ${imageResponse.statusText} (${imageUrl})`
          );
        } else {
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          //@ts-ignore
          const imagePath = path.join(
             //@ts-ignore
            AppConfig.imageDirectoryPath,
            imgUrlArr[imgUrlArr.length - 1]
          );
          if (imagePath) {
            console.log(`      ->  Downloaded image to ${imagePath}`);
            fs.writeFileSync(imagePath, imageBuffer);
            fullImagePath = imagePath;
          }
        }
      }
    }
  }
  copyToOtherLocations(metadata: ISongData) {
    if (!AppConfig.copyDownloadsToOtherLocation) {
      return;
    }
    AppConfig.otherLocationConfig.forEach(
      async (copyConfig: IDownloadHandlingConfig) => {
        copyConfig.formats.forEach((format: TAudioFormats) => {
          let extension: string = "";
          switch (format) {
            case "alac":
              extension = ".m4a";
              break;
            case "flac":
              extension = ".flac";
              break;
            case "mp3":
              extension = ".mp3";
              break;
            case "wav":
              extension = ".wav";
              break;
          }

          const sourcePath = path.join(
            (AppConfig as any)[`${format}DirectoryPath`],
            `${metadata.clipId}${extension}`
          );
          const destPath = path.join(
            copyConfig.directoryPath,
            format,
            `${metadata.clipId}${extension}`
          );
          //fs.copyFileSync(sourcePath, destPath);
          asyncCopyFile(sourcePath, destPath)
            .catch((reason: any) => {
              console.log(
                `          --> Error copying ${format} ${sourcePath} to ${destPath}! error: ${JSON.stringify(
                  reason
                )}`
              );
            })
            .then(() => {
              console.log(
                `          --> Copied ${format} ${sourcePath} to ${destPath}, removing original`
              );
              if (!copyConfig.retainOriginalFile) {
                asyncDeleteFile(sourcePath)
                  .catch((reason: any) => {
                    console.log(
                      `          --> Error deleting ${format} ${sourcePath} after copy! error: ${JSON.stringify(
                        reason
                      )}`
                    );
                  })
                  .then(() => {
                    console.log(
                      `          --> Removed ${format} ${sourcePath}`
                    );
                  });
              }
            });
        });
      }
    );
  }

  createFfmpegExecArgs(
    outputPath: string,
    wavPath: string,
    format: "alac" | "flac" | "mp3"
  ): string[] {
    const wavPart: string[] = ["-y", "-i", wavPath];
    let conversionPart: string[] = [];
    switch (format) {
      case "alac":
        conversionPart = ["-c:a", "alac"];
        break;
      case "flac":
        conversionPart = ["-c:a", "flac"];
        break;
      case "mp3":
        conversionPart = [
          "-c:a",
          "libmp3lame",
          "-b:a",
          `${AppConfig.convertedMp3BitrateKbps}k`,
        ];
        break;
      default:
        break;
    }

    const outputPart: string[] = [outputPath];

    const retVal: string[] = wavPart.concat(conversionPart).concat(outputPart);
    console.log(
      `      ->  running ffmpeg with command: ffmpeg ${retVal.join(" ")}`
    );
    return retVal;
  }
}

export const Converter:FileHandler = new FileHandler();