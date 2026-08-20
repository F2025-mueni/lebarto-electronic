// =====================================================
// LEBARTO ELECTRONICS
// POS.JS
// COMPLETE VERSION
// SELLING PRICE + BUYING/COST PRICE + PROFIT
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
// GLOBAL VARIABLES
// =====================================================

let currentUser = null;
let currentUserData = null;

let products = [];
let filteredProducts = [];
let cart = [];


// =====================================================
// CHECK LOGIN
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

        currentUserData =
            snapshot.docs[0].data();

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

    onSnapshot(q, (snapshot) => {

        products = [];

        snapshot.forEach(productDoc => {

            products.push({

                id: productDoc.id,

                ...productDoc.data()

            });

        });

        filteredProducts = [...products];

        displayProducts(filteredProducts);

    }, (error) => {

        console.error(
            "Load products error:",
            error
        );

        alert(
            "Unable to load products."
        );

    });

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

    productArray.forEach(product => {

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
                    ${escapeHTML(
                        product.category || ""
                    )}
                </p>

                <p>
                    Stock:
                    ${stock}
                </p>

                <h4>

                    KSh ${moneyValue(minSellingPrice)}

                    -

                    KSh ${moneyValue(maxSellingPrice)}

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
// GET SELLING PRICE MIN
// =====================================================

function getSellingMin(product) {

    return Number(
        product.minSellingPrice ??
        product.sellingPrice ??
        product.price ??
        0
    ) || 0;

}


// =====================================================
// GET SELLING PRICE MAX
// =====================================================

function getSellingMax(product) {

    return Number(
        product.maxSellingPrice ??
        product.sellingPrice ??
        product.price ??
        getSellingMin(product)
    ) || 0;

}


// =====================================================
// GET BUYING / COST PRICE
// =====================================================

function getBuyingPrice(product) {

    const value =

        product.buyingPrice ??

        product.costPrice ??

        product.purchasePrice ??

        product.buyPrice ??

        product.cost ??

        0;

    return Number(value) || 0;

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
                products.filter(product => {

                    return (

                        (product.name || "")
                            .toLowerCase()
                            .includes(value)

                        ||

                        String(product.barcode || "")
                            .toLowerCase()
                            .includes(value)

                        ||

                        (product.category || "")
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
            p => p.id === id
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
            item => item.id === id
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

            id:
                product.id,

            barcode:
                product.barcode || "",

            name:
                product.name || "",

            minPrice:
                minPrice,

            maxPrice:
                maxPrice,

            price:
                minPrice,

            // IMPORTANT
            buyingPrice:
                buyingPrice,

            // SAME VALUE FOR REPORTING
            costPrice:
                buyingPrice,

            quantity:
                1,

            stock:
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

    cart.forEach(item => {

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
                            onchange="updateQuantity('${item.id}', this.value)"
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
                        onblur="finishSellingPrice('${item.id}', this)"
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
// FINISH SELLING PRICE
// =====================================================

window.finishSellingPrice =
function (id, input) {

    const item =
        cart.find(
            product => product.id === id
        );

    if (!item) {
        return;
    }

    if (input.value === "") {

        input.value =
            item.price;

        return;

    }

    const price =
        Number(input.value);

    if (isNaN(price)) {

        input.value =
            item.price;

        return;

    }

    if (price < item.minPrice) {

        alert(
            `Selling price cannot be below KSh ${moneyValue(item.minPrice)}`
        );

        input.value =
            item.price;

        return;

    }

    if (price > item.maxPrice) {

        alert(
            `Selling price cannot be above KSh ${moneyValue(item.maxPrice)}`
        );

        input.value =
            item.price;

        return;

    }

    item.price =
        price;

    updateCart();

};


// =====================================================
// INCREASE QUANTITY
// =====================================================

window.increaseQty = function (id) {

    const item =
        cart.find(
            product => product.id === id
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


// =====================================================
// DECREASE QUANTITY
// =====================================================

window.decreaseQty = function (id) {

    const item =
        cart.find(
            product => product.id === id
        );

    if (!item) {
        return;
    }

    item.quantity--;

    if (item.quantity <= 0) {

        cart =
            cart.filter(
                product => product.id !== id
            );

    }

    updateCart();

};


// =====================================================
// DIRECT QUANTITY INPUT
// =====================================================

window.updateQuantity =
function (id, value) {

    const item =
        cart.find(
            product => product.id === id
        );

    if (!item) {
        return;
    }

    let quantity =
        Number(value);

    if (
        value === "" ||
        !Number.isInteger(quantity) ||
        quantity < 1
    ) {

        quantity = 1;

    }

    if (quantity > item.stock) {

        alert(
            `Only ${item.stock} items are available in stock.`
        );

        quantity =
            item.stock;

    }

    item.quantity =
        quantity;

    updateCart();

};


// =====================================================
// REMOVE ITEM
// =====================================================

window.removeItem = function (id) {

    cart =
        cart.filter(
            product => product.id !== id
        );

    updateCart();

};


// =====================================================
// GET SUBTOTAL
// =====================================================

function getSubtotal() {

    let subtotal = 0;

    cart.forEach(item => {

        subtotal +=

            (Number(item.price) || 0) *

            (Number(item.quantity) || 0);

    });

    return subtotal;

}


// =====================================================
// CALCULATE TOTALS
// =====================================================

function calculateTotals() {

    const subtotal =
        getSubtotal();

    const discountElement =
        document.getElementById("discount");

    let discount = 0;

    if (discountElement) {

        discount =
            Number(discountElement.value) || 0;

    }

    const grandTotal =
        Math.max(
            0,
            subtotal - discount
        );

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


// =====================================================
// DISCOUNT LISTENER
// =====================================================

document
    .getElementById("discount")
    ?.addEventListener(
        "input",
        calculateTotals
    );


// =====================================================
// GET PAYMENT AMOUNTS
// =====================================================

function getPaymentAmounts() {

    const cash =
        Number(
            document
                .getElementById("cashAmount")
                ?.value
        ) || 0;

    const mpesa =
        Number(
            document
                .getElementById("mpesaAmount")
                ?.value
        ) || 0;

    const bank =
        Number(
            document
                .getElementById("bankAmount")
                ?.value
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
// PAYMENT METHOD CHECKBOXES
// =====================================================

document
    .querySelectorAll(
        'input[name="paymentMethod"]'
    )
    .forEach(checkbox => {

        checkbox.addEventListener(
            "change",
            handlePaymentMethods
        );

    });


// =====================================================
// HANDLE PAYMENT METHODS
// =====================================================

function handlePaymentMethods() {

    const container =
        document.getElementById(
            "paymentAmounts"
        );

    if (!container) {
        return;
    }

    const selectedMethods =
        [
            ...document.querySelectorAll(
                'input[name="paymentMethod"]:checked'
            )
        ].map(
            input => input.value
        );

    const oldPayments =
        getPaymentAmounts();

    container.innerHTML = "";

    selectedMethods.forEach(method => {

        let id = "";

        if (
            method.toLowerCase() === "cash"
        ) {

            id = "cashAmount";

        }

        else if (
            method.toLowerCase() === "m-pesa" ||
            method.toLowerCase() === "mpesa"
        ) {

            id = "mpesaAmount";

        }

        else if (
            method.toLowerCase() === "bank"
        ) {

            id = "bankAmount";

        }

        let oldValue = 0;

        if (id === "cashAmount") {
            oldValue = oldPayments.cash;
        }

        else if (id === "mpesaAmount") {
            oldValue = oldPayments.mpesa;
        }

        else if (id === "bankAmount") {
            oldValue = oldPayments.bank;
        }

        container.innerHTML += `

            <div class="payment-amount-row">

                <label>

                    ${escapeHTML(method)} Paid

                </label>

                <input
                    type="number"
                    id="${id}"
                    value="${oldValue || ""}"
                    min="0"
                    step="0.01"
                    placeholder="Enter amount"
                >

            </div>

        `;

    });

    container
        .querySelectorAll("input")
        .forEach(input => {

            input.addEventListener(
                "input",
                calculatePaymentTotal
            );

        });

    calculatePaymentTotal();

}


// =====================================================
// CALCULATE PAYMENT TOTAL
// =====================================================

function calculatePaymentTotal() {

    const payments =
        getPaymentAmounts();

    const amountPaidElement =
        document.getElementById(
            "amountPaid"
        );

    if (amountPaidElement) {

        amountPaidElement.textContent =
            money(payments.totalPaid);

    }

    const discount =
        Number(
            document.getElementById(
                "discount"
            )?.value
        ) || 0;

    const total =
        Math.max(
            0,
            getSubtotal() - discount
        );

    const balance =
        payments.totalPaid -
        total;

    const balanceElement =
        document.getElementById(
            "balance"
        );

    if (balanceElement) {

        balanceElement.textContent =
            money(balance);

        balanceElement.style.color =
            balance < 0
            ? "#dc3545"
            : "#198754";

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
                .forEach(box => {

                    box.checked = false;

                });

            const paymentAmounts =
                document.getElementById(
                    "paymentAmounts"
                );

            if (paymentAmounts) {
                paymentAmounts.innerHTML = "";
            }

            calculatePaymentTotal();

        }
    );


// =====================================================
// BACK BUTTON
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
            isNaN(sellingPrice) ||
            sellingPrice < item.minPrice ||
            sellingPrice > item.maxPrice
        ) {

            alert(
                `Invalid selling price for ${item.name}.`
            );

            return false;

        }

        if (
            isNaN(buyingPrice) ||
            buyingPrice < 0
        ) {

            alert(
                `Invalid buying price for ${item.name}.`
            );

            return false;

        }

    }

    const payments =
        getPaymentAmounts();

    const discount =
        Number(
            document.getElementById(
                "discount"
            )?.value
        ) || 0;

    const total =
        Math.max(
            0,
            getSubtotal() - discount
        );

    if (
        payments.totalPaid <= 0
    ) {

        alert(
            "Please enter the amount paid."
        );

        return false;

    }

    const selectedMethods =
        document.querySelectorAll(
            'input[name="paymentMethod"]:checked'
        );

    if (
        selectedMethods.length === 0
    ) {

        alert(
            "Please select at least one payment method."
        );

        return false;

    }

    if (
        payments.totalPaid < total
    ) {

        alert(
            `Amount paid is less than total.\n\n` +
            `Total: ${money(total)}\n` +
            `Paid: ${money(payments.totalPaid)}`
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
            customerElement?.value?.trim()
            ||
            "Walk-in Customer";

        const paymentMethods =
            [
                ...document.querySelectorAll(
                    'input[name="paymentMethod"]:checked'
                )
            ].map(
                item => item.value
            );

        const payments =
            getPaymentAmounts();

        const cashAmount =
            payments.cash;

        const mpesaAmount =
            payments.mpesa;

        const bankAmount =
            payments.bank;

        const amountPaid =
            payments.totalPaid;

        const subtotal =
            getSubtotal();

        const discount =
            Number(
                document.getElementById(
                    "discount"
                )?.value
            ) || 0;

        const grandTotal =
            Math.max(
                0,
                subtotal - discount
            );

        const balance =
            amountPaid -
            grandTotal;


        // =================================================
        // BUILD SALE ITEMS
        // =================================================

        const saleItems = [];

        let totalCost = 0;

        let totalProfit = 0;


        cart.forEach(item => {

            const quantity =
                Number(item.quantity) || 0;

            const sellingPrice =
                Number(item.price) || 0;

            const buyingPrice =
                Number(item.buyingPrice) || 0;

            const lineRevenue =
                sellingPrice *
                quantity;

            const lineCost =
                buyingPrice *
                quantity;

            const lineProfit =
                lineRevenue -
                lineCost;

            totalCost +=
                lineCost;

            totalProfit +=
                lineProfit;


            saleItems.push({

                productId:
                    item.id,

                barcode:
                    item.barcode || "",

                name:
                    item.name || "",

                quantity:
                    quantity,

                // SELLING PRICE
                price:
                    sellingPrice,

                sellingPrice:
                    sellingPrice,

                // BUYING PRICE
                buyingPrice:
                    buyingPrice,

                // COST PRICE
                costPrice:
                    buyingPrice,

                // TOTAL SELLING VALUE
                total:
                    lineRevenue,

                revenue:
                    lineRevenue,

                // TOTAL COST
                costTotal:
                    lineCost,

                totalCost:
                    lineCost,

                // PROFIT
                profit:
                    lineProfit

            });

        });


        // =================================================
        // RECEIPT NUMBER
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

            cashAmount,

            mpesaAmount,

            bankAmount,

            amountPaid,

            subtotal,

            discount,

            total:
                grandTotal,

            // IMPORTANT REPORT FIELDS
            totalCost,

            cost:
                totalCost,

            profit:
                totalProfit,

            balance,

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

            const currentProduct =
                products.find(
                    p => p.id === item.id
                );

            if (!currentProduct) {
                continue;
            }

            const currentStock =
                Number(
                    currentProduct.quantity
                ) || 0;

            const soldQuantity =
                Number(item.quantity) || 0;

            const newStock =
                currentStock -
                soldQuantity;

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
                            newStock
                        )
                }

            );

        }


        // =================================================
        // SAVE LAST SALE
        // =================================================

        window.lastSale = {

            ...saleData,

            date:
                new Date(),

            items:
                [...saleItems]

        };


        // =================================================
        // SUCCESS
        // =================================================

        alert(
            "Sale completed successfully!"
        );


        // =================================================
        // PRINT RECEIPT
        // =================================================

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
            .forEach(box => {
                box.checked = false;
            });

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

    const now =
        new Date();

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
        ).padStart(2, "0");

}


// =====================================================
// PRINT RECEIPT BUTTON
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

    return "KSh " +
        moneyValue(value);

}


// =====================================================
// DATE
// =====================================================

function formatDate(date) {

    if (!date) {
        return "";
    }

    if (
        typeof date.toDate === "function"
    ) {

        date =
            date.toDate();

    }

    return new Date(date)
        .toLocaleString(
            "en-KE"
        );

}


// =====================================================
// GENERATE RECEIPT
// =====================================================

function generateReceipt() {

    if (!window.lastSale) {

        alert(
            "No receipt available."
        );

        return;

    }

    const sale =
        window.lastSale;

    let itemsHTML = "";

    sale.items.forEach(item => {

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
            "width=450,height=750"
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
                Receipt ${escapeHTML(sale.receiptNo)}
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

            <p>
                <strong>Payment:</strong>
                ${
                    sale.paymentMethods?.length
                    ? sale.paymentMethods.join(", ")
                    : "None"
                }
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

                Cash

                <span style="float:right;">
                    ${money(sale.cashAmount)}
                </span>

            </p>

            <p>

                M-Pesa

                <span style="float:right;">
                    ${money(sale.mpesaAmount)}
                </span>

            </p>

            <p>

                Bank

                <span style="float:right;">
                    ${money(sale.bankAmount)}
                </span>

            </p>

            <p>

                <strong>
                    Total Paid
                </strong>

                <span style="float:right;">

                    <strong>
                        ${money(sale.amountPaid)}
                    </strong>

                </span>

            </p>

            <p>

                Balance

                <span style="float:right;">
                    ${money(sale.balance)}
                </span>

            </p>

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

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// =====================================================
// END
// =====================================================

console.log(
    "LEBARTO POS MODULE LOADED SUCCESSFULLY."
);
