// =====================================================
// LEBARTO ELECTRONICS
// POS.JS
// CORRECTED VERSION
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
    addDoc,
    updateDoc,
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


// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    const loaded = await loadCurrentUser();

    if (!loaded) {
        return;
    }

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
            return false;

        }

        currentUserData = snapshot.docs[0].data();

        if (currentUserData.role !== "cashier") {

            alert("Access denied.");

            window.location.href = "admin.html";

            return false;

        }

        return true;

    }

    catch (error) {

        console.error(
            "Load current user error:",
            error
        );

        alert(error.message);

        return false;

    }

}


// =====================================================
// LOAD PRODUCTS
// =====================================================

function loadProducts() {

    const q = query(
        collection(db, "products"),
        orderBy("name")
    );

    onSnapshot(
        q,
        (snapshot) => {

            products = [];

            snapshot.forEach((productDoc) => {

                products.push({

                    id: productDoc.id,

                    ...productDoc.data()

                });

            });

            filteredProducts = [...products];

            displayProducts(filteredProducts);

        },
        (error) => {

            console.error(
                "Load products error:",
                error
            );

            alert(
                "Unable to load products: " +
                error.message
            );

        }
    );

}


// =====================================================
// DISPLAY PRODUCTS
// =====================================================

function displayProducts(productArray) {

    const container =
        document.getElementById("productList");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (productArray.length === 0) {

        container.innerHTML = `
            <p class="empty">
                No products found.
            </p>
        `;

        return;

    }

    productArray.forEach((product) => {

        const stock =
            Number(product.quantity) || 0;

        const minSellingPrice =
            getSellingMin(product);

        const maxSellingPrice =
            getSellingMax(product);

        container.innerHTML += `

            <div class="product-card">

                <h3>
                    ${escapeHTML(product.name || "")}
                </h3>

                <p>
                    Barcode:
                    ${escapeHTML(
                        String(product.barcode || "")
                    )}
                </p>

                <p>
                    Category:
                    ${escapeHTML(product.category || "")}
                </p>

                <p>
                    Stock:
                    ${stock}
                </p>

                <h4>

                    KSh ${moneyValue(minSellingPrice)}

                    ${
                        maxSellingPrice !== minSellingPrice
                            ? ` - KSh ${moneyValue(maxSellingPrice)}`
                            : ""
                    }

                </h4>

                <button
                    onclick="addToCart('${product.id}')"
                    ${stock <= 0 ? "disabled" : ""}
                >

                    <i class="fa-solid fa-cart-plus"></i>

                    Add

                </button>

            </div>

        `;

    });

}


// =====================================================
// SELLING PRICE
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


// =====================================================
// BUYING PRICE
// =====================================================

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


// =====================================================
// SEARCH PRODUCTS
// =====================================================

const searchProduct =
    document.getElementById("searchProduct");

if (searchProduct) {

    searchProduct.addEventListener(
        "input",
        function () {

            const value =
                this.value
                    .toLowerCase()
                    .trim();

            filteredProducts =
                products.filter((product) => {

                    return (

                        String(product.name || "")
                            .toLowerCase()
                            .includes(value)

                        ||

                        String(product.barcode || "")
                            .toLowerCase()
                            .includes(value)

                        ||

                        String(product.category || "")
                            .toLowerCase()
                            .includes(value)

                    );

                });

            displayProducts(filteredProducts);

        }
    );

}


// =====================================================
// ADD TO CART
// =====================================================

window.addToCart = function (id) {

    const product =
        products.find(
            (p) => p.id === id
        );

    if (!product) {

        alert("Product not found.");
        return;

    }

    const stock =
        Number(product.quantity) || 0;

    if (stock <= 0) {

        alert("Product is out of stock.");
        return;

    }

    const existing =
        cart.find(
            (item) => item.id === id
        );

    if (existing) {

        if (existing.quantity >= stock) {

            alert("Not enough stock.");
            return;

        }

        existing.quantity++;

    }

    else {

        const buyingPrice =
            getBuyingPrice(product);

        const minPrice =
            getSellingMin(product);

        const maxPrice =
            getSellingMax(product);

        cart.push({

            id: product.id,

            barcode: product.barcode || "",

            name: product.name || "",

            minPrice,

            maxPrice,

            price: minPrice,

            buyingPrice,

            quantity: 1,

            stock

        });

    }

    updateCart();

};


// =====================================================
// UPDATE CART
// =====================================================

function updateCart() {

    const table =
        document.getElementById("cartTable");

    if (!table) {
        return;
    }

    table.innerHTML = "";

    if (cart.length === 0) {

        table.innerHTML = `

            <tr>

                <td colspan="5">
                    Cart is empty
                </td>

            </tr>

        `;

        calculateTotals();

        return;

    }

    cart.forEach((item) => {

        const lineTotal =
            Number(item.price || 0) *
            Number(item.quantity || 0);

        table.innerHTML += `

            <tr>

                <td>
                    ${escapeHTML(item.name)}
                </td>

                <td>

                    <div class="quantity-control">

                        <button
                            type="button"
                            onclick="decreaseQty('${item.id}')"
                        >
                            −
                        </button>

                        <input
                            type="number"
                            value="${item.quantity}"
                            min="1"
                            max="${item.stock}"
                            step="1"
                            onchange="
                                updateQuantity(
                                    '${item.id}',
                                    this.value
                                )
                            "
                        >

                        <button
                            type="button"
                            onclick="increaseQty('${item.id}')"
                        >
                            +
                        </button>

                    </div>

                </td>

                <td>

                    <input
                        type="number"
                        value="${item.price}"
                        min="${item.minPrice}"
                        max="${item.maxPrice}"
                        step="0.01"
                        onblur="
                            finishSellingPrice(
                                '${item.id}',
                                this
                            )
                        "
                        style="width:90px;"
                    >

                    <br>

                    <small>
                        Min:
                        KSh ${moneyValue(item.minPrice)}
                    </small>

                    <br>

                    <small>
                        Max:
                        KSh ${moneyValue(item.maxPrice)}
                    </small>

                </td>

                <td>
                    KSh ${moneyValue(lineTotal)}
                </td>

                <td>

                    <button
                        type="button"
                        onclick="removeItem('${item.id}')"
                    >
                        <i class="fa-solid fa-trash"></i>
                    </button>

                </td>

            </tr>

        `;

    });

    calculateTotals();

}


// =====================================================
// SELLING PRICE
// =====================================================

window.finishSellingPrice = function(id, input) {

    const item =
        cart.find(
            (product) => product.id === id
        );

    if (!item) {
        return;
    }

    const price =
        Number(input.value);

    if (!Number.isFinite(price)) {

        input.value = item.price;
        return;

    }

    if (price < item.minPrice) {

        alert(
            `Selling price cannot be below KSh ${moneyValue(item.minPrice)}`
        );

        input.value = item.price;
        return;

    }

    if (price > item.maxPrice) {

        alert(
            `Selling price cannot be above KSh ${moneyValue(item.maxPrice)}`
        );

        input.value = item.price;
        return;

    }

    item.price = price;

    updateCart();

};


// =====================================================
// QUANTITY
// =====================================================

window.increaseQty = function(id) {

    const item =
        cart.find(
            (product) => product.id === id
        );

    if (!item) {
        return;
    }

    if (item.quantity >= item.stock) {

        alert("Insufficient stock.");
        return;

    }

    item.quantity++;

    updateCart();

};


window.decreaseQty = function(id) {

    const item =
        cart.find(
            (product) => product.id === id
        );

    if (!item) {
        return;
    }

    item.quantity--;

    if (item.quantity <= 0) {

        cart =
            cart.filter(
                (product) => product.id !== id
            );

    }

    updateCart();

};


window.updateQuantity = function(id, value) {

    const item =
        cart.find(
            (product) => product.id === id
        );

    if (!item) {
        return;
    }

    let quantity = Number(value);

    if (
        !Number.isInteger(quantity) ||
        quantity < 1
    ) {

        quantity = 1;

    }

    if (quantity > item.stock) {

        alert(
            `Only ${item.stock} items are available in stock.`
        );

        quantity = item.stock;

    }

    item.quantity = quantity;

    updateCart();

};


// =====================================================
// REMOVE ITEM
// =====================================================

window.removeItem = function(id) {

    cart =
        cart.filter(
            (product) => product.id !== id
        );

    updateCart();

};


// =====================================================
// TOTALS
// =====================================================

function getSubtotal() {

    return cart.reduce(
        (total, item) => {

            return total +
                (
                    Number(item.price) || 0
                ) *
                (
                    Number(item.quantity) || 0
                );

        },
        0
    );

}


function getDiscount() {

    return Math.max(
        0,
        Number(
            document.getElementById(
                "discount"
            )?.value
        ) || 0
    );

}


function getGrandTotal() {

    return Math.max(
        0,
        getSubtotal() -
        getDiscount()
    );

}


function calculateTotals() {

    const subtotal =
        getSubtotal();

    const grandTotal =
        getGrandTotal();

    const subtotalElement =
        document.getElementById("subtotal");

    if (subtotalElement) {

        subtotalElement.textContent =
            money(subtotal);

    }

    const totalElement =
        document.getElementById("grandTotal");

    if (totalElement) {

        totalElement.textContent =
            money(grandTotal);

    }

    calculatePaymentTotal();

}


document
    .getElementById("discount")
    ?.addEventListener(
        "input",
        calculateTotals
    );


// =====================================================
// PAYMENT
// =====================================================

function normalizePaymentMethod(method) {

    return String(method || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, "");

}


function getPaymentFieldId(method) {

    const normalized =
        normalizePaymentMethod(method);

    if (normalized === "cash") {
        return "cashAmount";
    }

    if (normalized === "mpesa") {
        return "mpesaAmount";
    }

    if (normalized === "bank") {
        return "bankAmount";
    }

    return "";

}


function getPaymentAmounts() {

    const cash =
        Number(
            document.getElementById(
                "cashAmount"
            )?.value
        ) || 0;

    const mpesa =
        Number(
            document.getElementById(
                "mpesaAmount"
            )?.value
        ) || 0;

    const bank =
        Number(
            document.getElementById(
                "bankAmount"
            )?.value
        ) || 0;

    return {

        cash,

        mpesa,

        bank,

        totalPaid:
            cash +
            mpesa +
            bank

    };

}


// =====================================================
// PAYMENT CHECKBOXES
// =====================================================

document
    .querySelectorAll(
        'input[name="paymentMethod"]'
    )
    .forEach((checkbox) => {

        checkbox.addEventListener(
            "change",
            handlePaymentMethods
        );

    });


function handlePaymentMethods() {

    const container =
        document.getElementById(
            "paymentAmounts"
        );

    if (!container) {
        return;
    }

    const oldPayments =
        getPaymentAmounts();

    const selectedMethods = [
        ...document.querySelectorAll(
            'input[name="paymentMethod"]:checked'
        )
    ].map(
        (input) => input.value
    );

    container.innerHTML = "";

    selectedMethods.forEach(
        (method, index) => {

            const fieldId =
                getPaymentFieldId(method);

            let oldValue = 0;

            if (fieldId === "cashAmount") {
                oldValue = oldPayments.cash;
            }

            if (fieldId === "mpesaAmount") {
                oldValue = oldPayments.mpesa;
            }

            if (fieldId === "bankAmount") {
                oldValue = oldPayments.bank;
            }

            const inputId =
                fieldId ||
                `paymentAmount_${index}`;

            container.innerHTML += `

                <div class="payment-amount-row">

                    <label for="${inputId}">

                        ${escapeHTML(method)}
                        Paid

                    </label>

                    <input
                        type="number"
                        id="${inputId}"
                        value="${oldValue || ""}"
                        min="0"
                        step="0.01"
                        placeholder="Enter amount"
                    >

                </div>

            `;

        }
    );

    container
        .querySelectorAll("input")
        .forEach((input) => {

            input.addEventListener(
                "input",
                calculatePaymentTotal
            );

        });

    calculatePaymentTotal();

}


// =====================================================
// PAYMENT TOTAL
// =====================================================

function calculatePaymentTotal() {

    const payments =
        getPaymentAmounts();

    const amountPaidElement =
        document.getElementById("amountPaid");

    if (amountPaidElement) {

        amountPaidElement.textContent =
            money(payments.totalPaid);

    }

    const total =
        getGrandTotal();

    const difference =
        payments.totalPaid - total;

    const balanceElement =
        document.getElementById("balance");

    if (balanceElement) {

        if (difference < 0) {

            balanceElement.textContent =
                money(Math.abs(difference));

            balanceElement.style.color =
                "#dc3545";

            balanceElement.dataset.status =
                "balance";

        }

        else if (difference > 0) {

            balanceElement.textContent =
                money(difference);

            balanceElement.style.color =
                "#198754";

            balanceElement.dataset.status =
                "change";

        }

        else {

            balanceElement.textContent =
                money(0);

            balanceElement.style.color =
                "#198754";

            balanceElement.dataset.status =
                "paid";

        }

    }

    const balanceLabel =
        document.getElementById(
            "balanceLabel"
        );

    if (balanceLabel) {

        balanceLabel.textContent =
            difference < 0
                ? "Balance Due"
                : difference > 0
                    ? "Change"
                    : "Balance";

    }

}


// =====================================================
// CLEAR CART
// =====================================================

document
    .getElementById("clearCart")
    ?.addEventListener(
        "click",
        () => {

            if (cart.length === 0) {
                return;
            }

            if (!confirm("Clear cart?")) {
                return;
            }

            cart = [];

            updateCart();

            const customer =
                document.getElementById(
                    "customerName"
                );

            if (customer) {
                customer.value = "";
            }

            const discount =
                document.getElementById(
                    "discount"
                );

            if (discount) {
                discount.value = 0;
            }

            document
                .querySelectorAll(
                    'input[name="paymentMethod"]'
                )
                .forEach(
                    (box) => {
                        box.checked = false;
                    }
                );

            const paymentAmounts =
                document.getElementById(
                    "paymentAmounts"
                );

            if (paymentAmounts) {
                paymentAmounts.innerHTML = "";
            }

            calculateTotals();

        }
    );


// =====================================================
// BACK
// =====================================================

document
    .getElementById("backBtn")
    ?.addEventListener(
        "click",
        () => {

            window.location.href =
                "cashier.html";

        }
    );


// =====================================================
// VALIDATE SALE
// =====================================================

function validateSale() {

    if (cart.length === 0) {

        alert("Cart is empty.");
        return false;

    }

    for (const item of cart) {

        const sellingPrice =
            Number(item.price);

        const buyingPrice =
            Number(item.buyingPrice);

        if (
            !Number.isFinite(sellingPrice) ||
            sellingPrice < item.minPrice ||
            sellingPrice > item.maxPrice
        ) {

            alert(
                `Invalid selling price for ${item.name}.`
            );

            return false;

        }

        if (
            !Number.isFinite(buyingPrice) ||
            buyingPrice < 0
        ) {

            alert(
                `Invalid buying price for ${item.name}.`
            );

            return false;

        }

    }

    const selectedMethods =
        document.querySelectorAll(
            'input[name="paymentMethod"]:checked'
        );

    if (selectedMethods.length === 0) {

        alert(
            "Please select at least one payment method."
        );

        return false;

    }

    const payments =
        getPaymentAmounts();

    const total =
        getGrandTotal();

    if (payments.totalPaid <= 0) {

        alert(
            "Please enter the amount paid."
        );

        return false;

    }

    for (const checkbox of selectedMethods) {

        const method =
            checkbox.value;

        const fieldId =
            getPaymentFieldId(method);

        if (!fieldId) {
            continue;
        }

        const amount =
            Number(
                document.getElementById(
                    fieldId
                )?.value
            ) || 0;

        if (amount <= 0) {

            alert(
                `Please enter an amount for ${method}.`
            );

            return false;

        }

    }

    if (payments.totalPaid < total) {

        alert(
            `Amount paid is less than total.\n\n` +
            `Total: ${money(total)}\n` +
            `Paid: ${money(payments.totalPaid)}\n` +
            `Balance Due: ${money(
                total - payments.totalPaid
            )}`
        );

        return false;

    }

    return true;

}


// =====================================================
// COMPLETE SALE BUTTON
// =====================================================

document
    .getElementById("completeSale")
    ?.addEventListener(
        "click",
        async () => {

            if (!validateSale()) {
                return;
            }

            const btn =
                document.getElementById(
                    "completeSale"
                );

            if (btn) {
                btn.disabled = true;
            }

            try {

                await completeSale();

            }

            finally {

                if (btn) {
                    btn.disabled = false;
                }

            }

        }
    );


// =====================================================
// COMPLETE SALE
// =====================================================

async function completeSale() {

    try {

        const customerElement =
            document.getElementById(
                "customerName"
            );

        const customerName =
            customerElement?.value?.trim() ||
            "Walk-in Customer";

        const paymentMethods = [

            ...document.querySelectorAll(
                'input[name="paymentMethod"]:checked'
            )

        ].map(
            (item) => item.value
        );

        const payments =
            getPaymentAmounts();

        const subtotal =
            getSubtotal();

        const discount =
            getDiscount();

        const grandTotal =
            Math.max(
                0,
                subtotal - discount
            );

        const amountPaid =
            payments.totalPaid;

        const balance =
            Math.max(
                0,
                grandTotal - amountPaid
            );

        const change =
            Math.max(
                0,
                amountPaid - grandTotal
            );


        // =================================================
        // ITEMS / COST / PROFIT
        // =================================================

        const saleItems = [];

        let totalCost = 0;

        let grossProfit = 0;

        cart.forEach((item) => {

            const quantity =
                Number(item.quantity) || 0;

            const sellingPrice =
                Number(item.price) || 0;

            const buyingPrice =
                Number(item.buyingPrice) || 0;

            const lineRevenue =
                sellingPrice * quantity;

            const lineCost =
                buyingPrice * quantity;

            const lineProfit =
                lineRevenue - lineCost;

            totalCost += lineCost;

            grossProfit += lineProfit;

            saleItems.push({

                productId:
                    item.id,

                barcode:
                    item.barcode || "",

                name:
                    item.name || "",

                quantity,

                price:
                    sellingPrice,

                sellingPrice,

                buyingPrice,

                costPrice:
                    buyingPrice,

                total:
                    lineRevenue,

                revenue:
                    lineRevenue,

                costTotal:
                    lineCost,

                totalCost:
                    lineCost,

                profit:
                    lineProfit

            });

        });


        /*
         * IMPORTANT:
         *
         * Discount reduces actual profit.
         *
         * Example:
         * Revenue = 10,000
         * Cost = 7,000
         * Discount = 500
         *
         * Actual profit = 2,500
         */

        const totalProfit =
            grossProfit - discount;


        // =================================================
        // RECEIPT
        // =================================================

        const receiptNo =
            generateReceiptNumber();


        // =================================================
        // SALE DATA
        // =================================================

        const saleData = {

            receiptNo,

            customerName,

            cashier:
                currentUserData?.name ||
                currentUser.email ||
                "Unknown Cashier",

            cashierId:
                currentUser.uid,

            paymentMethods,

            cashAmount:
                payments.cash,

            mpesaAmount:
                payments.mpesa,

            bankAmount:
                payments.bank,

            amountPaid,

            balance,

            change,

            subtotal,

            discount,

            total:
                grandTotal,

            totalCost,

            cost:
                totalCost,

            profit:
                totalProfit,

            items:
                saleItems,

            status:
                "Completed",

            date:
                serverTimestamp()

        };


        // =================================================
        // SAVE SALE
        // =================================================

        await addDoc(
            collection(db, "sales"),
            saleData
        );


        // =================================================
        // UPDATE STOCK
        // =================================================

        for (const item of cart) {

            const product =
                products.find(
                    (p) => p.id === item.id
                );

            if (!product) {
                continue;
            }

            const currentStock =
                Number(product.quantity) || 0;

            const soldQuantity =
                Number(item.quantity) || 0;

            await updateDoc(

                doc(
                    db,
                    "products",
                    item.id
                ),

                {

                    quantity:
                        Math.max(
                            0,
                            currentStock -
                            soldQuantity
                        )

                }

            );

        }


        // =================================================
        // SAVE LAST SALE
        // =================================================

        window.lastSale = {

            ...saleData,

            date: new Date(),

            items: [...saleItems]

        };


        alert(
            "Sale completed successfully!"
        );


        generateReceipt();


        // =================================================
        // RESET
        // =================================================

        cart = [];

        updateCart();

        if (customerElement) {
            customerElement.value = "";
        }

        const discountElement =
            document.getElementById(
                "discount"
            );

        if (discountElement) {
            discountElement.value = 0;
        }

        document
            .querySelectorAll(
                'input[name="paymentMethod"]'
            )
            .forEach(
                (box) => {
                    box.checked = false;
                }
            );

        const paymentAmounts =
            document.getElementById(
                "paymentAmounts"
            );

        if (paymentAmounts) {
            paymentAmounts.innerHTML = "";
        }

        calculateTotals();

    }

    catch (error) {

        console.error(
            "Complete sale error:",
            error
        );

        alert(
            "Unable to complete sale: " +
            error.message
        );

    }

}


// =====================================================
// RECEIPT NUMBER
// =====================================================

function generateReceiptNumber() {

    const now = new Date();

    return "INV-" +

        now.getFullYear() +

        String(
            now.getMonth() + 1
        ).padStart(2, "0") +

        String(
            now.getDate()
        ).padStart(2, "0") +

        String(
            now.getHours()
        ).padStart(2, "0") +

        String(
            now.getMinutes()
        ).padStart(2, "0") +

        String(
            now.getSeconds()
        ).padStart(2, "0") +

        String(
            now.getMilliseconds()
        ).padStart(3, "0");

}


// =====================================================
// PRINT RECEIPT
// =====================================================

document
    .getElementById("printReceipt")
    ?.addEventListener(
        "click",
        () => {

            if (!window.lastSale) {

                alert(
                    "No completed sale available to print."
                );

                return;

            }

            generateReceipt();

        }
    );


// =====================================================
// MONEY
// =====================================================

function moneyValue(value) {

    return Number(value || 0)
        .toLocaleString(
            "en-KE",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        );

}


function money(value) {

    return "KSh " + moneyValue(value);

}


// =====================================================
// DATE
// =====================================================

function formatDate(date) {

    if (!date) {
        return "";
    }

    if (
        typeof date.toDate ===
        "function"
    ) {

        date = date.toDate();

    }

    return new Date(date)
        .toLocaleString("en-KE");

}


// =====================================================
// GENERATE RECEIPT
// =====================================================

function generateReceipt() {

    if (!window.lastSale) {

        alert("No receipt available.");
        return;

    }

    const sale =
        window.lastSale;

    let itemsHTML = "";

    sale.items.forEach((item) => {

        itemsHTML += `

            <tr>

                <td>
                    ${escapeHTML(item.name)}
                </td>

                <td style="text-align:center;">
                    ${item.quantity}
                </td>

                <td style="text-align:right;">
                    ${money(item.price)}
                </td>

                <td style="text-align:right;">
                    ${money(item.total)}
                </td>

            </tr>

        `;

    });


    const receipt =
        window.open(
            "",
            "_blank",
            "width=450,height=800"
        );

    if (!receipt) {

        alert(
            "Please allow pop-ups to print receipts."
        );

        return;

    }


    receipt.document.write(`

        <!DOCTYPE html>

        <html>

        <head>

            <title>
                Receipt ${escapeHTML(
                    sale.receiptNo
                )}
            </title>

            <style>

                body {
                    font-family: Arial, sans-serif;
                    width: 350px;
                    margin: auto;
                    padding: 10px;
                    font-size: 13px;
                }

                h2 {
                    text-align: center;
                    margin-bottom: 5px;
                }

                p {
                    margin: 4px 0;
                }

                hr {
                    border: none;
                    border-top: 1px dashed #000;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                }

                th,
                td {
                    padding: 4px 2px;
                }

                .total {
                    font-size: 16px;
                    font-weight: bold;
                }

                .center {
                    text-align: center;
                }

                .payment-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 4px 0;
                }

            </style>

        </head>

        <body>

            <h2>
                LEBARTO ELECTRONICS
            </h2>

            <p class="center">
                Quality Electronics & Accessories
            </p>

            <hr>

            <p>
                <strong>Receipt:</strong>
                ${escapeHTML(sale.receiptNo)}
            </p>

            <p>
                <strong>Date:</strong>
                ${formatDate(sale.date)}
            </p>

            <p>
                <strong>Cashier:</strong>
                ${escapeHTML(sale.cashier)}
            </p>

            <p>
                <strong>Customer:</strong>
                ${escapeHTML(sale.customerName)}
            </p>

            <hr>

            <table>

                <tr>

                    <th align="left">
                        Item
                    </th>

                    <th>
                        Qty
                    </th>

                    <th align="right">
                        Price
                    </th>

                    <th align="right">
                        Total
                    </th>

                </tr>

                ${itemsHTML}

            </table>

            <hr>

            <p>

                Subtotal

                <span style="float:right;">
                    ${money(sale.subtotal)}
                </span>

            </p>

            <p>

                Discount

                <span style="float:right;">
                    ${money(sale.discount)}
                </span>

            </p>

            <p class="total">

                TOTAL

                <span style="float:right;">
                    ${money(sale.total)}
                </span>

            </p>

            <hr>

            <p>
                <strong>Payment Breakdown</strong>
            </p>

            ${
                Number(sale.cashAmount || 0) > 0
                ? `
                    <div class="payment-row">
                        <span>Cash</span>
                        <span>
                            ${money(sale.cashAmount)}
                        </span>
                    </div>
                `
                : ""
            }

            ${
                Number(sale.mpesaAmount || 0) > 0
                ? `
                    <div class="payment-row">
                        <span>M-Pesa</span>
                        <span>
                            ${money(sale.mpesaAmount)}
                        </span>
                    </div>
                `
                : ""
            }

            ${
                Number(sale.bankAmount || 0) > 0
                ? `
                    <div class="payment-row">
                        <span>Bank</span>
                        <span>
                            ${money(sale.bankAmount)}
                        </span>
                    </div>
                `
                : ""
            }

            <hr>

            <div class="payment-row">

                <strong>Total Paid</strong>

                <strong>
                    ${money(sale.amountPaid)}
                </strong>

            </div>

            ${
                Number(sale.change || 0) > 0
                ? `
                    <div class="payment-row">

                        <strong>Change</strong>

                        <strong>
                            ${money(sale.change)}
                        </strong>

                    </div>
                `
                : ""
            }

            ${
                Number(sale.balance || 0) > 0
                ? `
                    <div class="payment-row">

                        <strong>Balance Due</strong>

                        <strong>
                            ${money(sale.balance)}
                        </strong>

                    </div>
                `
                : ""
            }

            <hr>

            <p class="center">
                Thank You For Shopping!
            </p>

            <p class="center">
                Please Come Again
            </p>

        </body>

        </html>

    `);

    receipt.document.close();

    receipt.focus();

    setTimeout(() => {

        receipt.print();

        receipt.close();

    }, 500);

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return String(value ?? "")

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");

}


console.log(
    "LEBARTO CORRECTED POS MODULE LOADED."
);
