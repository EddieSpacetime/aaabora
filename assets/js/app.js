/**
 * Aabora Application Controller & UI State Manager (Full Suite)
 */

class AppController {
    constructor() {
        this.cart = JSON.parse(localStorage.getItem('aabora_cart')) || [];
        this.wishlist = JSON.parse(localStorage.getItem('aabora_wishlist')) || [];
        this.products = [];
        this.activeQuickViewProduct = null;
        this.currentCurrency = localStorage.getItem('aabora_currency') || 'EUR';
        this.rates = { EUR: 1.0, USD: 1.08, GBP: 0.85 };
        this.symbols = { EUR: '€', USD: '$', GBP: '£' };

        this.storyTexts = {
            philosophy: {
                en: "Aabora was born from a deep reverence for the raw, untamed elements of nature. We believe fine jewelry should not feel sterile, but rather carry an organic soul—sculpted with textures inspired by sea-carved stones, ancient bark, and molten earth.",
                el: "Η Aabora γεννήθηκε από έναν βαθύ σεβασμό για τα ανεπεξέργαστα στοιχεία της φύσης. Πιστεύουμε ότι τα πολύτιμα κοσμήματα πρέπει να φέρουν μια οργανική ψυχή—σμιλευμένη με υφές εμπνευσμένες από τη θάλασσα, τον φλοιό των δέντρων και τη λιωμένη γη.",
                it: "Aabora nasce da un profondo rispetto per gli elementi naturali. Crediamo che i gioielli debbano racchiudere un'anima organica—scolpita con texture ispirate alle pietre levigate dal mare e alla terra fusa."
            },
            craft: {
                en: "Every single piece is lost-wax cast and finished entirely by hand in our studio atelier. No two creations are identical, ensuring that every ring, necklace, and pair of earrings remains an exclusive artifact of craftsmanship.",
                el: "Κάθε κομμάτι κατασκευάζεται με τη μέθοδο του χαμένου κεριού και ολοκληρώνεται εξ ολοκλήρου στο χέρι στο ατελιέ μας. Κανένα δημιουργήμα δεν είναι απόλυτα ίδιο με το άλλο, διασφαλίζοντας τη μοναδικότητα κάθε κοσμίου.",
                it: "Ogni singolo pezzo è realizzato con la fusione a cera persa e rifinito a mano nel nostro atelier. Nessuna creazione è identica all'altra."
            },
            sustainability: {
                en: "We strictly utilize 100% recycled 18k gold, sterling silver, and ethically sourced conflict-free gemstones. Our commitment is to honor both artisan tradition and mother earth in equal balance.",
                el: "Χρησιμοποιούμε αποκλειστικά 100% ανακυκλωμένο χρυσό 18k, ασήμι 925 και ηθικά εξορυγμένους φυσικούς λίθους, τιμώντας τόσο την παράδοση όσο και το περιβάλλον.",
                it: "Utilizziamo esclusivamente oro 18k riciclato al 100%, argento 925 e pietre preziose estratte eticamente per onorare sia la tradizione che il nostro pianeta."
            }
        };
    }

    async init() {
        this.setupIntroSplash(); // Initialize splash immediately so buttons work instantly
        await this.loadProductData();
        this.setupCurrencySelector();
        this.setupEventListeners();
        this.updateCartUI();
        this.updateWishlistUI();
        this.handleURLParameters();
    }

    setupIntroSplash() {
        const splash = document.getElementById('intro-splash');
        const video = document.getElementById('intro-video');
        const skipBtn = document.getElementById('skip-intro');

        if (!splash) return;

        // If user already saw intro this session, remove immediately
        if (sessionStorage.getItem('aabora_intro_seen')) {
            splash.remove();
            return;
        }

        const dismissSplash = () => {
            if (!splash.parentNode) return;
            splash.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                splash.remove();
            }, 700);
            sessionStorage.setItem('aabora_intro_seen', 'true');
        };

        if (video) {
            video.addEventListener('ended', dismissSplash);
            video.play().catch(err => {
                console.log("Autoplay blocked by browser policy, waiting for user interaction.", err);
            });
        }

        if (skipBtn) {
            skipBtn.addEventListener('click', (e) => {
                e.preventDefault();
                dismissSplash();
            });
        }
    }

    setupCurrencySelector() {
        const selectEl = document.getElementById('currency-select');
        if (selectEl) {
            selectEl.value = this.currentCurrency;
            selectEl.addEventListener('change', (e) => {
                this.currentCurrency = e.target.value;
                localStorage.setItem('aabora_currency', this.currentCurrency);
                this.updateCartUI();
                window.dispatchEvent(new CustomEvent('currencyChanged', { detail: { currency: this.currentCurrency } }));
            });
        }
    }

    formatPrice(eurPrice) {
        const rate = this.rates[this.currentCurrency] || 1.0;
        const symbol = this.symbols[this.currentCurrency] || '€';
        return `${symbol}${(eurPrice * rate).toFixed(2)}`;
    }

    async loadProductData() {
        try {
            const response = await fetch('data/products.json');
            if (response.ok) {
                this.products = await response.json();
            }
        } catch (error) {
            console.error('AppController Error loading products:', error);
        }
    }

    setupEventListeners() {
        const cartBtn = document.getElementById('cart-btn');
        const closeCart = document.getElementById('close-cart');
        const cartDrawer = document.getElementById('cart-drawer');

        if (cartBtn && cartDrawer) {
            cartBtn.addEventListener('click', () => cartDrawer.classList.remove('hidden'));
        }
        if (closeCart && cartDrawer) {
            closeCart.addEventListener('click', () => cartDrawer.classList.add('hidden'));
        }

        const wishlistBtn = document.getElementById('wishlist-btn');
        const closeWishlist = document.getElementById('close-wishlist');
        const wishlistDrawer = document.getElementById('wishlist-drawer');

        if (wishlistBtn && wishlistDrawer) {
            wishlistBtn.addEventListener('click', () => wishlistDrawer.classList.remove('hidden'));
        }
        if (closeWishlist && wishlistDrawer) {
            closeWishlist.addEventListener('click', () => wishlistDrawer.classList.add('hidden'));
        }

        document.addEventListener('click', (e) => {
            const checkoutBtn = e.target.closest('[data-i18n="cart_checkout"]');
            if (checkoutBtn) {
                e.preventDefault();
                this.checkout();
            }
        });

        document.addEventListener('click', (e) => {
            const addToCartBtn = e.target.closest('.add-to-cart');
            if (addToCartBtn) {
                const productId = addToCartBtn.getAttribute('data-id');
                this.addToCart(productId);
            }

            const wishlistToggle = e.target.closest('.wishlist-toggle');
            if (wishlistToggle) {
                const productId = wishlistToggle.getAttribute('data-id');
                this.toggleWishlist(productId);
            }

            const qvBtn = e.target.closest('.quickview-btn');
            if (qvBtn) {
                const productId = qvBtn.getAttribute('data-id');
                this.openQuickView(productId);
            }

            const removeBtn = e.target.closest('.remove-cart-item');
            if (removeBtn) {
                const productId = removeBtn.getAttribute('data-id');
                this.removeFromCart(productId);
            }

            const clearCartBtn = e.target.closest('.clear-cart-btn');
            if (clearCartBtn) {
                this.clearCart();
            }
        });

        [cartDrawer, wishlistDrawer].forEach(drawer => {
            if (drawer) {
                drawer.addEventListener('click', (e) => {
                    if (e.target === drawer || e.target.classList.contains('backdrop-blur-sm')) {
                        drawer.classList.add('hidden');
                    }
                });
            }
        });

        const openBespokeBtn = document.getElementById('open-bespoke-modal');
        const closeBespokeBtn = document.getElementById('close-bespoke-modal');
        const bespokeModal = document.getElementById('bespoke-modal');
        const bespokeForm = document.getElementById('bespoke-form');

        if (openBespokeBtn && bespokeModal) {
            openBespokeBtn.addEventListener('click', () => bespokeModal.classList.remove('hidden'));
        }
        if (closeBespokeBtn && bespokeModal) {
            closeBespokeBtn.addEventListener('click', () => bespokeModal.classList.add('hidden'));
        }
        if (bespokeModal) {
            bespokeModal.addEventListener('click', (e) => {
                if (e.target === bespokeModal || e.target.classList.contains('backdrop-blur-sm')) {
                    bespokeModal.classList.add('hidden');
                }
            });
        }

        if (bespokeForm) {
            bespokeForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const payload = {
                    name: document.getElementById('bespoke-name').value.trim(),
                    email: document.getElementById('bespoke-email').value.trim(),
                    metal: document.getElementById('bespoke-metal').value,
                    budget: document.getElementById('bespoke-budget').value.trim(),
                    notes: document.getElementById('bespoke-notes').value.trim()
                };

                try {
                    const response = await fetch('/api/bespoke-inquiry', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        bespokeModal.classList.add('hidden');
                        bespokeForm.reset();

                        const successMessage = window.i18n 
                            ? window.i18n.t('toast_bespoke_success') 
                            : 'Thank you! Your bespoke inquiry has been submitted.';

                        this.showToast(successMessage, 'gem');
                    } else {
                        throw new Error('Failed to submit');
                    }
                } catch (error) {
                    console.error('Bespoke Submission Error:', error);
                    this.showToast('Submission failed. Please try again.', 'triangle-exclamation');
                }
            });
        }

        const qvModal = document.getElementById('quickview-modal');
        const closeQvBtn = document.getElementById('close-quickview-modal');
        const qvAddCartBtn = document.getElementById('qv-add-cart');
        const qvWishlistBtn = document.getElementById('qv-toggle-wishlist');

        if (closeQvBtn && qvModal) {
            closeQvBtn.addEventListener('click', () => qvModal.classList.add('hidden'));
        }
        if (qvModal) {
            qvModal.addEventListener('click', (e) => {
                if (e.target === qvModal || e.target.classList.contains('backdrop-blur-sm')) {
                    qvModal.classList.add('hidden');
                }
            });
        }
        if (qvAddCartBtn) {
            qvAddCartBtn.addEventListener('click', () => {
                if (this.activeQuickViewProduct) {
                    this.addToCart(this.activeQuickViewProduct.id);
                }
            });
        }
        if (qvWishlistBtn) {
            qvWishlistBtn.addEventListener('click', () => {
                if (this.activeQuickViewProduct) {
                    this.toggleWishlist(this.activeQuickViewProduct.id);
                }
            });
        }

        const openStoryBtn = document.getElementById('open-story-modal');
        const closeStoryBtn = document.getElementById('close-story-modal');
        const storyModal = document.getElementById('story-modal');
        const storyTabs = document.querySelectorAll('.story-tab');

        if (openStoryBtn && storyModal) {
            openStoryBtn.addEventListener('click', () => {
                storyModal.classList.remove('hidden');
                this.updateStoryTabContent('philosophy');
            });
        }
        if (closeStoryBtn && storyModal) {
            closeStoryBtn.addEventListener('click', () => storyModal.classList.add('hidden'));
        }
        if (storyModal) {
            storyModal.addEventListener('click', (e) => {
                if (e.target === storyModal || e.target.classList.contains('backdrop-blur-sm')) {
                    storyModal.classList.add('hidden');
                }
            });
        }

        storyTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                storyTabs.forEach(t => {
                    t.classList.remove('active', 'border-brand-900', 'text-brand-900');
                    t.classList.add('border-transparent', 'text-stone-400');
                });

                const targetBtn = e.target.closest('.story-tab');
                targetBtn.classList.add('active', 'border-brand-900', 'text-brand-900');
                targetBtn.classList.remove('border-transparent', 'text-stone-400');

                const targetTab = targetBtn.getAttribute('data-tab');
                this.updateStoryTabContent(targetTab);
            });
        });

        window.addEventListener('languageChanged', () => {
            const activeTab = document.querySelector('.story-tab.active');
            const tabName = activeTab ? activeTab.getAttribute('data-tab') : 'philosophy';
            this.updateStoryTabContent(tabName);
        });
    }

    updateStoryTabContent(tabName) {
        const textEl = document.getElementById('story-text');
        if (!textEl) return;

        const currentLang = localStorage.getItem('aabora_lang') || 'en';
        const key = `story_${tabName}_text`;

        let content = '';
        if (window.i18n && window.i18n.translations[key]) {
            content = window.i18n.translations[key];
        } else if (this.storyTexts[tabName]) {
            content = this.storyTexts[tabName][currentLang] || this.storyTexts[tabName].en;
        }

        textEl.setAttribute('data-i18n', key);
        textEl.textContent = content;
    }

    openQuickView(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        this.activeQuickViewProduct = product;
        const currentLang = localStorage.getItem('aabora_lang') || 'en';

        const modal = document.getElementById('quickview-modal');
        const img = document.getElementById('qv-image');
        const category = document.getElementById('qv-category');
        const title = document.getElementById('qv-title');
        const price = document.getElementById('qv-price');
        const description = document.getElementById('qv-description');

        if (img) img.src = product.image;
        if (category) category.textContent = product.category;
        if (title) title.textContent = product.name[currentLang] || product.name.en;
        if (price) price.textContent = this.formatPrice(product.price);
        if (description) description.textContent = product.description ? (product.description[currentLang] || product.description.en) : '';

        modal.classList.remove('hidden');
    }

    handleURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.get('session_id')) {
            this.cart = [];
            this.saveCart();
            this.updateCartUI();
            this.showToast('Thank you for your order! Payment successful.', 'circle-check');
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (urlParams.get('canceled')) {
            this.showToast('Payment canceled. Your bag has been saved.', 'circle-xmark');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    getProductTitle(product) {
        if (!product || !product.name) return '';
        const currentLang = localStorage.getItem('aabora_lang') || 'en';
        return product.name[currentLang] || product.name.en || '';
    }

    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        const existingItem = this.cart.find(item => item.id === productId);

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({ id: productId, quantity: 1 });
        }

        this.saveCart();
        this.updateCartUI();

        const title = this.getProductTitle(product);
        const actionText = window.i18n ? window.i18n.t('toast_added_to_cart') : 'added to your bag';
        this.showToast(`${title} ${actionText}`, 'bag-shopping');
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.saveCart();
        this.updateCartUI();
        this.showToast('Item removed from your bag.', 'trash-can');
    }

    clearCart() {
        this.cart = [];
        this.saveCart();
        this.updateCartUI();
        this.showToast('Your shopping bag has been cleared.', 'trash-can');
    }

    toggleWishlist(productId) {
        const index = this.wishlist.indexOf(productId);
        const product = this.products.find(p => p.id === productId);
        const title = this.getProductTitle(product);
        let message = '';

        if (index > -1) {
            this.wishlist.splice(index, 1);
            const actionText = window.i18n ? window.i18n.t('toast_removed_from_wishlist') : 'removed from your wishlist';
            message = `${title} ${actionText}`;
        } else {
            this.wishlist.push(productId);
            const actionText = window.i18n ? window.i18n.t('toast_added_to_wishlist') : 'added to your wishlist';
            message = `${title} ${actionText}`;
        }

        this.saveWishlist();
        this.updateWishlistUI();
        this.showToast(message, 'heart');

        window.dispatchEvent(new CustomEvent('wishlistUpdated', { detail: { wishlist: this.wishlist } }));
    }

    saveCart() {
        localStorage.setItem('aabora_cart', JSON.stringify(this.cart));
    }

    saveWishlist() {
        localStorage.setItem('aabora_wishlist', JSON.stringify(this.wishlist));
    }

    updateCartUI() {
        const badge = document.getElementById('cart-badge');
        const container = document.getElementById('cart-items');
        const subtotalEl = document.getElementById('cart-subtotal-price');

        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);

        if (badge) {
            badge.textContent = totalItems;
            badge.classList.toggle('hidden', totalItems === 0);
        }

        let subtotal = 0;

        if (container) {
            if (this.cart.length === 0) {
                container.innerHTML = `<p class="text-center text-stone-400 py-8 text-xs font-light">Your shopping bag is empty.</p>`;
            } else {
                const currentLang = localStorage.getItem('aabora_lang') || 'en';

                let html = `
                    <div class="flex justify-between items-center pb-3 mb-3 border-b border-brand-200 text-xs">
                        <span class="text-stone-500 font-medium">${totalItems} items</span>
                        <button class="clear-cart-btn text-red-600 hover:text-red-800 flex items-center space-x-1 transition cursor-pointer">
                            <i class="fa-solid fa-trash-can text-[11px]"></i>
                            <span>Αφαίρεση όλων</span>
                        </button>
                    </div>
                `;

                html += this.cart.map(item => {
                    const product = this.products.find(p => p.id === item.id);
                    if (!product) return '';
                    const title = product.name[currentLang] || product.name.en;
                    const itemTotal = product.price * item.quantity;
                    subtotal += itemTotal;

                    return `
                        <div class="flex items-center space-x-4 border-b border-brand-200 pb-4 mb-4">
                            <img src="${product.image}" alt="${title}" class="w-16 h-16 object-cover rounded bg-brand-100 flex-shrink-0">
                            <div class="flex-grow">
                                <h4 class="font-serif text-sm font-medium text-brand-900">${title}</h4>
                                <div class="text-xs text-stone-500 mt-0.5">Qty: ${item.quantity}</div>
                                <div class="font-serif text-sm font-semibold text-brand-900 mt-1">${this.formatPrice(itemTotal)}</div>
                            </div>
                            <button class="remove-cart-item text-stone-400 hover:text-red-600 p-2 transition cursor-pointer" data-id="${product.id}" title="Remove item">
                                <i class="fa-solid fa-trash-can text-sm"></i>
                            </button>
                        </div>
                    `;
                }).join('');

                container.innerHTML = html;
            }
        }

        if (subtotalEl) {
            subtotalEl.textContent = this.formatPrice(subtotal);
        }
    }

    updateWishlistUI() {
        const badge = document.getElementById('wishlist-badge');
        const container = document.getElementById('wishlist-items');

        if (badge) {
            badge.textContent = this.wishlist.length;
            badge.classList.toggle('hidden', this.wishlist.length === 0);
        }

        if (container) {
            if (this.wishlist.length === 0) {
                container.innerHTML = `<p class="text-center text-stone-400 py-8 text-xs font-light">Your wishlist is empty.</p>`;
            } else {
                const currentLang = localStorage.getItem('aabora_lang') || 'en';
                container.innerHTML = this.wishlist.map(id => {
                    const product = this.products.find(p => p.id === id);
                    if (!product) return '';
                    const title = product.name[currentLang] || product.name.en;

                    return `
                        <div class="flex items-center space-x-4 border-b border-brand-200 pb-4">
                            <img src="${product.image}" alt="${title}" class="w-16 h-16 object-cover rounded bg-brand-100">
                            <div class="flex-grow">
                                <h4 class="font-serif text-sm font-medium text-brand-900">${title}</h4>
                                <div class="font-serif text-sm font-semibold">${this.formatPrice(product.price)}</div>
                            </div>
                            <button class="add-to-cart bg-brand-900 text-brand-50 text-[10px] py-1.5 px-3 rounded uppercase tracking-wider" data-id="${product.id}">
                                Add
                            </button>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    async checkout() {
        if (this.cart.length === 0) {
            this.showToast('Your bag is empty!', 'triangle-exclamation');
            return;
        }

        const currentLang = localStorage.getItem('aabora_lang') || 'en';

        const checkoutItems = this.cart.map(item => {
            const product = this.products.find(p => p.id === item.id);
            const rate = this.rates[this.currentCurrency] || 1.0;
            return {
                name: product ? (product.name[currentLang] || product.name.en) : 'Jewelry Item',
                price: product ? (product.price * rate) : 0,
                qty: item.quantity,
                image: product ? product.image : ''
            };
        });

        try {
            const response = await fetch('/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    items: checkoutItems,
                    currency: this.currentCurrency,
                    lang: currentLang
                })
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Failed to initiate checkout.');
            }
        } catch (error) {
            console.error('Checkout error:', error);
            this.showToast('Checkout failed. Please try again.', 'triangle-exclamation');
        }
    }

    showToast(message, iconName = 'check') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast-notification pointer-events-auto flex items-center space-x-3 bg-brand-900 text-brand-50 text-xs px-5 py-3.5 rounded-lg shadow-2xl border border-brand-800 transition-all duration-300 transform translate-y-4 opacity-0';
        
        toast.innerHTML = `
            <i class="fa-solid fa-${iconName} text-sm"></i>
            <span class="font-light tracking-wide">${message}</span>
        `;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-4', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
        });

        setTimeout(() => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-2', 'opacity-0');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
}

const appController = new AppController();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        appController.init();
    });
} else {
    appController.init();
}