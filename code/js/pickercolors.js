var EDROPPER_VERSION = 11
const CANVAS_MAX_SIZE = 32767 - 20
const DEBUG = false

var page = {
    width: $(document).width(),
    height: $(document).height(),
    imageData: null,
    canvasBorders: 20,
    canvasData: null,
    dropperActivated: false,
    screenWidth: 0,
    screenHeight: 0,

    options: {
        cursor: "default",
        enableColorToolbox: true,
        enableColorTooltip: true,
        enableRightClickDeactivate: true
    },

    defaults: function() {
        page.canvas = document.createElement("canvas")
        page.rects = []
        page.screenshoting = false
    },

    // ---------------------------------
    // MENSAGENS
    // ---------------------------------

    //ESTUDANDO PARA ATIVAR A CAPTURA !
    messageListener: function() {
        console.log("dropper: page activated")
        chrome.runtime.onMessage.addListener(function(req, sender, sendResponse) {
            switch (req.type) {
                case "edropper-version":
                    sendResponse({
                        version: EDROPPER_VERSION,
                        tabid: req.tabid
                    })
                    break
                case "pickup-activate":
                    page.options = req.options
                    page.dropperActivate()
                    break
                case "pickup-deactivate":
                    page.dropperDeactivate()
                    break
                case "update-image":
                    console.log("dropper: background send me updated screenshot")
                    page.imageData = req.data
                    page.capture()
                    break
            }
        })
    },

    //ENVIANDO MESSAGEM
    sendMessage: function(message) {
        chrome.extension.connect().postMessage(message)
    },

    // ---------------------------------
    // CONTROLE DE GOTAS
    // ---------------------------------

    dropperActivate: function() {

        if (page.dropperActivated) return

        //CARREGAR CSS EXTERNO PARA MUDANÇAS DE CURSOR
        var injectedCss =
            '<link id="eye-dropper-css-cursor" rel="stylesheet" type="text/css" href="' +
            chrome.extension.getURL("css/cursor" + page.options.cursor + ".css?0.3.0") +
            '" /><link id="eye-dropper-css" rel="stylesheet" type="text/css" href="' +
            chrome.extension.getURL("css/pickercolors.css?0.3.0") +
            '" />'

        if ($("head").length == 0) {
            // SÃO CASOS COMO, POR EXEMPLO, PÁGINA DE IMAGEM
            $("body").before(injectedCss)
        } else {
            $("head").append(injectedCss)
        }

        //CRIAR OVERLAY DIV
        $("body").before('<div id="eye-dropper-overlay" style="position: absolute; width: ' + page.width + "px; height: " + page.height + 'px; opacity: 1; background: none; border: none; z-index: 9999999999;"></div>')

        //INSIRA A DICA DE FERRAMENTA E A CAIXA DE FERRAMENTAS
        var inserted = ""

        if (page.options.enableColorTooltip === true) {
            inserted += '<div id="color-tooltip"> </div>'
        }

        if (page.options.enableColorToolbox === true) {
            inserted += '<div id="color-toolbox"><div id="color-toolbox-color"></div><div id="color-toolbox-text"></div></div>'
        }

        $("#eye-dropper-overlay").append(inserted)

        if (page.options.enableColorTooltip === true) {
            page.elColorTooltip = $("#color-tooltip")
        }

        if (page.options.enableColorToolbox === true) {
            page.elColorToolbox = $("#color-toolbox")
            page.elColorToolboxColor = $("#color-toolbox-color")
            page.elColorToolboxText = $("#color-toolbox-text")
        }

        console.log("dropper: activating page dropper")
        page.defaults()

        page.dropperActivated = true
        page.screenChanged()

        //DEFINIR OUVINTES
        $(document).bind("scrollstop", page.onScrollStop)
        document.addEventListener("mousemove", page.onMouseMove, false)
        document.addEventListener("click", page.onMouseClick, false)

        if (page.options.enableRightClickDeactivate === true) {
            document.addEventListener("contextmenu", page.onContextMenu, false)
        }

        // ATIVAR ATALHOS DE TECLADO
        page.shortcuts(true)

    },

    dropperDeactivate: function() {
        if (!page.dropperActivated) return

        //DESABILITAR ATALHOS DE TECLADO
        page.shortcuts(false)

        //REDEFINIR AS ALTERAÇÕES DO CURSOR
        $("#eye-dropper-overlay").css("cursor", "default")
        $("#eye-dropper-css").remove()
        $("#eye-dropper-css-cursor").remove()

        page.dropperActivated = false

        console.log("dropper: deactivating page dropper")
        document.removeEventListener("mousemove", page.onMouseMove, false)
        document.removeEventListener("click", page.onMouseClick, false)
        if (page.options.enableRightClickDeactivate === true) {
            document.removeEventListener("contextmenu", page.onContextMenu, false)
        }
        $(document).unbind("scrollstop", page.onScrollStop)

        if (page.options.enableColorTooltip === true) {
            page.elColorTooltip.remove()
        }
        if (page.options.enableColorToolbox === true) {
            page.elColorToolbox.remove()
        }
        $("#eye-dropper-overlay").remove()
    },

    // ---------------------------------
    // MANIPULAÇÃO DE EVENTOS
    // ---------------------------------

    onMouseMove: function(e) {
        if (!page.dropperActivated) return

        page.tooltip(e)
    },

    onMouseClick: function(e) {
        if (!page.dropperActivated) return

        e.preventDefault()

        page.dropperDeactivate()
        page.sendMessage({
            type: "set-color",
            color: page.pickColor(e)
        })
    },

    onScrollStop: function() {
        if (!page.dropperActivated) return

        console.log("dropper: Scroll stop")
        page.screenChanged()
    },

    onScrollStart: function() {
        if (!page.dropperActivated) return
    },

    // ATALHOS DO TECLADO HABILITAR COM ARGUMENTO COMO VERDADEIRO, DESABILITAR COM FALSO
    shortcuts: function(start) {
        
        if (start == true) {
            // ATIVE ATALHOS
            shortcut.add("Esc", function(evt) {
                page.dropperDeactivate()
            })
            shortcut.add("U", function(evt) {
                page.screenChanged(true)
            })
        } else {
            // DESATIVAR ATALHOS
            shortcut.remove("U")
            shortcut.remove("Esc")
        }

    },

    //CLIQUE DIREITO
    onContextMenu: function(e) {

        if (!page.dropperActivated) return

        e.preventDefault()

        page.dropperDeactivate()

    },

    //JANELA É REDIMENSIONADA
    onWindowResize: function(e) {

        if (!page.dropperActivated) return

        console.log("dropper: window resized")

        // DEFINIR PADRÕES
        page.defaults()

        // LARGURA E ALTURA MUDARAM ENTÃO TEMOS QUE OBTER UM NOVO
        page.width = $(document).width()
        page.height = $(document).height()
        //page.screenWidth = window.innerWidth;
        //page.screenHeight = window.innerHeight;

        //TAMBÉM NÃO SE ESQUEÇA DE DEFINIR A SOBREPOSIÇÃO
        $("#eye-dropper-overlay")
            .css("width", page.width)
            .css("height", page.height)

        //MUDANÇA DE TELA DE CHAMADA
        page.screenChanged()

    },

    // ---------------------------------
    // MISC
    // ---------------------------------

    tooltip: function(e) {

        if (!page.dropperActivated || page.screenshoting) return

        var color = page.pickColor(e)
        var fromTop = -15
        var fromLeft = 10

        if (e.pageX - page.XOffset > page.screenWidth / 2) fromLeft = -20
        if (e.pageY - page.YOffset < page.screenHeight / 2) fromTop = 15

        //DEFINIR DICA DE FERRAMENTA
        if (page.options.enableColorTooltip === true) {
            page.elColorTooltip
                .css({
                    "background-color": "#" + color.rgbhex,
                    top: e.pageY + fromTop,
                    left: e.pageX + fromLeft,
                    "border-color": "#" + color.opposite
                })
                .show()
        }

        //DEFINIR CAIXA DE FERRAMENTAS
        if (page.options.enableColorToolbox === true) {
            page.elColorToolboxColor.css({
                "background-color": "#" + color.rgbhex
            })
            page.elColorToolboxText.html("#" + color.rgbhex + "<br />rgb(" + color.r + "," + color.g + "," + color.b + ")")
            page.elColorToolbox.show()
        }

    },

    //RETURN TRUE SE O RECTÂNGULO A ESTIVER INTEIRO NO RECTÂNGULO B
    rectInRect: function(A, B) {
        if (A.x >= B.x && A.y >= B.y && A.x + A.width <= B.x + B.width && A.y + A.height <= B.y + B.height) return true
        else return false
    },
    
    // E MESCLÁ-LO, SE NECESSÁRIO. MÉTODO AUXILIAR PARA RECTMERGE DESCOBRIU SE DOIS PONTOS E SOBREPOSIÇÕES DE COMPRIMENTO
    rectMergeGeneric: function(a1, a2, length) {
        //ALTERNE-OS SE A2 ESTIVER ACIMA DE A1
        if (a2 < a1) {
            tmp = a2
            a2 = a1
            a1 = tmp
        }

        //FORMAS ESTÃO SOBREPOSTAS
        if (a2 <= a1 + length){
            return {
                a: a1,
                length: a2 - a1 + length
            }
        } else {
            return false
        } 
        //LARGURA (OU ALTURA) DE B TEM QUE SER IGUAL A A 
    }, 
    
    
    //MESCLAR OS MESMOS RETÂNGULOS X OU Y SE HOUVER SOBREPOSIÇÃO
    rectMerge: function(A, B) {
        var t

        //MESMA POSIÇÃO X E MESMA LARGURA
        if (A.x == B.x && A.width == B.width) {
            t = page.rectMergeGeneric(A.y, B.y, A.height)

            if (t != false) {
                A.y = t.a
                A.height = length
                return A
            }

        //MESMA POSIÇÃO Y E MESMA ALTURA
        } else if (A.y == B.y && A.height == B.height) {
            t = page.rectMergeGeneric(A.x, B.x, A.width)

            if (t != false) {
                A.x = t.a
                A.width = length
                return A
            }
        }

        return false
    },

    // ---------------------------------
    // COLORS
    // ---------------------------------

    pickColor: function(e) {

        if (page.canvasData === null) return

        var canvasIndex = (e.pageX + e.pageY * page.canvas.width) * 4

        var color = {
            r: page.canvasData[canvasIndex],
            g: page.canvasData[canvasIndex + 1],
            b: page.canvasData[canvasIndex + 2],
            alpha: page.canvasData[canvasIndex + 3]
        }

        color.rgbhex = page.rgbToHex(color.r, color.g, color.b)
        color.opposite = page.rgbToHex(255 - color.r, 255 - color.g, 255 - color.b)

        //RETORNA REPRESENTAÇÃO HEXAGONAL DE DUAS CADEIAS DE CARACTERES DE UM CANAL DE COR (00-FF)
        return color
        
    }, 

    //I: VALOR DO CANAL DE COR, INTEIRO 0-255
    toHex: function(i) {
        // TODO ISTO NÃO DEVERIA ACONTECER; PARECE QUE O OFFSET / X / Y PODE ESTAR DESLIGADO POR UM
        if (i === undefined) return "FF" 
        
        var str = i.toString(16)
        while (str.length < 2) {
            str = "0" + str
        }

        // RETORNA REPRESENTAÇÃO HEXAGONAL DE SEIS CARACTERES DE UMA COR
        return str
    }, 

    // R, G, B: VALOR DO CANAL DE COR, INTEIRO 0-255
    rgbToHex: function(r, g, b) {
        return page.toHex(r) + page.toHex(g) + page.toHex(b)
    },

    // ---------------------------------
    // UPDATING SCREEN
    // ---------------------------------

    checkCanvas: function() {

        // TEMOS QUE CRIAR NOVO ELEMENTO DE TELA
        if (page.canvas.width != page.width + page.canvasBorders || page.canvas.height != page.height + page.canvasBorders) {
            console.log("dropper: creating new canvas")
            page.canvas = document.createElement("canvas")
            page.canvas.width = page.width + page.canvasBorders
            page.canvas.height = page.height + page.canvasBorders
            page.canvasContext = page.canvas.getContext("2d")
            page.canvasContext.scale(1 / window.devicePixelRatio, 1 / window.devicePixelRatio)
            page.rects = []
        }

    },

    screenChanged: function(force) {

        if (!page.dropperActivated) return

        console.log("dropper: screenChanged")
        page.YOffset = $(document).scrollTop()
        page.XOffset = $(document).scrollLeft()

        var rect = {
            x: page.XOffset,
            y: page.YOffset,
            width: page.screenWidth,
            height: page.screenHeight
        }

        // NÃO FAÇA SCREENSHOT SE JÁ TIVERMOS ONEC
        if (!force && page.rects.length > 0) {
            for (index in page.rects) {
                if (page.rectInRect(rect, page.rects[index])) {
                    console.log("dropper: already shoted, skipping")
                    return
                }
            }
        }

        page.screenshoting = true

        $("#eye-dropper-overlay").css("cursor", "progress")

        console.log("dropper: screenshoting")

        // TODO: ISSO É TERRÍVEL. TEM QUE SER FEITO MELHOR MANEIRA
        if (page.options.enableColorTooltip === true && page.options.enableColorToolbox === true) {
            page.elColorTooltip.hide(1, function() {
                page.elColorToolbox.hide(1, function() {
                    page.sendMessage(
                        {
                            type: "screenshot"
                        },
                        function() {}
                    )
                })
            })
        } else if (page.options.enableColorTooltip === true) {
            page.elColorTooltip.hide(1, function() {
                page.sendMessage(
                    {
                        type: "screenshot"
                    },
                    function() {}
                )
            })
        } else if (page.options.enableColorToolbox === true) {
            page.elColorToolbox.hide(1, function() {
                page.sendMessage(
                    {
                        type: "screenshot"
                    },
                    function() {}
                )
            })
        } else {
            page.sendMessage(
                {
                    type: "screenshot"
                },
                function() {}
            )
        }

    },

    //CAPTURA DE TELA REAL
    capture: function() {
        
        page.checkCanvas()
        
        // var image = new Image();
        var image = document.createElement("img")

        image.onload = function() {

            page.screenWidth = image.width
            page.screenHeight = image.height

            var rect = {
                x: page.XOffset,
                y: page.YOffset,
                width: image.width,
                height: image.height
            }
            
            var merged = false

            //SE JÁ EXISTEM RETÂNGULOS
            if (page.rects.length > 0) {
                //TENTE MESCLAR TIRO COM OS OUTROS
                for (index in page.rects) {
                    var t = page.rectMerge(rect, page.rects[index])

                    if (t != false) {
                        console.log("dropper: merging")
                        merged = true
                        page.rects[index] = t
                    }
                }
            }

            //COLOQUE O RETÂNGULO NO ARRAY
            if (merged == false) page.rects.push(rect)

            page.canvasContext.drawImage(image, page.XOffset, page.YOffset)
            page.canvasData = page.canvasContext.getImageData(0, 0, page.canvas.width, page.canvas.height).data
            //TODO - É NECESSÁRIO ATUALIZAR O QUADRADO E DEFINIR A COR CORRETA

            page.screenshoting = false
            $("#eye-dropper-overlay").css("cursor", page.options.cursor)

            //REATIVAR A DICA DE FERRAMENTA E A CAIXA DE FERRAMENTAS
            if (page.options.enableColorTooltip === true) {
                page.elColorTooltip.show(1)
            }

            if (page.options.enableColorToolbox === true) {
                page.elColorToolbox.show(1)
            }

            if (DEBUG) {
                page.sendMessage({type: "debug-tab", image: page.canvas.toDataURL()}, function() {})
                debugger
            }

        }

        if (page.imageData) {
            image.src = page.imageData
        } else {
            console.error("ed: no imageData")
        }

    },

    //FUNÇÃO DE INICIALIZAÇÃO
    init: function() {

        page.messageListener()

        if (page.width > CANVAS_MAX_SIZE) {
            page.width = CANVAS_MAX_SIZE
        }

        if (page.height > CANVAS_MAX_SIZE) {
            page.height = CANVAS_MAX_SIZE
        }

    }
    
}

//CHAMAR INICIALIZAÇÃO
page.init()

//QUANDO A PAGINA FOR REDIMENSIONADA
window.onresize = function() {
    page.onWindowResize()
}
