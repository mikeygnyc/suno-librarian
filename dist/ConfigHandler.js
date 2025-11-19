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
exports.AppConfig = void 0;
const cfgfile = __importStar(require("../config/config.json"));
const path_1 = __importDefault(require("path"));
const os = __importStar(require("os"));
class ConfigHandler {
    constructor() {
        if (cfgfile) {
            this.Config = this.transformPathFields(cfgfile);
        }
        else {
            throw new Error("Could not load config file");
        }
    }
    Config;
    transformPathFields(obj) {
        if (obj === null || typeof obj !== "object")
            return obj;
        const result = {};
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (key.includes("Path")) {
                result[key] = path_1.default.resolve(val.replace("~", os.homedir));
                //   } else if (typeof val === "object" && val !== null) {
                //     result[key] = this.transformPathFields(val);
                //   } else {
            }
            else {
                if (key === "otherLocationConfig") {
                    let tempArr = [];
                    obj.otherLocationConfig.forEach((otherLocCfg) => {
                        let newCfg = {
                            formats: otherLocCfg.formats,
                            retainOriginalFile: otherLocCfg.retainOriginalFile,
                            directoryPath: path_1.default.resolve(otherLocCfg.directoryPath.replace("~", os.homedir)),
                        };
                        tempArr.push(newCfg);
                    });
                    result[key] = tempArr;
                }
                else {
                    result[key] = val;
                }
            }
        }
        return result;
    }
}
exports.AppConfig = new ConfigHandler().Config;
//# sourceMappingURL=ConfigHandler.js.map