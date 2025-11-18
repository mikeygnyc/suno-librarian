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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessMetadata = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const ConfigHandler_1 = require("./ConfigHandler");
class MetadataHandler {
    saveSongsMetadata(songs) {
        if (!ConfigHandler_1.AppConfig.saveMetadataJSON) {
            return;
        }
        const metadataPath = path.join(ConfigHandler_1.AppConfig.downloadRootDirectory, "metadata", ConfigHandler_1.AppConfig.combinedSongsMetadataJsonFile);
        const songsArray = Array.from(songs.values());
        fs.writeFileSync(metadataPath, JSON.stringify(songsArray, null, 2));
    }
}
exports.ProcessMetadata = new MetadataHandler();
//# sourceMappingURL=MetadataHandler.js.map