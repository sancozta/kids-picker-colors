const BG_VERSION = 15
const NEED_DROPPER_VERSION = 11
const DEFAULT_COLOR = "#b48484"

//JQUERY LIKE FUNCTIONS

//FOR GET ELEMENT BY ID
function $(id) {
    return document.getElementById(id)
}

//RETURNS -1 IF VALUE ISN'T IN ARRAY.
//RETURN POSITION STARTING FROM 0 IF FOUND
function inArray(value, array) {
    for (let i = 0; i < array.length; i++) {
        if (array[i] == value) return i
    }
    return -1
}

//BASE BG OBJECT
var bg = {
    tab: 0,
    tabs: [],
    version: BG_VERSION,
    screenshotData: "",
    screenshotFormat: "png",
    canvas: document.createElement("canvas"),
    canvasContext: null,
    debugImage: null,
    debugTab: 0,
    history: {
        version: BG_VERSION,
        last_color: DEFAULT_COLOR,
        current_palette: "default",
        palettes: [],
        backups: []
    },
    defaultSettings: {
        autoClipboard: true,
        autoClipboardNoGrid: true,
        enableColorToolbox: true,
        enableColorTooltip: true,
        enableRightClickDeactivate: true,
        dropperCursor: "default",
        plus: false,
        plus_type: null
    },
    defaultPalette: "default",
    settings: {},
    edCb: null,
    color_sources: {
        1: "Web Page",
        2: "Color Picker",
        3: "Old History"
    },

    //USE SELECTED TAB
    //NEED TO NULL ALL TAB-SPECIFIC VARIABLES
    useTab(tab) {
        bg.tab = tab
        bg.screenshotData = ""
        bg.canvas = document.createElement("canvas")
        bg.canvasContext = null
    },

    checkDropperScripts() {
        console.log("bg: checking dropper version")
        bg.sendMessage(
            {
                type: "edropper-version"
            },
            function(res) {
                console.log("bg: checking dropper version 2")
                if (res) {
                    if (res.version < NEED_DROPPER_VERSION) {
                        bg.refreshDropper()
                    } else {
                        bg.pickupActivate()
                    }
                } else {
                    bg.injectDropper()
                }
            }
        )
    },

    //FIXME: TRY TO HANDLE THIS BETTER, MAYBE SOME CONSOLIDATION
    injectDropper() {
        console.log("bg: injecting dropper scripts")

        chrome.tabs.executeScript(
            bg.tab.id,
            {
                allFrames: false,
                file: "js/jquery.min.js"
            },
            function() {
                console.log("bg: jquery injected")
                chrome.tabs.executeScript(
                    bg.tab.id,
                    {
                        allFrames: false,
                        file: "js/jquery.scrollstop.js"
                    },
                    function() {
                        console.log("bg: jquery.scrollstop injected")
                        chrome.tabs.executeScript(
                            bg.tab.id,
                            {
                                allFrames: false,
                                file: "js/shortcut.js"
                            },
                            function() {
                                console.log("bg: shortcuts injected")
                                chrome.tabs.executeScript(
                                    bg.tab.id,
                                    {
                                        allFrames: false,
                                        file: "js/pickercolors.js"
                                    },
                                    function() {
                                        console.log("bg: pickercolors injected")
                                        bg.pickupActivate()
                                    }
                                )
                            }
                        )
                    }
                )
            }
        )
    },

    refreshDropper() {
        console.log("bg: refreshing dropper scripts")

        chrome.tabs.executeScript(
            bg.tab.id,
            {
                allFrames: true,
                file: "js/pickercolors.js"
            },
            function() {
                console.log("bg: pickercolors updated")
                bg.pickupActivate()
            }
        )
    },

    sendMessage(message, callback) {
        chrome.tabs.sendMessage(bg.tab.id, message, callback)
    },

    shortcutListener() {
        chrome.commands.onCommand.addListener(function(command) {
            console.log("bg: command: ", command)
            switch (command) {
                case "activate":
                    bg.activate2()
                    break
            }
        })
    },

    messageListener() {
        //SIMPLE MESSAGES
        chrome.runtime.onMessage.addListener(function(req, sender, sendResponse) {
            switch (req.type) {
                case "activate-from-hotkey":
                    bg.activate2()
                    sendResponse({})
                    break

                //RELOAD BACKGROUND SCRIPT
                case "reload-background":
                    window.location.reload()
                    break

                //CLEAR COLORS HISTORY
                case "clear-history":
                    bg.clearHistory(sendResponse)
                    break
            }
        })

        //LONGER CONNECTIONS
        chrome.extension.onConnect.addListener(function(port) {
            port.onMessage.addListener(function(req, sender) {
                switch (req.type) {
                    //TAKING SCREENSHOT FOR CONTENT SCRIPT
                    case "screenshot":
                        bg.capture()
                        break

                    //CREATING DEBUG TAB
                    case "debug-tab":
                        console.info("Received debug tab request")
                        bg.debugImage = req.image
                        bg.createDebugTab()
                        break

                    //SET COLOR GIVEN IN REQ
                    //FIXME: ASI LEPŠÍ Z INJECT SCRIPTU POSÍLAT JEN RGBHEX, UŽ TO TAK MÁME STEJNĚ SKORO VŠUDE
                    case "set-color":
                        console.log(sender.sender)
                        bg.setColor(`#${req.color.rgbhex}`, true, 1, sender.sender.url)
                        break
                }
            })
        })
    },

    //FUNCTION FOR INJECTING NEW CONTENT
    inject(file, tab) {

        if (tab == undefined) tab = bg.tab.id

        chrome.tabs.executeScript(
            tab,
            {
                allFrames: false,
                file: file
            },
            function() {}
        )

    },

    setBadgeColor(color) {

        console.info(`Setting badge color to ${color}`)

        //chrome.browserAction.setBadgeBackgroundColor({
        //    color: [parseInt(color.substr(1, 2), 16), parseInt(color.substr(3, 2), 16), parseInt(color.substr(5, 2), 16), 255]
        //})

    },

    //METHOD FOR SETTING COLOR. IT SET BG COLOR, UPDATE BADGE AND SAVE TO HISTORY IF POSSIBLE
    //SOURCE - SEE HISTORYCOLORITEM FOR DESCRIPTION
    setColor(color, history = true, source = 1, url = null) {
        
        console.group("setColor")
        console.info(`Received color ${color}, history: ${history}`)
        
        if (!color || !color.match(/^#[0-9a-f]{6}$/)) {
            console.error("error receiving collor from dropper")
            console.groupEnd("setColor")
            return
            //WE ARE STORING COLOR WITH FIRST # CHARACTER
        } 

        bg.setBadgeColor(color)
        bg.history.last_color = color

        console.info("Copying color to clipboard")
        bg.copyToClipboard(color)

        if (history) {
            console.info("Saving color to history")
            bg.saveToHistory(color, source, url)
        }

        console.groupEnd("setColor")
    },

    saveToHistory(color, source = 1, url = null) {
        let palette = bg.getPalette()
        if (!palette.colors.find(x => x.hex == color)) {
            palette.colors.push(bg.historyColorItem(color, Date.now(), source, url))
            console.info(`Color ${color} saved to palette ${bg.getPaletteName()}`)

            bg.saveHistory()
        } else {
            console.info(`Color ${color} already in palette ${bg.getPaletteName()}`)
        }
    },

    copyToClipboard(color) {
        bg.edCb.value = bg.settings.autoClipboardNoGrid ? color.substring(1) : color
        bg.edCb.select()
        document.execCommand("copy", false, null)
    },

    //ACTIVATE FROM CONTENT SCRIPT
    activate2() {
        chrome.tabs.getSelected(null, function(tab) {
            bg.useTab(tab)
            bg.activate()
        })
    },

    //ACTIVATE PICK
    activate() {
        console.log("bg: received pickup activate")
        //CHECK SCRIPTS AND ACTIVATE PICKUP
        bg.checkDropperScripts()
    },

    pickupActivate() {
        //ACTIVATE PICKER
        bg.sendMessage(
            {
                type: "pickup-activate",
                options: {
                    cursor: bg.settings.dropperCursor,
                    enableColorToolbox: bg.settings.enableColorToolbox,
                    enableColorTooltip: bg.settings.enableColorTooltip,
                    enableRightClickDeactivate: bg.settings.enableRightClickDeactivate
                }
            },
            function() {}
        )

        console.log("bg: activating pickup")
    },

    //CAPTURE ACTUAL SCREENSHOT
    capture() {
        try {
            chrome.tabs.captureVisibleTab(
                null,
                {
                    format: "png"
                },
                bg.doCapture
            )
            //FALLBACK FOR CHROME BEFORE 5.0.372.0
        } catch (e) {
            chrome.tabs.captureVisibleTab(null, bg.doCapture)
        }
    },

    getColor() {
        return bg.history.last_color
    },

    doCapture(data) {
        if (data) {
            console.log("bg: sending updated image")
            bg.sendMessage(
                {
                    type: "update-image",
                    data: data
                },
                function() {}
            )
        } else {
            console.error("bg: did not receive data from captureVisibleTab")
        }
    },

    createDebugTab() {
        // DEBUG
        if (bg.debugTab != 0) {
            chrome.tabs.sendMessage(bg.debugTab, {
                type: "update"
            })
        } else {
            
            //chrome.tabs.create(
            //{
            //url: "/html/debug-tab.html",
            //selected: false
            //},
            //function(tab) {
            //bg.debugTab = tab.id
            //}
            //)

        }
    },

    tabOnChangeListener() {
        //DEACTIVATE DROPPER IF TAB CHANGED
        chrome.tabs.onSelectionChanged.addListener(function(tabId, selectInfo) {
            if (bg.tab.id == tabId)
                bg.sendMessage(
                    {
                        type: "pickup-deactivate"
                    },
                    function() {}
                )
        })
    },

    getPaletteName() {
        return bg.getPalette().name
    },

    isPalette(name) {
        return bg.history.palettes.find(x => x.name == name) ? true : false
    },

    getPalette(name) {
        if (name === undefined) {
            name = bg.history.current_palette === undefined || !bg.isPalette(bg.history.current_palette) ? "default" : bg.history.current_palette
        }

        return bg.history.palettes.find(x => x.name == name)
    },

    changePalette(palette_name) {
        if (bg.history.current_palette === palette_name) {
            console.info(`Not switching, already on palette ${palette_name}`)
        } else if (bg.isPalette(palette_name)) {
            bg.history.current_palette = palette_name
            console.info(`Switched current palette to ${palette_name}`)
            bg.saveHistory()
        } else {
            console.error(`Cannot switch to palette ${palette_name}. Palette not found.`)
        }
    },

    getPaletteNames() {
        return bg.history.palettes.map(x => x.name)
    },

    uniquePaletteName(name) {
        //DEFAULT NAME IS PALETTE IF WE RECEIVE EMPTY OR UNDEFINED NAME
        if (name === undefined || !name || name.length < 1) {
            console.info(`uniquePaletteName: ${name} empty, trying 'palette'`)
            return bg.uniquePaletteName("palette")
            //IF THERE IS ALREADY PALETTE WITH SAME NAME
        } else if (bg.getPaletteNames().find(x => x == name)) {
            let matches = name.match(/^(.*[^\d]+)(\d+)?$/)

            //DOESN'T END WITH NUMBER, WE WILL ADD 1
            if (matches[2] === undefined) {
                console.info(`uniquePaletteName: ${name} occupied, trying '${name}1'`)
                return bg.uniquePaletteName(`${name}1`)
                //ENDS WITH NUMBER
            } else {
                let new_name = `${matches[1]}${parseInt(matches[2]) + 1}`
                console.info(`uniquePaletteName: ${name} occupied, trying '${new_name}'`)
                return bg.uniquePaletteName(new_name)
            }
        } else {
            console.info(`uniquePaletteName: ${name} is free'`)
            return name
        }
    },

    createPalette(name) {
        let palette_name = bg.uniquePaletteName(name)
        console.info(`Creating new palette ${name}. Unique name: ${palette_name}`)

        bg.history.palettes.push({
            name: palette_name,
            created: Date.now(),
            colors: []
        })

        bg.saveHistory()
        return bg.getPalette(palette_name)
    },

    destroyPalette(name) {
        if (!bg.isPalette(name)) {
            return
        }

        if (name === "default") {
            console.info("Can't destroy default palette. Clearing only.")
            bg.getPalette(name).colors = []
        } else {
            console.info(`Destroying palette ${name}`)
            let destroying_current = name === bg.getPalette().name
            bg.history.palettes = bg.history.palettes.filter(obj => {
                return obj.name !== name
            })
            //IF WE ARE DESTROYING CURRENT PALETTE, SWITCH TO DEFAULT ONE
            if (destroying_current) {
                bg.changePalette("default")
            }
        }
        bg.saveHistory(false)
        chrome.storage.sync.remove(`palette.${name}`)
    },

    clearHistory(sendResponse) {
        let palette = bg.getPalette()
        console.info(`Clearing history for palette ${palette.name}`)
        palette.colors = []
        bg.saveHistory()

        if (sendResponse != undefined) {
            sendResponse({
                state: "OK"
            })
        }
    },

    //WHEN COLOR PICKER IS JUST INSTALLED, WE WANT TO DISPLAY NICE
    //PAGE TO USER WITH SOME INSTRUCTIONS
    pageInstalled() {
        //ONLY IF WE HAVE SUPPORT FOR LOCALSTORAGE
        if (window.localStorage != null) {
            //SHOW INSTALLED OR UPDATED PAGE
            //DO NOT DISPLAY IF LOCALSTORAGE IS NOT SUPPORTED - WE DON'T WANT TO SPAM USER
            if (window.localStorage && !window.localStorage.seenInstalledPage) {
                console.info("Just installed: opening installed page in new tab.")
                window.localStorage.seenInstalledPage = true
                
                //chrome.tabs.create({
                //url: "html/installed.html",
                //selected: true
                //})

            }
        }
    },

    //LOAD HISTORY FROM STORAGE ON EXTENSION START
    loadHistory() {
        console.info("Loading history from storage")
        chrome.storage.sync.get(items => {
            if (items.history) {
                bg.history.current_palette = items.history.cp
                bg.history.last_color = items.history.lc

                console.info("History info loaded. Loading palettes.")
                console.info(`Default palette before loading: ${bg.defaultPalette}`)

                let count_default = 0
                let count_converted = 0

                Object.keys(items).forEach((key, index) => {
                    let matches = key.match(/^palette\.(.*)$/)
                    if (matches) {
                        let palette = items[key]
                        bg.history.palettes.push({
                            name: matches[1],
                            colors: palette.c,
                            created: palette.t
                        })

                        if (matches[1] === "default") {
                            count_default = palette.c.length
                        }
                        if (matches[1] === "converted") {
                            count_converted = palette.c.length
                        }
                    }
                })

                if (count_default === 0 && count_converted > 0) {
                    bg.defaultPalette = "converted"
                    console.info(`Default palette after loading: ${bg.defaultPalette}`)
                }

                if (items.history.v < bg.history.version) {
                    bg.checkHistoryUpgrades(items.history.v)
                }
            } else {
                console.warn("No history in storage")
                bg.createPalette("default")
            }

            //IN ANY CASE WE WILL TRY TO CONVERT LOCAL HISTORY
            bg.tryConvertOldHistory()

        })
    },
    
    //CHECK IF THERE ARE NEEDED UPGRADES TO HISTORY AND EXEC IF NEEDED
    checkHistoryUpgrades(version) {
        // WRONG TIMESTAMP SAVED BEFORE VERSION 14
        //
        // THERE WAS ERROR IN BG VERSIONS BEFORE 14 THAT CAUSED SAVING
        // HISTORY COLOR TIMESTAMP AS LINK TU DATENOW FUNCTION INSTEAD OF
        // CURRENT DATE IN SOME CASES.
        //
        // WE WILL CHECK FOR SUCH TIMES AND SET THEM TO START OF EPOCH
        if (version < 14) {
            console.warn("History version is pre 14: Fixing color times")
            for (let palette of bg.history.palettes) {
                for (let color of palette.colors) {
                    if (typeof color.t !== "number") {
                        color.t = 0
                    }
                }
            }
            bg.saveHistory()
        }
    },

    //LOAD SETTINGS FROM STORAGE ON EXTENSION START
    loadSettings() {
        console.info("Loading settings from storage")
        chrome.storage.sync.get("settings", items => {
            if (items.settings) {
                console.info("Settings loaded")
                bg.settings = items.settings
            } else {
                console.warn("No settings in storage")
                bg.tryConvertOldSettings()
            }
        })
    },

    /**
     * sources:
     *    1: eye dropper
     *    2: color picker
     *    3: converted from old history
     *
     * FIXME:
     * url is not saved now because of quotas
     * favorite not implemented yet
     *
     * h = hex
     * n = name
     * s = source
     * t = timestamp when taken
     * f = favorite
     */

    historyColorItem(color, timestamp = Date.now(), source = 1, source_url = null, favorite = false) {
        f = favorite ? 1 : 0
        return {
            h: color,
            n: "",
            s: source,
            t: timestamp,
            f: f
        }
    },

    //LOCAL HISTORY TO SYNCED STORAGE
    //BACKUP OF OLD HISTORY IS STORED IN LOCAL STORAGE IN _HISTORY_BACKUP
    //IN CASE SOMETHING GOES SOUTH.
    tryConvertOldHistory() {
        if (window.localStorage.history) {
            let oldHistory = JSON.parse(window.localStorage.history)
            let converted_palette = bg.createPalette("converted")
            console.warn(converted_palette)

            //ADD EVERY COLOR FROM OLD HISTORY TO NEW SCHEMA WITH CURRENT TIMESTAMP
            let timestamp = Date.now()
            for (let key in oldHistory) {
                let color = oldHistory[key]

                //IN VERSIONS BEFORE 0.3.0 COLORS WERE STORED WITHOUT # IN FRONT
                if (color[0] != "#") {
                    color = "#" + color
                }

                //PUSH COLOR TO OUR CONVERTED PALETTE
                converted_palette.colors.push(bg.historyColorItem(color, timestamp, 3))

                //SET THIS COLOR AS LAST
                bg.history.last_color = color
            }

            //MAKE BACKUP OF OLD HISTORY
            window.localStorage._history_backup = window.localStorage.history

            //REMOVE OLD HISTORY FROM LOCAL STORAGE
            window.localStorage.removeItem("history")

            //SYNC HISTORY
            bg.saveHistory()

            //CHANGE TO CONVERTED HISTORY IF CURRENT PALETTE IS EMPTY
            if (bg.getPalette().colors.length < 1) {
                bg.changePalette(converted_palette.name)
            }
        }
    },

    //LOCAL SETTINGS TO SYNCED STORAGE
    //SYNCED STORAGE IS MUCH BETTER BECAUSE IT FINALLY ALLOWS AS TO STORE OBJECTS AND NOT
    //STRINGS ONLY.
    tryConvertOldSettings() {
        // LOAD DEFAULT SETTINGS FIRST
        bg.settings = bg.defaultSettings

        // CONVERT OLD SETTINGS
        bg.settings.autoClipboard = window.localStorage.autoClipboard === "true" ? true : false
        bg.settings.autoClipboardNoGrid = window.localStorage.autoClipboardNoGrid === "true" ? true : false
        bg.settings.enableColorToolbox = window.localStorage.enableColorToolbox === "false" ? false : true
        bg.settings.enableColorTooltip = window.localStorage.enableColorTooltip === "false" ? false : true
        bg.settings.enableRightClickDeactivate = window.localStorage.enableRightClickDeactivate === "false" ? false : true
        bg.settings.dropperCursor = window.localStorage.dropperCursor === "crosshair" ? "crosshair" : "default"

        // SYNC SETTINGS
        bg.saveSettings()

        // REMOVE OLD SETTINGS FROM LOCAL STORAGE
        let setting_keys = ["autoClipboard", "autoClipboardNoGrid", "enableColorTooltip", "enableColorToolbox", "enableRightClickDeactivate", "dropperCursor"]
        for (let setting_name of setting_keys) {
            localStorage.removeItem(setting_name)
        }
        console.info("Removed old settings from locale storage.")
    },

    saveHistory(all_palettes = true) {
        let saved_object = {
            history: {
                v: bg.history.version,
                cp: bg.history.current_palette,
                lc: bg.history.last_color
            }
        }

        if (all_palettes) {
            for (palette of bg.history.palettes) {
                saved_object[`palette.${palette.name}`] = {
                    c: palette.colors,
                    t: palette.created
                }
            }
        }

        chrome.storage.sync.set(saved_object, () => {
            console.info("History synced to storage")
        })
    },

    saveSettings() {
        chrome.storage.sync.set(
            {
                settings: bg.settings
            },
            () => {
                console.info("Settings synced to storage")
            }
        )
    },

    unlockPlus(type) {
        bg.settings.plus = true
        bg.settings.plus_type = type
        bg.saveSettings()
    },

    lockPlus() {
        bg.settings.plus = false
        bg.settings.plus_type = null
        bg.saveSettings()
    },

    plus() {
        return bg.settings.plus ? bg.settings.plus_type : false
    },

    plusColor(color = bg.settings.plus_type) {
        switch (color) {
            case "free":
                return "gray"
                break
            case "alpha":
                return "silver"
                break
            default:
                return color
        }
    },

    init() {
        console.group("init")

        bg.pageInstalled()

        bg.edCb = document.getElementById("pcclipboard")

        bg.loadSettings()
        bg.loadHistory()

        //SET DEFAULT BADGE TEXT TO EMPTY STRING
        //WE ARE COMUNICATING WITH USERS ONLY THROUGH BADGE BACKGROUND COLOR
        //chrome.browserAction.setBadgeText({
        //    text: " "
        //})

        //WE HAVE TO LISTEN FOR MESSAGES
        bg.messageListener()

        //ACT WHEN TAB IS CHANGED
        //TODO: CALL ONLY WHEN NEEDED? THIS IS NOW USED ALSO IF PICKER ISN'T ACTIVE
        bg.tabOnChangeListener()

        //LISTEN FOR SHORTCUT COMMANDS
        bg.shortcutListener()

        console.groupEnd("init")
    }

}

document.addEventListener("DOMContentLoaded", function() {
    bg.init()
})
