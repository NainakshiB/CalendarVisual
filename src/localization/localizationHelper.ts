module powerbi.extensibility.visual {

    export interface Localization {
            "de-DE"?: string;
            "fr-FR"?: string;
            "gl-ES"?: string;
            "pt-BR"?: string;
            "pt-PT": string;
    }

    export interface LocalizaionResources {
        defaultValue: string;
        localization: Localization;
    }

    export interface Resources {
        [key: string]: LocalizaionResources;
    }

    /**
     * Returns the localized string in the locale transfared using the key that was given to serch the resources
     *
     * @param {string} locale - the locale in which PowerBI is currently running
     * @param {object} key - specify a key for the string you want localized in your visual
     */
    export function getLocalizedString(locale: string, key: string): string {
        const ret = myResources && key && myResources[key]  && (((myResources[key]).localization[locale]) || (myResources[key]).defaultValue);
        return (ret === undefined)? key : ret;
   }

}
