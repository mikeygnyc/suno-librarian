import * as cfgfile from "../config/config.json";
import { IAppConfig } from "./IAppConfig";
import path from "path";
import * as os from "os";
class ConfigHandler {
  constructor() {
    if (cfgfile) {
      this.config = this.transformPathFields(cfgfile as IAppConfig);
    } else {
      throw new Error("Could not load config file");
    }
  }
  get Config(): IAppConfig {
    return this.config;
  }
  config!: IAppConfig;
  transformPathFields(obj: any): any {
    if (obj === null || typeof obj !== "object") return obj;

    const result: any = {};

    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];

      if (key.includes("Path")) {
        result[key] = path.resolve(val.replace("~",os.homedir));
      } else if (typeof val === "object" && val !== null) {
        result[key] = this.transformPathFields(val);
      } else {
        result[key] = val;
      }
    }

    return result;
  }
}

export let AppConfig = new ConfigHandler().Config;
