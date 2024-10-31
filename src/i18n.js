class I18n {

    //var
    _config = {
        current: "en",
        mainLangs: [
            "en",
            "es"
        ],
        strings: {
        },
        langs: {
            en: { label: 'English' },
            fr: { label: 'French' },
            de: { label: 'German' },
            es: { label: 'Spanish' },
            ab: { label: 'Abkhazian' },
            aa: { label: 'Afar' },
            af: { label: 'Afrikaans' },
            ak: { label: 'Akan' },
            sq: { label: 'Albanian' },
            am: { label: 'Amharic' },
            ar: { label: 'Arabic' },
            an: { label: 'Aragonese' },
            hy: { label: 'Armenian' },
            as: { label: 'Assamese' },
            av: { label: 'Avaric' },
            ae: { label: 'Avestan' },
            ay: { label: 'Aymara' },
            az: { label: 'Azerbaijani' },
            bm: { label: 'Bambara' },
            ba: { label: 'Bashkir' },
            eu: { label: 'Basque' },
            be: { label: 'Belarusian' },
            bn: { label: 'Bengali (Bangla)' },
            bh: { label: 'Bihari' },
            bi: { label: 'Bislama' },
            bs: { label: 'Bosnian' },
            br: { label: 'Breton' },
            bg: { label: 'Bulgarian' },
            my: { label: 'Burmese' },
            ca: { label: 'Catalan' },
            ch: { label: 'Chamorro' },
            ce: { label: 'Chechen' },
            ny: { label: 'Chichewa, Chewa, Nyanja' },
            zh: { label: 'Chinese' },
            "zh-Hans": { label: 'Chinese (Simplified)' },
            "zh-Hant": { label: 'Chinese (Traditional)' },
            cv: { label: 'Chuvash' },
            kw: { label: 'Cornish' },
            co: { label: 'Corsican' },
            cr: { label: 'Cree' },
            hr: { label: 'Croatian' },
            cs: { label: 'Czech' },
            da: { label: 'Danish' },
            dv: { label: 'Divehi, Dhivehi, Maldivian' },
            nl: { label: 'Dutch' },
            dz: { label: 'Dzongkha' },
            eo: { label: 'Esperanto' },
            et: { label: 'Estonian' },
            ee: { label: 'Ewe' },
            fo: { label: 'Faroese' },
            fj: { label: 'Fijian' },
            fi: { label: 'Finnish' },
            ff: { label: 'Fula, Fulah, Pulaar, Pular' },
            gl: { label: 'Galician' },
            gd: { label: 'Gaelic (Scottish)' },
            gv: { label: 'Gaelic (Manx)' },
            ka: { label: 'Georgian' },
            el: { label: 'Greek' },
            kl: { label: 'Greenlandic' },
            gn: { label: 'Guarani' },
            gu: { label: 'Gujarati' },
            ht: { label: 'Haitian Creole' },
            ha: { label: 'Hausa' },
            he: { label: 'Hebrew' },
            hz: { label: 'Herero' },
            hi: { label: 'Hindi' },
            ho: { label: 'Hiri Motu' },
            hu: { label: 'Hungarian' },
            is: { label: 'Icelandic' },
            io: { label: 'Ido' },
            ig: { label: 'Igbo' },
            id: { label: 'Indonesian' },
            in: { label: 'Indonesian' },
            ia: { label: 'Interlingua' },
            ie: { label: 'Interlingue' },
            iu: { label: 'Inuktitut' },
            ik: { label: 'Inupiak' },
            ga: { label: 'Irish' },
            it: { label: 'Italian' },
            ja: { label: 'Japanese' },
            jv: { label: 'Javanese' },
            kn: { label: 'Kannada' },
            kr: { label: 'Kanuri' },
            ks: { label: 'Kashmiri' },
            kk: { label: 'Kazakh' },
            km: { label: 'Khmer' },
            ki: { label: 'Kikuyu' },
            rw: { label: 'Kinyarwanda (Rwanda)' },
            rn: { label: 'Kirundi' },
            ky: { label: 'Kyrgyz' },
            kv: { label: 'Komi' },
            kg: { label: 'Kongo' },
            ko: { label: 'Korean' },
            ku: { label: 'Kurdish' },
            kj: { label: 'Kwanyama' },
            lo: { label: 'Lao' },
            la: { label: 'Latin' },
            lv: { label: 'Latvian (Lettish)' },
            li: { label: 'Limburgish ( Limburger)' },
            ln: { label: 'Lingala' },
            lt: { label: 'Lithuanian' },
            lu: { label: 'Luga-Katanga' },
            lg: { label: 'Luganda, Ganda' },
            lb: { label: 'Luxembourgish' },
            mk: { label: 'Macedonian' },
            mg: { label: 'Malagasy' },
            ms: { label: 'Malay' },
            ml: { label: 'Malayalam' },
            mt: { label: 'Maltese' },
            mi: { label: 'Maori' },
            mr: { label: 'Marathi' },
            mh: { label: 'Marshallese' },
            mo: { label: 'Moldavian' },
            mn: { label: 'Mongolian' },
            na: { label: 'Nauru' },
            nv: { label: 'Navajo' },
            ng: { label: 'Ndonga' },
            nd: { label: 'Northern Ndebele' },
            ne: { label: 'Nepali' },
            no: { label: 'Norwegian' },
            nb: { label: 'Norwegian bokmål' },
            nn: { label: 'Norwegian nynorsk' },
            ii: { label: 'Nuosu' },
            oc: { label: 'Occitan' },
            oj: { label: 'Ojibwe' },
            cu: { label: 'Old Church Slavonic, Old Bulgarian' },
            or: { label: 'Oriya' },
            om: { label: 'Oromo (Afaan Oromo)' },
            os: { label: 'Ossetian' },
            pi: { label: 'Pāli' },
            ps: { label: 'Pashto, Pushto' },
            fa: { label: 'Persian (Farsi)' },
            pl: { label: 'Polish' },
            pt: { label: 'Portuguese' },
            pa: { label: 'Punjabi (Eastern)' },
            qu: { label: 'Quechua' },
            rm: { label: 'Romansh' },
            ro: { label: 'Romanian' },
            ru: { label: 'Russian' },
            se: { label: 'Sami' },
            sm: { label: 'Samoan' },
            sg: { label: 'Sango' },
            sa: { label: 'Sanskrit' },
            sr: { label: 'Serbian' },
            sh: { label: 'Serbo-Croatian' },
            st: { label: 'Sesotho' },
            tn: { label: 'Setswana' },
            sn: { label: 'Shona' },
            sd: { label: 'Sindhi' },
            si: { label: 'Sinhalese' },
            sk: { label: 'Slovak' },
            sl: { label: 'Slovenian' },
            so: { label: 'Somali' },
            nr: { label: 'Southern Ndebele' },
            su: { label: 'Sundanese' },
            sw: { label: 'Swahili (Kiswahili)' },
            ss: { label: 'Swati' },
            sv: { label: 'Swedish' },
            tl: { label: 'Tagalog' },
            ty: { label: 'Tahitian' },
            tg: { label: 'Tajik' },
            ta: { label: 'Tamil' },
            tt: { label: 'Tatar' },
            te: { label: 'Telugu' },
            th: { label: 'Thai' },
            bo: { label: 'Tibetan' },
            ti: { label: 'Tigrinya' },
            to: { label: 'Tonga' },
            ts: { label: 'Tsonga' },
            tr: { label: 'Turkish' },
            tk: { label: 'Turkmen' },
            tw: { label: 'Twi' },
            ug: { label: 'Uyghur' },
            uk: { label: 'Ukrainian' },
            ur: { label: 'Urdu' },
            uz: { label: 'Uzbek' },
            ve: { label: 'Venda' },
            vi: { label: 'Vietnamese' },
            vo: { label: 'Volapük' },
            wa: { label: 'Wallon' },
            cy: { label: 'Welsh' },
            wo: { label: 'Wolof' },
            fy: { label: 'Western Frisian' },
            xh: { label: 'Xhosa' },
            yi: { label: 'Yiddish' },
            ji: { label: 'Yiddish' },
            yo: { label: 'Yoruba' },
            za: { label: 'Zhuang, Chuang' },
            zu: { label: 'Zulu' }
        }
    }
    ;
    
    //ctor
    constructor(){
    }

    //props
    get config() {return this._config;}

    //methods
    async init(config) { 
        this._config = config;
        Object.freeze(this._config);
    }
    translate(label) {
        var result = this._config.strings[label];
        if (!result) result = label;
        return result;    
    }
}


// instance
let instance = new I18n();


// function
function i18n (label) {
    return instance.translate(label);
};
i18n.init = async function(config) {
    await instance.init(config);
};
Object.defineProperty(i18n, 'config', {
    get() {
        return instance.config;
    },
});


//export
export default i18n;
export { I18n };