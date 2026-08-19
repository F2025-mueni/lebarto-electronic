// =====================================================
// LEBARTO ELECTRONICS
// POS.JS
// COMPLETE VERSION
// =====================================================

// =====================================================
// IMPORTS
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

    const userLoaded = await loadCurrentUser();

    if (!userLoaded) {

        return;

    }

    loadProducts();

});


// =====================================================
// LOAD CURRENT USER
// =====================================================

async function loadCurrentUser() {

    try {

        const userQuery = query(
            collection(db, "users"),
            where("uid", "==", currentUser.uid)
        );

        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {

            alert("User account not found.");

            return false;

        }

        currentUserData =
            userSnapshot.docs[0].data();

        // Make sure this is actually a cashier
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

    });

}


// =====================================================
// DISPLAY PRODUCTS
// =====================================================

function displayProducts(productArray) {

    const container =
        document.getElementById("productList");

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
            Number(product.minSellingPrice) || 0;

        const maxSellingPrice =
            Number(product.maxSellingPrice) || 0;

        container.innerHTML += `

            <div class="product-card">

                <h3>

                    ${product.name || ""}

                </h3>

                <p>

                    Barcode:

                    ${product.barcode || ""}

                </p>

                <p>

                    Category:

                    ${product.category || ""}

                </p>

                <p>

                    Stock:

                    ${stock}

                </p>

                <h4>

                    KSh ${minSellingPrice.toLocaleString()}

                    -

                    KSh ${maxSellingPrice.toLocaleString()}

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
// SEARCH PRODUCTS
// =====================================================

document
    .getElementById("searchProduct")
    .addEventListener("keyup", function () {

        const value =
            this.value.toLowerCase().trim();

        filteredProducts =
            products.filter(product => {

                return (

                    (product.name || "")
                        .toLowerCase()
                        .includes(value)

                    ||

                    (product.barcode || "")
                        .toString()
                        .toLowerCase()
                        .includes(value)

                    ||

                    (product.category || "")
                        .toLowerCase()
                        .includes(value)

                );

            });

        displayProducts(filteredProducts);

    });


// =====================================================
// ADD TO CART
// =====================================================

window.addToCart = function (id) {

    const product =
        products.find(p => p.id === id);

    if (!product) {

        return;

    }

    const stock =
        Number(product.quantity) || 0;

    if (stock <= 0) {

        alert("Product is out of stock.");

        return;

    }

    const existing =
        cart.find(item => item.id === id);

    if (existing) {

        if (existing.quantity >= stock) {

            alert("Not enough stock.");

            return;

        }

        existing.quantity++;

    }

    else {

        cart.push({

            id: product.id,

            barcode: product.barcode || "",

            name: product.name || "",

            minPrice:
                Number(product.minSellingPrice) || 0,

            maxPrice:
                Number(product.maxSellingPrice) || 0,

            price:
                Number(product.minSellingPrice) || 0,

            buyingPrice:
                Number(product.buyingPrice) || 0,

            quantity: 1,

            stock: stock

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

        table.innerHTML += `

            <tr>

                <!-- PRODUCT -->

                <td>

                    ${item.name}

                </td>


                <!-- QUANTITY -->

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

                            oninput="updateQuantity('${item.id}', this.value)"

                            style="width:55px; text-align:center;"

                        >


                        <button

                            type="button"

                            onclick="increaseQty('${item.id}')"

                        >

                            +

                        </button>

                    </div>

                </td>


                <!-- PRICE -->

                <td>

                    <input

                        type="number"

                        value="${item.price}"

                        min="${item.minPrice}"

                        max="${item.maxPrice}"

                        step="0.01"

                        oninput="updateSellingPrice('${item.id}', this.value)"

                        style="width:90px;"

                    >

                    <br>

                    <small>

                        Min:

                        KSh ${item.minPrice.toLocaleString()}

                    </small>

                    <br>

                    <small>

                        Max:

                        KSh ${item.maxPrice.toLocaleString()}

                    </small>

                </td>


                <!-- TOTAL -->

                <td>

                    KSh

                    ${moneyValue(

                        item.price * item.quantity

                    )}

                </td>


                <!-- REMOVE -->

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
// INCREASE QUANTITY
// =====================================================

window.increaseQty = function (id) {

    const item =
        cart.find(product => product.id === id);

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
        cart.find(product => product.id === id);

    if (!item) {

        return;

    }

    item.quantity--;

    if (item.quantity <= 0) {

        cart =
            cart.filter(product => product.id !== id);

    }

    updateCart();

};


// =====================================================
// DIRECT QUANTITY INPUT
// =====================================================

window.updateQuantity = function (id, value) {

    const item =
        cart.find(product => product.id === id);

    if (!item) {

        return;

    }

    let quantity =
        Number(value);

    // Empty or invalid quantity
    if (
        value === "" ||
        !Number.isInteger(quantity) ||
        quantity < 1
    ) {

        quantity = 1;

    }

    // Prevent selling more than stock
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
// UPDATE SELLING PRICE
// =====================================================

window.updateSellingPrice = function (id, value) {

    const item =
        cart.find(product => product.id === id);

    if (!item) {

        return;

    }

    // Allow the field to temporarily be empty
    if (value === "") {

        return;

    }

    const price =
        Number(value);

    if (isNaN(price)) {

        return;

    }

    // Price cannot be below minimum
    if (price < item.minPrice) {

        alert(
            `Selling price cannot be below KSh ${item.minPrice.toLocaleString()}`
        );

        item.price = item.minPrice;

        updateCart();

        return;

    }

    // Price cannot be above maximum
    if (price > item.maxPrice) {

        alert(
            `Selling price cannot be above KSh ${item.maxPrice.toLocaleString()}`
        );

        item.price = item.maxPrice;

        updateCart();

        return;

    }

    item.price = price;

    updateCart();

};


// =====================================================
// REMOVE ITEM
// =====================================================

window.removeItem = function (id) {

    cart =
        cart.filter(product => product.id !== id);

    updateCart();

};


// =====================================================
// CALCULATE AUTOMATIC DISCOUNT
// =====================================================
//
// Discount is calculated from:
//
// Maximum Selling Price - Actual Selling Price
//
// Example:
//
// Max price = 2,000
// Seller price = 1,800
// Quantity = 2
//
// Discount = (2,000 - 1,800) × 2
//          = 400
//
// =====================================================

function calculateTotals() {

    let subtotal = 0;

    let automaticDiscount = 0;

    cart.forEach(item => {

        const price =
            Number(item.price) || 0;

        const quantity =
            Number(item.quantity) || 0;

        const maxPrice =
            Number(item.maxPrice) || 0;

        subtotal +=
            price * quantity;


        if (maxPrice > price) {

            automaticDiscount +=
                (maxPrice - price) * quantity;

        }

    });


    const discount =
        automaticDiscount;


    const grandTotal =
        subtotal - discount;


    // Show automatic discount
    document
        .getElementById("discount")
        .value = discount;


    // Show subtotal
    document
        .getElementById("subtotal")
        .textContent =
        "KSh " +
        moneyValue(subtotal);


    // Show total
    document
        .getElementById("grandTotal")
        .textContent =
        "KSh " +
        moneyValue(grandTotal);


    calculateBalance();

}


// =====================================================
// CALCULATE BALANCE
// =====================================================

function calculateBalance() {

    let subtotal = 0;

    let automaticDiscount = 0;

    cart.forEach(item => {

        const price =
            Number(item.price) || 0;

        const maxPrice =
            Number(item.maxPrice) || 0;

        const quantity =
            Number(item.quantity) || 0;


        subtotal +=
            price * quantity;


        if (maxPrice > price) {

            automaticDiscount +=
                (maxPrice - price) * quantity;

        }

    });


    const total =
        subtotal - automaticDiscount;


    const paid =
        Number(
            document
                .getElementById("amountPaid")
                .value
        ) || 0;


    const balance =
        paid - total;


    document
        .getElementById("balance")
        .textContent =

        "KSh " +

        moneyValue(balance);

}


// =====================================================
// AMOUNT PAID CHANGE
// =====================================================

document
    .getElementById("amountPaid")
    .addEventListener("input", () => {

        calculateBalance();

    });


// =====================================================
// CLEAR CART
// =====================================================

document
    .getElementById("clearCart")
    .addEventListener("click", () => {

        if (cart.length === 0) {

            return;

        }

        if (confirm("Clear cart?")) {

            cart = [];

            updateCart();


            document
                .getElementById("discount")
                .value = 0;


            document
                .getElementById("amountPaid")
                .value = "";


            document
                .getElementById("customerName")
                .value = "";


            document
                .querySelectorAll(
                    'input[name="paymentMethod"]'
                )
                .forEach(box => {

                    box.checked = false;

                });

        }

    });


// =====================================================
// BACK BUTTON
// =====================================================

document
    .getElementById("backBtn")
    .addEventListener("click", () => {

        window.location.href = "cashier.html";

    });


// =====================================================
// GET AUTOMATIC DISCOUNT
// =====================================================

function getAutomaticDiscount() {

    let discount = 0;

    cart.forEach(item => {

        const maxPrice =
            Number(item.maxPrice) || 0;

        const price =
            Number(item.price) || 0;

        const quantity =
            Number(item.quantity) || 0;


        if (maxPrice > price) {

            discount +=
                (maxPrice - price) * quantity;

        }

    });

    return discount;

}


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
// GET GRAND TOTAL
// =====================================================

function getGrandTotal() {

    const subtotal =
        getSubtotal();

    const discount =
        getAutomaticDiscount();

    return subtotal - discount;

}


// =====================================================
// PAYMENT VALIDATION
// =====================================================

function validateSale() {

    if (cart.length === 0) {

        alert("Cart is empty.");

        return false;

    }


    const paid =
        Number(
            document
                .getElementById("amountPaid")
                .value
        ) || 0;


    const total =
        getGrandTotal();


    if (paid < total) {

        alert(
            "Amount paid is less than total."
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
    .addEventListener("click", async () => {

        if (!validateSale()) {

            return;

        }


        const btn =
            document.getElementById("completeSale");


        btn.disabled = true;


        try {

            await completeSale();

        }

        finally {

            btn.disabled = false;

        }

    });


// =====================================================
// COMPLETE SALE
// =====================================================

async function completeSale() {

    try {

        const customerName =

            document
                .getElementById("customerName")
                .value
                .trim()

            ||

            "Walk-in Customer";


        // =================================================
        // PAYMENT METHODS
        // =================================================

        const paymentMethods = [

            ...document.querySelectorAll(
                'input[name="paymentMethod"]:checked'
            )

        ].map(item => item.value);


        if (paymentMethods.length === 0) {

            alert(
                "Please select at least one payment method."
            );

            return;

        }


        // =================================================
        // CALCULATE SALE TOTALS
        // =================================================

        const subtotal =
            getSubtotal();


        const discount =
            getAutomaticDiscount();


        const grandTotal =
            subtotal - discount;


        const amountPaid =
            Number(
                document
                    .getElementById("amountPaid")
                    .value
            ) || 0;


        const balance =
            amountPaid - grandTotal;


        // =================================================
        // CALCULATE PROFIT
        // =================================================
        //
        // Actual profit uses the actual selling price.
        //
        // Profit = Actual Selling Price - Buying Price
        //
        // =================================================

        let profit = 0;


        cart.forEach(item => {

            const price =
                Number(item.price) || 0;

            const buyingPrice =
                Number(item.buyingPrice) || 0;

            const qty =
                Number(item.quantity) || 0;


            profit +=
                (price - buyingPrice) * qty;

        });


        // =================================================
        // RECEIPT NUMBER
        // =================================================

        const receiptNo =
            generateReceiptNumber();


        // =================================================
        // SALE ITEMS
        // =================================================

        const saleItems = [];


        cart.forEach(item => {

            saleItems.push({

                productId:
                    item.id,

                barcode:
                    item.barcode,

                name:
                    item.name,

                quantity:
                    Number(item.quantity),

                price:
                    Number(item.price),

                total:
                    Number(item.price) *
                    Number(item.quantity)

            });

        });


        // =================================================
        // SALE OBJECT
        // =================================================

        const saleData = {

            receiptNo:
                receiptNo,

            customerName:
                customerName,

            cashier:
                currentUserData?.name ||
                currentUser.email ||
                "Unknown Cashier",

            cashierId:
                currentUser.uid,

            paymentMethods:
                paymentMethods,

            subtotal:
                subtotal,

            discount:
                discount,

            total:
                grandTotal,

            profit:
                profit,

            amountPaid:
                amountPaid,

            balance:
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
        // UPDATE PRODUCT STOCK
        // =================================================

        for (const item of cart) {

            const product =
                products.find(
                    p => p.id === item.id
                );


            if (product) {

                const currentStock =
                    Number(product.quantity) || 0;

                const soldQuantity =
                    Number(item.quantity) || 0;


                const newStock =
                    currentStock - soldQuantity;


                await updateDoc(

                    doc(
                        db,
                        "products",
                        item.id
                    ),

                    {

                        quantity:
                            Math.max(0, newStock)

                    }

                );

            }

        }


        // =================================================
        // SALE SUCCESS
        // =================================================

        alert(
            "Sale completed successfully!"
        );


        // =================================================
        // SAVE LAST SALE FOR PRINTING
        // =================================================

        window.lastSale = {

            receiptNo:
                receiptNo,

            customerName:
                customerName,

            cashier:
                currentUserData?.name ||
                currentUser.email ||
                "Unknown Cashier",

            paymentMethods:
                paymentMethods,

            subtotal:
                subtotal,

            discount:
                discount,

            profit:
                profit,

            total:
                grandTotal,

            amountPaid:
                amountPaid,

            balance:
                balance,

            items:
                [...saleItems],

            date:
                new Date()

        };


        // =================================================
        // PRINT RECEIPT
        // =================================================

        generateReceipt();


        // =================================================
        // CLEAR CART
        // =================================================

        cart = [];

        updateCart();


        // =================================================
        // RESET FORM
        // =================================================

        document
            .getElementById("customerName")
            .value = "";


        document
            .getElementById("discount")
            .value = 0;


        document
            .getElementById("amountPaid")
            .value = "";


        document
            .getElementById("balance")
            .textContent =
            "KSh 0";


        document
            .querySelectorAll(
                'input[name="paymentMethod"]'
            )
            .forEach(box => {

                box.checked = false;

            });


        calculateTotals();

    }

    catch (error) {

        console.error(
            "Complete sale error:",
            error
        );

        alert(
            "Unable to complete sale."
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
    .addEventListener("click", () => {

        if (!window.lastSale) {

            alert(
                "No completed sale available to print."
            );

            return;

        }

        generateReceipt();

    });


// =====================================================
// MONEY FORMAT
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
// FORMAT DATE
// =====================================================

function formatDate(date) {

    return new Date(date)
        .toLocaleString();

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

                    ${item.name}

                </td>

                <td
                    style="text-align:center;"
                >

                    ${item.quantity}

                </td>

                <td
                    style="text-align:right;"
                >

                    ${money(item.total)}

                </td>

            </tr>

        `;

    });


    const receipt =
        window.open(
            "",
            "_blank",
            "width=400,height=700"
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

            <title>Receipt</title>

            <style>

                body {

                    font-family:
                        Arial, sans-serif;

                    width: 300px;

                    margin: auto;

                    padding: 10px;

                    font-size: 13px;

                }


                h2 {

                    text-align: center;

                    margin-bottom: 5px;

                }


                p {

                    margin: 3px 0;

                }


                hr {

                    border: none;

                    border-top:
                        1px dashed #000;

                }


                table {

                    width: 100%;

                    border-collapse:
                        collapse;

                }


                td {

                    padding: 3px 0;

                }


                .total {

                    font-size: 16px;

                    font-weight: bold;

                }


                .center {

                    text-align: center;

                }


                .right {

                    text-align: right;

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

                <strong>
                    Receipt:
                </strong>

                ${sale.receiptNo}

            </p>


            <p>

                <strong>
                    Date:
                </strong>

                ${formatDate(sale.date)}

            </p>


            <p>

                <strong>
                    Cashier:
                </strong>

                ${sale.cashier}

            </p>


            <p>

                <strong>
                    Customer:
                </strong>

                ${sale.customerName}

            </p>


            <p>

                <strong>
                    Payment:
                </strong>

                ${sale.paymentMethods.join(", ")}

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

                        Total

                    </th>

                </tr>


                ${itemsHTML}

            </table>


            <hr>


            <p>

                Subtotal

                <span
                    class="right"
                    style="float:right;"
                >

                    ${money(sale.subtotal)}

                </span>

            </p>


            <p>

                Discount

                <span
                    class="right"
                    style="float:right;"
                >

                    ${money(sale.discount)}

                </span>

            </p>


            <p class="total">

                TOTAL

                <span
                    style="float:right;"
                >

                    ${money(sale.total)}

                </span>

            </p>


            <p>

                Paid

                <span
                    style="float:right;"
                >

                    ${money(sale.amountPaid)}

                </span>

            </p>


            <p>

                Balance

                <span
                    style="float:right;"
                >

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
