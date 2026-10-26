/**
 * Aabora Product Manager
 * Dynamic catalog rendering with localization support for names and descriptions.
 */

class ProductManager {
    constructor() {
        this.products = [];
        this.currentFilter = 'all';
    }

    async init() {
        await this.loadProducts();
        this.setupFilterListeners();
        this.setupLanguageListener();
        this.renderProducts();
    }

    async loadProducts() {
        try {
            const response = await fetch('data/products.json');
            if (!response.ok) throw new Error('Failed to load products.json');
            this.products = await response.json();
        } catch (error) {
            console.error('Product loading error:', error);
            this.products = [];
        }
    }

    setupFilterListeners() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterButtons.forEach(b => {
                    b.classList.remove('bg-brand-900', 'text-brand-50');
                    b.classList.add('bg-brand-100', 'text-brand-900');
                });

                const target = e.currentTarget;
                target.classList.remove('bg-brand-100', 'text-brand-900');
                target.classList.add('bg-brand-900', 'text-brand-50');

                this.currentFilter = target.getAttribute('data-filter') || 'all';
                this.renderProducts(this.currentFilter);
            });
        });
    }

    setupLanguageListener() {
        window.addEventListener('languageChanged', () => {
            this.renderProducts(this.currentFilter);
        });
    }

    renderProducts(filter = this.currentFilter) {
        const grid = document.getElementById('product-grid');
        if (!grid) return;

        const currentLang = localStorage.getItem('aabora_lang') || 'en';

        const filteredProducts = filter === 'all'
            ? this.products
            : this.products.filter(p => p.category === filter);

        if (filteredProducts.length === 0) {
            grid.innerHTML = `<p class="col-span-full text-center text-stone-500 py-12">No products found.</p>`;
            return;
        }

        grid.innerHTML = filteredProducts.map(product => {
            const title = (product.name && product.name[currentLang]) 
                ? product.name[currentLang] 
                : (product.name ? product.name.en : '');

            const description = (product.description && product.description[currentLang]) 
                ? product.description[currentLang] 
                : (product.description ? product.description.en : '');

            return `
                <div class="product-card bg-brand-50 border border-brand-200 rounded-lg overflow-hidden group hover:shadow-lg transition duration-300">
                    <div class="relative overflow-hidden aspect-square bg-brand-100">
                        <img src="${product.image}" alt="${title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                        <button class="wishlist-toggle absolute top-3 right-3 w-9 h-9 bg-brand-50/80 backdrop-blur rounded-full flex items-center justify-center text-brand-900 hover:text-red-500 transition" data-id="${product.id}">
                            <i class="fa-regular fa-heart"></i>
                        </button>
                    </div>
                    <div class="p-5 flex flex-col justify-between flex-grow">
                        <div>
                            <div class="text-[10px] uppercase tracking-widest text-stone-400 mb-1">${product.category}</div>
                            <h3 class="font-serif text-lg font-medium mb-2 text-brand-900">${title}</h3>
                            <p class="text-xs text-stone-500 mb-4 line-clamp-2 font-light leading-relaxed">${description}</p>
                        </div>
                        <div class="flex items-center justify-between pt-2 border-t border-brand-200/50">
                            <span class="font-serif text-base font-semibold">€${product.price.toFixed(2)}</span>
                            <button class="add-to-cart bg-brand-900 text-brand-50 text-xs py-2 px-4 rounded tracking-wider uppercase hover:bg-brand-800 transition" data-id="${product.id}">
                                <span data-i18n="add_to_cart">Add to Bag</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (window.i18n && typeof window.i18n.translatePage === 'function') {
            window.i18n.translatePage();
        }
    }
}

const productManager = new ProductManager();
document.addEventListener('DOMContentLoaded', () => {
    productManager.init();
});