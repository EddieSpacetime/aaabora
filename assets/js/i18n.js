/**
 * Aabora Internationalization (i18n) Engine
 */

class I18n {
    constructor() {
        this.defaultLang = 'en';
        this.currentLang = localStorage.getItem('aabora_lang') || this.defaultLang;
        this.translations = {};
    }

    async init() {
        const selectEl = document.getElementById('language-select');
        if (selectEl) {
            selectEl.value = this.currentLang;
            selectEl.addEventListener('change', (e) => {
                this.changeLanguage(e.target.value);
            });
        }

        document.documentElement.setAttribute('lang', this.currentLang);
        await this.loadTranslations(this.currentLang);
        
        // Translate all existing DOM elements immediately
        this.translatePage();
    }

    async loadTranslations(lang) {
        try {
            const response = await fetch(`locales/${lang}.json`);
            if (!response.ok) throw new Error(`Failed to load locale file: ${lang}.json`);
            this.translations = await response.json();
        } catch (error) {
            console.error('I18n Translation Error:', error);
            if (lang !== 'en') {
                await this.loadTranslations('en');
            }
        }
    }

    async changeLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('aabora_lang', lang);
        document.documentElement.setAttribute('lang', lang);

        await this.loadTranslations(lang);
        this.translatePage();

        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }

    translatePage() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (this.translations[key]) {
                if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.hasAttribute('placeholder')) {
                    el.placeholder = this.translations[key];
                } else {
                    el.textContent = this.translations[key];
                }
            }
        });
    }

    t(key) {
        return this.translations[key] || key;
    }
}

const i18n = new I18n();
document.addEventListener('DOMContentLoaded', () => {
    i18n.init();
});