// =====================================================
// LEBARTO ELECTRONICS
// REPORTS.JS
// OPTIMIZED SALES REPORT
// =====================================================

import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// =====================================================
// GLOBALS
// =====================================================

let currentUser = null;
let currentUserData = null;

let sales = [];
let filteredSales = [];


// =====================================================
// AUTHENTICATION
// =====================================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "login.html";

        return;

    }

    currentUser = user;

    /*
     * Do not make the sales report wait for
     * the user profile query.
     *
     * Both operations can happen at the
     * same time.
     */

    loadCurrentUser();

    loadSales();

});


// =====================================================
// LOAD CURRENT USER
// =====================================================

async function loadCurrentUser() {

    try {

        const q = query(
            collection(db, "users"),
            where(
                "uid",
                "==",
                currentUser.uid
            )
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {

            currentUserData =
                snapshot.docs[0].data();

        }

        const nameElement =
            document.getElementById("adminName");

        if (nameElement) {

            nameElement.textContent =
                currentUserData?.name ||
                currentUser.email ||
                "Admin";

        }

    }

    catch (error) {

        console.error(
            "User loading error:",
            error
        );

        const nameElement =
            document.getElementById("adminName");

        if (nameElement) {

            nameElement.textContent =
                currentUser.email ||
                "Admin";

        }

    }

}


// =====================================================
// LOAD SALES
// =====================================================

async function loadSales() {

    const table =
        document.getElementById(
            "reportTable"
        );

    /*
     * Show loading immediately.
     */

    if (table) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="10"
                    class="no-data"
                >

                    <i class="fa-solid fa-spinner fa-spin"></i>

                    Loading sales report...

                </td>

            </tr>

        `;

    }

    try {

        /*
         * Load the sales collection once.
         *
         * We intentionally do not use orderBy()
         * because older records may not have a
         * valid date field.
         */

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "sales"
                )
            );


        const loadedSales = [];


        snapshot.forEach(
            saleDoc => {

                loadedSales.push({

                    id:
                        saleDoc.id,

                    ...saleDoc.data()

                });

            }
        );


        /*
         * Sort safely in JavaScript.
         */

        loadedSales.sort(
            (a, b) => {

                const dateA =
                    getSaleDate(a);

                const dateB =
                    getSaleDate(b);

                if (!dateA && !dateB) {
                    return 0;
                }

                if (!dateA) {
                    return 1;
                }

                if (!dateB) {
                    return -1;
                }

                return dateB - dateA;

            }
        );


        sales = loadedSales;

        filteredSales = [...sales];


        console.log(
            "LEBARTO REPORT:",
            sales.length,
            "sales loaded"
        );


        /*
         * Display everything after the
         * data has arrived.
         */

        displayReport(
            filteredSales
        );

        updateStatistics(
            filteredSales
        );

        updateReportPeriod();

    }

    catch (error) {

        console.error(
            "Load sales error:",
            error
        );

        if (table) {

            table.innerHTML = `

                <tr>

                    <td
                        colspan="10"
                        class="no-data"
                    >

                        Unable to load sales.

                        <br><br>

                        ${escapeHTML(
                            error.message
                        )}

                    </td>

                </tr>

            `;

        }

    }

}


// =====================================================
// NUMBER VALUE
// =====================================================

function numberValue(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return 0;

    }


    if (
        typeof value === "number"
    ) {

        return Number.isFinite(value)
            ? value
            : 0;

    }


    const cleaned =
        String(value)
            .replace(/,/g, "")
            .replace(/KSh/gi, "")
            .trim();


    const result =
        Number(cleaned);


    return Number.isFinite(result)
        ? result
        : 0;

}


// =====================================================
// DATE
// =====================================================

function getSaleDate(sale) {

    if (!sale?.date) {

        return null;

    }


    try {

        /*
         * Firestore Timestamp
         */

        if (
            typeof sale.date.toDate ===
            "function"
        ) {

            return sale.date.toDate();

        }


        /*
         * Firestore timestamp object
         */

        if (
            typeof sale.date.seconds ===
            "number"
        ) {

            return new Date(
                sale.date.seconds * 1000
            );

        }


        /*
         * Date object
         */

        if (
            sale.date instanceof Date
        ) {

            return sale.date;

        }


        /*
         * Number timestamp
         */

        if (
            typeof sale.date ===
            "number"
        ) {

            const numericDate =
                new Date(
                    sale.date
                );

            return Number.isNaN(
                numericDate.getTime()
            )
                ? null
                : numericDate;

        }


        /*
         * String date
         */

        const date =
            new Date(
                sale.date
            );


        return Number.isNaN(
            date.getTime()
        )
            ? null
            : date;

    }

    catch (error) {

        console.error(
            "Date conversion error:",
            error
        );

        return null;

    }

}


// =====================================================
// PAYMENT NORMALIZATION
// =====================================================

function normalizePaymentMethod(method) {

    return String(
        method || ""
    )
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z]/g,
            ""
        );

}


// =====================================================
// SAVED PAYMENT METHODS
// =====================================================

function getSavedPaymentMethods(sale) {

    if (
        Array.isArray(
            sale?.paymentMethods
        )
    ) {

        return sale.paymentMethods
            .map(
                method =>
                    String(
                        method
                    ).trim()
            )
            .filter(Boolean);

    }

    return [];

}


// =====================================================
// PAYMENT AMOUNTS
// =====================================================

function getPaymentAmounts(sale) {

    const cash =
        numberValue(
            sale?.cashAmount
        );

    const mpesa =
        numberValue(
            sale?.mpesaAmount
        );

    const bank =
        numberValue(
            sale?.bankAmount
        );

    const savedAmountPaid =
        numberValue(
            sale?.amountPaid
        );


    /*
     * Older records may only have
     * amountPaid + paymentMethods.
     */

    if (
        cash === 0 &&
        mpesa === 0 &&
        bank === 0 &&
        savedAmountPaid > 0
    ) {

        const methods =
            getSavedPaymentMethods(
                sale
            );


        if (
            methods.length === 1
        ) {

            const method =
                normalizePaymentMethod(
                    methods[0]
                );


            if (
                method === "cash"
            ) {

                return {

                    cash:
                        savedAmountPaid,

                    mpesa: 0,

                    bank: 0,

                    totalPaid:
                        savedAmountPaid

                };

            }


            if (
                method === "mpesa"
            ) {

                return {

                    cash: 0,

                    mpesa:
                        savedAmountPaid,

                    bank: 0,

                    totalPaid:
                        savedAmountPaid

                };

            }


            if (
                method === "bank"
            ) {

                return {

                    cash: 0,

                    mpesa: 0,

                    bank:
                        savedAmountPaid,

                    totalPaid:
                        savedAmountPaid

                };

            }

        }

    }


    const fieldsTotal =
        cash +
        mpesa +
        bank;


    return {

        cash,

        mpesa,

        bank,

        totalPaid:
            savedAmountPaid > 0
                ? savedAmountPaid
                : fieldsTotal

    };

}


// =====================================================
// ITEM SELLING PRICE
// =====================================================

function getItemSellingPrice(item) {

    return numberValue(

        item?.sellingPrice ??

        item?.price ??

        item?.unitPrice ??

        item?.salePrice ??

        0

    );

}


// =====================================================
// ITEM BUYING PRICE
// =====================================================

function getItemBuyingPrice(item) {

    return numberValue(

        item?.buyingPrice ??

        item?.costPrice ??

        item?.purchasePrice ??

        item?.buyPrice ??

        item?.cost ??

        0

    );

}


// =====================================================
// ITEM QUANTITY
// =====================================================

function getItemQuantity(item) {

    return numberValue(
        item?.quantity
    );

}


// =====================================================
// ITEMS TOTAL
// =====================================================

function calculateItemsTotal(sale) {

    if (
        !Array.isArray(
            sale?.items
        )
    ) {

        return 0;

    }


    return sale.items.reduce(
        (total, item) => {

            const savedTotal =
                numberValue(
                    item?.total ??
                    item?.revenue
                );


            if (
                savedTotal > 0
            ) {

                return (
                    total +
                    savedTotal
                );

            }


            return total +

                (
                    getItemSellingPrice(
                        item
                    ) *

                    getItemQuantity(
                        item
                    )
                );

        },
        0
    );

}


// =====================================================
// SALE TOTAL
// =====================================================

function getSaleTotal(sale) {

    /*
     * Prefer the actual POS total.
     */

    if (
        sale?.total !== undefined &&
        sale?.total !== null &&
        sale?.total !== ""
    ) {

        return Math.max(
            0,
            numberValue(
                sale.total
            )
        );

    }


    const grandTotal =
        numberValue(
            sale?.grandTotal
        );


    if (
        grandTotal > 0
    ) {

        return grandTotal;

    }


    const subtotal =
        numberValue(
            sale?.subtotal
        );

    const discount =
        numberValue(
            sale?.discount
        );


    if (
        subtotal > 0
    ) {

        return Math.max(
            0,
            subtotal - discount
        );

    }


    return calculateItemsTotal(
        sale
    );

}


// =====================================================
// AMOUNT PAID
// =====================================================

function getAmountPaid(sale) {

    return getPaymentAmounts(
        sale
    ).totalPaid;

}


// =====================================================
// BALANCE
// =====================================================

function getBalance(sale) {

    if (
        sale?.balance !== undefined &&
        sale?.balance !== null
    ) {

        return Math.max(
            0,
            numberValue(
                sale.balance
            )
        );

    }


    return Math.max(
        0,
        getSaleTotal(sale) -
        getAmountPaid(sale)
    );

}


// =====================================================
// CHANGE
// =====================================================

function getChange(sale) {

    if (
        sale?.change !== undefined &&
        sale?.change !== null
    ) {

        return Math.max(
            0,
            numberValue(
                sale.change
            )
        );

    }


    return Math.max(
        0,
        getAmountPaid(sale) -
        getSaleTotal(sale)
    );

}


// =====================================================
// PAYMENT METHODS
// =====================================================

function getPaymentMethods(sale) {

    const payments =
        getPaymentAmounts(
            sale
        );

    const methods = [];


    if (
        payments.cash > 0
    ) {

        methods.push("Cash");

    }


    if (
        payments.mpesa > 0
    ) {

        methods.push("M-Pesa");

    }


    if (
        payments.bank > 0
    ) {

        methods.push("Bank");

    }


    if (
        methods.length === 0
    ) {

        return getSavedPaymentMethods(
            sale
        );

    }


    return methods;

}


// =====================================================
// PAYMENT FILTER
// =====================================================

function saleUsesPaymentMethod(
    sale,
    requestedMethod
) {

    const normalized =
        normalizePaymentMethod(
            requestedMethod
        );


    const payments =
        getPaymentAmounts(
            sale
        );


    if (
        normalized === "cash"
    ) {

        return payments.cash > 0;

    }


    if (
        normalized === "mpesa"
    ) {

        return payments.mpesa > 0;

    }


    if (
        normalized === "bank"
    ) {

        return payments.bank > 0;

    }


    return getSavedPaymentMethods(
        sale
    ).some(
        method =>
            normalizePaymentMethod(
                method
            ) === normalized
    );

}


// =====================================================
// PAYMENT HTML
// =====================================================

function getPaymentBreakdownHTML(
    sale
) {

    const payments =
        getPaymentAmounts(
            sale
        );


    const parts = [];


    if (
        payments.cash > 0
    ) {

        parts.push(`

            <div class="payment-line">

                <span>Cash</span>

                <strong>
                    ${money(
                        payments.cash
                    )}
                </strong>

            </div>

        `);

    }


    if (
        payments.mpesa > 0
    ) {

        parts.push(`

            <div class="payment-line">

                <span>M-Pesa</span>

                <strong>
                    ${money(
                        payments.mpesa
                    )}
                </strong>

            </div>

        `);

    }


    if (
        payments.bank > 0
    ) {

        parts.push(`

            <div class="payment-line">

                <span>Bank</span>

                <strong>
                    ${money(
                        payments.bank
                    )}
                </strong>

            </div>

        `);

    }


    if (
        parts.length === 0
    ) {

        const saved =
            getSavedPaymentMethods(
                sale
            );


        if (
            saved.length > 0
        ) {

            return saved
                .map(
                    method => `

                        <span class="payment-badge">

                            ${escapeHTML(
                                method
                            )}

                        </span>

                    `
                )
                .join("");

        }


        return "-";

    }


    return parts.join("");

}


// =====================================================
// DISPLAY REPORT
// =====================================================

function displayReport(data) {

    const table =
        document.getElementById(
            "reportTable"
        );


    if (!table) {

        return;

    }


    if (
        data.length === 0
    ) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="10"
                    class="no-data"
                >

                    No sales found.

                </td>

            </tr>

        `;


        updateFooter([]);

        return;

    }


    /*
     * Build the complete table once.
     *
     * This is considerably faster than:
     *
     * table.innerHTML += ...
     *
     * for every sale.
     */

    const rows =
        data.map(
            (sale, index) => {

                const total =
                    getSaleTotal(
                        sale
                    );

                const paid =
                    getAmountPaid(
                        sale
                    );

                const balance =
                    getBalance(
                        sale
                    );

                const change =
                    getChange(
                        sale
                    );

                const date =
                    getSaleDate(
                        sale
                    );


                let productsHTML =
                    "-";


                if (
                    Array.isArray(
                        sale.items
                    ) &&
                    sale.items.length > 0
                ) {

                    productsHTML = `

                        <div class="product-list">

                            ${
                                sale.items
                                    .map(
                                        item => `

                                            <div
                                                class="product-item"
                                            >

                                                <span
                                                    class="product-name"
                                                >

                                                    ${escapeHTML(
                                                        item.name ||
                                                        "Unknown Product"
                                                    )}

                                                </span>

                                                <span
                                                    class="product-quantity"
                                                >

                                                    ×
                                                    ${getItemQuantity(
                                                        item
                                                    )}

                                                </span>

                                            </div>

                                        `
                                    )
                                    .join("")
                            }

                        </div>

                    `;

                }


                const paymentHTML =
                    getPaymentBreakdownHTML(
                        sale
                    );


                const receipt =
                    sale.receiptNo ||
                    String(
                        sale.id
                    ).substring(
                        0,
                        8
                    );


                const customer =
                    sale.customerName ||
                    "Walk-in Customer";


                const cashier =
                    sale.cashier ||
                    "-";


                const balanceHTML =
                    balance > 0

                        ? `

                            <span class="negative">

                                ${money(
                                    balance
                                )}

                            </span>

                        `

                        : `

                            <span class="positive">

                                KSh 0

                            </span>

                        `;


                const changeHTML =
                    change > 0

                        ? `

                            <br>

                            <small>

                                Change:
                                ${money(
                                    change
                                )}

                            </small>

                        `

                        : "";


                return `

                    <tr>

                        <td>
                            ${index + 1}
                        </td>

                        <td class="products-column">

                            ${productsHTML}

                        </td>

                        <td>

                            ${escapeHTML(
                                receipt
                            )}

                        </td>

                        <td>

                            ${escapeHTML(
                                customer
                            )}

                        </td>

                        <td>

                            ${escapeHTML(
                                cashier
                            )}

                        </td>

                        <td>

                            <div
                                class="payment-breakdown"
                            >

                                ${paymentHTML}

                            </div>

                        </td>

                        <td>

                            ${money(
                                total
                            )}

                        </td>

                        <td>

                            ${money(
                                paid
                            )}

                        </td>

                        <td>

                            ${balanceHTML}

                            ${changeHTML}

                        </td>

                        <td>

                            ${
                                date
                                    ? date.toLocaleString(
                                        "en-KE"
                                    )
                                    : "N/A"
                            }

                        </td>

                    </tr>

                `;

            }
        );


    table.innerHTML =
        rows.join("");


    updateFooter(
        data
    );

}


// =====================================================
// STATISTICS
// =====================================================

function updateStatistics(data) {

    let totalSales = 0;

    let transactions = 0;

    let cash = 0;

    let mpesa = 0;

    let bank = 0;

    let totalPaid = 0;

    let totalBalance = 0;

    let totalChange = 0;

    let totalCost = 0;

    let totalProfit = 0;


    data.forEach(
        sale => {

            const saleTotal =
                getSaleTotal(
                    sale
                );


            totalSales +=
                saleTotal;


            transactions++;


            const payments =
                getPaymentAmounts(
                    sale
                );


            cash +=
                payments.cash;

            mpesa +=
                payments.mpesa;

            bank +=
                payments.bank;


            totalPaid +=
                getAmountPaid(
                    sale
                );


            totalBalance +=
                getBalance(
                    sale
                );


            totalChange +=
                getChange(
                    sale
                );


            /*
             * COST
             */

            let saleCost =
                numberValue(
                    sale.totalCost
                );


            if (
                saleCost === 0
            ) {

                saleCost =
                    numberValue(
                        sale.cost
                    );

            }


            if (
                saleCost === 0 &&
                Array.isArray(
                    sale.items
                )
            ) {

                saleCost =
                    sale.items.reduce(
                        (total, item) => {

                            return total +

                                (
                                    getItemBuyingPrice(
                                        item
                                    ) *

                                    getItemQuantity(
                                        item
                                    )
                                );

                        },
                        0
                    );

            }


            totalCost +=
                saleCost;


            /*
             * PROFIT
             */

            let saleProfit;


            if (
                sale.profit !== undefined &&
                sale.profit !== null
            ) {

                saleProfit =
                    numberValue(
                        sale.profit
                    );

            }

            else {

                saleProfit =
                    saleTotal -
                    saleCost;

            }


            totalProfit +=
                saleProfit;

        }
    );


    /*
     * Main cards
     */

    setText(
        "totalSales",
        money(totalSales)
    );


    setText(
        "totalTransactions",
        transactions
    );


    setText(
        "cashSales",
        money(cash)
    );


    setText(
        "mpesaSales",
        money(mpesa)
    );


    setText(
        "bankSales",
        money(bank)
    );


    setText(
        "grandTotal",
        money(totalSales)
    );


    /*
     * Summary
     */

    setText(
        "summarySales",
        money(totalSales)
    );


    setText(
        "summaryTransactions",
        transactions
    );


    setText(
        "summaryCash",
        money(cash)
    );


    setText(
        "summaryMpesa",
        money(mpesa)
    );


    setText(
        "summaryBank",
        money(bank)
    );


    setText(
        "summaryPaid",
        money(totalPaid)
    );


    setText(
        "summaryBalance",
        money(totalBalance)
    );


    setText(
        "summaryGrandTotal",
        money(totalSales)
    );


    /*
     * Optional profit/cost elements.
     * They work if they exist in your HTML.
     */

    setText(
        "totalCost",
        money(totalCost)
    );


    setText(
        "totalProfit",
        money(totalProfit)
    );


}


// =====================================================
// FOOTER
// =====================================================

function updateFooter(data) {

    let salesTotal = 0;

    let paidTotal = 0;

    let balanceTotal = 0;


    data.forEach(
        sale => {

            salesTotal +=
                getSaleTotal(
                    sale
                );


            paidTotal +=
                getAmountPaid(
                    sale
                );


            balanceTotal +=
                getBalance(
                    sale
                );

        }
    );


    setText(
        "footerSales",
        money(salesTotal)
    );


    setText(
        "footerPaid",
        money(paidTotal)
    );


    setText(
        "footerBalance",
        money(balanceTotal)
    );

}


// =====================================================
// FILTER SALES
// =====================================================

function filterSales() {

    const fromDate =
        document.getElementById(
            "fromDate"
        )?.value || "";


    const toDate =
        document.getElementById(
            "toDate"
        )?.value || "";


    const payment =
        document.getElementById(
            "paymentFilter"
        )?.value || "";


    const search =
        (
            document.getElementById(
                "searchReport"
            )?.value || ""
        )
            .toLowerCase()
            .trim();


    filteredSales =
        sales.filter(
            sale => {

                const date =
                    getSaleDate(
                        sale
                    );


                let matchDate = true;


                /*
                 * FROM DATE
                 */

                if (
                    fromDate
                ) {

                    if (!date) {

                        matchDate = false;

                    }

                    else {

                        const from =
                            new Date(
                                `${fromDate}T00:00:00`
                            );


                        if (
                            date < from
                        ) {

                            matchDate = false;

                        }

                    }

                }


                /*
                 * TO DATE
                 */

                if (
                    toDate
                ) {

                    if (!date) {

                        matchDate = false;

                    }

                    else {

                        const to =
                            new Date(
                                `${toDate}T23:59:59.999`
                            );


                        if (
                            date > to
                        ) {

                            matchDate = false;

                        }

                    }

                }


                /*
                 * PAYMENT
                 */

                let matchPayment = true;


                if (
                    payment
                ) {

                    matchPayment =
                        saleUsesPaymentMethod(
                            sale,
                            payment
                        );

                }


                /*
                 * SEARCH
                 */

                let productNames = "";


                if (
                    Array.isArray(
                        sale.items
                    )
                ) {

                    productNames =
                        sale.items
                            .map(
                                item =>
                                    item.name ||
                                    ""
                            )
                            .join(" ")
                            .toLowerCase();

                }


                const searchable = [

                    sale.customerName ||
                    "",

                    sale.cashier ||
                    "",

                    sale.receiptNo ||
                    "",

                    productNames

                ]
                    .join(" ")
                    .toLowerCase();


                const matchSearch =
                    !search ||
                    searchable.includes(
                        search
                    );


                return (

                    matchDate &&

                    matchPayment &&

                    matchSearch

                );

            }
        );


    displayReport(
        filteredSales
    );


    updateStatistics(
        filteredSales
    );


    updateReportPeriod();

}


// =====================================================
// REPORT PERIOD
// =====================================================

function updateReportPeriod() {

    const from =
        document.getElementById(
            "fromDate"
        )?.value || "";


    const to =
        document.getElementById(
            "toDate"
        )?.value || "";


    let text =
        "All Sales";


    if (
        from &&
        to
    ) {

        text =
            `From ${from} to ${to}`;

    }

    else if (
        from
    ) {

        text =
            `From ${from}`;

    }

    else if (
        to
    ) {

        text =
            `Up to ${to}`;

    }


    const payment =
        document.getElementById(
            "paymentFilter"
        )?.value || "";


    if (
        payment
    ) {

        text +=
            ` • ${payment}`;

    }


    setText(
        "reportPeriod",
        text
    );

}


// =====================================================
// SEARCH EVENTS
// =====================================================

document
    .getElementById(
        "searchReport"
    )
    ?.addEventListener(
        "input",
        filterSales
    );


document
    .getElementById(
        "generateReportBtn"
    )
    ?.addEventListener(
        "click",
        filterSales
    );


document
    .getElementById(
        "paymentFilter"
    )
    ?.addEventListener(
        "change",
        filterSales
    );


document
    .getElementById(
        "fromDate"
    )
    ?.addEventListener(
        "change",
        filterSales
    );


document
    .getElementById(
        "toDate"
    )
    ?.addEventListener(
        "change",
        filterSales
    );


// =====================================================
// TABLE SEARCH
// =====================================================

document
    .getElementById(
        "tableSearch"
    )
    ?.addEventListener(
        "input",
        function () {

            const value =
                this.value
                    .toLowerCase()
                    .trim();


            document
                .querySelectorAll(
                    "#reportTable tr"
                )
                .forEach(
                    row => {

                        const text =
                            row.textContent
                                .toLowerCase();


                        row.style.display =
                            !value ||
                            text.includes(
                                value
                            )
                                ? ""
                                : "none";

                    }
                );

        }
    );


// =====================================================
// PRINT REPORT
// =====================================================

document
    .getElementById(
        "printReportBtn"
    )
    ?.addEventListener(
        "click",
        () => {

            window.print();

        }
    );


// =====================================================
// DOWNLOAD CSV
// =====================================================

document
    .getElementById(
        "downloadReportBtn"
    )
    ?.addEventListener(
        "click",
        downloadCSV
    );


// =====================================================
// DOWNLOAD CSV
// =====================================================

function downloadCSV() {

    if (
        filteredSales.length === 0
    ) {

        alert(
            "There is no report data to download."
        );

        return;

    }


    const rows = [

        [

            "#",

            "Products",

            "Receipt",

            "Customer",

            "Cashier",

            "Payment Methods",

            "Cash",

            "M-Pesa",

            "Bank",

            "Sales",

            "Paid",

            "Balance",

            "Change",

            "Date"

        ]

    ];


    filteredSales.forEach(
        (sale, index) => {

            const products =
                Array.isArray(
                    sale.items
                )

                    ? sale.items
                        .map(
                            item =>
                                `${item.name || "Unknown"} x ${getItemQuantity(item)}`
                        )
                        .join(" | ")

                    : "";


            const date =
                getSaleDate(
                    sale
                );


            const payments =
                getPaymentAmounts(
                    sale
                );


            rows.push([

                index + 1,

                products,

                sale.receiptNo ||
                sale.id,

                sale.customerName ||
                "Walk-in Customer",

                sale.cashier ||
                "",

                getPaymentMethods(
                    sale
                ).join(", "),

                payments.cash,

                payments.mpesa,

                payments.bank,

                getSaleTotal(
                    sale
                ),

                getAmountPaid(
                    sale
                ),

                getBalance(
                    sale
                ),

                getChange(
                    sale
                ),

                date
                    ? date.toLocaleString(
                        "en-KE"
                    )
                    : ""

            ]);

        }
    );


    const csv =
        rows
            .map(
                row =>
                    row
                        .map(
                            csvEscape
                        )
                        .join(",")
            )
            .join("\n");


    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        `Lebarto-Sales-Report-${getFileDate()}.csv`;


    document.body.appendChild(
        link
    );


    link.click();


    document.body.removeChild(
        link
    );


    URL.revokeObjectURL(
        url
    );

}


// =====================================================
// CSV ESCAPE
// =====================================================

function csvEscape(value) {

    return `"${String(
        value ?? ""
    ).replace(
        /"/g,
        '""'
    )}"`;

}


// =====================================================
// LOGOUT
// =====================================================

document
    .getElementById(
        "logoutBtn"
    )
    ?.addEventListener(
        "click",
        async event => {

            event.preventDefault();


            try {

                await signOut(
                    auth
                );


                window.location.href =
                    "login.html";

            }

            catch (error) {

                console.error(
                    "Logout error:",
                    error
                );


                alert(
                    "Unable to logout. Please try again."
                );

            }

        }
    );


// =====================================================
// MONEY
// =====================================================

function money(value) {

    return "KSh " +

        numberValue(
            value
        ).toLocaleString(
            "en-KE",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        );

}


// =====================================================
// SET TEXT
// =====================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (
        element
    ) {

        element.textContent =
            value;

    }

}


// =====================================================
// FILE DATE
// =====================================================

function getFileDate() {

    const date =
        new Date();


    return [

        date.getFullYear(),

        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        ),

        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        )

    ].join("-");

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return String(
        value ?? ""
    )

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
// MODULE READY
// =====================================================

console.log(
    "LEBARTO OPTIMIZED REPORTS MODULE LOADED."
);
