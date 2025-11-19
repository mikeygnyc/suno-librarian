import fetch from "node-fetch";
import * as path from "path";
import * as fs from "fs";
import type { ISongData } from "./ISongData.js";
import { AppConfig } from "./ConfigHandler.js";




export function escapeFfmpegMetadata(value: string | null): string {
  if (!value) return "";

  // Start with an empty escaped string
  let escaped = "";

  // Trim if it has leading/trailing whitespace or empty string
  const needsQuotes = /^\s|\s$/.test(value) || value === "";
  if (needsQuotes) {
    value = value.trim();
  }
  for (const char of value) {
    if (char === "\\") {
      escaped += "\\\\";
    } else if (char === "'") {
      // Close quote, add escaped single quote, reopen quote
      escaped += "'\\''";
    } else if (char === "\n") {
      //skip newlines
      continue;
    } else if (char === "\r") {
      // Skip carriage returns
      continue;
    } else {
      escaped += char;
    }
  }

  return escaped;
}

function createMetaDataArgs(metadata: ISongData, parsley: boolean): string[] {
  const rawArgs = [
    "-metadata",
    `title=${escapeFfmpegMetadata(metadata.title)}`,
    "-metadata",
    `comment=${escapeFfmpegMetadata(
      `Liked:${metadata.liked ? "Yes" : "No"}|Model:Suno ${
        metadata.model
      }|Prompt:${metadata.style}`
    )}`,
    "-metadata",
    `artist=${escapeFfmpegMetadata("Gales.IO")}`,
  ];
  const metadataArgs: string[] = rawArgs.flatMap((arg: string) =>
    arg === "-metadata"
      ? parsley
        ? []
        : [arg]
      : arg.includes("=")
      ? parsley
        ? (() => {
            const i = arg.indexOf("=");
            return [`--${arg.substring(0, i)}`, arg.substring(i + 1)];
          })()
        : [arg]
      : []
  );

  return metadataArgs;
}
