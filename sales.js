// =====================================================
// LEBARTO ELECTRONICS
// SALES.JS
// SALES HISTORY • PRODUCTS • FILTER • RECEIPTS
// CURRENT MONTH SALES TOTAL
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
    orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// =====================================================
// VARIABLES
// =====================================================

let currentUser = null;
let sales = [];
let selectedSale = null;


// =====================================================
// AUTHENTICATION
// =====================================================

onAuthStateChanged(auth, (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    loadSales();

});


// =====================================================
// LOAD SALES
// =====================================================

async function loadSales() {

    try {

        const q = query(
            collection(db, "sales"),
            orderBy("date", "desc")
        );

        const snapshot = await getDocs(q);

        sales = [];

        snapshot.forEach((item) => {

            sales.push({
                id: item.id,
                ...item.data()
            });

        });


        // Display sales
        displaySales(sales);


        // Update statistics
        updateStatistics();


        // Update current month
        updateMonthlySales();

    }

    catch (error) {

        console.error(
            "Error loading sales:",
            error
        );

        alert(
            "Unable to load sales: " +
            error.message
        );

    }

}


// =====================================================
// GET SALE DATE
// Supports Firestore Timestamp
// =====================================================

function getSaleDate(sale) {

    if (!sale || !sale.date) {
        return null;
    }

    try {

        // Firestore Timestamp
        if (
            typeof sale.date.toDate === "function"
        ) {

            return sale.date.toDate();

        }


        // Firestore timestamp object
        if (
            typeof sale.date.seconds === "number"
        ) {

            return new Date(
                sale.date.seconds * 1000
            );

        }


        // JavaScript Date
        if (
            sale.date instanceof Date
        ) {

            return sale.date;

        }


        // Number timestamp
        if (
            typeof sale.date === "number"
        ) {

            return new Date(
                sale.date
            );

        }


        // String date
        if (
            typeof sale.date === "string"
        ) {

            const parsed =
                new Date(sale.date);

            if (!isNaN(parsed.getTime())) {
                return parsed;
            }

        }


        return null;

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
// DISPLAY SALES
// =====================================================

function displaySales(data) {

    const table =
        document.getElementById(
            "salesTable"
        );


    if (!table) {
        return;
    }


    table.innerHTML = "";


    if (data.length === 0) {

        table.innerHTML = `

            <tr>

                <td colspan="9">

                    No Sales Found

                </td>

            </tr>

        `;

        return;

    }


    const rows = data.map(
        (sale, index) => {

            // -----------------------------------------
            // PRODUCTS
            // -----------------------------------------

            let products = "-";


            if (
                Array.isArray(sale.items) &&
                sale.items.length > 0
            ) {

                products =
                    sale.items
                        .map((item) => {

                            return `

                                <div class="sale-product">

                                    <strong>
                                        ${
                                            item.name ||
                                            "Unknown Product"
                                        }
                                    </strong>

                                    <span>
                                        ×
                                        ${
                                            Number(
                                                item.quantity ||
                                                0
                                            )
                                        }
                                    </span>

                                </div>

                            `;

                        })
                        .join("");

            }


            // -----------------------------------------
            // PAYMENT
            // -----------------------------------------

            let payment = "-";


            if (
                Array.isArray(
                    sale.paymentMethods
                ) &&
                sale.paymentMethods.length > 0
            ) {

                payment =
                    sale.paymentMethods.join(
                        ", "
                    );

            }


            // -----------------------------------------
            // DATE
            // -----------------------------------------

            let saleDate = "N/A";

            const date =
                getSaleDate(sale);


            if (date) {

                saleDate =
                    date.toLocaleString();

            }


            // -----------------------------------------
            // RECEIPT NUMBER
            // -----------------------------------------

            const receiptNo =
                sale.receiptNo ||
                sale.id.substring(0, 8);


            // -----------------------------------------
            // RETURN ROW
            // -----------------------------------------

            return `

                <tr>

                    <td>
                        ${index + 1}
                    </td>

                    <td class="products-column">
                        ${products}
                    </td>

                    <td>
                        ${receiptNo}
                    </td>

                    <td>
                        ${
                            sale.customerName ||
                            "Walk-in Customer"
                        }
                    </td>

                    <td>
                        ${
                            sale.cashier ||
                            "-"
                        }
                    </td>

                    <td>
                        ${payment}
                    </td>

                    <td>
                        KSh
                        ${
                            Number(
                                sale.total || 0
                            ).toLocaleString()
                        }
                    </td>

                    <td>
                        ${saleDate}
                    </td>

                    <td>

                        <button
                            class="view-btn"
                            onclick="viewSale('${sale.id}')"
                            title="View Receipt"
                        >

                            <i
                                class="fa-solid fa-eye"
                            ></i>

                        </button>

                    </td>

                </tr>

            `;

        }
    );


    table.innerHTML =
        rows.join("");

}


// =====================================================
// UPDATE TOP STATISTICS
// =====================================================

function updateStatistics() {

    // -----------------------------------------
    // TOTAL SALES
    // All sales in database
    // -----------------------------------------

    let total = 0;


    sales.forEach((sale) => {

        total +=
            Number(
                sale.total || 0
            );

    });


    const totalSales =
        document.getElementById(
            "totalSales"
        );


    if (totalSales) {

        totalSales.textContent =
            "KSh " +
            total.toLocaleString();

    }


    // -----------------------------------------
    // TOTAL TRANSACTIONS
    // -----------------------------------------

    const totalTransactions =
        document.getElementById(
            "totalTransactions"
        );


    if (totalTransactions) {

        totalTransactions.textContent =
            sales.length;

    }


    // -----------------------------------------
    // TODAY'S SALES
    // -----------------------------------------

    let todayTotal = 0;


    const today =
        new Date();


    const todayYear =
        today.getFullYear();


    const todayMonth =
        today.getMonth();


    const todayDate =
        today.getDate();


    sales.forEach((sale) => {

        const saleDate =
            getSaleDate(sale);


        if (!saleDate) {
            return;
        }


        const isToday =

            saleDate.getFullYear() ===
                todayYear

            &&

            saleDate.getMonth() ===
                todayMonth

            &&

            saleDate.getDate() ===
                todayDate;


        if (isToday) {

            todayTotal +=
                Number(
                    sale.total || 0
                );

        }

    });


    const todaySales =
        document.getElementById(
            "todaySales"
        );


    if (todaySales) {

        todaySales.textContent =
            "KSh " +
            todayTotal.toLocaleString();

    }

}


// =====================================================
// CURRENT MONTH SALES TOTAL
// =====================================================

function updateMonthlySales() {

    const now =
        new Date();


    const currentYear =
        now.getFullYear();


    const currentMonth =
        now.getMonth();


    // -----------------------------------------
    // CURRENT MONTH NAME
    // -----------------------------------------

    const monthName =
        now.toLocaleString(
            "default",
            {
                month: "long"
            }
        );


    const monthNameElement =
        document.getElementById(
            "currentMonthName"
        );


    if (monthNameElement) {

        monthNameElement.textContent =
            monthName;

    }


    const yearElement =
        document.getElementById(
            "monthlySalesYear"
        );


    if (yearElement) {

        yearElement.textContent =
            `${monthName} ${currentYear} sales summary`;

    }


    // -----------------------------------------
    // MONTHLY VARIABLES
    // -----------------------------------------

    let monthlyTotal = 0;

    let monthlyTransactions = 0;

    let monthlyItems = 0;


    // -----------------------------------------
    // CHECK SALES
    // -----------------------------------------

    sales.forEach((sale) => {

        const saleDate =
            getSaleDate(sale);


        if (!saleDate) {
            return;
        }


        // Only current year
        const correctYear =
            saleDate.getFullYear() ===
            currentYear;


        // Only current month
        const correctMonth =
            saleDate.getMonth() ===
            currentMonth;


        if (
            !correctYear ||
            !correctMonth
        ) {

            return;

        }


        // -----------------------------------------
        // ADD SALE TOTAL
        // -----------------------------------------

        monthlyTotal +=
            Number(
                sale.total || 0
            );


        // -----------------------------------------
        // ADD TRANSACTION
        // -----------------------------------------

        monthlyTransactions++;


        // -----------------------------------------
        // ADD ITEMS SOLD
        // -----------------------------------------

        if (
            Array.isArray(
                sale.items
            )
        ) {

            sale.items.forEach(
                (item) => {

                    monthlyItems +=
                        Number(
                            item.quantity ||
                            0
                        );

                }
            );

        }

    });


    // -----------------------------------------
    // DISPLAY MONTHLY SALES
    // -----------------------------------------

    const currentMonthSales =
        document.getElementById(
            "currentMonthSales"
        );


    if (currentMonthSales) {

        currentMonthSales.textContent =
            "KSh " +
            monthlyTotal.toLocaleString();

    }


    // -----------------------------------------
    // DISPLAY TRANSACTIONS
    // -----------------------------------------

    const currentMonthTransactions =
        document.getElementById(
            "currentMonthTransactions"
        );


    if (currentMonthTransactions) {

        currentMonthTransactions.textContent =
            monthlyTransactions;

    }


    // -----------------------------------------
    // DISPLAY ITEMS
    // -----------------------------------------

    const currentMonthItems =
        document.getElementById(
            "currentMonthItems"
        );


    if (currentMonthItems) {

        currentMonthItems.textContent =
            monthlyItems;

    }

}


// =====================================================
// VIEW SALE / RECEIPT
// =====================================================

window.viewSale = function (id) {

    selectedSale =
        sales.find(
            (sale) =>
                sale.id === id
        );


    if (!selectedSale) {
        return;
    }


    // -----------------------------------------
    // PAYMENT
    // -----------------------------------------

    let payment = "-";


    if (
        Array.isArray(
            selectedSale.paymentMethods
        )
    ) {

        payment =
            selectedSale.paymentMethods.join(
                ", "
            );

    }


    // -----------------------------------------
    // DATE
    // -----------------------------------------

    const saleDate =
        getSaleDate(
            selectedSale
        );


    const formattedDate =
        saleDate
            ? saleDate.toLocaleString()
            : "N/A";


    // -----------------------------------------
    // RECEIPT HTML
    // -----------------------------------------

    let html = `

        <h3>
            Lebarto Electronics
        </h3>


        <p>

            <strong>
                Customer:
            </strong>

            ${
                selectedSale.customerName ||
                "Walk-in Customer"
            }

        </p>


        <p>

            <strong>
                Payment:
            </strong>

            ${payment}

        </p>


        <p>

            <strong>
                Cashier:
            </strong>

            ${
                selectedSale.cashier ||
                "-"
            }

        </p>


        <p>

            <strong>
                Receipt:
            </strong>

            ${
                selectedSale.receiptNo ||
                selectedSale.id
            }

        </p>


        <p>

            <strong>
                Date:
            </strong>

            ${formattedDate}

        </p>


        <p>

            <strong>
                Discount:
            </strong>

            KSh
            ${
                Number(
                    selectedSale.discount ||
                    0
                ).toLocaleString()
            }

        </p>


        <p>

            <strong>
                Paid:
            </strong>

            KSh
            ${
                Number(
                    selectedSale.amountPaid ||
                    0
                ).toLocaleString()
            }

        </p>


        <p>

            <strong>
                Balance:
            </strong>

            KSh
            ${
                Number(
                    selectedSale.balance ||
                    0
                ).toLocaleString()
            }

        </p>


        <hr>

    `;


    // -----------------------------------------
    // PRODUCTS
    // -----------------------------------------

    if (

        Array.isArray(
            selectedSale.items
        )

        &&

        selectedSale.items.length > 0

    ) {

        selectedSale.items.forEach(
            (item) => {

                const itemTotal =
                    Number(
                        item.total
                    ) ||

                    (
                        Number(
                            item.price ||
                            0
                        )

                        *

                        Number(
                            item.quantity ||
                            0
                        )
                    ) ||

                    0;


                html += `

                    <div
                        class="receipt-item"
                    >

                        <span>

                            ${
                                item.name ||
                                "Unknown Product"
                            }

                            x

                            ${
                                Number(
                                    item.quantity ||
                                    0
                                )
                            }

                        </span>


                        <span>

                            KSh
                            ${
                                itemTotal
                                    .toLocaleString()
                            }

                        </span>

                    </div>

                `;

            }
        );

    }

    else {

        html += `

            <p>
                No products recorded.
            </p>

        `;

    }


    // -----------------------------------------
    // TOTAL
    // -----------------------------------------

    html += `

        <div
            class="receipt-total"
        >

            Total:

            KSh
            ${
                Number(
                    selectedSale.total ||
                    0
                ).toLocaleString()
            }

        </div>

    `;


    // -----------------------------------------
    // SHOW RECEIPT
    // -----------------------------------------

    const receiptDetails =
        document.getElementById(
            "receiptDetails"
        );


    if (receiptDetails) {

        receiptDetails.innerHTML =
            html;

    }


    const receiptModal =
        document.getElementById(
            "receiptModal"
        );


    if (receiptModal) {

        receiptModal.style.display =
            "flex";

    }

};


// =====================================================
// SEARCH
// =====================================================

const searchSale =
    document.getElementById(
        "searchSale"
    );


if (searchSale) {

    searchSale.addEventListener(
        "input",
        filterSales
    );

}


// =====================================================
// PAYMENT FILTER
// =====================================================

const paymentFilter =
    document.getElementById(
        "paymentFilter"
    );


if (paymentFilter) {

    paymentFilter.addEventListener(
        "change",
        filterSales
    );

}


// =====================================================
// DATE FILTER
// =====================================================

const dateFilter =
    document.getElementById(
        "dateFilter"
    );


if (dateFilter) {

    dateFilter.addEventListener(
        "change",
        filterSales
    );

}


// =====================================================
// FILTER SALES
// =====================================================

function filterSales() {

    const text =
        document
            .getElementById(
                "searchSale"
            )
            .value
            .toLowerCase()
            .trim();


    const payment =
        document
            .getElementById(
                "paymentFilter"
            )
            .value;


    const date =
        document
            .getElementById(
                "dateFilter"
            )
            .value;


    const filtered =
        sales.filter(
            (sale) => {

                // ---------------------------------
                // CUSTOMER
                // ---------------------------------

                const customer =
                    (
                        sale.customerName ||
                        ""
                    )
                    .toLowerCase();


                // ---------------------------------
                // CASHIER
                // ---------------------------------

                const cashier =
                    (
                        sale.cashier ||
                        ""
                    )
                    .toLowerCase();


                // ---------------------------------
                // RECEIPT
                // ---------------------------------

                const receipt =
                    (
                        sale.receiptNo ||
                        ""
                    )
                    .toLowerCase();


                // ---------------------------------
                // PRODUCTS
                // ---------------------------------

                let productNames = "";


                if (
                    Array.isArray(
                        sale.items
                    )
                ) {

                    productNames =
                        sale.items
                            .map(
                                (item) =>
                                    item.name ||
                                    ""
                            )
                            .join(" ")
                            .toLowerCase();

                }


                // ---------------------------------
                // TEXT MATCH
                // ---------------------------------

                const matchText =

                    customer.includes(
                        text
                    )

                    ||

                    cashier.includes(
                        text
                    )

                    ||

                    receipt.includes(
                        text
                    )

                    ||

                    productNames.includes(
                        text
                    );


                // ---------------------------------
                // PAYMENT MATCH
                // ---------------------------------

                const matchPayment =

                    payment === ""

                    ||

                    (
                        Array.isArray(
                            sale.paymentMethods
                        )

                        &&

                        sale.paymentMethods.includes(
                            payment
                        )
                    );


                // ---------------------------------
                // DATE MATCH
                // ---------------------------------

                let matchDate = true;


                if (date) {

                    const saleDate =
                        getSaleDate(
                            sale
                        );


                    if (!saleDate) {

                        matchDate = false;

                    }

                    else {

                        const year =
                            saleDate
                                .getFullYear()
                                .toString()
                                .padStart(
                                    4,
                                    "0"
                                );


                        const month =
                            (
                                saleDate
                                    .getMonth() + 1
                            )
                            .toString()
                            .padStart(
                                2,
                                "0"
                            );


                        const day =
                            saleDate
                                .getDate()
                                .toString()
                                .padStart(
                                    2,
                                    "0"
                                );


                        const saleDateString =
                            `${year}-${month}-${day}`;


                        matchDate =
                            saleDateString ===
                            date;

                    }

                }


                return (

                    matchText

                    &&

                    matchPayment

                    &&

                    matchDate

                );

            }
        );


    displaySales(
        filtered
    );

}


// =====================================================
// PRINT RECEIPT
// =====================================================

const printReceiptBtn =
    document.getElementById(
        "printReceiptBtn"
    );


if (printReceiptBtn) {

    printReceiptBtn.onclick =
        function () {

            window.print();

        };

}


// =====================================================
// CLOSE RECEIPT MODAL
// =====================================================

const closeModal =
    document.getElementById(
        "closeModal"
    );


if (closeModal) {

    closeModal.onclick =
        () => {

            document
                .getElementById(
                    "receiptModal"
                )
                .style.display =
                "none";

        };

}


// =====================================================
// CLOSE MODAL WHEN CLICKING OUTSIDE
// =====================================================

const receiptModal =
    document.getElementById(
        "receiptModal"
    );


if (receiptModal) {

    receiptModal.addEventListener(
        "click",
        (event) => {

            if (
                event.target.id ===
                "receiptModal"
            ) {

                receiptModal.style.display =
                    "none";

            }

        }
    );

}


// =====================================================
// LOGOUT
// =====================================================

const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );


if (logoutBtn) {

    logoutBtn.onclick =
        async (event) => {

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

        };

}


// =====================================================
// AUTOMATIC MONTH CHECK
// =====================================================
// This checks periodically so that if the month changes
// while the page is still open, the monthly total resets.
// =====================================================

setInterval(
    () => {

        updateMonthlySales();

    },
    60 * 1000
);
