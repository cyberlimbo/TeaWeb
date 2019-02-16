enum LogCategory {
    CHANNEL,
    CLIENT,
    SERVER,
    PERMISSIONS,
    GENERAL,
    NETWORKING,
    VOICE,
    I18N
}

namespace log {
    export enum LogType {
        TRACE,
        DEBUG,
        INFO,
        WARNING,
        ERROR
    }

    let category_mapping = new Map<number, string>([
        [LogCategory.CHANNEL,       "Channel    "],
        [LogCategory.CLIENT,        "Client     "],
        [LogCategory.SERVER,        "Server     "],
        [LogCategory.PERMISSIONS,   "Permission "],
        [LogCategory.GENERAL,       "General    "],
        [LogCategory.NETWORKING,    "Network    "],
        [LogCategory.VOICE,         "Voice      "],
        [LogCategory.I18N,          "I18N       "]
    ]);

    let enabled_mapping = new Map<number, boolean>([
        [LogCategory.CHANNEL,       true],
        [LogCategory.CLIENT,        true],
        [LogCategory.SERVER,        true],
        [LogCategory.PERMISSIONS,   true],
        [LogCategory.GENERAL,       true],
        [LogCategory.NETWORKING,    true],
        [LogCategory.VOICE,         true],
        [LogCategory.I18N,          true]
    ]);

    loader.register_task(loader.Stage.LOADED, {
        name: "log enabled initialisation",
        function: async () => initialize(),
        priority: 10
    });

    //Example: <url>?log.i18n.enabled=0
    export function initialize() {
        for(const category of Object.keys(LogCategory).map(e => parseInt(e))) {
            if(isNaN(category)) continue;
            const category_name = LogCategory[category];
            enabled_mapping[category] = settings.static_global("log." + category_name.toLowerCase() + ".enabled", true);
        }
    }

    function logDirect(type: LogType, message: string, ...optionalParams: any[]) {
        switch (type) {
            case LogType.TRACE:
            case LogType.DEBUG:
                console.debug(message, ...optionalParams);
                break;
            case LogType.INFO:
                console.log(message, ...optionalParams);
                break;
            case LogType.WARNING:
                console.warn(message, ...optionalParams);
                break;
            case LogType.ERROR:
                console.error(message, ...optionalParams);
                break;
        }
        //console.log("This is %cMy stylish message", "color: yellow; font-style: italic; background-color: blue;padding: 2px");
    }

    export function log(type: LogType, category: LogCategory, message: string, ...optionalParams: any[]) {
        if(!enabled_mapping[category]) return;

        optionalParams.unshift(category_mapping.get(category));
        message = "[%s] " + message;
        logDirect(type, message, ...optionalParams);
    }

    export function trace(category: LogCategory, message: string, ...optionalParams: any[]) {
        log(LogType.TRACE, category, message, ...optionalParams);
    }

    export function debug(category: LogCategory, message: string, ...optionalParams: any[]) {
        log(LogType.DEBUG, category, message, ...optionalParams);
    }

    export function info(category: LogCategory, message: string, ...optionalParams: any[]) {
        log(LogType.INFO, category, message, ...optionalParams);
    }

    export function warn(category: LogCategory, message: string, ...optionalParams: any[]) {
        log(LogType.WARNING, category, message, ...optionalParams);
    }

    export function error(category: LogCategory, message: string, ...optionalParams: any[]) {
        log(LogType.ERROR, category, message, ...optionalParams);
    }

    export function group(level: LogType, category: LogCategory, name: string, ...optionalParams: any[]) : Group {
        name = "[%s] " + name;
        optionalParams.unshift(category_mapping.get(category));

        return new Group(level, category, name, optionalParams);
    }

    export class Group {
        readonly level: LogType;
        readonly category: LogCategory;
        owner: Group = undefined;

        private readonly name: string;
        private readonly optionalParams: any[][];
        private _collapsed: boolean = true;
        private initialized = false;

        constructor(level: LogType, category: LogCategory, name: string, optionalParams: any[][], owner: Group = undefined) {
            this.level = level;
            this.category = category;
            this.name = name;
            this.optionalParams = optionalParams;
        }

        group(level: LogType, name: string, ...optionalParams: any[]) : Group {
            return new Group(level, this.category, name, optionalParams, this);
        }

        collapsed(flag: boolean = true) : this {
            this._collapsed = flag;
            return this;
        }

        log(message: string, ...optionalParams: any[]) : this {
            if(!this.initialized) {
                if(this._collapsed && console.groupCollapsed)
                    console.groupCollapsed(this.name, ...this.optionalParams);
                else
                    console.group(this.name, ...this.optionalParams);
                this.initialized = true;
            }
            logDirect(this.level, message, ...optionalParams);
            return this;
        }

        end() {
            if(this.initialized)
                console.groupEnd();
        }
    }
}