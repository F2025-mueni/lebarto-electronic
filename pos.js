
 // =====================================================
 // LEBARTO ELECTRONICS - POS.JS
 // Secure stock updates • Split payments • Kopo Kopo
 // Receipt printing • Firebase authentication
 // =====================================================

import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    getDocs,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// =====================================================
// GLOBALS
// =====================================================

let currentUser = null;
let currentUserData = null;
let products = [];
let filteredProducts = [];
let cart = [];
let processingSale = false;
let productsUnsubscribe = null;

// =====================================================
// AUTHENTICATION
// =====================================================

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    const loaded = await loadCurrentUser();

    if (!loaded) return;

    loadProducts();
    updateCart();
});

// =====================================================
// LOAD CURRENT USER
// =====================================================

async function loadCurrentUser() {
    try {
        const q = query(
            collection(db, "users"),
            where("uid", "==", currentUser.uid)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            alert("User account not found.");
            await auth.signOut();
            window.location.href = "login.html";
            return false;
        }

        currentUserData = snapshot.docs[0].data();

        if (currentUserData.role !== "cashier") {
            alert("Access denied. Cashier access is required.");
            window.location.href = "admin.html";
            return false;
        }

        return true;

    } catch (error) {
        console.error("User loading error:", error);
        alert("Unable to verify your account: " + error.message);
        return false;
    }
}

// =====================================================
// LOAD PRODUCTS
// =====================================================

function loadProducts() {
    if (productsUnsubscribe) {
        productsUnsubscribe();
    }

    const q = query(
        collection(db, "products"),
        orderBy("name")
    );

    productsUnsubscribe = onSnapshot(
        q,
        (snapshot) => {
            products = snapshot.docs.map((productDoc) => ({
                id: productDoc.id,
                ...productDoc.data()
            }));

            // Keep the current search applied when stock updates.
            filterProducts();
        },
        (error) => {
            console.error("Product loading error:", error);
            alert("Unable to load products: " + error.message);
        }
    );
}

// =====================================================
// PRICE HELPERS
// =====================================================

function getSellingMin(product) {
    return Number(
        product.minSellingPrice ??
        product.sellingPrice ??
        product.price ??
        0
    ) || 0;
}

function getSellingMax(product) {
    return Number(
        product.maxSellingPrice ??
        product.sellingPrice ??
        product.price ??
        getSellingMin(product)
    ) || 0;
}

function getBuyingPrice(product) {
    return Number(
        product.buyingPrice ??
        product.costPrice ??
        product.purchasePrice ??
        product.buyPrice ??
        product.cost ??
        0
    ) || 0;
}

function moneyValue(value) {
    return Number(value || 0).toLocaleString("en-KE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function money(value) {
    return "KSh " + moneyValue(value);
}

// =====================================================
// SAFE HTML
// =====================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =====================================================
// PRODUCT SEARCH
// =====================================================

const searchProduct = document.getElementById("searchProduct");

if (searchProduct) {
    searchProduct.addEventListener("input", filterProducts);
}

function filterProducts() {
    const value = (
        document.getElementById("searchProduct")?.value || ""
    ).toLowerCase().trim();

    filteredProducts = products.filter((product) => {
        return (
            String(product.name || "").toLowerCase().includes(value) ||
            String(product.barcode || "").toLowerCase().includes(value) ||
            String(product.category || "").toLowerCase().includes(value)
        );
    });

    displayProducts(filteredProducts);
}

// =====================================================
// DISPLAY PRODUCTS
// =====================================================

function displayProducts(productArray) {
    const container = document.getElementById("productList");

    if (!container) return;

    container.innerHTML = "";

    if (productArray.length === 0) {
        container.innerHTML = `
            <p class="empty">No products found.</p>
        `;
        return;
    }

    container.innerHTML = productArray.map((product) => {
        const stock = Number(product.quantity) || 0;
        const minPrice = getSellingMin(product);
        const maxPrice = getSellingMax(product);

        return `
            <div class="product-card">
                <h3>${escapeHTML(product.name || "Unnamed Product")}</h3>

                <p>Barcode: ${escapeHTML(product.barcode || "-")}</p>

                <p>Category: ${escapeHTML(product.category || "-")}</p>

                <p>Stock: ${stock}</p>

                <h4>
                    KSh ${moneyValue(minPrice)}
                    ${maxPrice !== minPrice
                        ? ` - KSh ${moneyValue(maxPrice)}`
                        : ""}
                </h4>

                <button
                    type="button"
                    data-add-product="${escapeHTML(product.id)}"
                    ${stock <= 0 ? "disabled" : ""}
                >
                    <i class="fa-solid fa-cart-plus"></i>
                    ${stock <= 0 ? "Out of Stock" : "Add"}
                </button>
            </div>
        `;
    }).join("");
}

// =====================================================
// ADD TO CART
// =====================================================

const productList = document.getElementById("productList");

productList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-product]");

    if (!button || button.disabled) return;

    addToCart(button.dataset.addProduct);
});

function addToCart(id) {
    const product = products.find((item) => item.id === id);

    if (!product) {
        alert("Product not found. Refresh the product list and try again.");
        return;
    }

    const stock = Number(product.quantity) || 0;

    if (!Number.isFinite(stock) || stock <= 0) {
        alert("This product is out of stock.");
        return;
    }

    const existing = cart.find((item) => item.id === id);

    if (existing) {
        if (existing.quantity >= stock) {
            alert("Not enough stock available.");
            return;
        }

        existing.quantity++;
    } else {
        const minPrice = getSellingMin(product);
        const maxPrice = getSellingMax(product);

        if (
            !Number.isFinite(minPrice) ||
            !Number.isFinite(maxPrice) ||
            minPrice < 0 ||
            maxPrice < minPrice
        ) {
            alert("This product has invalid selling prices.");
            return;
        }

        cart.push({
            id: product.id,
            barcode: product.barcode || "",
            name: product.name || "",
            minPrice,
            maxPrice,
            price: minPrice,
            quantity: 1,
            stock
        });
    }

    updateCart();
}

// =====================================================
// CART DISPLAY
// =====================================================

function updateCart() {
    const table = document.getElementById("cartTable");

    if (!table) return;

    if (cart.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="5">Cart is empty</td>
            </tr>
        `;

        calculateTotals();
        return;
    }

    table.innerHTML = cart.map((item) => `
        <tr>
            <td>${escapeHTML(item.name)}</td>

            <td>
                <div class="quantity-control">
                    <button
                        type="button"
                        data-quantity-action="decrease"
                        data-item-id="${escapeHTML(item.id)}"
                    >−</button>

                    <input
                        type="number"
                        data-quantity-input="${escapeHTML(item.id)}"
                        value="${item.quantity}"
                        min="1"
                        max="${item.stock}"
                        step="1"
                    >

                    <button
                        type="button"
                        data-quantity-action="increase"
                        data-item-id="${escapeHTML(item.id)}"
                    >+</button>
                </div>
            </td>

            <td>
                <input
                    type="number"
                    data-price-input="${escapeHTML(item.id)}"
                    value="${item.price}"
                    min="${item.minPrice}"
                    max="${item.maxPrice}"
                    step="0.01"
                    style="width:90px;"
                >

                <br>
                <small>Min: KSh ${moneyValue(item.minPrice)}</small>

                <br>
                <small>Max: KSh ${moneyValue(item.maxPrice)}</small>
            </td>

            <td>${money(item.price * item.quantity)}</td>

            <td>
                <button
                    type="button"
                    data-remove-item="${escapeHTML(item.id)}"
                    title="Remove item"
                >
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join("");

    calculateTotals();
}

// =====================================================
// CART EVENT HANDLERS
// =====================================================

const cartTable = document.getElementById("cartTable");

cartTable?.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button) return;

    const id = button.dataset.itemId;

    if (button.dataset.quantityAction === "increase") {
        increaseQty(id);
    } else if (button.dataset.quantityAction === "decrease") {
        decreaseQty(id);
    } else if (button.dataset.removeItem) {
        removeItem(button.dataset.removeItem);
    }
});

cartTable?.addEventListener("change", (event) => {
    const input = event.target;

    if (input.matches("[data-quantity-input]")) {
        updateQuantity(
            input.dataset.quantityInput,
            input.value
        );
    }

    if (input.matches("[data-price-input]")) {
        updateSellingPrice(
            input.dataset.priceInput,
            input.value
        );
    }
});

// =====================================================
// SELLING PRICE VALIDATION
// =====================================================

function updateSellingPrice(id, value) {
    const item = cart.find((entry) => entry.id === id);

    if (!item) return;

    const price = Number(value);

    if (
        value.trim() === "" ||
        !Number.isFinite(price) ||
        price < item.minPrice ||
        price > item.maxPrice
    ) {
        alert(
            `Price must be between ${money(item.minPrice)} ` +
            `and ${money(item.maxPrice)}.`
        );

        updateCart();
        return;
    }

    item.price = price;
    updateCart();
}

// =====================================================
// QUANTITY CONTROL
// =====================================================

function increaseQty(id) {
    const item = cart.find((entry) => entry.id === id);

    if (!item) return;

    if (item.quantity >= item.stock) {
        alert("Insufficient stock.");
        return;
    }

    item.quantity++;
    updateCart();
}

function decreaseQty(id) {
    const item = cart.find((entry) => entry.id === id);

    if (!item) return;

    item.quantity--;

    if (item.quantity <= 0) {
        cart = cart.filter((entry) => entry.id !== id);
    }

    updateCart();
}

function updateQuantity(id, value) {
    const item = cart.find((entry) => entry.id === id);

    if (!item) return;

    let quantity = Number(value);

    if (!Number.isInteger(quantity) || quantity < 1) {
        quantity = 1;
    }

    if (quantity > item.stock) {
        alert(`Only ${item.stock} items are currently available.`);
        quantity = item.stock;
    }

    item.quantity = quantity;
    updateCart();
}

function removeItem(id) {
    cart = cart.filter((item) => item.id !== id);
    updateCart();
}

// =====================================================
// TOTALS AND DISCOUNT
// =====================================================

function getSubtotal() {
    return cart.reduce((total, item) => {
        return total + item.price * item.quantity;
    }, 0);
}

function getDiscount() {
    const value = Number(
        document.getElementById("discount")?.value
    );

    return Number.isFinite(value) ? value : 0;
}

function getGrandTotal() {
    return getSubtotal() - getDiscount();
}

function calculateTotals() {
    const subtotal = getSubtotal();
    const discount = getDiscount();
    const total = subtotal - discount;

    const subtotalElement = document.getElementById("subtotal");
    const totalElement = document.getElementById("grandTotal");

    if (subtotalElement) {
        subtotalElement.textContent = money(subtotal);
    }

    if (totalElement) {
        totalElement.textContent = money(total);
    }

    calculatePaymentTotal();
}

document.getElementById("discount")?.addEventListener(
    "input",
    calculateTotals
);

// =====================================================
// PAYMENT METHODS
// =====================================================

function normalizePaymentMethod(method) {
    return String(method || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, "");
}

function getPaymentFieldId(method) {
    const normalized = normalizePaymentMethod(method);

    if (normalized === "cash") return "cashAmount";
    if (normalized === "mpesa") return "mpesaAmount";
    if (normalized === "bank") return "bankAmount";
    if (normalized === "kopokopo") return "kopokopoAmount";

    return "";
}

function getPaymentAmounts() {
    const cash = Number(
        document.getElementById("cashAmount")?.value
    ) || 0;

    const mpesa = Number(
        document.getElementById("mpesaAmount")?.value
    ) || 0;

    const bank = Number(
        document.getElementById("bankAmount")?.value
    ) || 0;

    const kopokopo = Number(
        document.getElementById("kopokopoAmount")?.value
    ) || 0;

    return {
        cash,
        mpesa,
        bank,
        kopokopo,
        totalPaid: cash + mpesa + bank + kopokopo
    };
}

document.querySelectorAll('input[name="paymentMethod"]')
    .forEach((checkbox) => {
        checkbox.addEventListener("change", handlePaymentMethods);
    });

function handlePaymentMethods() {
    const container = document.getElementById("paymentAmounts");

    if (!container) return;

    const oldPayments = getPaymentAmounts();

    const oldValues = {
        cashAmount: oldPayments.cash,
        mpesaAmount: oldPayments.mpesa,
        bankAmount: oldPayments.bank,
        kopokopoAmount: oldPayments.kopokopo
    };

    const selectedMethods = [
        ...document.querySelectorAll(
            'input[name="paymentMethod"]:checked'
        )
    ].map((input) => input.value);

    container.innerHTML = selectedMethods.map((method) => {
        const fieldId = getPaymentFieldId(method);

        if (!fieldId) return "";

        return `
            <div class="payment-amount-row">
                <label for="${fieldId}">
                    ${escapeHTML(method)} Paid
                </label>

                <input
                    type="number"
                    id="${fieldId}"
                    value="${oldValues[fieldId] || ""}"
                    min="0"
                    step="0.01"
                    placeholder="Enter amount"
                >
            </div>
        `;
    }).join("");

    container.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", calculatePaymentTotal);
    });

    calculatePaymentTotal();
}

// =====================================================
// PAYMENT TOTAL, BALANCE AND CHANGE
// =====================================================

function calculatePaymentTotal() {
    const payments = getPaymentAmounts();
    const total = getGrandTotal();
    const difference = payments.totalPaid - total;

    const paidElement = document.getElementById("amountPaid");

    if (paidElement) {
        paidElement.textContent = money(payments.totalPaid);
    }

    const balanceElement = document.getElementById("balance");

    if (balanceElement) {
        balanceElement.textContent = money(Math.abs(difference));

        balanceElement.style.color =
            difference < 0 ? "#dc3545" :
            difference > 0 ? "#198754" :
            "";

        balanceElement.dataset.status =
            difference < 0 ? "balance" :
            difference > 0 ? "change" :
            "paid";
    }

    const label = document.getElementById("balanceLabel");

    if (label) {
        label.textContent =
            difference < 0 ? "Balance Due" :
            difference > 0 ? "Change" :
            "Balance";
    }
}

function resetPaymentMethods() {
    document.querySelectorAll('input[name="paymentMethod"]')
        .forEach((checkbox) => {
            checkbox.checked = false;
        });

    const container = document.getElementById("paymentAmounts");

    if (container) {
        container.innerHTML = "";
    }
}

// =====================================================
// CLEAR CART
// =====================================================

document.getElementById("clearCart")?.addEventListener(
    "click",
    () => {
        if (processingSale) {
            alert("Please wait for the current sale to finish.");
            return;
        }

        if (cart.length === 0) return;

        if (!confirm("Clear the entire cart?")) return;

        cart = [];
        updateCart();

        const customer = document.getElementById("customerName");
        const discount = document.getElementById("discount");

        if (customer) customer.value = "";
        if (discount) discount.value = "0";

        resetPaymentMethods();
        calculateTotals();
    }
);

// =====================================================
// BACK TO CASHIER DASHBOARD
// =====================================================

document.getElementById("backBtn")?.addEventListener(
    "click",
    () => {
        if (processingSale) return;

        window.location.href = "cashier.html";
    }
);

// =====================================================
// VALIDATE SALE AND PAYMENTS
// =====================================================

function validateSale() {
    if (!currentUser || !currentUserData) {
        alert("Your user session is not ready.");
        return false;
    }

    if (cart.length === 0) {
        alert("Cart is empty.");
        return false;
    }

    const subtotal = getSubtotal();
    const discount = getDiscount();
    const total = getGrandTotal();

    if (
        !Number.isFinite(subtotal) ||
        !Number.isFinite(discount) ||
        discount < 0 ||
        discount > subtotal ||
        !Number.isFinite(total) ||
        total < 0
    ) {
        alert("Invalid subtotal, discount, or sale total.");
        return false;
    }

    for (const item of cart) {
        if (
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            !Number.isFinite(item.price) ||
            item.price < item.minPrice ||
            item.price > item.maxPrice
        ) {
            alert(`Invalid quantity or selling price for ${item.name}.`);
            return false;
        }
    }

    const selectedMethods = [
        ...document.querySelectorAll(
            'input[name="paymentMethod"]:checked'
        )
    ];

    if (selectedMethods.length === 0) {
        alert("Select at least one payment method.");
        return false;
    }

    const allowedMethods = new Set([
        "cash",
        "mpesa",
        "bank",
        "kopokopo"
    ]);

    for (const checkbox of selectedMethods) {
        const method = normalizePaymentMethod(checkbox.value);
        const fieldId = getPaymentFieldId(checkbox.value);
        const input = document.getElementById(fieldId);

        if (!allowedMethods.has(method) || !input) {
            alert("An invalid payment method was selected.");
            return false;
        }

        const rawValue = input.value.trim();
        const amount = Number(rawValue);

        if (
            rawValue === "" ||
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            alert(`Enter a valid positive amount for ${checkbox.value}.`);
            return false;
        }
    }

    const payments = getPaymentAmounts();

    if (
        !Number.isFinite(payments.totalPaid) ||
        payments.totalPaid < total
    ) {
        alert(
            "Payment is insufficient.\n\n" +
            `Total: ${money(total)}\n` +
            `Paid: ${money(payments.totalPaid)}\n` +
            `Balance Due: ${money(Math.max(0, total - payments.totalPaid))}`
        );

        return false;
    }

    return true;
}

// =====================================================
// COMPLETE SALE BUTTON
// =====================================================

document.getElementById("completeSale")?.addEventListener(
    "click",
    async () => {
        if (processingSale) return;

        if (!validateSale()) return;

        processingSale = true;

        const button = document.getElementById("completeSale");

        if (button) {
            button.disabled = true;
            button.textContent = "Processing Sale...";
        }

        try {
            await completeSale();

        } catch (error) {
            console.error("Sale completion error:", error);

            alert(
                "The sale could not be completed.\n\n" +
                error.message +
                "\n\nCheck Firestore records before attempting the sale again."
            );

        } finally {
            processingSale = false;

            if (button) {
                button.disabled = false;
                button.innerHTML =
                    '<i class="fa-solid fa-check"></i> Complete Sale';
            }
        }
    }
);

// =====================================================
// ATOMIC SALE + STOCK UPDATE
// =====================================================

async function completeSale() {
    const customerName =
        document.getElementById("customerName")?.value?.trim() ||
        "Walk-in Customer";

    const paymentMethods = [
        ...document.querySelectorAll(
            'input[name="paymentMethod"]:checked'
        )
    ].map((input) => input.value);

    const payments = getPaymentAmounts();
    const subtotal = getSubtotal();
    const discount = getDiscount();
    const total = getGrandTotal();
    const amountPaid = payments.totalPaid;
    const balance = Math.max(0, total - amountPaid);
    const change = Math.max(0, amountPaid - total);

    // Copy the cart so UI changes cannot alter this sale's quantities.
    const cartSnapshot = cart.map((item) => ({ ...item }));

    // Generate the document reference before the transaction.
    const saleRef = doc(collection(db, "sales"));
    const receiptNo = generateReceiptNumber();

    let committedSale = null;

    await runTransaction(db, async (transaction) => {
        // Read every product before performing any writes.
        const latestProducts = [];

        for (const item of cartSnapshot) {
            const productRef = doc(db, "products", item.id);
            const productSnapshot = await transaction.get(productRef);

            if (!productSnapshot.exists()) {
                throw new Error(
                    `Product "${item.name}" no longer exists.`
                );
            }

            latestProducts.push({
                item,
                ref: productRef,
                data: productSnapshot.data()
            });
        }

        // Validate current stock and current permitted prices.
        const saleItems = [];
        const stockUpdates = [];

        let totalCost = 0;
        let grossProfit = 0;

        for (const entry of latestProducts) {
            const { item, ref, data } = entry;

            const stock = Number(data.quantity);

            if (!Number.isFinite(stock) || stock < item.quantity) {
                throw new Error(
                    `Insufficient current stock for "${item.name}". ` +
                    `Available: ${Number.isFinite(stock) ? stock : 0}, ` +
                    `requested: ${item.quantity}.`
                );
            }

            const minPrice = getSellingMin(data);
            const maxPrice = getSellingMax(data);

            if (
                !Number.isFinite(item.price) ||
                !Number.isFinite(minPrice) ||
                !Number.isFinite(maxPrice) ||
                minPrice < 0 ||
                maxPrice < minPrice ||
                item.price < minPrice ||
                item.price > maxPrice
            ) {
                throw new Error(
                    `The permitted price for "${item.name}" changed. ` +
                    `Remove it from the cart and add it again.`
                );
            }

            const buyingPrice = getBuyingPrice(data);

            if (!Number.isFinite(buyingPrice) || buyingPrice < 0) {
                throw new Error(
                    `Invalid buying cost for "${item.name}".`
                );
            }

            const quantity = item.quantity;
            const lineRevenue = item.price * quantity;
            const lineCost = buyingPrice * quantity;
            const lineProfit = lineRevenue - lineCost;

            totalCost += lineCost;
            grossProfit += lineProfit;

            saleItems.push({
                productId: item.id,
                barcode: data.barcode || item.barcode || "",
                name: data.name || item.name,
                quantity,
                price: item.price,
                sellingPrice: item.price,
                buyingPrice,
                costPrice: buyingPrice,
                total: lineRevenue,
                revenue: lineRevenue,
                costTotal: lineCost,
                totalCost: lineCost,
                profit: lineProfit
            });

            stockUpdates.push({
                ref,
                quantity: stock - quantity
            });
        }

        const saleData = {
            receiptNo,
            customerName,
            cashier:
                currentUserData?.name ||
                currentUser.email ||
                "Unknown Cashier",
            cashierId: currentUser.uid,

            paymentMethods,

            cashAmount: payments.cash,
            mpesaAmount: payments.mpesa,
            bankAmount: payments.bank,
            kopokopoAmount: payments.kopokopo,

            amountPaid,
            balance,
            change,

            subtotal,
            discount,
            total,

            totalCost,
            cost: totalCost,
            profit: grossProfit - discount,

            items: saleItems,
            status: "Completed",
            date: serverTimestamp()
        };

        // All reads have completed. These writes commit atomically.
        for (const update of stockUpdates) {
            transaction.update(update.ref, {
                quantity: update.quantity
            });
        }

        transaction.set(saleRef, saleData);

        committedSale = {
            ...saleData,
            date: new Date(),
            items: saleItems
        };
    });

    // Only reset the cart after Firestore confirms the transaction.
    window.lastSale = committedSale;

    cart = [];
    updateCart();

    const customer = document.getElementById("customerName");
    const discountElement = document.getElementById("discount");

    if (customer) customer.value = "";
    if (discountElement) discountElement.value = "0";

    resetPaymentMethods();
    calculateTotals();

    alert("Sale completed successfully!");

    // Open the receipt only after the sale has committed.
    generateReceipt();
}

// =====================================================
// RECEIPT NUMBER
// =====================================================

function generateReceiptNumber() {
    const now = new Date();

    return "INV-" +
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0") +
        String(now.getHours()).padStart(2, "0") +
        String(now.getMinutes()).padStart(2, "0") +
        String(now.getSeconds()).padStart(2, "0") +
        String(now.getMilliseconds()).padStart(3, "0");
}

// =====================================================
// PRINT RECEIPT BUTTON
// =====================================================

document.getElementById("printReceipt")?.addEventListener(
    "click",
    () => {
        if (!window.lastSale) {
            alert("No completed sale is available to print.");
            return;
        }

        generateReceipt();
    }
);

// =====================================================
// RECEIPT DATE
// =====================================================

function formatDate(date) {
    if (!date) return "N/A";

    try {
        if (typeof date.toDate === "function") {
            date = date.toDate();
        }

        const parsed = date instanceof Date ? date : new Date(date);

        if (Number.isNaN(parsed.getTime())) return "N/A";

        return parsed.toLocaleString("en-KE");

    } catch {
        return "N/A";
    }
}

// =====================================================
// GENERATE AND PRINT RECEIPT
// =====================================================

function generateReceipt() {
    const sale = window.lastSale;

    if (!sale) {
        alert("No completed sale is available.");
        return;
    }

    const receipt = window.open(
        "",
        "_blank",
        "width=450,height=800"
    );

    if (!receipt) {
        alert(
            "The receipt was saved, but the print window was blocked. " +
            "Allow pop-ups and click Print Receipt."
        );
        return;
    }

    const itemsHTML = sale.items.map((item) => `
        <tr>
            <td>${escapeHTML(item.name)}</td>
            <td class="center">${item.quantity}</td>
            <td class="right">${money(item.price)}</td>
            <td class="right">${money(item.total)}</td>
        </tr>
    `).join("");

    const paymentRows = [
        { name: "Cash", amount: sale.cashAmount },
        { name: "M-Pesa", amount: sale.mpesaAmount },
        { name: "Bank", amount: sale.bankAmount },
        { name: "Kopo Kopo", amount: sale.kopokopoAmount }
    ]
        .filter((payment) => Number(payment.amount) > 0)
        .map((payment) => `
            <div class="payment-row">
                <span>${payment.name}</span>
                <span>${money(payment.amount)}</span>
            </div>
        `)
        .join("");

    receipt.document.open();

    receipt.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Receipt ${escapeHTML(sale.receiptNo)}</title>

            <style>
                body {
                    font-family: Arial, sans-serif;
                    width: 350px;
                    max-width: 100%;
                    margin: 0 auto;
                    padding: 12px;
                    box-sizing: border-box;
                    color: #111;
                    font-size: 12px;
                }

                h2, .center {
                    text-align: center;
                }

                h2 {
                    margin-bottom: 4px;
                }

                p {
                    margin: 5px 0;
                }

                hr {
                    border: 0;
                    border-top: 1px dashed #555;
                    margin: 10px 0;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                }

                th, td {
                    padding: 5px 2px;
                    overflow-wrap: anywhere;
                }

                .right {
                    text-align: right;
                }

                .payment-row {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    margin: 5px 0;
                }

                .total {
                    font-weight: bold;
                    font-size: 15px;
                }

                .notice {
                    font-size: 10px;
                    line-height: 1.5;
                    text-align: center;
                }

                @media print {
                    body {
                        width: auto;
                        margin: 0;
                        padding: 5px;
                    }

                    @page {
                        margin: 5mm;
                    }
                }
            </style>
        </head>

        <body>
            <h2>LEBARTO ELECTRONICS</h2>

            <p class="center">Quality Electronics & Accessories</p>

            <hr>

            <p><strong>Receipt:</strong> ${escapeHTML(sale.receiptNo)}</p>
            <p><strong>Date:</strong> ${escapeHTML(formatDate(sale.date))}</p>
            <p><strong>Cashier:</strong> ${escapeHTML(sale.cashier)}</p>
            <p><strong>Customer:</strong> ${escapeHTML(sale.customerName)}</p>

            <hr>

            <table>
                <thead>
                    <tr>
                        <th style="text-align:left">Item</th>
                        <th>Qty</th>
                        <th class="right">Price</th>
                        <th class="right">Total</th>
                    </tr>
                </thead>

                <tbody>${itemsHTML}</tbody>
            </table>

            <hr>

            <div class="payment-row">
                <span>Subtotal</span>
                <span>${money(sale.subtotal)}</span>
            </div>

            <div class="payment-row">
                <span>Discount</span>
                <span>${money(sale.discount)}</span>
            </div>

            <div class="payment-row total">
                <span>TOTAL</span>
                <span>${money(sale.total)}</span>
            </div>

            <hr>

            <strong>Payment Breakdown</strong>

            ${paymentRows}

            <hr>

            <div class="payment-row">
                <strong>Total Paid</strong>
                <strong>${money(sale.amountPaid)}</strong>
            </div>

            ${sale.balance > 0 ? `
                <div class="payment-row">
                    <strong>Balance Due</strong>
                    <strong>${money(sale.balance)}</strong>
                </div>
            ` : ""}

            ${sale.change > 0 ? `
                <div class="payment-row">
                    <strong>Change</strong>
                    <strong>${money(sale.change)}</strong>
                </div>
            ` : ""}

            <hr>

            <p class="center">Thank You For Shopping!</p>
            <p class="center">Please Come Again</p>

            <hr>

            <p class="notice">
                Please Note: This is not an ETR Receipt.
                Collect the Tax Invoice from the Cashier.
            </p>

            <p class="notice">
                For Complaints Contact 0719302014
            </p>
        </body>
        </html>
    `);

    receipt.document.close();

    receipt.onafterprint = () => {
        receipt.close();
    };

    receipt.focus();

    // Wait for the receipt document to render before printing.
    receipt.setTimeout(() => {
        receipt.print();
    }, 300);
}

// =====================================================
// READY
// =====================================================

console.log(
    "LEBARTO POS READY - ATOMIC STOCK, SPLIT PAYMENTS, KOPO KOPO."
);
