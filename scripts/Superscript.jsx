/**
  * SuperScript
  * 
  * SuperScript est un script InDesign qui automatise 
  * la correction typographique pour accélérer la préparation
  * des documents et garantir une mise en page plus propre.
  * 
  * @version 1.0 beta 10
  * @license AGPL
  * @author entremonde / Spectral lab
  * @website https://lab.spectral.art
  */

(function() {
    "use strict";
    
    // Vérifier si l'application est disponible
    if (typeof app === "undefined") {
        alert("Impossible d'accéder à l'application InDesign.");
        return;
    }
    
    /**
     * Constantes de configuration
     * @private
     */
    var CONFIG = {
        DEFAULT_STYLES: {
            SUPERSCRIPT: "Superscript",
            ITALIC: "Italic",
            FIRST_PARAGRAPH: "First paragraph"
        },
        REGEX: {
            FOOTNOTE_PATTERN: "[,;.?!~e\u00BB\\s]+~F",
            SPACE_BEFORE_FOOTNOTE: "[ \t\u00A0\u2000-\u200A\u202F\u205F\u3000]+(?=~F)",
            SPACE_BEFORE_POINT: "[ \t\u00A0\u2000-\u200A\u202F\u205F\u3000]+(?=\\.)",
            SPACE_BEFORE_COMMA: "[ \t\u00A0\u2000-\u200A\u202F\u205F\u3000]+(?=,)",
            DOUBLE_SPACES: "[ \t\u00A0\u2000-\u200A\u202F\u205F\u3000]{2,}",
            SPACE_AFTER_OPENING_QUOTE: "(?<=«)[ \t\u00A0\u2000-\u200A\u202F\u205F\u3000]",
            SPACE_BEFORE_CLOSING_QUOTE: "[ \t\u00A0\u2000-\u200A\u202F\u205F\u3000](?=»)",
            SPACE_BEFORE_DOUBLE_PUNCTUATION: "[ \t\u00A0\u2000-\u200A\u202F\u205F\u3000](?=[:;!?])",
            CHARACTER_BEFORE_DOUBLE_PUNCTUATION: "([^\\s])(?=[:;!?])",
            DOUBLE_RETURNS: "\\r[ \t\u00A0\u200B\u202F\u2060]*\\r",
            TRIPLE_DOTS: "\\.{3}",
            APOSTROPHES_TO_REPLACE: ["'", "&#39;", "&apos;", "&#8217;"]
        },
        SPACE_TYPES: [
            { label: "Espace fine insécable (~<)", value: "~<" },
            { label: "Espace insécable (~S)", value: "~S" },
        ],
        SCRIPT_TITLE: "Superscript"
    };
    
    /**
     * Gestionnaire d'erreurs personnalisé
     * @private
     */
    var ErrorHandler = {
        /**
         * Affiche un message d'erreur avec détails et trace
         * @param {Error} error - L'erreur qui s'est produite
         * @param {string} context - Contexte dans lequel l'erreur s'est produite
         * @param {boolean} isFatal - Si true, arrête l'exécution du script
         */
        handleError: function(error, context, isFatal) {
            var message = "Erreur";
            
            if (context) {
                message += " dans " + context;
            }
            
            message += " : " + (error.message || "Erreur inconnue");
            
            if (error.line) {
                message += " (ligne " + error.line + ")";
            }
            
            try {
                if (typeof console !== "undefined" && console && console.log) {
                    console.log(message);
                    if (error.stack) {
                        console.log("Stack trace: " + error.stack);
                    }
                }
            } catch (e) {
                // Ignorer les erreurs de journalisation
            }
            
            if (isFatal) {
                alert(message);
                throw new Error("Arrêt du script suite à une erreur fatale");
            }
            
            return message;
        },
        
        /**
         * Vérifie qu'un objet n'est pas undefined ou null
         * @param {*} obj - L'objet à vérifier
         * @param {string} name - Nom de l'objet pour le message d'erreur
         * @param {boolean} throwError - Si true, lance une erreur si l'objet est null
         * @returns {boolean} True si l'objet est défini, false sinon
         */
        ensureDefined: function(obj, name, throwError) {
            if (obj === undefined || obj === null) {
                var message = "Objet '" + name + "' est undefined ou null";
                
                if (throwError) {
                    throw new Error(message);
                }
                
                try {
                    if (typeof console !== "undefined" && console && console.log) {
                        console.log(message);
                    }
                } catch (e) {
                    // Ignorer les erreurs de journalisation
                }
                
                return false;
            }
            
            return true;
        }
    };
    
    /**
     * Fonctions utilitaires pour les opérations du script
     * @private
     */
    var Utilities = {
        /**
         * Vérifie qu'un document est ouvert avant de continuer
         * @returns {boolean} Vrai si des documents sont disponibles
         */
        validateDocumentOpen: function() {
            try {
                if (!ErrorHandler.ensureDefined(app, "app", false)) {
                    alert("L'application InDesign n'est pas accessible");
                    return false;
                }
                
                if (!ErrorHandler.ensureDefined(app.documents, "app.documents", false)) {
                    alert("La collection de documents n'est pas accessible");
                    return false;
                }
                
                if (app.documents.length === 0) {
                    alert("Veuillez ouvrir un document avant d'exécuter ce script.");
                    return false;
                }
                
                return true;
            } catch (error) {
                ErrorHandler.handleError(error, "validateDocumentOpen", true);
                return false;
            }
        },
        
        /**
         * Récupère les styles de caractère disponibles dans le document
         * @param {Document} doc - Document InDesign
         * @returns {Object} Objet contenant les noms de style et les index
         */
        getCharacterStyles: function(doc) {
            var result = {
                styles: [],
                superscriptIndex: 0,
                italicIndex: 0
            };
            
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) {
                    return result;
                }
                
                if (!ErrorHandler.ensureDefined(doc.characterStyles, "document.characterStyles", true)) {
                    // Utiliser des valeurs par défaut
                    result.styles = ["[Style par défaut]", CONFIG.DEFAULT_STYLES.SUPERSCRIPT, CONFIG.DEFAULT_STYLES.ITALIC];
                    return result;
                }
                
                for (var i = 0; i < doc.characterStyles.length; i++) {
                    try {
                        var style = doc.characterStyles[i];
                        
                        if (!ErrorHandler.ensureDefined(style, "style à l'index " + i, false)) {
                            continue;
                        }
                        
                        if (!ErrorHandler.ensureDefined(style.name, "style.name à l'index " + i, false)) {
                            continue;
                        }
                        
                        var styleName = style.name;
                        result.styles.push(styleName);
                        
                        // Trouver les index de style par défaut
                        if (styleName === CONFIG.DEFAULT_STYLES.SUPERSCRIPT) {
                            result.superscriptIndex = i;
                        }
                        if (styleName === CONFIG.DEFAULT_STYLES.ITALIC) {
                            result.italicIndex = i;
                        }
                    } catch (styleError) {
                        ErrorHandler.handleError(styleError, "boucle getCharacterStyles pour l'index " + i, false);
                        // Continuer avec le style suivant
                    }
                }
                
                // S'assurer qu'au moins un style existe
                if (result.styles.length === 0) {
                    result.styles.push("[Style par défaut]");
                }
            } catch (error) {
                ErrorHandler.handleError(error, "getCharacterStyles", false);
                // Ajouter des styles par défaut en cas d'erreur
                result.styles = ["[Style par défaut]", CONFIG.DEFAULT_STYLES.SUPERSCRIPT, CONFIG.DEFAULT_STYLES.ITALIC];
            }
            
            return result;
        },
        
        /**
         * Récupère tous les styles de paragraphe, y compris ceux dans les groupes
         * @param {Document} doc - Document InDesign
         * @returns {Object} Objet contenant les styles de paragraphe et l'index du style "First paragraph"
         */
        getParagraphStyles: function(doc) {
            var result = {
                styles: [],
                firstParagraphIndex: -1
            };
            
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) {
                    return result;
                }
                
                // Fonction récursive pour collecter les styles dans les groupes
                function collectStyles(group) {
                    var styles = [];
                    
                    try {
                        if (!ErrorHandler.ensureDefined(group, "groupe de styles", false)) {
                            return styles;
                        }
                        
                        if (ErrorHandler.ensureDefined(group.paragraphStyles, "group.paragraphStyles", false)) {
                            for (var i = 0; i < group.paragraphStyles.length; i++) {
                                try {
                                    var style = group.paragraphStyles[i];
                                    
                                    if (!ErrorHandler.ensureDefined(style, "style à l'index " + i, false)) {
                                        continue;
                                    }
                                    
                                    if (!ErrorHandler.ensureDefined(style.name, "style.name à l'index " + i, false)) {
                                        continue;
                                    }
                                    
                                    // Ignorer les styles avec crochets
                                    if (!style.name.match(/^\[/)) {
                                        styles.push(style);
                                    }
                                } catch (styleError) {
                                    ErrorHandler.handleError(styleError, "boucle getParagraphStyles pour l'index " + i, false);
                                    // Continuer avec le style suivant
                                }
                            }
                        }
                        
                        if (ErrorHandler.ensureDefined(group.paragraphStyleGroups, "group.paragraphStyleGroups", false)) {
                            for (var j = 0; j < group.paragraphStyleGroups.length; j++) {
                                try {
                                    var subgroup = group.paragraphStyleGroups[j];
                                    
                                    if (!ErrorHandler.ensureDefined(subgroup, "subgroup à l'index " + j, false)) {
                                        continue;
                                    }
                                    
                                    styles = styles.concat(collectStyles(subgroup));
                                } catch (groupError) {
                                    ErrorHandler.handleError(groupError, "boucle de groupe pour l'index " + j, false);
                                    // Continuer avec le groupe suivant
                                }
                            }
                        }
                    } catch (error) {
                        ErrorHandler.handleError(error, "collectStyles", false);
                    }
                    
                    return styles;
                }
                
                // Collecter tous les styles
                var allStyles = collectStyles(doc);
                result.styles = allStyles;
                
                // Trouver l'index du style "First paragraph" s'il existe
                for (var k = 0; k < allStyles.length; k++) {
                    if (allStyles[k].name === CONFIG.DEFAULT_STYLES.FIRST_PARAGRAPH) {
                        result.firstParagraphIndex = k;
                        break;
                    }
                }
            } catch (error) {
                ErrorHandler.handleError(error, "getParagraphStyles", false);
            }
            
            return result;
        },
        
        /**
         * Récupère ou crée un style de caractère dans le document
         * @param {Document} doc - Document InDesign
         * @param {string} name - Nom du style
         * @param {Object} properties - Propriétés du style à définir si créé
         * @returns {CharacterStyle} Le style récupéré ou créé
         */
        getOrCreateStyle: function(doc, name, properties) {
            var style = null;
            
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) {
                    return null;
                }
                
                if (!ErrorHandler.ensureDefined(name, "nom du style", true)) {
                    return null;
                }
                
                if (!ErrorHandler.ensureDefined(properties, "propriétés du style", false)) {
                    properties = {}; // Créer un objet vide par défaut
                }
                
                if (!ErrorHandler.ensureDefined(doc.characterStyles, "document.characterStyles", true)) {
                    return null;
                }
                
                // Essayer de récupérer le style existant
                try {
                    style = doc.characterStyles.itemByName(name);
                    
                    // Vérifier si le style existe
                    if (!style || !style.isValid) {
                        throw new Error("Style non trouvé");
                    }
                } catch (lookupError) {
                    // Créer le style s'il n'existe pas
                    try {
                        style = doc.characterStyles.add({name: name});
                        
                        // Appliquer les propriétés
                        for (var prop in properties) {
                            if (Object.prototype.hasOwnProperty.call(properties, prop)) {
                                style[prop] = properties[prop];
                            }
                        }
                    } catch (createError) {
                        ErrorHandler.handleError(createError, "création du style " + name, false);
                        return null;
                    }
                }
            } catch (error) {
                ErrorHandler.handleError(error, "getOrCreateStyle", false);
                return null;
            }
            
            return style;
        },
        
        /**
         * Vérifie si un paragraphe est vide
         * @param {Paragraph} paragraph - Paragraphe à vérifier
         * @returns {boolean} True si le paragraphe est vide
         */
        isEmptyParagraph: function(paragraph) {
            try {
                if (!ErrorHandler.ensureDefined(paragraph, "paragraph", true)) {
                    return false;
                }
                
                if (!ErrorHandler.ensureDefined(paragraph.contents, "paragraph.contents", true)) {
                    return false;
                }
                
                var contents = paragraph.contents;
                return contents.replace(/[\r\n\s\u200B\uFEFF]/g, "") === "";
            } catch (error) {
                ErrorHandler.handleError(error, "isEmptyParagraph", false);
                return false;
            }
        },
        
        /**
         * Vérifie si un style est dans une liste de styles
         * @param {ParagraphStyle} style - Style à vérifier
         * @param {Array} styleList - Liste des styles
         * @returns {boolean} True si le style est dans la liste
         */
        isStyleInList: function(style, styleList) {
            try {
                if (!ErrorHandler.ensureDefined(style, "style", true)) {
                    return false;
                }
                
                if (!ErrorHandler.ensureDefined(styleList, "styleList", true)) {
                    return false;
                }
                
                if (!Array.isArray(styleList)) {
                    return false;
                }
                
                for (var i = 0; i < styleList.length; i++) {
                    if (style.id === styleList[i].id) {
                        return true;
                    }
                }
                
                return false;
            } catch (error) {
                ErrorHandler.handleError(error, "isStyleInList", false);
                return false;
            }
        },
        
        /**
         * Réinitialise toutes les préférences de recherche
         */
        resetPreferences: function() {
            try {
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                
                // Réinitialiser les préférences GREP
                if (ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", false)) {
                    app.findGrepPreferences = NothingEnum.nothing;
                }
                
                if (ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", false)) {
                    app.changeGrepPreferences = NothingEnum.nothing;
                }
                
                // Réinitialiser les préférences de texte
                if (ErrorHandler.ensureDefined(app.findTextPreferences, "app.findTextPreferences", false)) {
                    app.findTextPreferences = NothingEnum.nothing;
                }
                
                if (ErrorHandler.ensureDefined(app.changeTextPreferences, "app.changeTextPreferences", false)) {
                    app.changeTextPreferences = NothingEnum.nothing;
                }
                
                // Activer l'inclusion des notes de bas de page par défaut
                if (ErrorHandler.ensureDefined(app.findChangeGrepOptions, "app.findChangeGrepOptions", false)) {
                    app.findChangeGrepOptions.includeFootnotes = true;
                }
                
                if (ErrorHandler.ensureDefined(app.findChangeTextOptions, "app.findChangeTextOptions", false)) {
                    app.findChangeTextOptions.includeFootnotes = true;
                }
            } catch (error) {
                ErrorHandler.handleError(error, "resetPreferences", false);
            }
        }
    };
    
    /**
     * Fonctions de correction typographique
     * @private
     */
    var Corrections = {
        /**
         * Supprime les espaces avant la ponctuation simple et les notes de bas de page
         * @param {Document} doc - Document InDesign
         */
        removeSpacesBeforePunctuation: function(doc) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                
                // Supprimer les espaces avant les notes de bas de page
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = CONFIG.REGEX.SPACE_BEFORE_FOOTNOTE;
                app.changeGrepPreferences.changeTo = "";
                doc.changeGrep();
                
                // Supprimer les espaces avant les points
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = CONFIG.REGEX.SPACE_BEFORE_POINT;
                app.changeGrepPreferences.changeTo = "";
                doc.changeGrep();
                
                // Supprimer les espaces avant les virgules
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = CONFIG.REGEX.SPACE_BEFORE_COMMA;
                app.changeGrepPreferences.changeTo = "";
                doc.changeGrep();
            } catch (error) {
                ErrorHandler.handleError(error, "removeSpacesBeforePunctuation", false);
            }
        },
        
        /**
         * Supprime les espaces en début de paragraphe
         * @param {Document} doc - Document InDesign
         */
        removeSpacesStartParagraph: function(doc) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "^\\s+"; // Cherche un ou plusieurs espaces en début de paragraphe
                app.changeGrepPreferences.changeTo = "";
                doc.changeGrep();
            } catch (error) {
                ErrorHandler.handleError(error, "removeSpacesStartParagraph", false);
            }
        },
        
        /**
         * Supprime les espaces en fin de paragraphe
         * @param {Document} doc - Document InDesign
         */
        removeSpacesEndParagraph: function(doc) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "\\s+$"; // Cherche un ou plusieurs espaces en fin de paragraphe
                app.changeGrepPreferences.changeTo = "";
                doc.changeGrep();
            } catch (error) {
                ErrorHandler.handleError(error, "removeSpacesEndParagraph", false);
            }
        },
        
        /**
         * Supprime les tabulations, sauf celles qui suivent une référence de note dans les notes de bas de page
         * @param {Document} doc - Document InDesign
         */
        removeTabs: function(doc) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                
                // Approche alternative: traiter les tabulations par contexte
                
                // 1. D'abord, supprimer les tabulations régulières (pas après ~F) partout
                Utilities.resetPreferences();
                app.findChangeGrepOptions.includeFootnotes = true; // Inclure les notes
                
                // Rechercher les tabulations qui ne sont pas précédées par ~F
                app.findGrepPreferences.findWhat = "(?<!~F)\\t";
                app.changeGrepPreferences.changeTo = "";
                doc.changeGrep();
                
                // 2. Ensuite, supprimer les tabulations après ~F, mais uniquement dans le texte principal
                Utilities.resetPreferences();
                app.findChangeGrepOptions.includeFootnotes = false; // Exclure les notes
                
                // Rechercher ~F suivi d'une tabulation dans le texte principal uniquement
                app.findGrepPreferences.findWhat = "~F\\t";
                app.changeGrepPreferences.changeTo = "~F"; // Garder la référence de note mais supprimer la tabulation
                doc.changeGrep();
                
            } catch (error) {
                ErrorHandler.handleError(error, "removeTabs", false);
            }
        },
        
        /**
         * Déplace les références de notes de bas de page avant la ponctuation
         * @param {Document} doc - Document InDesign
         */
        moveNotes: function(doc) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.findChangeGrepOptions, "app.findChangeGrepOptions", true)) return;
                if (!ErrorHandler.ensureDefined(LocationOptions, "LocationOptions", true)) return;
                
                var LO_BEFORE = LocationOptions.BEFORE;
                
                app.findGrepPreferences = null;
                app.changeGrepPreferences = null;
                app.findChangeGrepOptions.includeFootnotes = false;
                app.findGrepPreferences.findWhat = CONFIG.REGEX.FOOTNOTE_PATTERN;
                
                var foundItems = doc.findGrep();
                
                if (!ErrorHandler.ensureDefined(foundItems, "foundItems", false)) {
                    return;
                }
                
                var itemCount = foundItems.length;
                
                // Traiter les éléments en ordre inverse pour éviter les problèmes de décalage d'index
                for (var i = itemCount - 1; i >= 0; i--) {
                    try {
                        var item = foundItems[i];
                        
                        if (!ErrorHandler.ensureDefined(item, "item à l'index " + i, false)) {
                            continue;
                        }
                        
                        if (!ErrorHandler.ensureDefined(item.texts, "item.texts à l'index " + i, false)) {
                            continue;
                        }
                        
                        if (item.texts.length === 0) {
                            continue;
                        }
                        
                        var t = item.texts[0].characters;
                        
                        if (!ErrorHandler.ensureDefined(t, "caractères à l'index " + i, false)) {
                            continue;
                        }
                        
                        t[-1].move(LO_BEFORE, t[0]);
                    } catch (itemError) {
                        ErrorHandler.handleError(itemError, "traitement de l'élément " + i, false);
                        // Continuer avec l'élément suivant
                    }
                }
            } catch (error) {
                ErrorHandler.handleError(error, "moveNotes", false);
            }
        },
        
        /**
         * Corrige les doubles espaces dans tout le document
         * @param {Document} doc - Document InDesign
         */
        fixDoubleSpaces: function(doc) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                
                Utilities.resetPreferences();
                
                app.findGrepPreferences.findWhat = CONFIG.REGEX.DOUBLE_SPACES;
                app.changeGrepPreferences.changeTo = " ";
                doc.changeGrep();
            } catch (error) {
                ErrorHandler.handleError(error, "fixDoubleSpaces", false);
            }
        },
        
        /**
         * Applique un style de caractère aux références de notes de bas de page
         * @param {Document} doc - Document InDesign
         * @param {string} styleName - Nom du style de caractère
         */
        applyNoteStyle: function(doc, styleName) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(styleName, "styleName", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                
                // Récupérer ou créer le style
                var style = Utilities.getOrCreateStyle(doc, styleName, { position: Position.SUPERSCRIPT });
                
                if (!ErrorHandler.ensureDefined(style, "style", false)) {
                    return;
                }
                
                if (!ErrorHandler.ensureDefined(doc.stories, "document.stories", true)) {
                    return;
                }
                
                // Traiter chaque histoire
                var stories = doc.stories;
                for (var i = 0; i < stories.length; i++) {
                    try {
                        var story = stories[i];
                        
                        if (!ErrorHandler.ensureDefined(story, "story à l'index " + i, false)) {
                            continue;
                        }
                        
                        // Rechercher les références de notes de bas de page seulement dans le texte principal
                        // et non dans les notes elles-mêmes
                        
                        // Assurons-nous que les paramètres de recherche sont correctement configurés
                        app.findGrepPreferences = NothingEnum.nothing;
                        app.changeGrepPreferences = NothingEnum.nothing;
                        
                        // Désactiver explicitement la recherche dans les notes de bas de page
                        app.findChangeGrepOptions.includeFootnotes = false;
                        
                        // Configurer la recherche
                        app.findGrepPreferences.findWhat = "~F";
                        
                        // Effectuer la recherche uniquement dans cette histoire
                        var founds = story.findGrep();
                        
                        if (!ErrorHandler.ensureDefined(founds, "founds dans story " + i, false)) {
                            continue;
                        }
                        
                        // Appliquer le style aux références trouvées
                        for (var j = 0; j < founds.length; j++) {
                            try {
                                var found = founds[j];
                                
                                if (!ErrorHandler.ensureDefined(found, "found à l'index " + j, false)) {
                                    continue;
                                }
                                
                                found.appliedCharacterStyle = style;
                            } catch (foundError) {
                                ErrorHandler.handleError(foundError, "application du style à found " + j, false);
                                // Continuer avec l'élément suivant
                            }
                        }
                    } catch (storyError) {
                        ErrorHandler.handleError(storyError, "traitement de l'histoire " + i, false);
                        // Continuer avec l'histoire suivante
                    }
                }
                
                // Réinitialiser les options de recherche à la fin
                app.findChangeGrepOptions.includeFootnotes = true;
            } catch (error) {
                ErrorHandler.handleError(error, "applyNoteStyle", false);
            }
        },
        
        /**
         * Corrige les espaces typographiques autour de la ponctuation et des guillemets
         * @param {Document} doc - Document InDesign
         * @param {string} spaceType - Code d'espace spécial InDesign
         */
        fixTypoSpaces: function(doc, spaceType) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(spaceType, "spaceType", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                
                Utilities.resetPreferences();
                
                // Espace après guillemet ouvrant
                app.findGrepPreferences.findWhat = CONFIG.REGEX.SPACE_AFTER_OPENING_QUOTE;
                app.changeGrepPreferences.changeTo = spaceType;
                doc.changeGrep();
                
                // Espace avant guillemet fermant
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = CONFIG.REGEX.SPACE_BEFORE_CLOSING_QUOTE;
                app.changeGrepPreferences.changeTo = spaceType;
                doc.changeGrep();
                
                // Espace avant ponctuation double
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = CONFIG.REGEX.SPACE_BEFORE_DOUBLE_PUNCTUATION;
                app.changeGrepPreferences.changeTo = spaceType;
                doc.changeGrep();
                
                // Espace avant ponctuation double quand elle est collée à un caractère
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = CONFIG.REGEX.CHARACTER_BEFORE_DOUBLE_PUNCTUATION;
                app.changeGrepPreferences.changeTo = "$1" + spaceType;
                doc.changeGrep();
            } catch (error) {
                ErrorHandler.handleError(error, "fixTypoSpaces", false);
            }
        },
        
        /**
         * Remplace les tirets cadratin par des tirets demi-cadratin
         * @param {Document} doc - Document InDesign
         */
        replaceDashes: function(doc) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "—";
                app.changeGrepPreferences.changeTo = "–";
                doc.changeGrep();
            } catch (error) {
                ErrorHandler.handleError(error, "replaceDashes", false);
            }
        },
        
        /**
         * Corrige les tirets isolés en les transformant en tirets demi-cadratin
         * Version sans dictionnaire qui cible seulement les tirets vraiment isolés
         * @param {Document} doc - Document InDesign
         */
        fixIsolatedHyphens: function(doc) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                
                // Le tiret demi-cadratin dans Unicode
                var ENDASH = "\u2013"; // –
                
                // Réinitialiser les préférences de recherche
                Utilities.resetPreferences();
                
                // CAS 1: Tirets isolés entre deux espaces normaux
                // Simplement: espace tiret espace
                app.findGrepPreferences.findWhat = " - ";
                app.changeGrepPreferences.changeTo = " " + ENDASH + " ";
                doc.changeGrep();
                
                // CAS 2: Tirets en début de paragraphe
                // Simplement: début de paragraphe, tiret, espace
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "^- ";
                app.changeGrepPreferences.changeTo = ENDASH + " ";
                doc.changeGrep();
                
                // CAS 3: Tirets après tabulation (pour les listes)
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "\\t- ";
                app.changeGrepPreferences.changeTo = "\\t" + ENDASH + " ";
                doc.changeGrep();
                
                // Réinitialiser les préférences à la fin
                Utilities.resetPreferences();
            } catch (error) {
                ErrorHandler.handleError(error, "fixIsolatedHyphens", false);
            }
        },
        
        /**
         * Remplace les tirets simples par des tirets demi-cadratin dans les intervalles de valeurs
         * Version de base ultra-simplifiée qui devrait fonctionner dans tous les cas
         * @param {Document} doc - Document InDesign
         */
        fixValueRanges: function(doc) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                
                // Le tiret demi-cadratin dans Unicode
                var ENDASH = "\u2013"; // –
                
                // Cas 1: Années (1990-2000)
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "(\\d{4})-(\\d{4})";
                app.changeGrepPreferences.changeTo = "$1" + ENDASH + "$2";
                doc.changeGrep();
                
                // Cas 2: Pages (p. 10-20)
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "(p\\.) (\\d+)-(\\d+)";
                app.changeGrepPreferences.changeTo = "$1 $2" + ENDASH + "$3";
                doc.changeGrep();
                
                // Cas 3: Pages (pages 10-20)
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "(pages) (\\d+)-(\\d+)";
                app.changeGrepPreferences.changeTo = "$1 $2" + ENDASH + "$3";
                doc.changeGrep();
                
                // Cas 4: Heures (10h-12h)
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "(\\d+h)-(\\d+h)";
                app.changeGrepPreferences.changeTo = "$1" + ENDASH + "$2";
                doc.changeGrep();
                
                // Cas 5: Heures avec minutes (10h30-12h45)
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "(\\d+h\\d+)-(\\d+h\\d+)";
                app.changeGrepPreferences.changeTo = "$1" + ENDASH + "$2";
                doc.changeGrep();
                
                // Cas 6: Tableaux (tableau 1-3)
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "(tableau) (\\d+)-(\\d+)";
                app.changeGrepPreferences.changeTo = "$1 $2" + ENDASH + "$3";
                doc.changeGrep();
                
                // Cas 7: Figures (fig. 1-3)
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "(fig\\.) (\\d+)-(\\d+)";
                app.changeGrepPreferences.changeTo = "$1 $2" + ENDASH + "$3";
                doc.changeGrep();
                
                // Cas 8: De A à Z
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "([A-Z])-([A-Z])";
                app.changeGrepPreferences.changeTo = "$1" + ENDASH + "$2";
                doc.changeGrep();
                
                // Réinitialiser les préférences à la fin
                Utilities.resetPreferences();
            } catch (error) {
                ErrorHandler.handleError(error, "fixValueRanges", false);
            }
        },
        
        /**
         * Applique un style au texte avec formatage italique
         * @param {Document} doc - Document InDesign
         * @param {string} styleName - Nom du style de caractère
         */
        applyItalicStyle: function(doc, styleName) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(styleName, "styleName", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findTextPreferences, "app.findTextPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeTextPreferences, "app.changeTextPreferences", true)) return;
                
                // Récupérer ou créer le style
                var style = Utilities.getOrCreateStyle(doc, styleName, { fontStyle: "Italic" });
                
                if (!ErrorHandler.ensureDefined(style, "style", false)) {
                    return;
                }
                
                // Appliquer le style au texte en italique
                Utilities.resetPreferences();
                app.findTextPreferences.fontStyle = "Italic";
                app.changeTextPreferences.appliedCharacterStyle = style;
                doc.changeText();
            } catch (error) {
                ErrorHandler.handleError(error, "applyItalicStyle", false);
            }
        },
        
        /**
         * Applique un style au texte avec formatage exposant
         * @param {Document} doc - Document InDesign
         * @param {string} styleName - Nom du style de caractère
         */
        applyExposantStyle: function(doc, styleName) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(styleName, "styleName", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findTextPreferences, "app.findTextPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeTextPreferences, "app.changeTextPreferences", true)) return;
                
                // Récupérer ou créer le style
                var style = Utilities.getOrCreateStyle(doc, styleName, { position: Position.SUPERSCRIPT });
                
                if (!ErrorHandler.ensureDefined(style, "style", false)) {
                    return;
                }
                
                // Appliquer le style au texte en exposant
                Utilities.resetPreferences();
                app.findTextPreferences.position = Position.SUPERSCRIPT;
                app.changeTextPreferences.appliedCharacterStyle = style;
                doc.changeText();
            } catch (error) {
                ErrorHandler.handleError(error, "applyExposantStyle", false);
            }
        },
        
        /**
         * Supprime les doubles retours à la ligne
         * @param {Document} doc - Document InDesign
         */
        removeDoubleReturns: function(doc) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                
                Utilities.resetPreferences();
                
                app.findGrepPreferences.findWhat = CONFIG.REGEX.DOUBLE_RETURNS;
                app.changeGrepPreferences.changeTo = "\\r";
                doc.changeGrep();
            } catch (error) {
                ErrorHandler.handleError(error, "removeDoubleReturns", false);
            }
        },
        
        /**
         * Convertit trois points consécutifs en caractère points de suspension
         * @param {Document} doc - Document InDesign
         */
        convertEllipsis: function(doc) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                
                Utilities.resetPreferences();
                
                app.findGrepPreferences.findWhat = CONFIG.REGEX.TRIPLE_DOTS;
                app.changeGrepPreferences.changeTo = "…"; // U+2026 HORIZONTAL ELLIPSIS
                doc.changeGrep();
            } catch (error) {
                ErrorHandler.handleError(error, "convertEllipsis", false);
            }
        },
        
        /**
         * Remplace les apostrophes droites par des apostrophes typographiques
         * @param {Document} doc - Document InDesign
         * @returns {number} Nombre total d'apostrophes remplacées
         */
        replaceApostrophes: function(doc) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return 0;
                
                var totalReplaced = 0;
                
                // 1. Sauvegarder les options de recherche actuelles
                var savedOptions = {};
                try {
                    savedOptions = {
                        caseSensitive: app.findChangeTextOptions.caseSensitive,
                        wholeWord: app.findChangeTextOptions.wholeWord,
                        includeFootnotes: app.findChangeTextOptions.includeFootnotes,
                        includeHiddenLayers: app.findChangeTextOptions.includeHiddenLayers,
                        includeMasterPages: app.findChangeTextOptions.includeMasterPages,
                        includeLockedLayersForFind: app.findChangeTextOptions.includeLockedLayersForFind,
                        includeLockedStoriesForFind: app.findChangeTextOptions.includeLockedStoriesForFind
                    };
                } catch (e) {
                    // Continuer même si certaines options ne peuvent pas être sauvegardées
                }
                
                // 2. Réinitialiser à la fois les préférences GREP et Text
                app.findGrepPreferences = NothingEnum.NOTHING;
                app.changeGrepPreferences = NothingEnum.NOTHING;
                app.findTextPreferences = NothingEnum.NOTHING;
                app.changeTextPreferences = NothingEnum.NOTHING;
                
                // 3. Configurer explicitement les options de recherche
                app.findChangeTextOptions.caseSensitive = false;
                app.findChangeTextOptions.wholeWord = false;
                app.findChangeTextOptions.includeFootnotes = true;
                app.findChangeTextOptions.includeHiddenLayers = true;
                app.findChangeTextOptions.includeMasterPages = true;
                app.findChangeTextOptions.includeLockedLayersForFind = true;
                app.findChangeTextOptions.includeLockedStoriesForFind = true;
                
                try {
                    // 4. Rechercher uniquement l'apostrophe droite (le cas le plus courant dans InDesign)
                    app.findTextPreferences.findWhat = "'";
                    app.changeTextPreferences.changeTo = "\u2019"; // apostrophe typographique
                    
                    // 5. Effectuer le remplacement global
                    var foundItems = doc.changeText();
                    totalReplaced = foundItems.length;
                    
                    // Version sans alerte pour production
                    // Si vous préférez conserver l'alerte, décommentez la ligne ci-dessous
                    // alert("Fonction replaceApostrophes : " + totalReplaced + " apostrophes droites remplacées.");
                    
                    // Journalisation pour débogage
                    try {
                        if (typeof console !== "undefined" && console && console.log) {
                            console.log("Apostrophes remplacées : " + totalReplaced);
                        }
                    } catch (e) {
                        // Ignorer les erreurs de journalisation
                    }
                } catch (searchError) {
                    ErrorHandler.handleError(searchError, "replaceApostrophes - opération de recherche", false);
                }
                
                // 6. Restaurer les options originales
                try {
                    for (var opt in savedOptions) {
                        if (Object.prototype.hasOwnProperty.call(savedOptions, opt)) {
                            app.findChangeTextOptions[opt] = savedOptions[opt];
                        }
                    }
                } catch (e) {
                    // Continuer même si la restauration échoue
                }
                
                // 7. Réinitialiser à nouveau les deux types de préférences
                app.findGrepPreferences = NothingEnum.NOTHING;
                app.changeGrepPreferences = NothingEnum.NOTHING;
                app.findTextPreferences = NothingEnum.NOTHING;
                app.changeTextPreferences = NothingEnum.NOTHING;
                
                return totalReplaced;
            } catch (error) {
                ErrorHandler.handleError(error, "replaceApostrophes", false);
                // Alerte seulement en cas d'erreur grave
                alert("Erreur dans replaceApostrophes : " + error.message);
                return 0;
            }
        },
        
        /**
         * Applique un style de paragraphe après les paragraphes déclencheurs
         * @param {Document} doc - Document InDesign
         * @param {Array} triggerStyles - Styles déclencheurs
         * @param {ParagraphStyle} targetStyle - Style à appliquer
         */
        applyStyleAfterTriggers: function(doc, triggerStyles, targetStyle) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(triggerStyles, "triggerStyles", true)) return;
                if (!ErrorHandler.ensureDefined(targetStyle, "targetStyle", true)) return;
                
                // Vérifier que les collections d'objets sont accessibles
                if (!ErrorHandler.ensureDefined(doc.stories, "document.stories", true)) return;
                
                // Parcourir les articles du document
                var stories = doc.stories;
                for (var s = 0; s < stories.length; s++) {
                    try {
                        var story = stories[s];
                        
                        if (!ErrorHandler.ensureDefined(story, "story à l'index " + s, false)) {
                            continue;
                        }
                        
                        if (!ErrorHandler.ensureDefined(story.paragraphs, "story.paragraphs à l'index " + s, false)) {
                            continue;
                        }
                        
                        var paras = story.paragraphs;
                        var justLeftTriggerBlock = false;
                        
                        // Parcourir les paragraphes de l'article
                        for (var p = 0; p < paras.length; p++) {
                            try {
                                var para = paras[p];
                                
                                if (!ErrorHandler.ensureDefined(para, "paragraph à l'index " + p, false)) {
                                    continue;
                                }
                                
                                if (!ErrorHandler.ensureDefined(para.appliedParagraphStyle, "para.appliedParagraphStyle à l'index " + p, false)) {
                                    continue;
                                }
                                
                                var style = para.appliedParagraphStyle;
                                var isTriggerStyle = false;
                                
                                // Vérifier si le style actuel est un déclencheur
                                for (var t = 0; t < triggerStyles.length; t++) {
                                    if (style.id === triggerStyles[t].id) {
                                        isTriggerStyle = true;
                                        break;
                                    }
                                }
                                
                                if (isTriggerStyle) {
                                    justLeftTriggerBlock = true;
                                } else if (justLeftTriggerBlock) {
                                    // Si on vient de quitter un bloc de déclencheurs et que le paragraphe n'est pas vide
                                    if (!Utilities.isEmptyParagraph(para)) {
                                        // Appliquer le style cible
                                        para.appliedParagraphStyle = targetStyle;
                                        justLeftTriggerBlock = false; // Réinitialiser pour ne pas affecter plusieurs paragraphes consécutifs
                                    }
                                }
                            } catch (paraError) {
                                ErrorHandler.handleError(paraError, "traitement du paragraphe " + p, false);
                                // Continuer avec le paragraphe suivant
                            }
                        }
                    } catch (storyError) {
                        ErrorHandler.handleError(storyError, "traitement de l'article " + s, false);
                        // Continuer avec l'article suivant
                    }
                }
            } catch (error) {
                ErrorHandler.handleError(error, "applyStyleAfterTriggers", false);
            }
        },
        
        /**
         * Corrige les espaces autour des incises avec tirets demi-cadratins
         * @param {Document} doc - Document InDesign
         * @param {string} spaceType - Code d'espace spécial InDesign
         */
        fixDashIncises: function(doc, spaceType) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(spaceType, "spaceType", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                
                // Tiret demi-cadratin
                var ENDASH = "\u2013"; // –
                
                // Obtenir le caractère d'espace insécable à utiliser selon le type demandé
                var insecableChar = (spaceType === "~<") ? "\u202F" : "\u00A0"; // Espace fine ou espace insécable standard
                
                // Réinitialiser les préférences
                Utilities.resetPreferences();
                app.findChangeGrepOptions.includeFootnotes = true;
                
                // 1. Gestion des incises (paires de tirets)
                // 1.1 Trouver les paires de tirets (tiret + espace + texte + espace + tiret)
                app.findGrepPreferences.findWhat = ENDASH + " ([^" + ENDASH + "\\r\\n]*?) " + ENDASH;
                app.changeGrepPreferences.changeTo = ENDASH + insecableChar + "$1" + insecableChar + ENDASH;
                doc.changeGrep();
                
                // 1.2 Traiter les tirets de dialogue en début de paragraphe
                Utilities.resetPreferences();
                app.findChangeGrepOptions.includeFootnotes = true;
                app.findGrepPreferences.findWhat = "^" + ENDASH + " ";
                app.changeGrepPreferences.changeTo = ENDASH + insecableChar;
                doc.changeGrep();
                
                // 1.3 Traiter les tirets ouvrants isolés (non suivis d'un autre tiret dans le paragraphe)
                Utilities.resetPreferences();
                app.findChangeGrepOptions.includeFootnotes = true;
                app.findGrepPreferences.findWhat = ENDASH + " ";
                
                var tousLesTirets = doc.findGrep();
                for (var i = 0; i < tousLesTirets.length; i++) {
                    var item = tousLesTirets[i];
                    var paragraphText = item.paragraphs[0].contents;
                    var itemPosition = paragraphText.indexOf(item.contents);
                    var positionApresTiret = itemPosition + item.contents.length;
                    
                    // Si ce tiret est le dernier du paragraphe, c'est un tiret ouvrant isolé
                    if (paragraphText.indexOf(ENDASH, positionApresTiret) === -1) {
                        // Utiliser findGrep/changeGrep localement sur cette occurrence
                        Utilities.resetPreferences();
                        app.findGrepPreferences.findWhat = ENDASH + " ";
                        app.changeGrepPreferences.changeTo = ENDASH + insecableChar;
                        item.changeGrep();
                    }
                }
                
                // 1.4 Traiter les tirets fermants isolés (non précédés d'un autre tiret dans le paragraphe)
                Utilities.resetPreferences();
                app.findChangeGrepOptions.includeFootnotes = true;
                app.findGrepPreferences.findWhat = " " + ENDASH;
                
                var tiretsFermants = doc.findGrep();
                for (var j = 0; j < tiretsFermants.length; j++) {
                    var fermant = tiretsFermants[j];
                    var paraText = fermant.paragraphs[0].contents;
                    var fermantPosition = paraText.indexOf(fermant.contents);
                    
                    // Si ce tiret est le premier du paragraphe, c'est un tiret fermant isolé
                    if (paraText.indexOf(ENDASH, 0, fermantPosition) === -1) {
                        // Utiliser findGrep/changeGrep localement sur cette occurrence
                        Utilities.resetPreferences();
                        app.findGrepPreferences.findWhat = " " + ENDASH;
                        app.changeGrepPreferences.changeTo = insecableChar + ENDASH;
                        fermant.changeGrep();
                    }
                }
                
                // Réinitialiser les préférences à la fin
                Utilities.resetPreferences();
            } catch (error) {
                ErrorHandler.handleError(error, "fixDashIncises", false);
            }
        },
        
        /**
         * Formate les nombres en respectant les conventions typographiques françaises
         * @param {Document} doc - Document InDesign
         * @param {boolean} addSpaces - Si true, ajoute des espaces insécables entre les milliers
         * @param {boolean} useComma - Si true, remplace les points décimaux par des virgules
         * @param {boolean} excludeYears - Si true, exclut les nombres entre 0 et 2050
         */
        formatNumbers: function(doc, addSpaces, useComma, excludeYears) {
            try {
                if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
                if (!ErrorHandler.ensureDefined(app, "app", true)) return;
                if (!ErrorHandler.ensureDefined(app.findGrepPreferences, "app.findGrepPreferences", true)) return;
                if (!ErrorHandler.ensureDefined(app.changeGrepPreferences, "app.changeGrepPreferences", true)) return;
                
                // Définir le tiret demi-cadratin
                var ENDASH = "\u2013"; // –
                
                var SEPARATEUR_MILLIERS = "~<"; // Espace fine insécable
                
                if (addSpaces) {
                    // CORRECTION: Protéger d'abord les intervalles d'années avec tiret demi-cadratin
                    if (excludeYears) {
                        Utilities.resetPreferences();
                        
                        // 1. Protéger les intervalles d'années avec tiret demi-cadratin déjà formatées
                        app.findGrepPreferences.findWhat = "([0-1]\\d{3})" + ENDASH + "([0-1]\\d{3}|20[0-4]\\d|2050)";
                        app.changeGrepPreferences.changeTo = "YEAR_ENDASH_$1_ENDASH_$2";  
                        doc.changeGrep();
                        
                        // 2. Protéger les années entre parenthèses avec tiret demi-cadratin
                        app.findGrepPreferences.findWhat = "\\(([0-1]\\d{3})" + ENDASH + "([0-1]\\d{3}|20[0-4]\\d|2050)\\)";
                        app.changeGrepPreferences.changeTo = "(YEAR_ENDASH_$1_ENDASH_$2)";  
                        doc.changeGrep();
                        
                        // Première passe : protéger les plages d'années connectées par des tirets ou traits d'union
                        Utilities.resetPreferences();
                        app.findGrepPreferences.findWhat = "\\b([0-1]\\d{3})[-–—]([0-1]\\d{3}|20[0-4]\\d|2050)\\b";
                        app.changeGrepPreferences.changeTo = "YEAR_MARK_$1_YEAR_MARK-YEAR_MARK_$2_YEAR_MARK";
                        doc.changeGrep();
                        
                        // Deuxième passe : protéger les années individuelles restantes
                        Utilities.resetPreferences();
                        app.findGrepPreferences.findWhat = "\\b([0-1]\\d{3})\\b|\\b(20[0-4]\\d)\\b|\\b(2050)\\b";
                        app.changeGrepPreferences.changeTo = "YEAR_MARK_$1$2$3_YEAR_MARK";
                        doc.changeGrep();
                        
                        // Troisième passe : protéger les années dans les parenthèses (comme dans votre exemple)
                        Utilities.resetPreferences();
                        app.findGrepPreferences.findWhat = "\\(([0-1]\\d{3})[-–—]([0-1]\\d{3}|20[0-4]\\d|2050)\\)";
                        app.changeGrepPreferences.changeTo = "(YEAR_MARK_$1_YEAR_MARK-YEAR_MARK_$2_YEAR_MARK)";
                        doc.changeGrep();
                    }
                    
                    // Protéger nombres décimaux avant tout traitement
                    Utilities.resetPreferences();
                    if (useComma) {
                        app.findGrepPreferences.findWhat = "\\b(\\d+),(\\d+)\\b";
                    } else {
                        app.findGrepPreferences.findWhat = "\\b(\\d+)\\.(\\d+)\\b";
                    }
                    app.changeGrepPreferences.changeTo = "###$1###$2###";
                    doc.changeGrep();
                    
                    // Traiter d'abord les grands nombres sans séparateurs (4+ chiffres)
                    // mais qui ne sont pas protégés (années ou décimaux)
                    Utilities.resetPreferences();
                    app.findGrepPreferences.findWhat = "\\b(\\d{4,})\\b";
                    
                    var largeNumbers = doc.findGrep();
                    for (var ln = 0; ln < largeNumbers.length; ln++) {
                        try {
                            var numStr = largeNumbers[ln].contents;
                            
                            // Vérifier que ce n'est pas un nombre déjà protégé
                            if (numStr.indexOf("YEAR_MARK_") !== -1 || numStr.indexOf("YEAR_ENDASH_") !== -1 || numStr.indexOf("###") !== -1) {
                                continue;
                            }
                            
                            // Formater en préservant la méthode d'origine
                            var formattedNum = "";
                            var len = numStr.length;
                            var mod = len % 3;
                            
                            if (mod > 0) {
                                formattedNum = numStr.substring(0, mod);
                            } else {
                                formattedNum = numStr.substring(0, 3);
                                mod = 3;
                            }
                            
                            for (var j = mod; j < len; j += 3) {
                                formattedNum += " " + numStr.substring(j, j + 3);
                            }
                            
                            largeNumbers[ln].contents = formattedNum;
                        } catch (e) {
                            continue;
                        }
                    }
                    
                    // Traiter les nombres avec un séparateur suivi de 4+ chiffres (ex: 5 000000)
                    Utilities.resetPreferences();
                    app.findGrepPreferences.findWhat = "\\b(\\d+)[ \\t\\u00A0\\u202F~<~>~|~=](\\d{4,})\\b";
                    
                    var singleSepNumbers = doc.findGrep();
                    for (var i = 0; i < singleSepNumbers.length; i++) {
                        try {
                            var originalText = singleSepNumbers[i].contents;
                            
                            // Vérifier que ce n'est pas un nombre déjà protégé
                            if (originalText.indexOf("YEAR_MARK_") !== -1 || originalText.indexOf("YEAR_ENDASH_") !== -1 || originalText.indexOf("###") !== -1) {
                                continue;
                            }
                            
                            var matches = originalText.match(/(\d+)[ \t\u00A0\u202F~<~>~|~=](\d+)/);
                            
                            if (matches && matches.length === 3) {
                                var fullNumber = matches[1] + matches[2];
                                var tempKey = "SPECIAL_NUMBER_" + Math.random().toString(36).substring(2, 10) + "_";
                                
                                singleSepNumbers[i].contents = tempKey;
                                
                                var formattedNumber = "";
                                var len = fullNumber.length;
                                var mod = len % 3;
                                
                                if (mod > 0) {
                                    formattedNumber = fullNumber.substring(0, mod);
                                } else {
                                    formattedNumber = fullNumber.substring(0, 3);
                                    mod = 3;
                                }
                                
                                for (var j = mod; j < len; j += 3) {
                                    formattedNumber += " " + fullNumber.substring(j, j + 3);
                                }
                                
                                Utilities.resetPreferences();
                                app.findGrepPreferences.findWhat = tempKey;
                                app.changeGrepPreferences.changeTo = formattedNumber;
                                doc.changeGrep();
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                    
                    // Traiter les nombres avec apostrophe (ex: 10'000)
                    Utilities.resetPreferences();
                    app.findGrepPreferences.findWhat = "\\b(\\d+)'(\\d{3,})\\b";
                    
                    var apostropheSepNumbers = doc.findGrep();
                    for (var i = 0; i < apostropheSepNumbers.length; i++) {
                        try {
                            var originalText = apostropheSepNumbers[i].contents;
                            
                            // Vérifier que ce n'est pas un nombre déjà protégé
                            if (originalText.indexOf("YEAR_MARK_") !== -1 || originalText.indexOf("YEAR_ENDASH_") !== -1 || originalText.indexOf("###") !== -1) {
                                continue;
                            }
                            
                            var parts = originalText.split("'");
                            
                            if (parts.length === 2) {
                                var fullNumber = parts[0] + parts[1];
                                var tempKey = "SPECIAL_NUMBER_" + Math.random().toString(36).substring(2, 10) + "_";
                                
                                apostropheSepNumbers[i].contents = tempKey;
                                
                                var formattedNumber = "";
                                var len = fullNumber.length;
                                var mod = len % 3;
                                
                                if (mod > 0) {
                                    formattedNumber = fullNumber.substring(0, mod);
                                } else {
                                    formattedNumber = fullNumber.substring(0, 3);
                                    mod = 3;
                                }
                                
                                for (var j = mod; j < len; j += 3) {
                                    formattedNumber += " " + fullNumber.substring(j, j + 3);
                                }
                                
                                Utilities.resetPreferences();
                                app.findGrepPreferences.findWhat = tempKey;
                                app.changeGrepPreferences.changeTo = formattedNumber;
                                doc.changeGrep();
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                    
                    // Normaliser les séparateurs
                    // Traiter apostrophes
                    Utilities.resetPreferences();
                    app.findGrepPreferences.findWhat = "(\\d+)'(\\d{3})(?!'|\\d)"; 
                    app.changeGrepPreferences.changeTo = "$1" + SEPARATEUR_MILLIERS + "$2";
                    while (doc.changeGrep().length > 0) {}
                    
                    // Traiter points
                    Utilities.resetPreferences();
                    app.findGrepPreferences.findWhat = "(\\d+)\\.(\\d{3})(?![\\d,.])";
                    app.changeGrepPreferences.changeTo = "$1" + SEPARATEUR_MILLIERS + "$2";
                    while (doc.changeGrep().length > 0) {}
                    
                    // Normaliser les différents types d'espaces
                    var espacesPatterns = [
                        " (\\d{3})",                // Espace normal
                        "~>(\\d{3})",               // Espace fine
                        "~<(\\d{3})",               // Espace fine insécable
                        "~|(\\d{3})",               // Espace insécable alt
                        "~=(\\d{3})",               // Espace quart
                        "[\\u00A0\\u202F](\\d{3})" // Codes Unicode pour espaces insécables
                    ];
                    
                    for (var i = 0; i < espacesPatterns.length; i++) {
                        if (espacesPatterns[i].indexOf(SEPARATEUR_MILLIERS) === -1) {
                            Utilities.resetPreferences();
                            app.findGrepPreferences.findWhat = "(\\d+)" + espacesPatterns[i];
                            app.changeGrepPreferences.changeTo = "$1" + SEPARATEUR_MILLIERS + "$2";
                            while (doc.changeGrep().length > 0) {}
                        }
                    }
                    
                    // Traiter combinaisons mixtes
                    var mixedPatterns = [
                        "(\\d+)'(\\d{3})[\\s\\u00A0\\u202F~<~>~|~=](\\d{3})",  // Apostrophe puis espace
                        "(\\d+)[\\s\\u00A0\\u202F~<~>~|~=](\\d{3})'(\\d{3})",  // Espace puis apostrophe
                        "(\\d+)\\.(\\d{3})[\\s\\u00A0\\u202F~<~>~|~=](\\d{3})" // Point puis espace
                    ];
                    
                    for (var i = 0; i < mixedPatterns.length; i++) {
                        Utilities.resetPreferences();
                        app.findGrepPreferences.findWhat = mixedPatterns[i];
                        app.changeGrepPreferences.changeTo = "$1" + SEPARATEUR_MILLIERS + "$2" + SEPARATEUR_MILLIERS + "$3";
                        while (doc.changeGrep().length > 0) {}
                    }
                }
                
                // Remplacer points décimaux par virgules
                if (useComma) {
                    Utilities.resetPreferences();
                    app.findGrepPreferences.findWhat = "(\\d+)(?<!\\.)\\.((?!\\.)\\d+)";
                    app.changeGrepPreferences.changeTo = "$1,$2";
                    doc.changeGrep();
                }
                
                if (addSpaces) {
                    // Traiter nombres avec décimales qui ont été protégés
                    for (var nbDigits = 15; nbDigits >= 4; nbDigits--) {
                        var groupLength = nbDigits - 3;
                        
                        Utilities.resetPreferences();
                        var pattern = "###(\\d{" + groupLength + "})(\\d{3})###";
                        app.findGrepPreferences.findWhat = pattern;
                        app.changeGrepPreferences.changeTo = "###$1" + SEPARATEUR_MILLIERS + "$2###";
                        doc.changeGrep();
                    }
                    
                    // Restaurer nombres décimaux
                    Utilities.resetPreferences();
                    if (useComma) {
                        app.findGrepPreferences.findWhat = "###([^#]+)###([^#]+)###";
                        app.changeGrepPreferences.changeTo = "$1,$2";
                    } else {
                        app.findGrepPreferences.findWhat = "###([^#]+)###([^#]+)###";
                        app.changeGrepPreferences.changeTo = "$1.$2";
                    }
                    doc.changeGrep();
                    
                    // CORRECTION: Restaurer les différents types d'années protégées
                    if (excludeYears) {
                        // 1. D'abord restaurer les années avec tiret demi-cadratin
                        Utilities.resetPreferences();
                        app.findGrepPreferences.findWhat = "YEAR_ENDASH_(\\d+)_ENDASH_(\\d+)";
                        app.changeGrepPreferences.changeTo = "$1" + ENDASH + "$2";  // Restaure avec tiret demi-cadratin
                        doc.changeGrep();
                        
                        // 2. Restaurer les plages d'années avec tiret simple
                        Utilities.resetPreferences();
                        app.findGrepPreferences.findWhat = "YEAR_MARK_(\\d+)_YEAR_MARK-YEAR_MARK_(\\d+)_YEAR_MARK";
                        app.changeGrepPreferences.changeTo = "$1-$2";
                        doc.changeGrep();
                        
                        // 3. Restaurer les années individuelles
                        Utilities.resetPreferences();
                        app.findGrepPreferences.findWhat = "YEAR_MARK_(\\d+)_YEAR_MARK";
                        app.changeGrepPreferences.changeTo = "$1";
                        doc.changeGrep();
                    }
                    
                    // Traiter très grands nombres
                    for (var pass = 0; pass < 5; pass++) {
                        Utilities.resetPreferences();
                        app.findGrepPreferences.findWhat = "(\\d{1,3})" + SEPARATEUR_MILLIERS + "(\\d{3}" + SEPARATEUR_MILLIERS + "\\d{3})";
                        app.changeGrepPreferences.changeTo = "$1" + SEPARATEUR_MILLIERS + "$2";
                        
                        var foundItems = doc.findGrep();
                        if (foundItems.length === 0) break;
                        
                        for (var f = 0; f < foundItems.length; f++) {
                            var num = foundItems[f].contents;
                            if (num.match(/^\d{4,}/)) {
                                var parts = num.split(SEPARATEUR_MILLIERS);
                                var firstPart = parts[0];
                                
                                if (firstPart.length > 3) {
                                    var newFirstPart = "";
                                    var remaining = firstPart.length % 3;
                                    
                                    if (remaining > 0) {
                                        newFirstPart += firstPart.substring(0, remaining) + SEPARATEUR_MILLIERS;
                                    }
                                    
                                    for (var i = remaining; i < firstPart.length; i += 3) {
                                        newFirstPart += firstPart.substring(i, i + 3);
                                        if (i + 3 < firstPart.length) {
                                            newFirstPart += SEPARATEUR_MILLIERS;
                                        }
                                    }
                                    
                                    var newNum = newFirstPart;
                                    for (var i = 1; i < parts.length; i++) {
                                        newNum += SEPARATEUR_MILLIERS + parts[i];
                                    }
                                    
                                    foundItems[f].contents = newNum;
                                }
                            }
                        }
                    }
                }
                
                // Nettoyage final
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = SEPARATEUR_MILLIERS + "{2,}";
                app.changeGrepPreferences.changeTo = SEPARATEUR_MILLIERS;
                doc.changeGrep();
                
                // CORRECTION: Inclure les nouveaux marqueurs dans le nettoyage
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "###|YEAR_MARK_|_YEAR_MARK|YEAR_ENDASH_|_ENDASH_|SPECIAL_NUMBER_[a-z0-9]+_";
                app.changeGrepPreferences.changeTo = "";
                doc.changeGrep();
                
                // Convertir espaces normaux en espaces fines insécables
                Utilities.resetPreferences();
                app.findGrepPreferences.findWhat = "(\\d+) (\\d{3})";
                app.changeGrepPreferences.changeTo = "$1" + SEPARATEUR_MILLIERS + "$2";
                while (doc.changeGrep().length > 0) {}
                
            } catch (error) {
                ErrorHandler.handleError(error, "formatNumbers", false);
            }
        }
    };
    
    /**
     * Module de barre de progression pour SuperScript
     * @private
     */
    var ProgressBar = {
        /**
         * Référence à la fenêtre de progression
         * @private
         */
        progressWin: null,
        
        /**
         * Crée une barre de progression
         * @param {String} title - Titre de la boîte de dialogue
         * @param {Number} maxValue - Valeur maximale pour la barre de progression
         */
        create: function(title, maxValue) {
            try {
                this.progressWin = new Window("palette", title);
                this.progressWin.progressBar = this.progressWin.add("progressbar", undefined, 0, maxValue);
                this.progressWin.progressBar.preferredSize.width = 300;
                this.progressWin.status = this.progressWin.add("statictext", undefined, "");
                this.progressWin.status.preferredSize.width = 300;
                
                // Centrer la fenêtre
                this.progressWin.center();
                this.progressWin.show();
            } catch (e) {
                ErrorHandler.handleError(e, "création de la barre de progression", false);
                // Continuer sans barre de progression
                this.progressWin = null;
            }
        },
        
        /**
         * Met à jour la barre de progression
         * @param {Number} value - Valeur actuelle de la progression
         * @param {String} statusText - Texte de statut à afficher
         */
        update: function(value, statusText) {
            if (!this.progressWin) return;
            
            try {
                this.progressWin.progressBar.value = value;
                this.progressWin.status.text = statusText;
                this.progressWin.update();
            } catch (e) {
                ErrorHandler.handleError(e, "mise à jour de la barre de progression", false);
            }
        },
        
        /**
         * Ferme la barre de progression
         */
        close: function() {
            if (this.progressWin) {
                try {
                    this.progressWin.close();
                    this.progressWin = null;
                } catch (e) {
                    ErrorHandler.handleError(e, "fermeture de la barre de progression", false);
                }
            }
        }
    };
    
    /**
     * Constructeur d'interface utilisateur pour le dialogue du script
     * @private
     */
    var UIBuilder = {
      /**
       * Crée et affiche le dialogue du script
       * @param {Array} characterStyles - Tableau des styles de caractère disponibles
       * @param {number} noteStyleIndex - Index du style de note par défaut
       * @param {number} italicStyleIndex - Index du style italique par défaut
       * @returns {Object} Résultat du dialogue avec les options de l'utilisateur
       */
      createDialog: function(characterStyles, noteStyleIndex, italicStyleIndex) {
        try {
        if (!ErrorHandler.ensureDefined(characterStyles, "characterStyles", true)) {
          characterStyles = ["[Style par défaut]"];
        }
        
        // Création du dialogue principal
        var dialog = new Window("dialog", CONFIG.SCRIPT_TITLE);
        dialog.orientation = "column";
        dialog.alignChildren = "fill";
        dialog.preferredSize.width = 400;
        
        // Bannière supérieure avec attribution
        var topBanner = dialog.add("group");
        topBanner.orientation = "row";
        topBanner.alignment = "right";
        var attribution = topBanner.add("statictext", undefined, "entremonde / Spectral lab");
        
        // Création des onglets
        var tpanel = dialog.add("tabbedpanel");
        tpanel.alignChildren = "fill";
        
        // Nouvel onglet des corrections générales
        var tabCorrections = tpanel.add("tab", undefined, "Corrections");
        tabCorrections.orientation = "column";
        tabCorrections.alignChildren = "left";
        
        // Onglet des corrections d'espaces
        var tabSpaces = tpanel.add("tab", undefined, "Espaces et retours");
        tabSpaces.orientation = "column";
        tabSpaces.alignChildren = "left";
        
        // Onglet Styles
        var tabStyle = tpanel.add("tab", undefined, "Styles");
        tabStyle.orientation = "column";
        tabStyle.alignChildren = "left";
        
        // Onglet des formatages
        var tabOther = tpanel.add("tab", undefined, "Formatages");
        tabOther.orientation = "column";
        tabOther.alignChildren = "left";
        
        // Ajout du nouvel onglet pour les styles
        var tabStyles = tpanel.add("tab", undefined, "Mise en page");
        tabStyles.orientation = "column";
        tabStyles.alignChildren = "left";
        
        // Sélection de l'onglet par défaut
        tpanel.selection = tabCorrections;
        
        // Fonction utilitaire pour ajouter une case à cocher
        function addCheckboxOption(parent, label, checked) {
          var group = parent.add("group");
          group.orientation = "row";
          group.alignChildren = "left";
          var checkbox = group.add("checkbox", undefined, label);
          checkbox.value = checked;
          return checkbox;
        }
        
        // Fonction utilitaire pour ajouter une option avec liste déroulante
        function addDropdownOption(parent, label, items, checked) {
          var group = parent.add("group");
          group.orientation = "row";
          group.alignChildren = "left";
          var checkbox = group.add("checkbox", undefined, label);
          checkbox.value = checked;
          
          var dropdown = group.add("dropdownlist", undefined);
          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var itemLabel = item;
            
            if (typeof item === "object" && item !== null && item.label) {
              itemLabel = item.label;
            }
            
            dropdown.add("item", itemLabel);
          }
          dropdown.selection = 0;
          dropdown.preferredSize.width = 150;
          dropdown.enabled = checkbox.value;
          
          checkbox.onClick = function() {
            dropdown.enabled = checkbox.value;
          };
          
          return { checkbox: checkbox, dropdown: dropdown };
        }
        
        // Ajout des options dans l'onglet Corrections
        var cbMoveNotes = addCheckboxOption(tabCorrections, "Déplacer les appels de notes de bas de page", true);
        var cbEllipsis = addCheckboxOption(tabCorrections, "Convertir ... en points de suspension (…)", true);
        var cbReplaceApostrophes = addCheckboxOption(tabCorrections, "Remplacer les apostrophes droites par les apostrophes typographiques", true);
        var cbDashes = addCheckboxOption(tabCorrections, "Remplacer les tirets cadratin par des tirets demi-cadratin", true);
        var cbFixIsolatedHyphens = addCheckboxOption(tabCorrections, "Transformer les tirets isolés en tirets demi-cadratin", true);
        var cbFixValueRanges = addCheckboxOption(tabCorrections, "Transformer les tirets en tirets demi-cadratin dans les intervalles de valeurs", true);
        
        // Ajout des options dans l'onglet Espaces et retours
        var fixTypoSpacesOpt = addDropdownOption(tabSpaces, "Corriger les espaces typographiques :", CONFIG.SPACE_TYPES, true);
        var fixDashIncisesOpt = addDropdownOption(tabSpaces, "Corriger les espaces des – incises – :", CONFIG.SPACE_TYPES, false);
          fixDashIncisesOpt.dropdown.selection = 1; // Par défaut, sélectionner "Espace insécable (~S)"
        var cbFixSpaces = addCheckboxOption(tabSpaces, "Corriger les espaces multiples", true);
        var cbDoubleReturns = addCheckboxOption(tabSpaces, "Supprimer les doubles retours à la ligne", true);
        var cbRemoveSpacesBeforePunctuation = addCheckboxOption(tabSpaces, "Supprimer les espaces avant les points, virgules et notes", true);
        var cbRemoveSpacesStartParagraph = addCheckboxOption(tabSpaces, "Supprimer les espaces en début de paragraphe", true);
        var cbRemoveSpacesEndParagraph = addCheckboxOption(tabSpaces, "Supprimer les espaces en fin de paragraphe", true);
        var cbRemoveTabs = addCheckboxOption(tabSpaces, "Supprimer les tabulations", true);
        var cbFormatEspaces = addCheckboxOption(tabSpaces, "Ajouter espaces insécables dans les références de page (p. 54)", true);
        
        // Ajout des options de style dans l'onglet Styles
        // Section pour la définition des styles
        var styleDefinitionPanel = tabStyle.add("panel", undefined, "Définition des styles");
        styleDefinitionPanel.orientation = "column";
        styleDefinitionPanel.alignChildren = "left";
        
        // Styles pour notes, italique et SieclesModule dans le panneau de définition des styles
        var noteStyleOpt = addDropdownOption(styleDefinitionPanel, "Appels de notes:", characterStyles, true);
        var cbItalicStyle = addDropdownOption(styleDefinitionPanel, "Italique:", characterStyles, true);
        var romainsStyleOpt = addDropdownOption(styleDefinitionPanel, "Petites capitales:", characterStyles, true);
        var romainsMajStyleOpt = addDropdownOption(styleDefinitionPanel, "Capitales:", characterStyles, true);
        var exposantOrdinalStyleOpt = addDropdownOption(styleDefinitionPanel, "Exposants:", characterStyles, true);
        
        // Sélection des styles par défaut
        if (noteStyleIndex >= 0 && noteStyleIndex < noteStyleOpt.dropdown.items.length) {
          noteStyleOpt.dropdown.selection = noteStyleIndex;
        }
        
        if (italicStyleIndex >= 0 && italicStyleIndex < cbItalicStyle.dropdown.items.length) {
          cbItalicStyle.dropdown.selection = italicStyleIndex;
        }
        
        // Rechercher les styles par défaut pour SieclesModule
        var defaultIndicesSiecles = SieclesModule.trouverStylesParDefaut(characterStyles);
        
        // Sélectionner les styles par défaut si trouvés
        if (defaultIndicesSiecles.petitesCapitales >= 0) {
          romainsStyleOpt.dropdown.selection = defaultIndicesSiecles.petitesCapitales;
          romainsStyleOpt.checkbox.value = true;
        } else {
          romainsStyleOpt.checkbox.value = false;
          romainsStyleOpt.dropdown.enabled = false;
        }
        
        if (defaultIndicesSiecles.capitales >= 0) {
          romainsMajStyleOpt.dropdown.selection = defaultIndicesSiecles.capitales;
          romainsMajStyleOpt.checkbox.value = true;
        } else {
          romainsMajStyleOpt.checkbox.value = false;
          romainsMajStyleOpt.dropdown.enabled = false;
        }
        
        if (defaultIndicesSiecles.exposant >= 0) {
          exposantOrdinalStyleOpt.dropdown.selection = defaultIndicesSiecles.exposant;
          exposantOrdinalStyleOpt.checkbox.value = true;
        } else if (noteStyleIndex >= 0) {
          // Utiliser le style d'exposant pour les notes si disponible
          exposantOrdinalStyleOpt.dropdown.selection = noteStyleIndex;
          exposantOrdinalStyleOpt.checkbox.value = true;
        } else {
          exposantOrdinalStyleOpt.checkbox.value = false;
          exposantOrdinalStyleOpt.dropdown.enabled = false;
        }
        
        // Garder des références aux cases à cocher des fonctionnalités
        var cbFormatSiecles = null;
        var cbFormatOrdinaux = null;
        var cbFormatReferences = null;
        var applyNoteStyleOpt = null;
        var applyItalicStyleOpt = null;
        var applyExposantStyleOpt = null;
        
        // Fonction qui met à jour l'état des fonctionnalités en fonction des styles disponibles
        function updateFeatureDependencies() {
          // --- Dépendances pour "Formater les siècles (XIVe siècle)" ---
          // Nécessite: Petites capitales + Exposant
          if (cbFormatSiecles) {
            var canFormatSiecles = romainsStyleOpt.checkbox.value && exposantOrdinalStyleOpt.checkbox.value;
            cbFormatSiecles.enabled = canFormatSiecles;
            
            if (!canFormatSiecles) {
              cbFormatSiecles.value = false;
            }
          }
          
          // --- Dépendances pour "Formater les expressions ordinales (IIe Internationale)" ---
          // Nécessite: Capitales + Exposant
          if (cbFormatOrdinaux) {
            var canFormatOrdinaux = romainsMajStyleOpt.checkbox.value && exposantOrdinalStyleOpt.checkbox.value;
            cbFormatOrdinaux.enabled = canFormatOrdinaux;
            
            if (!canFormatOrdinaux) {
              cbFormatOrdinaux.value = false;
            }
          }
          
          // --- Dépendances pour "Formater titres d'œuvres et noms propres (Tome III, Louis XIV)" ---
          // Nécessite: Capitales + Exposant (pour les cas comme "Louis Ier")
          if (cbFormatReferences) {
            var canFormatReferences = romainsMajStyleOpt.checkbox.value && exposantOrdinalStyleOpt.checkbox.value;
            cbFormatReferences.enabled = canFormatReferences;
            
            if (!canFormatReferences) {
              cbFormatReferences.value = false;
            }
          }
          
          // --- Dépendance pour "Appliquer un style aux références de notes" ---
          // Nécessite: Style d'appel de notes disponible
          if (applyNoteStyleOpt) {
            var canApplyNoteStyle = noteStyleOpt.checkbox.value;
            applyNoteStyleOpt.enabled = canApplyNoteStyle;
            
            if (!canApplyNoteStyle) {
              applyNoteStyleOpt.value = false;
            }
          }
          
          // --- Dépendance pour "Appliquer un style au texte en italique" ---
          // Nécessite: Style italique disponible
          if (applyItalicStyleOpt) {
            var canApplyItalicStyle = cbItalicStyle.checkbox.value;
            applyItalicStyleOpt.enabled = canApplyItalicStyle;
            
            if (!canApplyItalicStyle) {
              applyItalicStyleOpt.value = false;
            }
          }
          
          // --- Dépendance pour "Appliquer un style au texte en exposant" ---
          // Nécessite: Style d'exposant disponible
          if (applyExposantStyleOpt) {
            var canApplyExposantStyle = exposantOrdinalStyleOpt.checkbox.value;
            applyExposantStyleOpt.enabled = canApplyExposantStyle;
            
            if (!canApplyExposantStyle) {
              applyExposantStyleOpt.value = false;
            }
          }
        }
        
        // Ajouter des écouteurs d'événements pour toutes les cases à cocher de style
        romainsStyleOpt.checkbox.onClick = function() {
          romainsStyleOpt.dropdown.enabled = romainsStyleOpt.checkbox.value;
          updateFeatureDependencies();
        };
        
        romainsMajStyleOpt.checkbox.onClick = function() {
          romainsMajStyleOpt.dropdown.enabled = romainsMajStyleOpt.checkbox.value;
          updateFeatureDependencies();
        };
        
        exposantOrdinalStyleOpt.checkbox.onClick = function() {
          exposantOrdinalStyleOpt.dropdown.enabled = exposantOrdinalStyleOpt.checkbox.value;
          updateFeatureDependencies();
        };
        
        noteStyleOpt.checkbox.onClick = function() {
          noteStyleOpt.dropdown.enabled = noteStyleOpt.checkbox.value;
          updateFeatureDependencies();
        };
        
        cbItalicStyle.checkbox.onClick = function() {
          cbItalicStyle.dropdown.enabled = cbItalicStyle.checkbox.value;
          updateFeatureDependencies();
        };
        
        exposantOrdinalStyleOpt.checkbox.onClick = function() {
          exposantOrdinalStyleOpt.dropdown.enabled = exposantOrdinalStyleOpt.checkbox.value;
          updateFeatureDependencies();
        };
        
        // Ajouter un peu d'espace entre les sections
        tabStyle.add("statictext", undefined, "");
        
        // Section pour l'application des styles
        var styleApplicationPanel = tabStyle.add("panel", undefined, "Application des styles");
        styleApplicationPanel.orientation = "column";
        styleApplicationPanel.alignChildren = "left";
        
        // Options d'application de style (séparées des définitions de style)
        applyNoteStyleOpt = addCheckboxOption(styleApplicationPanel, "Appliquer un style aux appels de notes", true);
        applyItalicStyleOpt = addCheckboxOption(styleApplicationPanel, "Appliquer un style au texte en italique", true);
        applyExposantStyleOpt = addCheckboxOption(styleApplicationPanel, "Appliquer un style au texte en exposant", true);
        // Appliquer immédiatement les dépendances
        updateFeatureDependencies();
        
        // Ajout des options dans l'onglet Formatages (sans les options déplacées)
        // Options du module SieclesModule (restent dans l'onglet Formatages)
        var cbFormatSiecles = addCheckboxOption(tabOther, "Formater les siècles (XIVe siècle)", true);
        var cbFormatOrdinaux = addCheckboxOption(tabOther, "Formater les expressions ordinales (IIe Internationale)", true);
        var cbFormatReferences = addCheckboxOption(tabOther, "Formater parties d'œuvres et noms propres (Tome III, Louis XIV)", true);
        // Appliquer immédiatement les dépendances
        updateFeatureDependencies();
        
        // Ajout des options pour le formatage des nombres
        var cbFormatNumbers = addCheckboxOption(tabOther, "Formater les nombres", true);
        var numberSettingsPanel = tabOther.add("panel", undefined, "Options de formatage des nombres");
        numberSettingsPanel.orientation = "column";
        numberSettingsPanel.alignChildren = "left";
        numberSettingsPanel.enabled = cbFormatNumbers.value;
        
        var cbAddSpaces = addCheckboxOption(numberSettingsPanel, "Ajouter des espaces entre les milliers (12345 → 12 345)", true);
        var cbExcludeYears = addCheckboxOption(numberSettingsPanel, "Exclure les années potentielles (nombres entre 0 et 2050)", true);
        var cbUseComma = addCheckboxOption(numberSettingsPanel, "Remplacer les points par des virgules (3.14 → 3,14)", true);
        
        // Activer/désactiver le panneau d'options selon l'état de la case à cocher principale
        cbFormatNumbers.onClick = function() {
          numberSettingsPanel.enabled = cbFormatNumbers.value;
        };
        
        // Ajout des options dans le nouvel onglet Styles de paragraphe
        var cbEnableStyleAfter = addCheckboxOption(tabStyles, "Application conditionnelle de styles", true);
        
        // Récupérer les styles de paragraphe du document actif
        var doc = app.activeDocument;
        var allParaStyles = [];
        var paraStyleNames = [];
        
        try {
          // Fonction récursive pour collecter les styles
          function collectParagraphStyles(group) {
            var styles = [];
            
            try {
              if (group && group.paragraphStyles) {
                for (var i = 0; i < group.paragraphStyles.length; i++) {
                  var style = group.paragraphStyles[i];
                  if (style && style.name && !style.name.match(/^\[/)) {
                    styles.push(style);
                  }
                }
              }
              
              if (group && group.paragraphStyleGroups) {
                for (var j = 0; j < group.paragraphStyleGroups.length; j++) {
                  var subgroup = group.paragraphStyleGroups[j];
                  if (subgroup) {
                    styles = styles.concat(collectParagraphStyles(subgroup));
                  }
                }
              }
            } catch (e) {
              // Ignorer les erreurs silencieusement
            }
            
            return styles;
          }
          
          allParaStyles = collectParagraphStyles(doc);
          
          for (var i = 0; i < allParaStyles.length; i++) {
            paraStyleNames.push(allParaStyles[i].name);
          }
        } catch (e) {
          paraStyleNames = ["[Aucun style disponible]"];
          allParaStyles = [];
        }
        
        // Vérifier qu'il y a des styles de paragraphe
        if (paraStyleNames.length === 0) {
          paraStyleNames = ["[Aucun style disponible]"];
        }
        
        // Créer le panneau des styles déclencheurs
        var styleGroupPanel = tabStyles.add("panel", undefined, "Styles déclencheurs (sélection multiple)");
        styleGroupPanel.orientation = "column";
        styleGroupPanel.alignChildren = "left";
        styleGroupPanel.maximumSize.height = 200;
        styleGroupPanel.minimumSize.height = 150;
        
        // Ajouter un groupe déroulant pour les styles
        var scrollGroup = styleGroupPanel.add("group");
        scrollGroup.orientation = "column";
        scrollGroup.alignChildren = "left";
        scrollGroup.maximumSize.height = 180;
        
        // Créer les cases à cocher pour les styles déclencheurs
        var triggerCheckboxes = [];
        for (var i = 0; i < paraStyleNames.length; i++) {
          var cb = scrollGroup.add("checkbox", undefined, paraStyleNames[i]);
          triggerCheckboxes.push(cb);
          
          // Par défaut, tous les styles sont cochés sauf "Body text" et "First paragraph"
          if (paraStyleNames[i] === "Body text" || paraStyleNames[i] === "First paragraph") {
            cb.value = false;
          } else {
            cb.value = true;
          }
        }
        
        // Option pour le style cible
        var targetStyleGroup = tabStyles.add("group");
        targetStyleGroup.orientation = "row";
        targetStyleGroup.alignChildren = "center";
        targetStyleGroup.add("statictext", undefined, "Style à appliquer au paragraphe suivant :");
        var targetStyleDropdown = targetStyleGroup.add("dropdownlist", undefined, paraStyleNames);
        targetStyleDropdown.preferredSize.width = 150;
        
        // Sélectionner "First paragraph" par défaut s'il existe
        var firstParaIndex = -1;
        for (var i = 0; i < paraStyleNames.length; i++) {
          if (paraStyleNames[i] === "First paragraph") {
            firstParaIndex = i;
            break;
          }
        }
        
        if (firstParaIndex !== -1) {
          targetStyleDropdown.selection = firstParaIndex;
        } else if (paraStyleNames.length > 0) {
          targetStyleDropdown.selection = 0;
        }
        
        // Option pour appliquer un gabarit à la dernière page
        var cbApplyMasterToLastPage = addCheckboxOption(tabStyles, "Appliquer un gabarit à la dernière page en vis-à-vis", true);
        
        // Récupérer les gabarits du document
        var masterNames = [];
        var allMasters = [];
        
        try {
          if (ErrorHandler.ensureDefined(doc.masterSpreads, "doc.masterSpreads", false)) {
            for (var i = 0; i < doc.masterSpreads.length; i++) {
              var master = doc.masterSpreads[i];
              if (ErrorHandler.ensureDefined(master, "master à l'index " + i, false) && 
                ErrorHandler.ensureDefined(master.name, "master.name à l'index " + i, false)) {
                masterNames.push(master.name);
                allMasters.push(master);
              }
            }
          }
        } catch (e) {
          masterNames = ["[Aucun gabarit disponible]"];
          allMasters = [];
        }
        
        // Si aucun gabarit n'est disponible, désactiver l'option
        if (masterNames.length === 0) {
          masterNames = ["[Aucun gabarit disponible]"];
          cbApplyMasterToLastPage.enabled = false;
        }
        
        // Menu déroulant pour sélectionner le gabarit
        var masterGroup = tabStyles.add("group");
        masterGroup.orientation = "row";
        masterGroup.alignChildren = "center";
        masterGroup.add("statictext", undefined, "Gabarit à appliquer :");
        var masterDropdown = masterGroup.add("dropdownlist", undefined, masterNames);
        masterDropdown.preferredSize.width = 150;
        masterDropdown.enabled = cbApplyMasterToLastPage.value;
        
        // Activer/désactiver le menu déroulant selon la case à cocher
        cbApplyMasterToLastPage.onClick = function() {
          masterDropdown.enabled = cbApplyMasterToLastPage.value;
        };
        
        // Sélectionner le premier gabarit par défaut
        if (masterNames.length > 0) {
          masterDropdown.selection = 0;
        }
        
        // Section de portée
        var scopePanel = dialog.add("panel", undefined, "Portée d'application");
        scopePanel.orientation = "row";
        scopePanel.alignChildren = "left";
        scopePanel.margins = 20;
        
        var rbActiveDoc = scopePanel.add("radiobutton", undefined, "Document actif");
        var rbAllDocs = scopePanel.add("radiobutton", undefined, "Tous les documents ouverts");
        rbActiveDoc.value = true;
        
        // Boutons d'action
        var buttonGroup = dialog.add("group");
        buttonGroup.orientation = "row";
        buttonGroup.alignment = "right";
        
        // Ajouter un bouton d'aide
        var helpButton = buttonGroup.add("button", undefined, "?");
        helpButton.preferredSize.width = 25; // Mini bouton
        helpButton.preferredSize.height = 25;
        helpButton.helpTip = "Afficher l'aide de SuperScript";
        
        var cancelButton = buttonGroup.add("button", undefined, "Annuler", {name: "cancel"});
        var okButton = buttonGroup.add("button", undefined, "Appliquer", {name: "ok"});
        
        // Fonction pour afficher la fenêtre d'aide
        helpButton.onClick = function() {
          // Créer une nouvelle boîte de dialogue pour l'aide
          var helpDialog = new Window("dialog", "Aide de SuperScript");
          helpDialog.orientation = "column";
          helpDialog.alignChildren = "fill";
          helpDialog.preferredSize.width = 500;
          helpDialog.preferredSize.height = 400;
          
          // Ajouter un groupe pour le logo/bannière
          var helpHeaderGroup = helpDialog.add("group");
          helpHeaderGroup.alignment = "center";
          helpHeaderGroup.add("statictext", undefined, "SuperScript - Guide d'utilisation");
          
          // Ajouter une zone de texte avec une barre de défilement
          var helpText = helpDialog.add("edittext", undefined, "", {multiline: true, readonly: true, scrollable: true});
          helpText.preferredSize.height = 300;
          
          // Texte d'aide à afficher
          var helpContent = "GUIDE D'UTILISATION DE SUPERSCRIPT\n\n";
          helpContent += "PRÉSENTATION\n\n";
          helpContent += "SuperScript est un script pour InDesign qui automatise les corrections typographiques dans les documents de mise en page. Il permet de corriger rapidement les espaces, les ponctuations, les guillemets, les apostrophes, etc.\n\n";
          helpContent += "ONGLET \"ESPACES ET RETOURS\"\n\n";
          helpContent += "• Corriger les espaces typographiques : Ajoute des espaces fines insécables ou des espaces insécables avant ou après certains caractères selon les règles typographiques françaises.\n";
          helpContent += "• Corriger les espaces multiples : Remplace les séquences d'espaces par une seule espace.\n";
          helpContent += "• Supprimer les doubles retours : Élimine les paragraphes vides.\n";
          helpContent += "• Supprimer les espaces avant les points, virgules et notes : Retire les espaces indésirables.\n\n";
          helpContent += "ONGLET \"STYLES\"\n\n";
          helpContent += "• Définition des styles : Sélectionnez les styles à utiliser pour mettre en forme les appels de notes, le texte en italique et les exposants.\n";
          helpContent += "• Application des styles : Activez les options pour appliquer automatiquement ces styles.\n\n";
          helpContent += "ONGLET \"FORMATAGES\"\n\n";
          helpContent += "• Déplacer les appels de notes : Place les notes avant la ponctuation.\n";
          helpContent += "• Remplacer les tirets cadratin : Convertit les tirets cadratin en tirets demi-cadratin.\n";
          helpContent += "• Convertir ... en points de suspension : Remplace trois points par le caractère typographique correspondant.\n";
          helpContent += "• Remplacer les apostrophes droites : Utilise des apostrophes typographiques.\n";
          helpContent += "• Formatage des siècles, ordinaux et références : Options pour la mise en forme des chiffres romains.\n\n";
          helpContent += "ONGLET \"MISE EN PAGE\"\n\n";
          helpContent += "• Application conditionnelle de styles : Applique automatiquement un style au paragraphe qui suit les styles sélectionnés.\n";
          helpContent += "• Appliquer un gabarit à la dernière page : Utile pour la fin des chapitres ou des documents.\n\n";
          helpContent += "PORTÉE D'APPLICATION\n\n";
          helpContent += "• Document actif : Applique les corrections uniquement au document ouvert actuellement.\n";
          helpContent += "• Tous les documents ouverts : Applique les corrections à tous les documents ouverts dans InDesign.\n\n";
          helpContent += "Pour plus d'informations, visitez notre site web : https://lab.spectral.art";
          
          // Appliquer le texte d'aide
          helpText.text = helpContent;
          
          // Bouton pour fermer l'aide
          var closeButton = helpDialog.add("button", undefined, "Fermer", {name: "ok"});
          closeButton.alignment = "center";
          
          // Afficher la boîte de dialogue d'aide
          helpDialog.show();
        };
        
        // Événement du bouton Annuler
        cancelButton.onClick = function() {
          dialog.close(2);
        };
        
        // Afficher le dialogue et renvoyer les résultats
        if (dialog.show() == 1) {
          try {
            // Collecter les styles déclencheurs sélectionnés
            var selectedTriggerStyles = [];
            if (allParaStyles.length > 0) {
              for (var i = 0; i < triggerCheckboxes.length; i++) {
                if (triggerCheckboxes[i].value) {
                  selectedTriggerStyles.push(allParaStyles[i]);
                }
              }
            }
            
            // Récupérer les options du module SieclesModule
            var sieclesOptions = {
              formaterSiecles: cbFormatSiecles.value,
              formaterOrdinaux: cbFormatOrdinaux.value,
              formaterReferences: cbFormatReferences.value,
              formaterEspaces: cbFormatEspaces.value,
              romainsStyle: romainsStyleOpt.checkbox.value ? 
                doc.characterStyles[romainsStyleOpt.dropdown.selection.index] : null,
              romainsMajStyle: romainsMajStyleOpt.checkbox.value ? 
                doc.characterStyles[romainsMajStyleOpt.dropdown.selection.index] : null,
              exposantStyle: exposantOrdinalStyleOpt.checkbox.value ? 
                doc.characterStyles[exposantOrdinalStyleOpt.dropdown.selection.index] : null
            };
            
            // Renvoyer les sélections de l'utilisateur
            return {
              removeSpacesBeforePunctuation: cbRemoveSpacesBeforePunctuation.value,
              moveNotes: cbMoveNotes.value,
              applyNoteStyle: applyNoteStyleOpt.value && noteStyleOpt.checkbox.value,
              noteStyleName: applyNoteStyleOpt.value && noteStyleOpt.checkbox.value && noteStyleOpt.dropdown.selection ? 
                noteStyleOpt.dropdown.selection.text : null,
              fixDoubleSpaces: cbFixSpaces.value,
              fixTypoSpaces: fixTypoSpacesOpt.checkbox.value,
              spaceType: fixTypoSpacesOpt.checkbox.value && fixTypoSpacesOpt.dropdown.selection ? 
                CONFIG.SPACE_TYPES[fixTypoSpacesOpt.dropdown.selection.index].value : null,
              fixDashIncises: fixDashIncisesOpt.checkbox.value,
              dashIncisesSpaceType: fixDashIncisesOpt.checkbox.value && fixDashIncisesOpt.dropdown.selection ? 
                  CONFIG.SPACE_TYPES[fixDashIncisesOpt.dropdown.selection.index].value : null,
              replaceDashes: cbDashes.value,
              applyItalicStyle: applyItalicStyleOpt.value && cbItalicStyle.checkbox.value,
              italicStyleName: applyItalicStyleOpt.value && cbItalicStyle.checkbox.value && cbItalicStyle.dropdown.selection ? 
                cbItalicStyle.dropdown.selection.text : null,
              applyExposantStyle: applyExposantStyleOpt.value && exposantOrdinalStyleOpt.checkbox.value,
              exposantStyleName: applyExposantStyleOpt.value && exposantOrdinalStyleOpt.checkbox.value && exposantOrdinalStyleOpt.dropdown.selection ? 
                exposantOrdinalStyleOpt.dropdown.selection.text : null,
              removeDoubleReturns: cbDoubleReturns.value,
              convertEllipsis: cbEllipsis.value,
              replaceApostrophes: cbReplaceApostrophes.value,
              fixIsolatedHyphens: cbFixIsolatedHyphens.value,
              fixValueRanges: cbFixValueRanges.value,
              removeSpacesStartParagraph: cbRemoveSpacesStartParagraph.value,
              removeSpacesEndParagraph: cbRemoveSpacesEndParagraph.value,
              removeTabs: cbRemoveTabs.value,
              
              // Nouvelles options pour les styles
              enableStyleAfter: cbEnableStyleAfter.value,
              triggerStyles: selectedTriggerStyles,
              targetStyle: targetStyleDropdown.selection && allParaStyles.length > 0 ? 
                allParaStyles[targetStyleDropdown.selection.index] : null,
                
              applyMasterToLastPage: cbApplyMasterToLastPage.value,
              selectedMaster: masterDropdown.selection && allMasters.length > 0 ? 
                allMasters[masterDropdown.selection.index] : null,
              
              // Options pour le module SieclesModule
              sieclesOptions: sieclesOptions,
              
              applyToAllDocs: rbAllDocs.value,
              
              // Options pour le formatage des nombres
              formatNumbers: cbFormatNumbers.value,
              addSpaces: cbAddSpaces.value,
              excludeYears: cbExcludeYears.value,
              useComma: cbUseComma.value
              
            };
          } catch (resultError) {
            ErrorHandler.handleError(resultError, "récupération des résultats du dialogue", true);
            return null;
          }
        }
        
        return null;
        } catch (error) {
          ErrorHandler.handleError(error, "createDialog", true);
          return null;
        }
      }
    };
    
    /**
     * Processeur principal pour appliquer les corrections
     * @private
     */
    var Processor = {
      /**
        * Applique les corrections sélectionnées à un document
        * @param {Document} doc - Document InDesign
        * @param {Object} options - Options de correction
        */
      applyCorrections: function(doc, options) {
          try {
              if (!ErrorHandler.ensureDefined(doc, "document", true)) return;
              if (!ErrorHandler.ensureDefined(options, "options", true)) return;
              if (!ErrorHandler.ensureDefined(app, "app", true)) return;
              if (!ErrorHandler.ensureDefined(app.scriptPreferences, "app.scriptPreferences", false)) {
                  // Continuer sans modifier le redessinage si non disponible
              } else {
                  // Désactiver le redessinage pour de meilleures performances
                  app.scriptPreferences.enableRedraw = false;
              }
              
              // Créer la barre de progression
              ProgressBar.create("Application des corrections typographiques", 16);
              
              try {
                  // Compteur de progression
                  var progress = 0;
                  
                  // Corrections d'espaces et retours
                  if (options.removeSpacesBeforePunctuation) {
                      ProgressBar.update(++progress, "Suppression des espaces avant ponctuation...");
                      Corrections.removeSpacesBeforePunctuation(doc);
                  }
                  
                  if (options.fixDoubleSpaces) {
                      ProgressBar.update(++progress, "Correction des doubles espaces...");
                      Corrections.fixDoubleSpaces(doc);
                  }
                  
                  if (options.fixTypoSpaces && options.spaceType) {
                      ProgressBar.update(++progress, "Correction des espaces typographiques...");
                      Corrections.fixTypoSpaces(doc, options.spaceType);
                  }
                  
                  if (options.fixDashIncises && options.dashIncisesSpaceType) {
                      ProgressBar.update(++progress, "Correction des espaces autour des incises...");
                      Corrections.fixDashIncises(doc, options.dashIncisesSpaceType);
                  }
                  
                  if (options.removeDoubleReturns) {
                      ProgressBar.update(++progress, "Suppression des doubles retours...");
                      Corrections.removeDoubleReturns(doc);
                  }
                  
                  if (options.removeSpacesStartParagraph) {
                      ProgressBar.update(++progress, "Suppression des espaces en début de paragraphe...");
                      Corrections.removeSpacesStartParagraph(doc);
                  }
                  
                  if (options.removeSpacesEndParagraph) {
                      ProgressBar.update(++progress, "Suppression des espaces en fin de paragraphe...");
                      Corrections.removeSpacesEndParagraph(doc);
                  }
                  
                  if (options.removeTabs) {
                      ProgressBar.update(++progress, "Suppression des tabulations...");
                      Corrections.removeTabs(doc);
                  }
                  
                  // Autres corrections
                  if (options.moveNotes) {
                      ProgressBar.update(++progress, "Déplacement des notes de bas de page...");
                      Corrections.moveNotes(doc);
                  }
                  
                  if (options.applyNoteStyle && options.noteStyleName) {
                      ProgressBar.update(++progress, "Application du style aux notes de bas de page...");
                      Corrections.applyNoteStyle(doc, options.noteStyleName);
                  }
                  
                  if (options.replaceDashes) {
                      ProgressBar.update(++progress, "Remplacement des tirets cadratin...");
                      Corrections.replaceDashes(doc);
                  }
                  
                  if (options.fixIsolatedHyphens) {
                      ProgressBar.update(++progress, "Correction des tirets isolés...");
                      Corrections.fixIsolatedHyphens(doc);
                  }
                  
                  if (options.fixValueRanges) {
                      ProgressBar.update(++progress, "Correction des intervalles de valeurs...");
                      Corrections.fixValueRanges(doc);
                  }
                  
                  if (options.applyItalicStyle && options.italicStyleName) {
                      ProgressBar.update(++progress, "Application du style italique...");
                      Corrections.applyItalicStyle(doc, options.italicStyleName);
                  }
                  
                  if (options.applyExposantStyle && options.exposantStyleName) {
                      ProgressBar.update(++progress, "Application du style aux exposants...");
                      Corrections.applyExposantStyle(doc, options.exposantStyleName);
                  }
                  
                  if (options.convertEllipsis) {
                      ProgressBar.update(++progress, "Conversion des points de suspension...");
                      Corrections.convertEllipsis(doc);
                  }
                  
                  if (options.replaceApostrophes) {
                      ProgressBar.update(++progress, "Remplacement des apostrophes...");
                      Corrections.replaceApostrophes(doc);
                  }
                  
                  // Nouvelle correction : application de style après déclencheurs
                  if (options.enableStyleAfter && 
                      options.triggerStyles && 
                      options.triggerStyles.length > 0 && 
                      options.targetStyle) {
                      ProgressBar.update(++progress, "Application des styles conditionnels...");
                      Corrections.applyStyleAfterTriggers(doc, options.triggerStyles, options.targetStyle);
                  }
                  
                  // Application du gabarit à la dernière page
                  if (options.applyMasterToLastPage && options.selectedMaster) {
                      ProgressBar.update(++progress, "Application du gabarit à la dernière page...");
                      // Stocker le nom du gabarit plutôt que l'objet gabarit lui-même
                      var masterName = options.selectedMaster.name;
                      
                      // Appliquer en utilisant le nom du gabarit
                      applyMasterToLastPageStandalone(doc, masterName);
                  }
                  
                  // Intégration du module SieclesModule
                  if (options.sieclesOptions && 
                      (options.sieclesOptions.formaterSiecles || 
                       options.sieclesOptions.formaterOrdinaux || 
                       options.sieclesOptions.formaterReferences || 
                       options.sieclesOptions.formaterEspaces)) {
                      
                      ProgressBar.update(++progress, "Formatage des siècles et expressions ordinales...");
                      
                      // Appliquer les corrections du module SieclesModule
                      SieclesModule.processDocument(doc, options.sieclesOptions);
                  }
                  
                  // Traitement du formatage des nombres
                  if (options.formatNumbers) {
                      ProgressBar.update(++progress, "Formatage des nombres...");
                      Corrections.formatNumbers(doc, options.addSpaces, options.useComma, options.excludeYears);
                  }
                  
                  // Finalisation
                  ProgressBar.update(12, "Terminé !");
                  
              } catch (correctionsError) {
                  ErrorHandler.handleError(correctionsError, "application des corrections", false);
              } finally {
                  // Fermer la barre de progression
                  ProgressBar.close();
                  
                  // Réinitialiser les préférences
                  Utilities.resetPreferences();
                  
                  // Réactiver le redessinage
                  if (ErrorHandler.ensureDefined(app, "app", false) && 
                      ErrorHandler.ensureDefined(app.scriptPreferences, "app.scriptPreferences", false)) {
                      app.scriptPreferences.enableRedraw = true;
                  }
              }
          } catch (error) {
              ErrorHandler.handleError(error, "applyCorrections", true);
          }
      },
      
      /**
        * Traite les documents en fonction des options de l'utilisateur
        * @param {Object} options - Options sélectionnées par l'utilisateur
        */
      processDocuments: function(options) {
          try {
              if (!ErrorHandler.ensureDefined(options, "options", true)) return;
              if (!ErrorHandler.ensureDefined(app, "app", true)) return;
              if (!ErrorHandler.ensureDefined(app.documents, "app.documents", true)) return;
              
              var successCount = 0;
              
              if (options.applyToAllDocs) {
                  // Tous les documents
                  var totalDocs = app.documents.length;
                  
                  // Créer une barre de progression pour plusieurs documents
                  if (totalDocs > 1) {
                      ProgressBar.create("Traitement des documents", totalDocs);
                  }
                  
                  for (var i = 0; i < totalDocs; i++) {
                      try {
                          var doc = app.documents[i];
                          
                          if (!ErrorHandler.ensureDefined(doc, "document à l'index " + i, false)) {
                              continue;
                          }
                          
                          // Mise à jour pour plusieurs documents
                          if (totalDocs > 1) {
                              ProgressBar.update(i + 1, "Traitement du document " + (i + 1) + " sur " + totalDocs);
                          }
                          
                          Processor.applyCorrections(doc, options);
                          successCount++;
                      } catch (docError) {
                          ErrorHandler.handleError(docError, "traitement du document " + i, false);
                          // Continuer avec le document suivant
                      }
                  }
                  
                  // Fermer la barre de progression de plusieurs documents
                  if (totalDocs > 1) {
                      ProgressBar.close();
                  }
                  
                  alert("Corrections appliquées à " + successCount + " document(s) sur " + totalDocs + ".");
              } else {
                  // Document actif uniquement
                  if (!ErrorHandler.ensureDefined(app.activeDocument, "app.activeDocument", true)) return;
                  
                  Processor.applyCorrections(app.activeDocument, options);
                  alert("Corrections appliquées au document actif.");
              }
          } catch (error) {
              // Fermer la barre de progression en cas d'erreur
              ProgressBar.close();
              ErrorHandler.handleError(error, "processDocuments", true);
          }
      }
    };
    
    /**
     * Module SieclesModule - Intégration isolée du script de formatage des siècles
     * @private
     */
    var SieclesModule = {
        /**
         * Configuration spécifique au formatage des siècles
         * Copiée directement du script original
         */
        CONFIG: {
            // Liste des mots pouvant être confondus avec des chiffres romains
            MOTS_AMBIGUS: [
                "vie", "ive", "xie", "ie"
            ],
            
            // Liste des mots à exclure des siècles mais à inclure pour les expressions ordinales
            MOTS_ORDINAUX: [
                // Événements institutionnels et politiques
                "congrès", "conférence", "sommet", "assemblée", "session", "convention", 
                "colloque", "forum", "séminaire", "symposium", "concile", "internationale",
                
                // Événements culturels et artistiques
                "festival", "biennale", "exposition", "salon", "rencontres", "journées", 
                "cérémonie", "gala", "édition", "triennale", "quadriennale",
                
                // Événements sportifs
                "jeux", "tournoi", "coupe", "championnat", "épreuve", "grand prix", "olympiade",
                "round", "manche", "tour",
                
                // Contexte militaire et administratif
                "régiment", "division", "corps", "brigade", "batterie", "compagnie", 
                "détachement", "unité", "légion", "escadron", "armée", "bataillon", "flotte",
                "escadre", "flottille", "peloton", "section", "force", "contingent",
                
                // Géographie administrative
                "arrondissement", "canton", "circonscription", "section", "district", 
                "région", "zone", "département", "préfecture", "sous-préfecture", "quartier",
                "communauté", "collectivité", "subdivision",
                
                // Histoire et chronologie
                "dynastie", "règne", "époque", "ère", "période", "âge", "millénaire",
                
                // Littérature, théâtre, édition
                "tome", "volume", "acte", "scène", "chant", "livre", "partie", "section", 
                "chapitre", "paragraphe", "alinéa", "titre", "sous-section", "annexe", 
                "appendice", "supplément", "bulletin", "rapport", "numéro",
                
                // Administration et gouvernement
                "ministère", "secrétariat", "commission", "conseil", "comité", "état",
                "mandat", "législature", "administration", "chambre", "cour", "tribunal",
                "article", "amendement", "lecture",
                
                // Éducation
                "année", "classe", "promotion", "cycle", "semestre", "trimestre", "examen",
                "diplôme",
                
                // Structures et groupes
                "groupe", "collectif",
                
                // Temporels
                "trimestre", "semestre", "décennie", "vague",
                
                // Ordres et classements
                "rang", "position", "place", "catégorie", "échelon", "niveau", "grade",
                "stade", "série", "classe", "division",
                
                // Événements séquentiels
                "tentative", "essai", "phase", "étape", "version", "itération", "mouvement",
                
                // Autres cas officiels ou institutionnels
                "plan", "phase", "république", "empire", "ordre", "reich", "dimension",
                "degré", "position", "génération", "base", "volet", "pilier", "concept",
                "principe", "type", "forme", "paradigme"
            ],
            
            // Liste des mots à exclure avant le chiffre romain
            MOTS_AVANT_ORDINAUX: [
                "an", "année", "jour", "mois", "semaine", "trimestre", "semestre",
                "numéro", "n°", "article", "alinéa", "paragraphe", "chapitre",
                "niveau", "groupe", "classe", "étage", "zone", "secteur", "district",
                "bataillon", "régiment", "division", "brigade", "compagnie", "escadron",
                "tome", "volume", "partie", "phase", "étape", "session", "version"
            ],
            
            // Liste des mots désignant des parties d'œuvres
            MOTS_OEUVRES: [
                "livre", "tome", "volume", "chapitre", "partie", "section", "acte", 
                "scène", "chant", "symphonie", "concerto", "sonate", "opus", 
                "épisode", "volet", "cycle", "saison"
            ],
            
            // Liste des titres de personnes
            TITRES_PERSONNES: [
                "louis", "henri", "élisabeth", "charles", "napoléon", "hadrien", 
                "frédéric", "jean-paul", "benoît", "clément", "pie", "léon"
            ],
            
            // Liste des noms qui devraient être suivis de "Ier"
            NOMS_PREMIER: [
                // Monarques
                "louis", "charles", "françois", "henri", "philippe", "frédéric",
                "napoléon", "nicolas", "alexandre", "léopold", "victor", "ferdinand",
                "édouard", "georges", "wilhelm", "michel", "constantin", "jacques",
                "jean", "pierre", "robert", "albert", "richard", "maximilien",
                
                // Papes et religieux
                "pie", "grégoire", "léon", "benoît", "clément", "innocent", 
                "urbain", "jean-paul", "boniface", "sixte", "paul", "célestin",
                
                // Titres génériques
                "roi", "empereur", "tsar", "pape", "président", "prince",
                "duc", "comte", "baron"
            ],
            
            // Références bibliographiques
            ABREVIATIONS_REFS: [
                // Références aux pages
                "p\\.", "pp\\.", "page", "pages",
                // Références aux folios
                "f\\.", "ff\\.", "fol\\.", "folio", "folios",
                // Références aux colonnes
                "col\\.", "cols\\.",
                // Références aux paragraphes, lignes, sections
                "§", "¶", "l\\.", "ligne", "lignes", "sec\\.", "section", "sections",
                // Références aux chapitres
                "chap\\.", "chapitre", "chapitres",
                // Références aux figures, tableaux, illustrations
                "fig\\.", "figure", "figures", "tab\\.", "tableau", "tableaux", "ill\\.", "illustration",
                // Références à des documents
                "doc\\.", "document", "documents", "art\\.", "article", "articles", "app\\.", "appendice", "annexe"
            ],
            
            // Références à des tomes/volumes
            ABREVIATIONS_VOLUMES: [
                "vol\\.", "volume", "volumes", "t\\.", "tome", "tomes"
            ],
            
            // Références temporelles
            ABREVIATIONS_TEMPORELLES: [
                "c\\.", "ca\\.", "circa", "env\\.", "environ",
                "av\\. J\\.-C\\.", "apr\\. J\\.-C\\.", "J\\.-C\\."
            ],
            
            // Références aux numéros
            ABREVIATIONS_NUMEROS: [
                "n°", "n°s", "num\\.", "numéro", "numéros"
            ],
            
            // Unités de mesure
            UNITES_MESURE: [
                "km", "m", "cm", "mm", "µm", "nm", 
                "kg", "g", "mg", "µg",
                "l", "ml", "cl", "dl"
            ],
            
            // Références directionnelles
            ABREVIATIONS_DIRECTION: [
                "N\\.", "S\\.", "E\\.", "O\\.", "N\\.E\\.", "N\\.O\\.", "S\\.E\\.", "S\\.O\\."
            ],
            
            // Titres et appellations
            TITRES_APPELLATIONS: [
                "M\\.", "Mme", "Mlle", "MM\\.", "Mmes", "Mlles", "Dr", "Pr", "Me", "St", "Ste"
            ],
            
            // Styles par défaut
            STYLES_PETITES_CAPITALES: ["Small caps", "Small cap", "Small capitals", "Small capital", "Petites capitales", "Petites caps"],
            STYLES_CAPITALES: ["Large Capitals", "Capital", "Capitals"],
            STYLES_EXPOSANT: ["Superscript", "Exposant", "Superior"]
        },
        
        /**
         * Initialisation du module et création des options dans l'interface
         * @param {Window} tabOther - Onglet formatages du dialogue principal
         * @param {Array} characterStyles - Styles de caractère disponibles
         * @returns {Object} Contrôles créés pour l'onglet
         */
        initializeUI: function(tabOther, characterStyles) {
            var controls = {};
            
            // Ajouter un séparateur visuel
            var separatorGroup = tabOther.add("group");
            separatorGroup.alignment = "fill";
            var separator = separatorGroup.add("panel");
            separator.alignment = "fill";
            
            // Ajouter un titre pour la section
            var titleGroup = tabOther.add("group");
            titleGroup.orientation = "row";
            titleGroup.alignChildren = "left";
            titleGroup.add("statictext", undefined, "Formatage des siècles et expressions ordinales");
            
            // Option pour formater les siècles
            var cbFormatSiecles = UIBuilder.addCheckboxOption(tabOther, "Formater les siècles (XIVe siècle)", true);
            
            // Option pour formater les expressions ordinales
            var cbFormatOrdinaux = UIBuilder.addCheckboxOption(tabOther, "Formater les expressions ordinales (IIe Internationale)", true);
            
            // Option pour formater les parties d'œuvres
            var cbFormatReferences = UIBuilder.addCheckboxOption(tabOther, "Formater titres d'œuvres et noms propres (Tome III, Louis XIV)", true);
            
            // Option pour formater les espaces insécables
            var cbFormatEspaces = UIBuilder.addCheckboxOption(tabOther, "Ajouter espaces insécables dans les références (p. 54)", true);
            
            // Options pour les styles à utiliser
            var romainsStyleOpt = UIBuilder.addDropdownOption(tabOther, "Style pour chiffres romains en petites capitales:", characterStyles, true);
            var romainsMajStyleOpt = UIBuilder.addDropdownOption(tabOther, "Style pour chiffres romains en CAPITALES:", characterStyles, true);
            
            // Option spécifique pour le style d'exposant des ordinaux
            var exposantStyleOpt = UIBuilder.addDropdownOption(tabOther, "Style pour exposants des ordinaux (e, er):", characterStyles, true);
            
            // Rechercher les styles par défaut
            var defaultIndices = this.trouverStylesParDefaut(characterStyles);
            
            // Sélectionner les styles par défaut si trouvés
            if (defaultIndices.petitesCapitales > 0) {
                romainsStyleOpt.dropdown.selection = defaultIndices.petitesCapitales;
            }
            
            if (defaultIndices.capitales > 0) {
                romainsMajStyleOpt.dropdown.selection = defaultIndices.capitales;
            }
            
            // Sélectionner le style par défaut pour l'exposant si trouvé
            if (defaultIndices.exposant > 0) {
                exposantStyleOpt.dropdown.selection = defaultIndices.exposant;
            }
            
            // Stocker les contrôles pour les récupérer plus tard
            controls.formatSiecles = cbFormatSiecles;
            controls.formatOrdinaux = cbFormatOrdinaux;
            controls.formatReferences = cbFormatReferences;
            controls.formatEspaces = cbFormatEspaces;
            controls.romainsStyle = romainsStyleOpt;
            controls.romainsMajStyle = romainsMajStyleOpt;
            controls.exposantStyle = exposantStyleOpt;
            
            return controls;
        },
        
        /**
         * Trouve les index des styles par défaut pour le formatage des siècles
         * @param {Array} characterStyles - Tableau des styles de caractère disponibles
         * @returns {Object} Indices des styles par défaut
         */
        trouverStylesParDefaut: function(characterStyles) {
            var indices = {
                petitesCapitales: -1,  // Initialiser à -1 pour indiquer "non trouvé"
                capitales: -1,
                exposant: -1
            };
            
            // Rechercher les styles par défaut
            for (var i = 0; i < characterStyles.length; i++) {
                var styleName = characterStyles[i].toLowerCase();
                
                // Recherche pour les petites capitales (correspondance exacte)
                for (var sc = 0; sc < this.CONFIG.STYLES_PETITES_CAPITALES.length; sc++) {
                    if (styleName === this.CONFIG.STYLES_PETITES_CAPITALES[sc].toLowerCase()) {
                        indices.petitesCapitales = i;
                        break;
                    }
                }
                
                // Recherche pour les capitales (correspondance exacte)
                for (var ac = 0; ac < this.CONFIG.STYLES_CAPITALES.length; ac++) {
                    if (styleName === this.CONFIG.STYLES_CAPITALES[ac].toLowerCase()) {
                        indices.capitales = i;
                        break;
                    }
                }
                
                // Recherche pour les exposants (correspondance exacte)
                for (var ex = 0; ex < this.CONFIG.STYLES_EXPOSANT.length; ex++) {
                    if (styleName === this.CONFIG.STYLES_EXPOSANT[ex].toLowerCase()) {
                        indices.exposant = i;
                        break;
                    }
                }
            }
            
            return indices;
        },
        
        /**
         * Récupère les options sélectionnées par l'utilisateur
         * @param {Object} controls - Contrôles créés dans l'interface
         * @param {Object} styles - Styles communs récupérés du script principal
         * @returns {Object} Options sélectionnées
         */
        getOptions: function(controls, styles) {
            return {
                formaterSiecles: controls.formatSiecles.value,
                formaterOrdinaux: controls.formatOrdinaux.value,
                formaterReferences: controls.formatReferences.value,
                formaterEspaces: controls.formatEspaces.value,
                romainsStyle: controls.romainsStyle.checkbox.value ? 
                    app.activeDocument.characterStyles[controls.romainsStyle.dropdown.selection.index] : null,
                romainsMajStyle: controls.romainsMajStyle.checkbox.value ? 
                    app.activeDocument.characterStyles[controls.romainsMajStyle.dropdown.selection.index] : null,
                // Utiliser le style d'exposant spécifique pour les ordinaux
                exposantStyle: controls.exposantStyle.checkbox.value ? 
                    app.activeDocument.characterStyles[controls.exposantStyle.dropdown.selection.index] : null
            };
        },
        
        /**
         * Applique les corrections de formatage selon les options choisies
         * @param {Document} doc - Document InDesign
         * @param {Object} options - Options sélectionnées
         */
        processDocument: function(doc, options) {
          try {
            // Vérifier si au moins une option est activée
            if (!options.formaterSiecles && !options.formaterOrdinaux && 
                !options.formaterReferences && !options.formaterEspaces) {
                return;
            }
            
            // Initialiser les variables nécessaires pour le script isolé
            this.initializeIsolatedEnvironment();
            
            // Appliquer les corrections selon les options choisies
            if (options.formaterOrdinaux) {
                this.formaterOrdinaux(doc, options.romainsMajStyle, options.exposantStyle);
            }
            
            if (options.formaterSiecles) {
                this.formaterSiecles(doc, options.romainsStyle, options.exposantStyle);
            }
            
            if (options.formaterReferences) {
                this.formaterReferences(doc, options.romainsMajStyle, options.exposantStyle);
            }
            
            if (options.formaterEspaces) {
                this.formaterEspaces(doc);
            }
            
            // Réinitialiser l'environnement après utilisation
            this.resetIsolatedEnvironment();
          } catch (error) {
              alert("Erreur lors du formatage des siècles: " + error);
          }
        },
        
        /**
         * Initialise l'environnement isolé pour le script de formatage des siècles
         * Crée des fonctions locales nécessaires au fonctionnement du script
         */
        initializeIsolatedEnvironment: function() {
            // Créer une référence locale au module pour utilisation dans les fonctions
            var self = this;
            
            // Recréer les fonctions utilitaires nécessaires au script
            this.Utilities = {
                estEnItalique: function(texte) {
                    try {
                        return texte.fontStyle && texte.fontStyle.indexOf("Italic") !== -1;
                    } catch (e) {
                        return false;
                    }
                },
                
                estEnGras: function(texte) {
                    try {
                        return texte.fontStyle && texte.fontStyle.indexOf("Bold") !== -1;
                    } catch (e) {
                        return false;
                    }
                },
                
                appliquerStylePolice: function(caractere, estItalique, estGras) {
                    try {
                        if (estItalique && estGras) {
                            caractere.fontStyle = "Bold Italic";
                        } else if (estItalique) {
                            caractere.fontStyle = "Italic";
                        } else if (estGras) {
                            caractere.fontStyle = "Bold";
                        }
                    } catch (e) {
                        // Ignorer l'erreur si l'application du style échoue
                    }
                },
                
                appliquerGrepPartout: function(findWhat, changeParams, specificAction) {
                    var doc = app.activeDocument;
                    app.findGrepPreferences.findWhat = findWhat;
                    
                    // Si changeParams contient des paramètres spécifiques (comme un style)
                    if (changeParams) {
                        for (var prop in changeParams) {
                            app.changeGrepPreferences[prop] = changeParams[prop];
                        }
                    }
                    
                    // Parcourir toutes les histoires normales
                    for (var s = 0; s < doc.stories.length; s++) {
                        // Si specificAction est fournie (pour un traitement spécial), l'utiliser
                        if (specificAction) {
                            var results = doc.stories[s].findGrep();
                            for (var r = 0; r < results.length; r++) {
                                specificAction(results[r]);
                            }
                        } else {
                            // Sinon, utiliser la méthode standard changeGrep()
                            doc.stories[s].changeGrep();
                        }
                        
                        // Traiter les notes de bas de page de cette histoire
                        try {
                            // Vérifier si l'histoire contient des notes de bas de page
                            if (doc.stories[s].footnotes && doc.stories[s].footnotes.length > 0) {
                                for (var fn = 0; fn < doc.stories[s].footnotes.length; fn++) {
                                    var footnote = doc.stories[s].footnotes[fn];
                                    if (specificAction) {
                                        var fnResults = footnote.texts[0].findGrep();
                                        for (var fr = 0; fr < fnResults.length; fr++) {
                                            specificAction(fnResults[fr]);
                                        }
                                    } else {
                                        footnote.texts[0].changeGrep();
                                    }
                                }
                            }
                        } catch (e) {
                            // Ignorer les erreurs
                        }
                    }
                    
                    // Réinitialiser les préférences
                    app.findGrepPreferences = app.changeGrepPreferences = null;
                },
                
                preparerRegex: function(liste) {
                    var regex = "";
                    for (var i = 0; i < liste.length; i++) {
                        if (i > 0) {
                            regex += "|";
                        }
                        regex += liste[i];
                    }
                    return regex;
                },
                
                preparerRegexAmbigus: function(liste) {
                    var regex = "";
                    for (var i = 0; i < liste.length; i++) {
                        if (i > 0) {
                            regex += "|";
                        }
                        regex += "\\b" + liste[i] + "\\b";
                    }
                    return regex;
                }
            };
            
            // Sauvegarde des préférences actuelles pour restauration ultérieure
            this.savedPreferences = {
                findGrepPreferences: app.findGrepPreferences,
                changeGrepPreferences: app.changeGrepPreferences,
                findTextPreferences: app.findTextPreferences,
                changeTextPreferences: app.changeTextPreferences
            };
        },
        
        /**
         * Réinitialise l'environnement après exécution du script isolé
         */
        resetIsolatedEnvironment: function() {
            // Réinitialiser les préférences GREP
            app.findGrepPreferences = app.changeGrepPreferences = null;
            app.findTextPreferences = app.changeTextPreferences = null;
        },
        
        /**
         * Formate les siècles (ex: XIVe siècle)
         */
        formaterSiecles: function(doc, romainsStyle, exposantStyle) {
          var self = this;
          try {
            // Vérifier que les styles sont définis
            if (!romainsStyle || !exposantStyle) {
              alert("Les styles de caractère requis ne sont pas définis. Veuillez sélectionner des styles valides.");
              return;
            }
            
            // Espace insécable
            var ESPACE_INSECABLE = String.fromCharCode(0x00A0);
            
            // Préparer les expressions régulières
            var motsClefsRegex = this.Utilities.preparerRegex(this.CONFIG.MOTS_ORDINAUX);
            var ambigusRegex = this.Utilities.preparerRegexAmbigus(this.CONFIG.MOTS_AMBIGUS);
            
            // Appliquer les styles à tout le document
            app.findGrepPreferences = app.changeGrepPreferences = null;
            
            // === TRAITEMENT SPÉCIAL POUR LE Ier SIÈCLE ===
            // Rechercher "Ie siècle" ou "ie siècle" et le remplacer par "Ier siècle"
            var modelesPremierSiecle = [
                // Modèles originaux
                "(?<=\\s|^|:)([Ii])e(?=\\s+(?i:siècle))",
                "(?<=\\s|^|:)([Ii])e(?=[\\.,;:\\s!\\?])(?!\\s+(?i:" + motsClefsRegex + "))",
                "\\bie(?=\\s+(?i:siècle))",
                "(?<=\\s|^|:)([Ii])e(?=[\\)\\]\\}\\>])(?!\\s+(?i:" + motsClefsRegex + "))"
            ];
            
            // Traitement explicite pour "ie siècle"
            app.findGrepPreferences = app.changeGrepPreferences = null;
            app.findGrepPreferences.findWhat = "\\bie\\s+siècle";
            
            function traiterIeSiecle(resultat) {
              if (resultat && resultat.contents) {
                // Forcer le résultat à "ier"
                var estItaliqueLocal = self.Utilities.estEnItalique(resultat);
                var estGrasLocal = self.Utilities.estEnGras(resultat);
                
                // Récupérer la position de "ie"
                var texteOriginal = resultat.contents;
                var positionIe = texteOriginal.indexOf("ie");
                
                if (positionIe !== -1) {
                  // Remplacer "ie" par "ier"
                  resultat.contents = texteOriginal.substring(0, positionIe) + "ier" + texteOriginal.substring(positionIe + 2);
                  
                  // Appliquer les styles caractère par caractère
                  if (positionIe < resultat.characters.length) {
                    // Style pour "i"
                    resultat.characters[positionIe].appliedCharacterStyle = romainsStyle;
                    self.Utilities.appliquerStylePolice(resultat.characters[positionIe], estItaliqueLocal, estGrasLocal);
                    
                    // Style pour "er"
                    if (positionIe + 1 < resultat.characters.length) {
                      resultat.characters[positionIe + 1].appliedCharacterStyle = exposantStyle;
                      self.Utilities.appliquerStylePolice(resultat.characters[positionIe + 1], estItaliqueLocal, estGrasLocal);
                    }
                    if (positionIe + 2 < resultat.characters.length) {
                      resultat.characters[positionIe + 2].appliedCharacterStyle = exposantStyle;
                      self.Utilities.appliquerStylePolice(resultat.characters[positionIe + 2], estItaliqueLocal, estGrasLocal);
                    }
                  }
                }
              }
            }
            
            self.Utilities.appliquerGrepPartout("\\bie\\s+siècle", null, traiterIeSiecle);
            
            // Traitement explicite pour "Ie siècle" (I majuscule)
            app.findGrepPreferences = app.changeGrepPreferences = null;
            app.findGrepPreferences.findWhat = "\\bIe\\s+siècle";
            
            function traiterIeCapSiecle(resultat) {
              if (resultat && resultat.contents) {
                // Forcer le résultat à "Ier"
                var estItaliqueLocal = self.Utilities.estEnItalique(resultat);
                var estGrasLocal = self.Utilities.estEnGras(resultat);
                
                // Récupérer la position de "Ie"
                var texteOriginal = resultat.contents;
                var positionIe = texteOriginal.indexOf("Ie");
                
                if (positionIe !== -1) {
                  // Remplacer "Ie" par "Ier"
                  resultat.contents = texteOriginal.substring(0, positionIe) + "Ier" + texteOriginal.substring(positionIe + 2);
                  
                  // Appliquer les styles caractère par caractère
                  if (positionIe < resultat.characters.length) {
                    // Style pour "I"
                    resultat.characters[positionIe].appliedCharacterStyle = romainsStyle;
                    self.Utilities.appliquerStylePolice(resultat.characters[positionIe], estItaliqueLocal, estGrasLocal);
                    
                    // Style pour "er"
                    if (positionIe + 1 < resultat.characters.length) {
                      resultat.characters[positionIe + 1].appliedCharacterStyle = exposantStyle;
                      self.Utilities.appliquerStylePolice(resultat.characters[positionIe + 1], estItaliqueLocal, estGrasLocal);
                    }
                    if (positionIe + 2 < resultat.characters.length) {
                      resultat.characters[positionIe + 2].appliedCharacterStyle = exposantStyle;
                      self.Utilities.appliquerStylePolice(resultat.characters[positionIe + 2], estItaliqueLocal, estGrasLocal);
                    }
                  }
                }
              }
            }
            
            self.Utilities.appliquerGrepPartout("\\bIe\\s+siècle", null, traiterIeCapSiecle);
            
            for (var ps = 0; ps < modelesPremierSiecle.length; ps++) {
              // Fonction spéciale pour traiter le premier siècle
              function traiterPremierSiecle(resultat) {
                // Obtenir le caractère initial (I ou i)
                var premierChar = resultat.characters[0].contents;
                
                // Vérifier si le texte est en italique ou en gras
                var estItaliqueLocal = self.Utilities.estEnItalique(resultat);
                var estGrasLocal = self.Utilities.estEnGras(resultat);
                
                // Remplacer le contenu par "Ier" ou "ier"
                resultat.contents = premierChar + "er";
                
                // S'assurer qu'on a bien les caractères attendus
                if (resultat.characters.length >= 3) {
                  // Appliquer le style pour "I" ou "i"
                  resultat.characters[0].appliedCharacterStyle = romainsStyle;
                  self.Utilities.appliquerStylePolice(resultat.characters[0], estItaliqueLocal, estGrasLocal);
                  
                  // Appliquer le style pour "er"
                  resultat.characters[1].appliedCharacterStyle = exposantStyle;
                  resultat.characters[2].appliedCharacterStyle = exposantStyle;
                  
                  self.Utilities.appliquerStylePolice(resultat.characters[1], estItaliqueLocal, estGrasLocal);
                  self.Utilities.appliquerStylePolice(resultat.characters[2], estItaliqueLocal, estGrasLocal);
                } else {
                  // Si le nombre de caractères n'est pas celui attendu, journal d'erreur
                  try {
                    if (typeof console !== "undefined" && console && console.log) {
                      console.log("Attention: Nombre incorrect de caractères pour le premier siècle: " + resultat.contents);
                    }
                  } catch (e) {
                    // Ignorer les erreurs de journalisation
                  }
                  
                  // Tentons quand même d'appliquer les styles aux caractères disponibles
                  if (resultat.characters.length > 0) {
                    resultat.characters[0].appliedCharacterStyle = romainsStyle;
                    self.Utilities.appliquerStylePolice(resultat.characters[0], estItaliqueLocal, estGrasLocal);
                    
                    // Appliquer le style pour "er" s'ils existent
                    for (var i = 1; i < resultat.characters.length; i++) {
                      resultat.characters[i].appliedCharacterStyle = exposantStyle;
                      self.Utilities.appliquerStylePolice(resultat.characters[i], estItaliqueLocal, estGrasLocal);
                    }
                  }
                }
              }
              
              this.Utilities.appliquerGrepPartout(modelesPremierSiecle[ps], null, traiterPremierSiecle);
            }
            
            // === TRAITEMENT POUR LE Ier SIÈCLE DÉJÀ FORMATÉ ===
            // Rechercher "Ier siècle" ou "ier siècle" déjà présent
            var modelesPremierSiecleExistant = [
                "(?<=\\s)([Ii])er(?=\\s+(?i:siècle))",
                "(?<=\\s)([Ii])er(?=[\\.,;:\\s!\\?])(?!\\s+(?i:" + motsClefsRegex + "))",
                "(?<=\\s)([Ii])er(?=[\\)\\]\\}\\>])(?!\\s+(?i:" + motsClefsRegex + "))"
            ];
            
            for (var pse = 0; pse < modelesPremierSiecleExistant.length; pse++) {
              function traiterPremierSiecleExistant(resultat) {
                var estItaliqueLocal = self.Utilities.estEnItalique(resultat);
                var estGrasLocal = self.Utilities.estEnGras(resultat);
                
                // Appliquer le style pour la première lettre (I/i)
                resultat.characters[0].appliedCharacterStyle = romainsStyle;
                self.Utilities.appliquerStylePolice(resultat.characters[0], estItaliqueLocal, estGrasLocal);
                
                // Appliquer le style d'exposant aux caractères "er" (indices 1 et 2)
                if (resultat.characters.length >= 3) {
                  resultat.characters[1].appliedCharacterStyle = exposantStyle;
                  resultat.characters[2].appliedCharacterStyle = exposantStyle;
                  
                  self.Utilities.appliquerStylePolice(resultat.characters[1], estItaliqueLocal, estGrasLocal);
                  self.Utilities.appliquerStylePolice(resultat.characters[2], estItaliqueLocal, estGrasLocal);
                }
              }
              
              this.Utilities.appliquerGrepPartout(modelesPremierSiecleExistant[pse], null, traiterPremierSiecleExistant);
            }
            
            // === FORMATAGE DES SIÈCLES - MAJUSCULES ===
            var modelesSiecleMajWithE = [
              "(?<=\\s)([IVX])e(?=[\\.,;:\\s!\\?\\)\\]\\}\\>])(?!\\s+(?i:" + motsClefsRegex + "))",
              "(?<=\\s)([IVX][IVX])e(?=[\\.,;:\\s!\\?\\)\\]\\}\\>])(?!\\s+(?i:" + motsClefsRegex + "))",
              "(?<=\\s)([IVX][IVX][IVX])e(?=[\\.,;:\\s!\\?\\)\\]\\}\\>])(?!\\s+(?i:" + motsClefsRegex + "))",
              "(?<=\\s)([IVX][IVX][IVX][IVX])e(?=[\\.,;:\\s!\\?\\)\\]\\}\\>])(?!\\s+(?i:" + motsClefsRegex + "))",
              "(?<=\\s)([IVX][IVX][IVX][IVX][IVX])e(?=[\\.,;:\\s!\\?\\)\\]\\}\\>])(?!\\s+(?i:" + motsClefsRegex + "))"
            ];
            
            for (var j = 0; j < modelesSiecleMajWithE.length; j++) {
              function traiterSiecleMaj(resultat) {
                var texteOriginal = resultat.contents;
                
                // Vérifier si le texte est en italique ou en gras
                var estItaliqueLocal = self.Utilities.estEnItalique(resultat);
                var estGrasLocal = self.Utilities.estEnGras(resultat);
                
                // Séparer le chiffre romain du "e"
                var chiffreRomain = texteOriginal.slice(0, -1).toLowerCase();
                var e = texteOriginal.slice(-1);
                
                // Remplacer le texte
                resultat.contents = chiffreRomain + e;
                
                // Appliquer les styles séparément
                for (var c = 0; c < resultat.characters.length - 1; c++) {
                  resultat.characters[c].appliedCharacterStyle = romainsStyle;
                  self.Utilities.appliquerStylePolice(resultat.characters[c], estItaliqueLocal, estGrasLocal);
                }
                
                // Appliquer le style d'exposant au dernier caractère
                resultat.characters[resultat.characters.length - 1].appliedCharacterStyle = exposantStyle;
                self.Utilities.appliquerStylePolice(resultat.characters[resultat.characters.length - 1], estItaliqueLocal, estGrasLocal);
              }
              
              this.Utilities.appliquerGrepPartout(modelesSiecleMajWithE[j], null, traiterSiecleMaj);
            }
            
            // === FORMATAGE DES SIÈCLES - MINUSCULES ===
            var modelesSiecleMinWithE = [
              "(?<=\\s)(?!(?i:" + ambigusRegex + "))([ivx])e(?=[\\.,;:\\s!\\?\\)\\]\\}\\>])(?!\\s+(?i:" + motsClefsRegex + "))",
              "(?<=\\s)(?!(?i:" + ambigusRegex + "))([ivx][ivx])e(?=[\\.,;:\\s!\\?\\)\\]\\}\\>])(?!\\s+(?i:" + motsClefsRegex + "))",
              "(?<=\\s)(?!(?i:" + ambigusRegex + "))([ivx][ivx][ivx])e(?=[\\.,;:\\s!\\?\\)\\]\\}\\>])(?!\\s+(?i:" + motsClefsRegex + "))",
              "(?<=\\s)(?!(?i:" + ambigusRegex + "))([ivx][ivx][ivx][ivx])e(?=[\\.,;:\\s!\\?\\)\\]\\}\\>])(?!\\s+(?i:" + motsClefsRegex + "))",
              "(?<=\\s)(?!(?i:" + ambigusRegex + "))([ivx][ivx][ivx][ivx][ivx])e(?=[\\.,;:\\s!\\?\\)\\]\\}\\>])(?!\\s+(?i:" + motsClefsRegex + "))"
            ];
            
            for (var i = 0; i < modelesSiecleMinWithE.length; i++) {
              function traiterSiecleMin(resultat) {
                var texteOriginal = resultat.contents;
                
                // Vérifier si le texte est en italique ou en gras
                var estItaliqueLocal = self.Utilities.estEnItalique(resultat);
                var estGrasLocal = self.Utilities.estEnGras(resultat);
                
                // Séparer le chiffre romain du "e"
                var chiffreRomain = texteOriginal.slice(0, -1);
                var e = texteOriginal.slice(-1);
                
                // Remplacer le texte
                resultat.contents = chiffreRomain + e;
                
                // Appliquer les styles séparément
                for (var c = 0; c < resultat.characters.length - 1; c++) {
                  resultat.characters[c].appliedCharacterStyle = romainsStyle;
                  self.Utilities.appliquerStylePolice(resultat.characters[c], estItaliqueLocal, estGrasLocal);
                }
                
                // Appliquer le style d'exposant au dernier caractère
                resultat.characters[resultat.characters.length - 1].appliedCharacterStyle = exposantStyle;
                self.Utilities.appliquerStylePolice(resultat.characters[resultat.characters.length - 1], estItaliqueLocal, estGrasLocal);
              }
              
              this.Utilities.appliquerGrepPartout(modelesSiecleMinWithE[i], null, traiterSiecleMin);
            }
            
            // === TRAITEMENT EXPLICITE POUR "SIÈCLE" ET "SIÈCLES" ===
            var modelesSiecleExplicite = [
              "(?<=\\s)([IVXivx]{1,5})e(?=\\s+(?i:siècle))",
              "(?<=\\s)([IVXivx]{1,5})e(?=\\s+(?i:siècles))"
            ];
            
            for (var s = 0; s < modelesSiecleExplicite.length; s++) {
              function traiterSiecleExplicite(resultat) {
                var texteOriginal = resultat.contents;
                
                // Vérifier si le texte est en italique ou en gras
                var estItaliqueLocal = self.Utilities.estEnItalique(resultat);
                var estGrasLocal = self.Utilities.estEnGras(resultat);
                
                // Séparer le chiffre romain du "e"
                var chiffreRomain = texteOriginal.slice(0, -1).toLowerCase();
                var e = texteOriginal.slice(-1);
                
                // Remplacer le texte
                resultat.contents = chiffreRomain + e;
                
                // Appliquer les styles séparément
                for (var c = 0; c < resultat.characters.length - 1; c++) {
                  resultat.characters[c].appliedCharacterStyle = romainsStyle;
                  self.Utilities.appliquerStylePolice(resultat.characters[c], estItaliqueLocal, estGrasLocal);
                }
                
                // Appliquer le style d'exposant au dernier caractère
                resultat.characters[resultat.characters.length - 1].appliedCharacterStyle = exposantStyle;
                self.Utilities.appliquerStylePolice(resultat.characters[resultat.characters.length - 1], estItaliqueLocal, estGrasLocal);
              }
              
              this.Utilities.appliquerGrepPartout(modelesSiecleExplicite[s], null, traiterSiecleExplicite);
            }
          } catch (error) {
            alert("Erreur lors du formatage des siècles: " + error);
          }
        },
        
        /**
         * Formate les expressions ordinales (ex: IIIe régiment, Ire République)
         */
        formaterOrdinaux: function(doc, romainsMajStyle, exposantStyle) {
            try {
                // Créer une référence locale au module
                var self = this;
                
                // Espace insécable
                var ESPACE_INSECABLE = String.fromCharCode(0x00A0);
                
                // Préparer les expressions régulières
                var motsClefsRegex = this.Utilities.preparerRegex(this.CONFIG.MOTS_ORDINAUX);
                var motsClefsRegexAvant = this.Utilities.preparerRegex(this.CONFIG.MOTS_AVANT_ORDINAUX);
                var ambigusRegex = this.Utilities.preparerRegexAmbigus(this.CONFIG.MOTS_AMBIGUS);
                
                // === CORRECTIONS PRÉLIMINAIRES ===
                // Remplacer les caractères problématiques avant tout traitement
                app.findGrepPreferences = app.changeGrepPreferences = null;
                
                // 1. Corriger les formes féminines avec accent
                app.findGrepPreferences.findWhat = "\\b([Ii])ère\\b";
                app.changeGrepPreferences.changeTo = "$1re";
                app.activeDocument.changeGrep();
                
                // 2. Corriger les formes féminines sans accent
                app.findGrepPreferences = app.changeGrepPreferences = null;
                app.findGrepPreferences.findWhat = "\\b([Ii])ere\\b";
                app.changeGrepPreferences.changeTo = "$1re";
                app.activeDocument.changeGrep();
                
                // 3. Corriger le cas "IeR" 
                app.findGrepPreferences = app.changeGrepPreferences = null;
                app.findGrepPreferences.findWhat = "\\b([Ii])eR\\b";
                app.changeGrepPreferences.changeTo = "$1er";
                app.activeDocument.changeGrep();
                
                // === TRAITEMENT DES ORDINAUX SPÉCIFIQUES ===
                // Rechercher "Ier" et "Ire" premier/première, mais pas les mots ambigus
                app.findGrepPreferences = app.changeGrepPreferences = null;
                
                // Expression qui exclut les mots ambigus
                app.findGrepPreferences.findWhat = "\\b(?!(?i:" + ambigusRegex + "))([Ii])(?:er|re)\\b";
                
                var resultatsIer = app.activeDocument.findGrep();
                
                for (var i = 0; i < resultatsIer.length; i++) {
                    try {
                        var resultat = resultatsIer[i];
                        var estItaliqueLocal = self.Utilities.estEnItalique(resultat);
                        var estGrasLocal = self.Utilities.estEnGras(resultat);
                        
                        // Appliquer le style au "I"
                        resultat.characters[0].appliedCharacterStyle = romainsMajStyle;
                        self.Utilities.appliquerStylePolice(resultat.characters[0], estItaliqueLocal, estGrasLocal);
                        
                        // Appliquer le style d'exposant au reste
                        for (var j = 1; j < resultat.characters.length; j++) {
                            resultat.characters[j].appliedCharacterStyle = exposantStyle;
                            self.Utilities.appliquerStylePolice(resultat.characters[j], estItaliqueLocal, estGrasLocal);
                        }
                    } catch (e) {
                        // Ignorer les erreurs
                    }
                }
                
                // === CODE ORIGINAL POUR LES CAS GÉNÉRAUX (II, III, IV, etc.) ===
                // Cas 1: précédés par des mots spécifiques
                var modelesOrdCase1WithE = [
                    // Majuscules
                    "(?<=(?i:" + motsClefsRegexAvant + ")\\s)([IVX])e(?=\\s)",
                    "(?<=(?i:" + motsClefsRegexAvant + ")\\s)([IVX][IVX])e(?=\\s)",
                    "(?<=(?i:" + motsClefsRegexAvant + ")\\s)([IVX][IVX][IVX])e(?=\\s)",
                    "(?<=(?i:" + motsClefsRegexAvant + ")\\s)([IVX][IVX][IVX][IVX])e(?=\\s)",
                    "(?<=(?i:" + motsClefsRegexAvant + ")\\s)([IVX][IVX][IVX][IVX][IVX])e(?=\\s)",
                    
                    // Minuscules - exclure les mots ambigus
                    "(?<=(?i:" + motsClefsRegexAvant + ")\\s)(?!(?i:" + ambigusRegex + "))([ivx])e(?=\\s)",
                    "(?<=(?i:" + motsClefsRegexAvant + ")\\s)(?!(?i:" + ambigusRegex + "))([ivx][ivx])e(?=\\s)",
                    "(?<=(?i:" + motsClefsRegexAvant + ")\\s)(?!(?i:" + ambigusRegex + "))([ivx][ivx][ivx])e(?=\\s)",
                    "(?<=(?i:" + motsClefsRegexAvant + ")\\s)(?!(?i:" + ambigusRegex + "))([ivx][ivx][ivx][ivx])e(?=\\s)",
                    "(?<=(?i:" + motsClefsRegexAvant + ")\\s)(?!(?i:" + ambigusRegex + "))([ivx][ivx][ivx][ivx][ivx])e(?=\\s)"
                ];
                
                // Fonction pour traiter les expressions ordinales
                function traiterExpressionOrdinale(resultat) {
                    try {
                        var texteOriginal = resultat.contents;
                        var estItaliqueLocal = self.Utilities.estEnItalique(resultat);
                        var estGrasLocal = self.Utilities.estEnGras(resultat);
                        
                        // Séparer le chiffre romain du "e"
                        var chiffreRomain = texteOriginal.slice(0, -1);
                        var e = texteOriginal.slice(-1);
                        
                        // Appliquer les styles séparément
                        for (var c = 0; c < resultat.characters.length - 1; c++) {
                            resultat.characters[c].appliedCharacterStyle = romainsMajStyle;
                            self.Utilities.appliquerStylePolice(resultat.characters[c], estItaliqueLocal, estGrasLocal);
                        }
                        
                        // Appliquer le style d'exposant au dernier caractère
                        resultat.characters[resultat.characters.length - 1].appliedCharacterStyle = exposantStyle;
                        self.Utilities.appliquerStylePolice(resultat.characters[resultat.characters.length - 1], estItaliqueLocal, estGrasLocal);
                    } catch (e) {
                        // Ignorer les erreurs
                    }
                }
                
                // Appliquer aux cas 1
                for (var o = 0; o < modelesOrdCase1WithE.length; o++) {
                    this.Utilities.appliquerGrepPartout(modelesOrdCase1WithE[o], null, traiterExpressionOrdinale);
                }
                
                // Cas 2: suivis par des mots spécifiques
                var modelesOrdCase2WithE = [
                    // Majuscules
                    "(?<=\\s)([IVX])e(?=\\s+(?i:" + motsClefsRegex + "))",
                    "(?<=\\s)([IVX][IVX])e(?=\\s+(?i:" + motsClefsRegex + "))",
                    "(?<=\\s)([IVX][IVX][IVX])e(?=\\s+(?i:" + motsClefsRegex + "))",
                    "(?<=\\s)([IVX][IVX][IVX][IVX])e(?=\\s+(?i:" + motsClefsRegex + "))",
                    "(?<=\\s)([IVX][IVX][IVX][IVX][IVX])e(?=\\s+(?i:" + motsClefsRegex + "))",
                    
                    // Minuscules - exclure les mots ambigus
                    "(?<=\\s)(?!(?i:" + ambigusRegex + "))([ivx])e(?=\\s+(?i:" + motsClefsRegex + "))",
                    "(?<=\\s)(?!(?i:" + ambigusRegex + "))([ivx][ivx])e(?=\\s+(?i:" + motsClefsRegex + "))",
                    "(?<=\\s)(?!(?i:" + ambigusRegex + "))([ivx][ivx][ivx])e(?=\\s+(?i:" + motsClefsRegex + "))",
                    "(?<=\\s)(?!(?i:" + ambigusRegex + "))([ivx][ivx][ivx][ivx])e(?=\\s+(?i:" + motsClefsRegex + "))",
                    "(?<=\\s)(?!(?i:" + ambigusRegex + "))([ivx][ivx][ivx][ivx][ivx])e(?=\\s+(?i:" + motsClefsRegex + "))"
                ];
                
                // Appliquer aux cas 2
                for (var p = 0; p < modelesOrdCase2WithE.length; p++) {
                    this.Utilities.appliquerGrepPartout(modelesOrdCase2WithE[p], null, traiterExpressionOrdinale);
                }
                
                // === RECHERCHE DIRECTE DES FORMES II, III, etc. + e ===
                // Cette approche est plus directe et peut attraper les cas manqués
                // En excluant explicitement les mots ambigus
                app.findGrepPreferences = app.changeGrepPreferences = null;
                app.findGrepPreferences.findWhat = "\\b(?!(?i:" + ambigusRegex + "))([IVXivx][IVXivx]+)e\\b";
                
                var resultatsAutres = app.activeDocument.findGrep();
                
                for (var i = 0; i < resultatsAutres.length; i++) {
                    try {
                        var resultat = resultatsAutres[i];
                        var estItaliqueLocal = self.Utilities.estEnItalique(resultat);
                        var estGrasLocal = self.Utilities.estEnGras(resultat);
                        
                        // Séparer le chiffre romain du "e"
                        var texteOriginal = resultat.contents;
                        var longueurChiffre = texteOriginal.length - 1;
                        
                        // Appliquer le style au chiffre romain
                        for (var c = 0; c < longueurChiffre; c++) {
                            resultat.characters[c].appliedCharacterStyle = romainsMajStyle;
                            self.Utilities.appliquerStylePolice(resultat.characters[c], estItaliqueLocal, estGrasLocal);
                        }
                        
                        // Appliquer le style au "e"
                        resultat.characters[longueurChiffre].appliedCharacterStyle = exposantStyle;
                        self.Utilities.appliquerStylePolice(resultat.characters[longueurChiffre], estItaliqueLocal, estGrasLocal);
                    } catch (e) {
                        // Ignorer les erreurs
                    }
                }
                
                // === ESPACES INSÉCABLES ===
                // Ajouter des espaces insécables après les ordinaux
                
                // Pour "Ier" et "Ire" suivis d'un mot commençant par une majuscule
                app.findGrepPreferences = app.changeGrepPreferences = null;
                app.findGrepPreferences.findWhat = "(\\b[Ii](?:er|re)) ([A-Z]\\w*)";
                app.changeGrepPreferences.changeTo = "$1" + ESPACE_INSECABLE + "$2";
                app.activeDocument.changeGrep();
                
                // Pour les chiffres romains + e suivis d'un mot commençant par une majuscule
                app.findGrepPreferences = app.changeGrepPreferences = null;
                app.findGrepPreferences.findWhat = "(\\b[IVXivx]+e) ([A-Z]\\w*)";
                app.changeGrepPreferences.changeTo = "$1" + ESPACE_INSECABLE + "$2";
                app.activeDocument.changeGrep();
            } catch (error) {
                alert("Erreur lors du formatage des expressions ordinales: " + error);
            }
        },
        
        /**
         * Formate les parties d'œuvres et titres de personnes
         */
        formaterReferences: function(doc, romainsMajStyle, exposantStyle) {
          try {
              // Créer une référence locale au module
              var self = this;
              
              // Espace insécable
              var ESPACE_INSECABLE = String.fromCharCode(0x00A0);
              
              app.findGrepPreferences = app.changeGrepPreferences = null;
              
              // Combiner les mots d'œuvres et les titres de personnes
              var tousLesMots = this.CONFIG.MOTS_OEUVRES.concat(this.CONFIG.TITRES_PERSONNES);
              
              // ÉTAPE 1: Remplacer les espaces normaux par des espaces insécables
              for (var i = 0; i < tousLesMots.length; i++) {
                  // Réinitialiser les préférences
                  app.findGrepPreferences = app.changeGrepPreferences = null;
                  
                  // Rechercher: mot + espace + chiffre romain
                  var motif = "(?i)(" + tousLesMots[i] + ") ([ivxIVX][ivxIVX]*)";
                  app.findGrepPreferences.findWhat = motif;
                  app.changeGrepPreferences.changeTo = "$1" + ESPACE_INSECABLE + "$2";
                  
                  // Appliquer à tout le document
                  app.activeDocument.changeGrep();
              }
              
              // ÉTAPE 2: Formater les chiffres romains trouvés
              for (var i = 0; i < tousLesMots.length; i++) {
                  // Réinitialiser les préférences
                  app.findGrepPreferences = app.changeGrepPreferences = null;
                  
                  // Rechercher: mot + espace insécable + chiffre romain
                  var motif = "(?i)(" + tousLesMots[i] + ")" + ESPACE_INSECABLE + "([ivxIVX][ivxIVX]*)";
                  app.findGrepPreferences.findWhat = motif;
                  
                  // Trouver toutes les occurrences
                  var resultats = app.activeDocument.findGrep();
                  
                  // Pour chaque occurrence
                  for (var r = 0; r < resultats.length; r++) {
                      // Le texte complet (mot + espace insécable + chiffre romain)
                      var texteComplet = resultats[r].contents;
                      
                      // Extraire le mot, l'espace insécable et le chiffre romain
                      var mot = texteComplet.substring(0, tousLesMots[i].length);
                      var espaceEtChiffre = texteComplet.substring(tousLesMots[i].length);
                      var chiffreRomain = espaceEtChiffre.substring(1); // Ignorer l'espace insécable
                      
                      // Conserver les attributs
                      var estItaliqueLocal = self.Utilities.estEnItalique(resultats[r]);
                      var estGrasLocal = self.Utilities.estEnGras(resultats[r]);
                      
                      // Remplacer le texte en mettant le chiffre romain en majuscules
                      resultats[r].contents = mot + ESPACE_INSECABLE + chiffreRomain.toUpperCase();
                      
                      // Traiter le chiffre romain séparément
                      var longueurChiffre = chiffreRomain.length;
                      var debutChiffre = tousLesMots[i].length + 1; // +1 pour l'espace insécable
                      
                      // Appliquer le style au chiffre romain uniquement
                      for (var c = debutChiffre; c < debutChiffre + longueurChiffre; c++) {
                          if (c < resultats[r].characters.length) {
                              resultats[r].characters[c].appliedCharacterStyle = romainsMajStyle;
                              
                              // Préserver l'italique et/ou le gras
                              self.Utilities.appliquerStylePolice(resultats[r].characters[c], estItaliqueLocal, estGrasLocal);
                          }
                      }
                  }
              }
              
              // === TRAITEMENT UNIQUEMENT DES "Ier" DÉJÀ FORMATÉS (IGNORE LES "Ie") ===
              // Créer une expression regex pour les noms avec premier
              var nomsPremierRegex = this.Utilities.preparerRegex(this.CONFIG.NOMS_PREMIER);
              
              // Rechercher seulement les cas déjà formatés en "Ier" (pas "Ie")
              app.findGrepPreferences = app.changeGrepPreferences = null;
              app.findGrepPreferences.findWhat = "(?i)(" + nomsPremierRegex + ")[ " + ESPACE_INSECABLE + "]([Ii])er";
              
              var resultatsIer = app.activeDocument.findGrep();
              
              for (var i = 0; i < resultatsIer.length; i++) {
                  try {
                      var texteOriginal = resultatsIer[i].contents;
                      var estItaliqueLocal = self.Utilities.estEnItalique(resultatsIer[i]);
                      var estGrasLocal = self.Utilities.estEnGras(resultatsIer[i]);
                      
                      // Trouver l'espace qui sépare le nom du "Ier"
                      var indexEspace = -1;
                      for (var j = 0; j < texteOriginal.length; j++) {
                          if (texteOriginal.charAt(j) === ' ' || texteOriginal.charAt(j) === ESPACE_INSECABLE) {
                              indexEspace = j;
                              break;
                          }
                      }
                      
                      if (indexEspace !== -1) {
                          // Position du "I" après l'espace
                          var positionI = indexEspace + 1;
                          
                          // Appliquer le style pour le "I"
                          if (positionI < resultatsIer[i].characters.length) {
                              resultatsIer[i].characters[positionI].appliedCharacterStyle = romainsMajStyle;
                              self.Utilities.appliquerStylePolice(resultatsIer[i].characters[positionI], estItaliqueLocal, estGrasLocal);
                              
                              // Appliquer le style exposant pour "er"
                              for (var k = positionI + 1; k < resultatsIer[i].characters.length; k++) {
                                  resultatsIer[i].characters[k].appliedCharacterStyle = exposantStyle;
                                  self.Utilities.appliquerStylePolice(resultatsIer[i].characters[k], estItaliqueLocal, estGrasLocal);
                              }
                          }
                      }
                  } catch (e) {
                      // Ignorer les erreurs
                  }
              }
              
              // === TRAITEMENT DES CHIFFRES ARABES (1er) ===
              try {
                  // Rechercher explicitement "1er" (déjà formaté)
                  app.findGrepPreferences = app.changeGrepPreferences = null;
                  app.findGrepPreferences.findWhat = "(\\s|^)(1er)";
                  
                  var resultats1er = app.activeDocument.findGrep();
                  
                  for (var r = 0; r < resultats1er.length; r++) {
                      try {
                          var texteComplet = resultats1er[r].contents;
                          var estItaliqueLocal = self.Utilities.estEnItalique(resultats1er[r]);
                          var estGrasLocal = self.Utilities.estEnGras(resultats1er[r]);
                          
                          // Identifier où commence le "1er"
                          var debut = texteComplet.indexOf("1");
                          
                          // Appliquer le style d'exposant aux caractères "er"
                          if (debut !== -1 && debut + 1 < resultats1er[r].characters.length) {
                              resultats1er[r].characters[debut + 1].appliedCharacterStyle = exposantStyle;
                              if (debut + 2 < resultats1er[r].characters.length) {
                                  resultats1er[r].characters[debut + 2].appliedCharacterStyle = exposantStyle;
                              }
                              
                              self.Utilities.appliquerStylePolice(resultats1er[r].characters[debut + 1], estItaliqueLocal, estGrasLocal);
                              if (debut + 2 < resultats1er[r].characters.length) {
                                  self.Utilities.appliquerStylePolice(resultats1er[r].characters[debut + 2], estItaliqueLocal, estGrasLocal);
                              }
                          }
                      } catch (e) {
                          // Ignorer les erreurs
                      }
                  }
              } catch (e) {
                  alert("Erreur lors du formatage des occurrences de '1er': " + e.message);
              }
          } catch (error) {
              alert("Erreur lors du formatage des références d'œuvres et titres: " + error.message);
          }
        },
        
        /**
         * Formate les espaces insécables dans les références
         */
        formaterEspaces: function(doc) {
          var self = this;
          
          try {
              // Espace insécable
              var ESPACE_INSECABLE = String.fromCharCode(0x00A0);
              
              app.findGrepPreferences = app.changeGrepPreferences = null;
              
              // Préparer des abréviations plus précises
              var abreviationsPrecises = [];
              
              // Traiter les abréviations avec points
              for (var i = 0; i < this.CONFIG.ABREVIATIONS_REFS.length; i++) {
                  // Si l'abréviation contient déjà un point d'échappement, elle est correcte
                  if (this.CONFIG.ABREVIATIONS_REFS[i].indexOf("\\.") !== -1) {
                      abreviationsPrecises.push(this.CONFIG.ABREVIATIONS_REFS[i]);
                  } else {
                      // Sinon, ajouter des délimiteurs de mot
                      abreviationsPrecises.push("\\b" + this.CONFIG.ABREVIATIONS_REFS[i] + "\\b");
                  }
              }
              
              // Ajouter les références aux volumes avec délimiteurs de mot
              for (var i = 0; i < this.CONFIG.ABREVIATIONS_VOLUMES.length; i++) {
                  if (this.CONFIG.ABREVIATIONS_VOLUMES[i].indexOf("\\.") !== -1) {
                      abreviationsPrecises.push(this.CONFIG.ABREVIATIONS_VOLUMES[i]);
                  } else {
                      abreviationsPrecises.push("\\b" + this.CONFIG.ABREVIATIONS_VOLUMES[i] + "\\b");
                  }
              }
              
              // Ajouter les références temporelles avec délimiteurs de mot
              for (var i = 0; i < this.CONFIG.ABREVIATIONS_TEMPORELLES.length; i++) {
                  if (this.CONFIG.ABREVIATIONS_TEMPORELLES[i].indexOf("\\.") !== -1) {
                      abreviationsPrecises.push(this.CONFIG.ABREVIATIONS_TEMPORELLES[i]);
                  } else {
                      abreviationsPrecises.push("\\b" + this.CONFIG.ABREVIATIONS_TEMPORELLES[i] + "\\b");
                  }
              }
              
              // Ajouter les références aux numéros avec délimiteurs de mot
              for (var i = 0; i < this.CONFIG.ABREVIATIONS_NUMEROS.length; i++) {
                  if (this.CONFIG.ABREVIATIONS_NUMEROS[i].indexOf("\\.") !== -1) {
                      abreviationsPrecises.push(this.CONFIG.ABREVIATIONS_NUMEROS[i]);
                  } else if (this.CONFIG.ABREVIATIONS_NUMEROS[i].indexOf("°") !== -1) {
                      // Cas spécial pour n° et n°s - pas de \b à la fin
                      abreviationsPrecises.push("\\b" + this.CONFIG.ABREVIATIONS_NUMEROS[i]);
                  } else {
                      abreviationsPrecises.push("\\b" + this.CONFIG.ABREVIATIONS_NUMEROS[i] + "\\b");
                  }
              }
              
              // Ajouter les références directionnelles avec délimiteurs de mot
              for (var i = 0; i < this.CONFIG.ABREVIATIONS_DIRECTION.length; i++) {
                  if (this.CONFIG.ABREVIATIONS_DIRECTION[i].indexOf("\\.") !== -1) {
                      abreviationsPrecises.push(this.CONFIG.ABREVIATIONS_DIRECTION[i]);
                  } else {
                      abreviationsPrecises.push("\\b" + this.CONFIG.ABREVIATIONS_DIRECTION[i] + "\\b");
                  }
              }
              
              // Ajouter les titres et appellations avec délimiteurs de mot
              for (var i = 0; i < this.CONFIG.TITRES_APPELLATIONS.length; i++) {
                  if (this.CONFIG.TITRES_APPELLATIONS[i].indexOf("\\.") !== -1) {
                      abreviationsPrecises.push(this.CONFIG.TITRES_APPELLATIONS[i]);
                  } else {
                      abreviationsPrecises.push("\\b" + this.CONFIG.TITRES_APPELLATIONS[i] + "\\b");
                  }
              }
              
              // 1. Abréviations suivies d'un chiffre ou d'un nombre
              for (var i = 0; i < abreviationsPrecises.length; i++) {
                  // Réinitialiser les préférences
                  app.findGrepPreferences = app.changeGrepPreferences = null;
                  
                  // Abréviations suivies d'un chiffre - version améliorée
                  var motif = "(?i)(" + abreviationsPrecises[i] + ")[ \\t" + ESPACE_INSECABLE + "]+([0-9][0-9.,\\-–—]*(?:[0-9]|[a-z]))";
                  app.findGrepPreferences.findWhat = motif;
                  app.changeGrepPreferences.changeTo = "$1" + ESPACE_INSECABLE + "$2";
                  
                  // Appliquer à tout le document
                  app.activeDocument.changeGrep();
              }
              
              // 2. Traitement spécial pour les intervalles de pages
              // Correction : utiliser directement les abréviations de référence avec délimiteurs
              var abreviationsRefs = [];
              for (var i = 0; i < this.CONFIG.ABREVIATIONS_REFS.length; i++) {
                  if (this.CONFIG.ABREVIATIONS_REFS[i].indexOf("\\.") !== -1) {
                      abreviationsRefs.push(this.CONFIG.ABREVIATIONS_REFS[i]);
                  } else {
                      abreviationsRefs.push("\\b" + this.CONFIG.ABREVIATIONS_REFS[i] + "\\b");
                  }
              }
              
              for (var i = 0; i < abreviationsRefs.length; i++) {
                  // Réinitialiser les préférences
                  app.findGrepPreferences = app.changeGrepPreferences = null;
                  
                  // Format d'intervalle avec trait d'union ou tiret - version améliorée
                  var motif = "(?i)(" + abreviationsRefs[i] + ")[ \\t" + ESPACE_INSECABLE + "]+([0-9]+)[ ]*([-–—])[ ]*([0-9]+)";
                  app.findGrepPreferences.findWhat = motif;
                  app.changeGrepPreferences.changeTo = "$1" + ESPACE_INSECABLE + "$2$3$4";
                  
                  // Appliquer à tout le document
                  app.activeDocument.changeGrep();
              }
              
              // 3. Traitement spécial pour les numéros avec lettre
              for (var i = 0; i < abreviationsPrecises.length; i++) {
                  // Réinitialiser les préférences
                  app.findGrepPreferences = app.changeGrepPreferences = null;
                  
                  // Format de numéro avec lettre - version améliorée
                  var motif = "(?i)(" + abreviationsPrecises[i] + ")[ \\t" + ESPACE_INSECABLE + "]+([0-9]+[a-z])\\b";
                  app.findGrepPreferences.findWhat = motif;
                  app.changeGrepPreferences.changeTo = "$1" + ESPACE_INSECABLE + "$2";
                  
                  // Appliquer à tout le document
                  app.activeDocument.changeGrep();
              }
              
              // 4. Traitement des unités de mesure précédées de nombres
              for (var i = 0; i < this.CONFIG.UNITES_MESURE.length; i++) {
                  // Réinitialiser les préférences
                  app.findGrepPreferences = app.changeGrepPreferences = null;
                  
                  // Nombre suivi d'une unité de mesure - version améliorée
                  var motif = "([0-9]+[.,]?[0-9]*)[ ](\\b" + this.CONFIG.UNITES_MESURE[i] + "(?=\\s|[.,;:!?)]|$))";
                  app.findGrepPreferences.findWhat = motif;
                  app.changeGrepPreferences.changeTo = "$1" + ESPACE_INSECABLE + "$2";
                  
                  // Appliquer à tout le document
                  app.activeDocument.changeGrep();
              }
          } catch (error) {
              alert("Erreur lors du formatage des espaces insécables pour les références: " + error.message);
          }
        }
    };
    
    /**
     * Fonction principale pour initialiser et exécuter le script
     * @private
     */
    function main() {
        try {
            // Vérifier si un document est ouvert
            if (!Utilities.validateDocumentOpen()) {
                return;
            }
            
            // Récupérer les styles de caractère
            if (!ErrorHandler.ensureDefined(app, "app", true)) return;
            if (!ErrorHandler.ensureDefined(app.activeDocument, "app.activeDocument", true)) return;
            
            var doc = app.activeDocument;
            var styleInfo = Utilities.getCharacterStyles(doc);
            
            // Créer et afficher le dialogue
            var options = UIBuilder.createDialog(
                styleInfo.styles, 
                styleInfo.superscriptIndex, 
                styleInfo.italicIndex
            );
            
            // Traiter si l'utilisateur a cliqué sur Appliquer
            if (options) {
                try {
                    // Vérifier les constantes nécessaires
                    if (!ErrorHandler.ensureDefined(ScriptLanguage, "ScriptLanguage", true)) return;
                    if (!ErrorHandler.ensureDefined(UndoModes, "UndoModes", true)) return;
                    
                    // Exécuter les corrections dans un bloc d'annulation
                    app.doScript(
                        function() {
                            Processor.processDocuments(options);
                        },
                        ScriptLanguage.JAVASCRIPT,
                        undefined,
                        UndoModes.fastEntireScript,
                        CONFIG.SCRIPT_TITLE
                    );
                } catch (scriptError) {
                    ErrorHandler.handleError(scriptError, "exécution du script dans un bloc d'annulation", true);
                }
            }
        } catch (error) {
            ErrorHandler.handleError(error, "fonction principale", true);
        }
    }
    
    // Initialiser le script avec une gestion des erreurs globale
    try {
        main();
    } catch (fatalError) {
        // Essayer d'afficher l'erreur
        try {
            alert("Erreur fatale : " + fatalError.message);
            
            if (typeof console !== "undefined" && console && console.log) {
                console.log("Erreur fatale dans le script : " + fatalError.message);
                
                if (fatalError.line) {
                    console.log("Ligne : " + fatalError.line);
                }
                
                if (fatalError.stack) {
                    console.log("Stack trace : " + fatalError.stack);
                }
            }
        } catch (e) {
            // Dernier recours si même l'alerte échoue
            alert("Une erreur irrécupérable s'est produite.");
        }
    }
    
    /**
     * Fonction autonome pour appliquer un gabarit à la dernière page
     */
    function applyMasterToLastPageStandalone(document, masterName) {
        try {
            // Vérifications de base
            if (!document) {
                alert("Erreur : Document invalide");
                return false;
            }
            
            if (!masterName) {
                alert("Erreur : Nom de gabarit invalide");
                return false;
            }
            
            // Accéder à la dernière page 
            var pageCount = document.pages.length;
            if (pageCount <= 0) {
                return false;
            }
            
            var lastPage = document.pages.item(pageCount - 1);
            if (!lastPage || !lastPage.isValid) {
                return false;
            }
            
            // Trouver le gabarit correspondant DANS CE DOCUMENT
            var targetMaster = null;
            for (var i = 0; i < document.masterSpreads.length; i++) {
                if (document.masterSpreads[i].name === masterName) {
                    targetMaster = document.masterSpreads[i];
                    break;
                }
            }
            
            if (!targetMaster) {
                alert("Gabarit '" + masterName + "' introuvable dans le document " + document.name);
                return false;
            }
            
            // Appliquer le gabarit spécifique à ce document
            lastPage.appliedMaster = targetMaster;
            return true;
        } catch (error) {
            alert("Erreur lors de l'application du gabarit : " + error.message);
            return false;
        }
    }
})();