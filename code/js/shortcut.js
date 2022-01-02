//KEYBOARD SHORTCUTS 2.01.B
//http://www.openjs.com/scripts/events/keyboard_shortcuts/

shortcut = {
    all_shortcuts: {}, 
    //ALL THE SHORTCUTS ARE STORED IN THIS ARRAY
    add: function(shortcut_combination, callback, opt) {
        //PROVIDE A SET OF DEFAULT OPTIONS
        var default_options = {
            type: "keydown",
            propagate: false,
            disable_in_input: false,
            target: document,
            keycode: false
        }
        if (!opt) opt = default_options
        else {
            for (var dfo in default_options) {
                if (typeof opt[dfo] == "undefined") opt[dfo] = default_options[dfo]
            }
        }

        var ele = opt.target
        if (typeof opt.target == "string") ele = document.getElementById(opt.target)
        var ths = this
        shortcut_combination = shortcut_combination.toLowerCase()

        //THE FUNCTION TO BE CALLED AT KEYPRESS
        var func = function(e) {

            e = e || window.event

            if (opt["disable_in_input"]) {
                //DON'T ENABLE SHORTCUT KEYS IN INPUT, TEXTAREA FIELDS
                var element
                if (e.target) element = e.target
                else if (e.srcElement) element = e.srcElement
                if (element.nodeType == 3) element = element.parentNode

                if (element.tagName == "INPUT" || element.tagName == "TEXTAREA") return
            }

            //FIND WHICH KEY IS PRESSED
            if (e.keyCode) code = e.keyCode
            else if (e.which) code = e.which
            var character = String.fromCharCode(code).toLowerCase()

            if (code == 188) character = "," //IF THE USER PRESSES , WHEN THE TYPE IS ONKEYDOWN
            if (code == 190) character = "." //IF THE USER PRESSES , WHEN THE TYPE IS ONKEYDOWN

            var keys = shortcut_combination.split("+")
            //KEY PRESSED - COUNTS THE NUMBER OF VALID KEYPRESSES - IF IT IS SAME AS THE NUMBER OF KEYS, THE SHORTCUT FUNCTION IS INVOKED
            var kp = 0

            //WORK AROUND FOR STUPID SHIFT KEY BUG CREATED BY USING LOWERCASE - AS A RESULT THE SHIFT+NUM COMBINATION WAS BROKEN
            var shift_nums = {
                "`": "~",
                "1": "!",
                "2": "@",
                "3": "#",
                "4": "$",
                "5": "%",
                "6": "^",
                "7": "&",
                "8": "*",
                "9": "(",
                "0": ")",
                "-": "_",
                "=": "+",
                ";": ":",
                "'": '"',
                ",": "<",
                ".": ">",
                "/": "?",
                "\\": "|"
            }

            //SPECIAL KEYS - AND THEIR CODES
            var special_keys = {
                esc: 27,
                escape: 27,
                tab: 9,
                space: 32,
                return: 13,
                enter: 13,
                backspace: 8,

                scrolllock: 145,
                scroll_lock: 145,
                scroll: 145,
                capslock: 20,
                caps_lock: 20,
                caps: 20,
                numlock: 144,
                num_lock: 144,
                num: 144,

                pause: 19,
                break: 19,

                insert: 45,
                home: 36,
                delete: 46,
                end: 35,

                pageup: 33,
                page_up: 33,
                pu: 33,

                pagedown: 34,
                page_down: 34,
                pd: 34,

                left: 37,
                up: 38,
                right: 39,
                down: 40,

                f1: 112,
                f2: 113,
                f3: 114,
                f4: 115,
                f5: 116,
                f6: 117,
                f7: 118,
                f8: 119,
                f9: 120,
                f10: 121,
                f11: 122,
                f12: 123
            }

            var modifiers = {
                shift: {wanted: false, pressed: false},
                ctrl: {wanted: false, pressed: false},
                alt: {wanted: false, pressed: false},
                meta: {wanted: false, pressed: false} //META IS MAC SPECIFIC
            }

            if (e.ctrlKey) modifiers.ctrl.pressed = true
            if (e.shiftKey) modifiers.shift.pressed = true
            if (e.altKey) modifiers.alt.pressed = true
            if (e.metaKey) modifiers.meta.pressed = true

            for (var i = 0; (k = keys[i]), i < keys.length; i++) {
                //MODIFIERS
                if (k == "ctrl" || k == "control") {
                    kp++
                    modifiers.ctrl.wanted = true
                } else if (k == "shift") {
                    kp++
                    modifiers.shift.wanted = true
                } else if (k == "alt") {
                    kp++
                    modifiers.alt.wanted = true
                } else if (k == "meta") {
                    kp++
                    modifiers.meta.wanted = true
                } else if (k.length > 1) {
                    //IF IT IS A SPECIAL KEY
                    if (special_keys[k] == code) kp++
                } else if (opt["keycode"]) {
                    if (opt["keycode"] == code) kp++
                } else {
                    //THE SPECIAL KEYS DID NOT MATCH
                    if (character == k) kp++
                    else {
                        if (shift_nums[character] && e.shiftKey) {
                            //STUPID SHIFT KEY BUG CREATED BY USING LOWERCASE
                            character = shift_nums[character]
                            if (character == k) kp++
                        }
                    }
                }
            }

            if (kp == keys.length && modifiers.ctrl.pressed == modifiers.ctrl.wanted && modifiers.shift.pressed == modifiers.shift.wanted && modifiers.alt.pressed == modifiers.alt.wanted && modifiers.meta.pressed == modifiers.meta.wanted) {
                callback(e)

                if (!opt["propagate"]) {
                    //STOP THE EVENT
                    //E.CANCELBUBBLE IS SUPPORTED BY IE - THIS WILL KILL THE BUBBLING PROCESS.
                    e.cancelBubble = true
                    e.returnValue = false

                    //E.STOPPROPAGATION WORKS IN FIREFOX.
                    if (e.stopPropagation) {
                        e.stopPropagation()
                        e.preventDefault()
                    }
                    return false
                }
            }

        }
        this.all_shortcuts[shortcut_combination] = {
            callback: func,
            target: ele,
            event: opt["type"]
        }
        //ATTACH THE FUNCTION WITH THE EVENT
        if (ele.addEventListener) ele.addEventListener(opt["type"], func, false)
        else if (ele.attachEvent) ele.attachEvent("on" + opt["type"], func)
        else ele["on" + opt["type"]] = func
    },

    //REMOVE THE SHORTCUT - JUST SPECIFY THE SHORTCUT AND I WILL REMOVE THE BINDING
    remove: function(shortcut_combination) {
        shortcut_combination = shortcut_combination.toLowerCase()
        var binding = this.all_shortcuts[shortcut_combination]
        delete this.all_shortcuts[shortcut_combination]
        if (!binding) return
        var type = binding["event"]
        var ele = binding["target"]
        var callback = binding["callback"]

        if (ele.detachEvent) ele.detachEvent("on" + type, callback)
        else if (ele.removeEventListener) ele.removeEventListener(type, callback, false)
        else ele["on" + type] = false
    }

}
