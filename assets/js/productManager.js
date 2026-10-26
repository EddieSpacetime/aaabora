/**
 * Aabora Product Manager & Dynamic Grid Renderer (Multi-Currency Support)
 */

class ProductManager {
    constructor() {
        this.products = [];
        this.currentCategory = 'all';
        this.rates = { EUR: 1.0, USD: 1.08, GBP: 0.85 };
        this.symbols = { EUR: '€', USD: '$', GBP: '£' };
    }

    async init() {
        await this.loadProducts();
        this.setupListeners();
        this.renderGrid();
    }

    async loadProducts() {
        try {
            const response = await fetch('data/products.json');
            if (response.ok) {
                this.products = await response.json();
            }
        } catch (error) {
            console.error('ProductManager Error loading products:', error);
        }
    }

    setupListeners() {
        const filterBtns = document.querySelectorAll('#category-filters .category-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterBtns.forEach(b => b.classList.remove('active', 'bg-brand-900', 'text-brand-50'));
                filterBtns.forEach(b => b.classList.add('border-brand-200', 'text-brand-900'));
                
                e.target.classList.add('active', 'bg-brand-900', 'text-brand-50');
                
                this.currentCategory = e.target.getAttribute('data-category');
                this.renderGrid();
            });
        });

        window.addEventListener('languageChanged', () => this.renderGrid());
        window.addEventListener('currencyChanged', () => this.renderGrid());
    }

    formatPrice(eurPrice) {
        const currentCurr = localStorage.getItem('aabora_currency') || 'EUR';
        const rate = this.rates[currentCurr] || 1.0;
        const symbol = this.symbols[currentCurr] || '€';
        const converted = eurPrice * rate;
        return `${symbol}${converted.toFixed(2)}`;
    }

    renderGrid() {
        const grid = document.getElementById('product-grid');
        if (!grid) return;

        const currentLang = localStorage.getItem('aabora_lang') || 'en';
        const wishlist = JSON.parse(localStorage.getItem('aabora_wishlist')) || [];

        const filteredProducts = this.currentCategory === 'all' 
            ? this.products 
            : this.products.filter(p => p.category === this.currentCategory);

        if (filteredProducts.length === 0) {
            grid.innerHTML = `<p class="col-span-full text-center text-stone-400 py-12 font-light text-sm">No items found in this category.</p>`;
            return;
        }

        const addToCartText = window.i18n ? window.i18n.t('add_to_cart') : 'Add to Bag';
        const quickViewText = window.i18n ? window.i18n.t('quick_view') : 'Quick View';

        grid.innerHTML = filteredProducts.map(product => {
            const title = product.name[currentLang] || product.name.en;
            const description = product.description ? (product.description[currentLang] || product.description.en) : '';
            const isWishlisted = wishlist.includes(product.id);
            const formattedPrice = this.formatPrice(product.price);

            return `
                <div class="group relative bg-brand-50 rounded-lg overflow-hidden border border-brand-200/60 transition duration-300 hover:shadow-xl flex flex-col justify-between">
                    <div class="relative overflow-hidden bg-brand-100 aspect-square">
                        <img src="${product.image}" alt="${title}" class="w-full h-full object-cover object-center group-hover:scale-105 transition duration-500">
                        
                        <button class="wishlist-toggle absolute top-3 right-3 p-2 bg-brand-50/80 rounded-full text-brand-900 hover:text-red-500 backdrop-blur-sm transition shadow" data-id="${product.id}">
                            <i class="${isWishlisted ? 'fa-solid text-red-500' : 'fa-regular'} fa-heart text-base"></i>
                        </button>

                        <button class="quickview-btn absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-brand-900/90 text-brand-50 text-[10px] uppercase tracking-widest px-4 py-2 rounded shadow opacity-0 group-hover:opacity-100 transition duration-300 hover:bg-brand-900" data-id="${product.id}">
                            ${quickViewText}
                        </button>
                    </div>

                    <div class="p-5 flex flex-col flex-grow justify-between">
                        <div>
                            <span class="text-[9px] uppercase tracking-widest text-stone-400 font-semibold block mb-1">${product.category}</span>
                            <h3 class="font-serif text-base font-medium text-brand-900 mb-1 group-hover:text-stone-600 transition">${title}</h3>
                            <p class="text-xs text-stone-500 line-clamp-2 font-light mb-4">${description}</p>
                        </div>
                        
                        <div class="flex items-center justify-between pt-2 border-t border-brand-200/40">
                            <span class="font-serif text-base font-semibold text-brand-900">${formattedPrice}</span>
                            <button class="add-to-cart bg-brand-900 text-brand-50 text-[10px] uppercase tracking-widest font-semibold px-3 py-2 rounded hover:bg-brand-800 transition" data-id="${product.id}">
                                ${addToCartText}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

const productManager = new ProductManager();
document.addEventListener('DOMContentLoaded', () => {
    productManager.init();
});