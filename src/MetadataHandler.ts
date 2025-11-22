import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as puppeteer from "puppeteer";
import { ISongData } from "./ISongData";
import { AppConfig } from "./ConfigHandler";
import { Importer } from "./scraper";
import { TDirectoryType } from "./FileHandler";
import { execFile } from "child_process";
import { promisify } from "util";
import { IToneJsonMeta } from "./IToneJsonMeta";
const execFileAsync = promisify(execFile);

class MetadataHandler {
  saveMainMetadataFile() {
    if (!AppConfig.saveMetadataJSON) {
      return;
    }
    const metadataPath = path.join(
      AppConfig.downloadRootDirectoryPath,
      "metadata",
      AppConfig.combinedSongsMetadataJsonFile
    );
    const songsArray = Array.from(Importer.allSongs.values());
    fs.writeFileSync(metadataPath, JSON.stringify(songsArray, null, 2));
  }
  async saveSongMetadata(meta: ISongData) {
    if (!AppConfig.saveMetadataSidecarFiles) {
      return;
    }
    const metadataPath = path.join(
      AppConfig.downloadRootDirectoryPath,
      "metadata",
      `${meta.clipId}.json`
    );
    let cloneMeta = Object.assign({}, meta);
    delete cloneMeta.mp3Status;
    delete cloneMeta.flacStatus;
    delete cloneMeta.alacStatus;
    delete cloneMeta.wavStatus;
    fs.writeFileSync(metadataPath, JSON.stringify(cloneMeta, null, 2));
    this.saveLyrics(meta);
    await this.saveImage(meta);
  }
  saveLyrics(metadata: ISongData) {
    if (!AppConfig.saveLyricsInTextFiles && !AppConfig.embedLyricsInMetadata) {
      return;
    }
    const metadataPath = path.join(
      AppConfig.downloadRootDirectoryPath,
      "lyrics",
      `${metadata.clipId}.txt`
    );
    fs.writeFileSync(metadataPath, `${metadata.lyrics}`);
  }
  async saveImage(metadata: ISongData) {
    if (AppConfig.saveImages || AppConfig.embedImagesInConvertedFiles) {
      const imageUrl: string = metadata.thumbnail ?? "";
      // const imgUrlArr: string[] = imageUrl.split("/");
      if (imageUrl) {
        let imageFile = `${metadata.clipId}${path.extname(imageUrl)}`;
        console.log(`      ->  Downloading image from ${imageUrl}`);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok && !!imageFile === undefined) {
          console.log(
            `      ->  Failed to fetch image: ${imageResponse.statusText} (${imageUrl})`
          );
        } else {
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          //@ts-ignore
          const imagePath = path.join(
            //@ts-ignore
            AppConfig.imagesDirectoryPath,
            //@ts-ignore
            imageFile
          );

          if (imagePath) {
            console.log(`      ->  Downloaded image to ${imagePath}`);
            fs.writeFileSync(imagePath, imageBuffer);
          }
        }
      }
    }
  }
  async embedMetadataInFile(metadata: ISongData) {
    // Implement embedding metadata into audio files here
    if (!AppConfig.embedMetadataInCovertedFiles) {
      return;
    }
    if (
      (AppConfig.audioFormats.includes("mp3") &&
        metadata.mp3Status === "DOWNLOADED") ||
      metadata.mp3Status === "CREATED"
    ) {
      this.embedMetadataInMp3(metadata);
    }
    if (
      AppConfig.audioFormats.includes("flac") &&
      metadata.flacStatus === "CREATED"
    ) {
      this.embedMetadataInFlac(metadata);
    }
    if (
      AppConfig.audioFormats.includes("alac") &&
      metadata.alacStatus === "CREATED"
    ) {
      this.embedMetadataInAlac(metadata);
    }

    // This is a placeholder for actual implementation
    // console.log(
    //   `      ->  Embedding metadata into ${filePath} for format ${format}`
    // );
  }
  private async embedMetadataInFlac(metadata: ISongData) {
    //convert metadata JSON to k=v form and save as id_vorbis.txt
    let lines: string[] = [];
    lines.push(`TITLE=${metadata.title}`);
    lines.push(`ARTIST=${metadata.artistName}`);
    lines.push(`AI_MODEL=Suno ${metadata.model}`);
    lines.push(`DATE=${metadata.creationDate?.toISOString()}`);
    lines.push(`CONTACT=${metadata.songUrl}`);
    lines.push(`SUNO_ID=${metadata.clipId}`);
    lines.push(`DESCRIPTION=${metadata.style ?? "-N/A-"}`);
    lines.push(`FAVORITE=${metadata.liked}`);
    if (metadata.tags) {
      lines.push(`SUNO_TAGS=${metadata.tags.join(",")}`);
    }
    lines.push(`SUNO_WEIRDNESS=${metadata.weirdness}%`);
    lines.push(`SUNO_STYLE_STRENGTH=${metadata.styleStrength}%`);
    lines.push(`SUNO_AUDIO_STRENGTH=${metadata.audioStrength}%`);
    lines.push(`COMMENT=${this.commentTagMunger(metadata)}`);
    if (metadata.remixParent) {
      lines.push(`SUNO_REMIX_PARENT=${metadata.remixParent}`);
    }

    const tmpFilePath = path.join(
      AppConfig.downloadRootDirectoryPath,
      "metadata",
      `${metadata.clipId}_vorbis.txt`
    );

    fs.writeFileSync(tmpFilePath, lines.join(os.EOL));
    let embeddedImage: boolean = false;
    let imagePath: string = "";
    if (AppConfig.embedImagesInConvertedFiles) {
      embeddedImage = true;
      imagePath = path.join(
        //@ts-ignore
        AppConfig.imagesDirectoryPath,
        //@ts-ignore
        `${metadata.clipId}${path.extname(metadata.thumbnail)}`
      );
    }
    const flacPath = `${AppConfig.flacDirectoryPath}/${metadata.clipId}.flac`;
    const metadataArgs: string[] = [
      `--preserve-modtime`,
      `--no-utf8-convert`,
      `--import-tags-from=${tmpFilePath}`,
    ];
    if (AppConfig.embedLyricsInMetadata) {
      if (metadata.lyrics) {
        const lyricsFilePath = path.join(
          AppConfig.downloadRootDirectoryPath,
          "lyrics",
          `${metadata.clipId}.txt`
        );
        metadataArgs.push(`--set-tag-from-file=LYRICS=${lyricsFilePath}`);
      }
    }
    if (embeddedImage) {
      metadataArgs.push(`--import-picture-from=${imagePath}`);
    }
    metadataArgs.push(flacPath);
    console.log(
      `      ->  running metaflac with command: metaflac ${metadataArgs.join(
        " "
      )}`
    );
    await execFileAsync("metaflac", metadataArgs);
    fs.rmSync(tmpFilePath);
  }
  private embedMetadataInAlac(metadata: ISongData) {}
  private async embedMetadataInMp3(metadata: ISongData) {
    let toneJsonMeta: IToneJsonMeta = {
      meta: {
        artist: metadata.artistName ?? "",
        recordingDate: metadata.creationDate
          ? metadata.creationDate.toISOString()
          : new Date(Date.now()).toISOString(),
        title: metadata.title ?? "[UNTITLED]",
        additionalFields: {
          description: metadata.style ?? "",
          contact: metadata.songUrl,
          favorite: metadata.liked,
          ai_model: `Suno ${metadata.model}`,
          suno_id: metadata.clipId,
          suno_tags: metadata.tags ? metadata.tags.join(",") : "",
          suno_weirdness: `${metadata.weirdness}%`,
          suno_style_strength: `${metadata.styleStrength}%`,
          suno_audio_strength: `${metadata.audioStrength}%`,
          remix_parent_id: metadata.remixParent,
          lyrics: AppConfig.embedLyricsInMetadata
            ? metadata.lyrics ?? undefined
            : undefined,
          comments: this.commentTagMunger(metadata),
        },
      },
    };
    const tmpFilePath = path.join(
      AppConfig.downloadRootDirectoryPath,
      "mp3",
      `${metadata.clipId}_tone.json`
    );
    fs.writeFileSync(tmpFilePath, JSON.stringify(toneJsonMeta));

    //tone tag fn.mp3 --taggers="ToneJson" --meta-tone-json-file fn_tone.json
    const mp3Path = `${AppConfig.mp3DirectoryPath}/${metadata.clipId}.mp3`;
    const metadataArgs: string[] = [
      "tag",
      `${mp3Path}`,
      `--taggers="ToneJson"`,
      `--meta-tone-json-file="${tmpFilePath}"`
    ];
    let embeddedImage: boolean = false;
    let imagePath: string = "";
    if (AppConfig.embedImagesInConvertedFiles) {
      embeddedImage = true;
      imagePath = path.join(
        //@ts-ignore
        AppConfig.imagesDirectoryPath,
        //@ts-ignore
        `${metadata.clipId}${path.extname(metadata.thumbnail)}`
      );
    }
    if (embeddedImage) {
      metadataArgs.push(`--meta-cover-file="${imagePath}"`);
    }
    metadataArgs.push(mp3Path);
    console.log(
      `      ->  running tone with command: tone ${metadataArgs.join(
        " "
      )}`
    );
    await execFileAsync("tone", metadataArgs);
    // tone tag --help
    // tone tag input.mp3 --meta-title "a title"
    // tone tag --debug --auto-import=covers --meta-additional-field ©st3=testing input.m4b --dry-run
    // tone tag --auto-import=covers --auto-import=chapters --path-pattern="audiobooks/%g/%a/%s/%p - %n.m4b" --path-pattern="audiobooks/%g/%a/%z/%n.m4b" audiobooks/ --dry-run
    // tone tag input.mp3 --script musicbrainz.js --script-tagger-parameter e2310769-2e68-462f-b54f-25ac8e3f1a21

    //--taggers=ToneJson
  }

  private commentTagMunger(metadata: ISongData): string {
    const commentArr: string[] = [
      `Liked:${metadata.liked ? "Yes" : "No"}`,
      `Model:Suno ${metadata.model}`,
      `Prompt:${metadata.style ?? "-N/A-"}`,
      `Weirdness:${metadata.weirdness}%`,
      `StyleStrength:${metadata.styleStrength}%`,
      `AudioStrength:${metadata.audioStrength}%`,
      `Tags:${metadata.tags ? metadata.tags.join(",") : ""}`,
    ];
    return commentArr.join("|");
  }
}
export let MetadataProcessor = new MetadataHandler();

//tone for mp3

//atomic parsley for alac/m4a
