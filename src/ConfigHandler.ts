import * as cfgfile from "../config/config.json";
import { IAppConfig } from "./IAppConfig";
class ConfigHandler{
    constructor(){
        if (cfgfile){
            this.config=cfgfile as IAppConfig;
        } else {
            throw new Error("Could not load config file");
        }

    }
    get Config():IAppConfig{
        return this.config
    }
    config!: IAppConfig;
}

export let AppConfig = new ConfigHandler().Config;