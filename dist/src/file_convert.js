"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertWavToFlacAndAlac = convertWavToFlacAndAlac;
exports.escapeFfmpegMetadata = escapeFfmpegMetadata;
const child_process_1 = require("child_process");
const util_1 = require("util");
const node_fetch_1 = __importDefault(require("node-fetch"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const asyncCopyFile = (0, util_1.promisify)(fs.copyFile);
const asyncDeleteFile = (0, util_1.promisify)(fs.rm);
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
async function convertWavToFlacAndAlac(metadata) {
    const songId = metadata.clipId;
    const imageDlDir = path.join(__dirname, "downloads", "images");
    const nasConfig = path.join(__dirname, "..", "nasloc");
    let nasPath = "";
    let moveToNas = false;
    let nasFlacDir = "";
    let nasAlacDir = "";
    let nasWavDir = "";
    if (fs.existsSync(nasConfig)) {
        nasPath = path.join(fs.readFileSync(nasConfig, "utf8"));
        if (fs.existsSync(nasPath)) {
            console.log(`      ->  Found NAS at ${nasPath} `);
            moveToNas = true;
            nasFlacDir = path.join(nasPath, "flac");
            if (!fs.existsSync(nasFlacDir)) {
                fs.mkdirSync(nasFlacDir);
            }
            nasAlacDir = path.join(nasPath, "alac");
            if (!fs.existsSync(nasAlacDir)) {
                fs.mkdirSync(nasAlacDir);
            }
            nasWavDir = path.join(nasPath, "wav");
            if (!fs.existsSync(nasWavDir)) {
                fs.mkdirSync(nasWavDir);
            }
        }
    }
    else {
        console.log(`      ->  Did Not Find NAS at ${nasConfig} `);
    }
    if (!fs.existsSync(imageDlDir)) {
        fs.mkdirSync(imageDlDir);
    }
    const flacDir = path.join(__dirname, "downloads", "flac");
    if (!fs.existsSync(flacDir)) {
        fs.mkdirSync(flacDir);
    }
    const alacDir = path.join(__dirname, "downloads", "alac");
    if (!fs.existsSync(alacDir)) {
        fs.mkdirSync(alacDir);
    }
    const wavDir = path.join(__dirname, "downloads", "wav");
    //this has to exist to even get here
    // 1. Fetch image
    let fullImagePath = "";
    const imageUrl = metadata.thumbnail ?? "";
    const imgUrlArr = imageUrl.split("/");
    if (imgUrlArr && imgUrlArr.length > 0) {
        console.log(`      ->  Downloading image from ${imageUrl}`);
        const imageResponse = await (0, node_fetch_1.default)(imageUrl);
        if (!imageResponse.ok) {
            console.log(`      ->  Failed to fetch image: ${imageResponse.statusText} (${imageUrl})`);
        }
        else {
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            //@ts-ignore
            const imagePath = path.join(imageDlDir, imgUrlArr[imgUrlArr.length - 1]);
            if (imagePath) {
                console.log(`      ->  Downloaded image to ${imagePath}`);
                fs.writeFileSync(imagePath, imageBuffer);
                fullImagePath = imagePath;
            }
        }
    }
    // 3. Prepare output paths
    const flacPath = path.join(flacDir, `${songId}.flac`);
    const alacPath = path.join(alacDir, `${songId}.m4a`);
    const wavPath = path.join(wavDir, `${songId}.wav`);
    // 4. Build metadata args
    const metadataArgs = createMetaDataArgs(metadata, false);
    const parsleyMetadataArgs = createMetaDataArgs(metadata, true);
    // 5. Convert to FLAC
    console.log(`        ->  Converting ${songId} to flac`);
    await execFileAsync("ffmpeg", createFfmpegExecArgs(flacPath, wavPath, "flac", metadataArgs, fullImagePath));
    console.log(`        ->  Done converting ${songId} to flac`);
    // 6. Convert to ALAC
    console.log(`        ->  Converting ${songId} to alac`);
    await execFileAsync("ffmpeg", createFfmpegExecArgs(alacPath, wavPath, "alac", metadataArgs));
    const atomicArgs = [
        alacPath,
        ...(fullImagePath ? ["--artwork", fullImagePath] : []),
        "--overWrite",
        ...parsleyMetadataArgs,
    ];
    console.log(`         ->  Adding cover and metadata to ALAC with AtomicParsley for ${songId}`);
    await execFileAsync("AtomicParsley", atomicArgs);
    console.log(`        ->  Done converting ${songId} to alac`);
    let finalWavPath = wavPath;
    let finalFlacPath = flacPath;
    let finalAlacPath = alacPath;
    if (moveToNas) {
        console.log(`          ->  Copying ${songId} to NAS`);
        try {
            let wavNas = path.join(nasWavDir, `${songId}.wav`);
            let alacNas = path.join(nasAlacDir, `${songId}.m4a`);
            let flacNas = path.join(nasFlacDir, `${songId}.flac`);
            copyToNAS(wavPath, wavNas, "WAV");
            copyToNAS(flacPath, flacNas, "WAV");
            copyToNAS(alacPath, alacNas, "WAV");
        }
        catch (err) {
            console.log(`       --> Error copying ${songId} to NAS! error: ${JSON.stringify(err)}`);
        }
        console.log(`          ->  Done copying ${songId} to NAS`);
    }
    fs.rmSync(fullImagePath);
    return { flac: finalFlacPath, alac: finalAlacPath, wav: finalWavPath };
}
function copyToNAS(srcPath, nasPath, label) {
    asyncCopyFile(srcPath, nasPath)
        .catch((reason) => {
        console.log(`          --> Error copying ${label} ${srcPath} to NAS! error: ${JSON.stringify(reason)}`);
    })
        .then(() => {
        console.log(`          --> Copied ${label} ${srcPath} to NAS, removing original`);
        asyncDeleteFile(srcPath)
            .catch((reason) => {
            console.log(`          --> Error deleting ${label} ${srcPath} after copy! error: ${JSON.stringify(reason)}`);
        })
            .then(() => {
            console.log(`          --> Removed ${label} ${srcPath}`);
        });
    });
}
function createFfmpegExecArgs(outputPath, wavPath, format, metadataArgs, imagePath) {
    const wavPart = ["-y", "-i", wavPath];
    let conversionPart = [
        ...(format === "flac"
            ? imagePath
                ? ["-i", imagePath, "-map", "0:a", "-map", "1:v"]
                : ["-map", "0:a"]
            : []),
        "-c:a",
        format,
        ...(format === "flac"
            ? imagePath
                ? ["-disposition:v:0", "attached_pic"]
                : []
            : []),
    ];
    const outputPart = [...metadataArgs, outputPath];
    const retVal = wavPart.concat(conversionPart).concat(outputPart);
    console.log(`      ->  running ffmpeg with command: ffmpeg ${retVal.join(" ")}`);
    return retVal;
}
function escapeFfmpegMetadata(value) {
    if (!value)
        return "";
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
        }
        else if (char === "'") {
            // Close quote, add escaped single quote, reopen quote
            escaped += "'\\''";
        }
        else if (char === "\n") {
            //skip newlines
            continue;
        }
        else if (char === "\r") {
            // Skip carriage returns
            continue;
        }
        else {
            escaped += char;
        }
    }
    return escaped;
}
function createMetaDataArgs(metadata, parsley) {
    const rawArgs = [
        "-metadata",
        `title=${escapeFfmpegMetadata(metadata.title)}`,
        "-metadata",
        `comment=${escapeFfmpegMetadata(`Liked:${metadata.liked ? "Yes" : "No"}|Model:Suno ${metadata.model}|Prompt:${metadata.style}`)}`,
        "-metadata",
        `artist=${escapeFfmpegMetadata("Gales.IO")}`,
    ];
    const metadataArgs = rawArgs.flatMap((arg) => arg === "-metadata"
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
            : []);
    return metadataArgs;
}
//# sourceMappingURL=file_convert.js.map