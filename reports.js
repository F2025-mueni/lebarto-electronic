// =====================================================
// LEBARTO ELECTRONICS
// REPORTS.JS
// SALES REPORT
// COST • PROFIT • DISCOUNT REMOVED
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

    await loadCurrentUser();

    loadSales();

});


// =====================================================
// LOAD CURRENT USER
// =====================================================

async function loadCurrentUser() {

    try {

        const snapshot = await getDocs(

            query(
                collection(db, "users"),
                orderBy("name")
            )

        );


        const userDoc =
            snapshot.docs.find(
                doc =>
                    doc.data().uid ===
                    currentUser.uid
            );


        if (userDoc) {

            currentUserData =
                userDoc.data();


            const nameElement =
                document.getElementById(
                    "adminName"
                );


            if (nameElement) {

                nameElement.textContent =

                    currentUserData.name ||

                    currentUser.email ||

                    "Admin";

            }

        }

    }

    catch (error) {

        console.error(
            "User loading error:",
            error
        );


        const nameElement =
            document.getElementById(
                "adminName"
            );


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

    try {

        const q = query(

            collection(db, "sales"),

            orderBy(
                "date",
                "desc"
            )

        );


        const snapshot =
            await getDocs(q);


        sales = [];


        snapshot.forEach(docSnap => {

            sales.push({

                id:
                    docSnap.id,

                ...docSnap.data()

            });

        });


        filteredSales =
            [...sales];


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


        const table =
            document.getElementById(
                "reportTable"
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
// GET SALE DATE
// =====================================================

function getSaleDate(sale) {

    if (
        !sale ||
        !sale.date
    ) {

        return null;

    }


    try {

        if (
            typeof sale.date.toDate ===
            "function"
        ) {

            return sale.date.toDate();

        }


        if (
            sale.date.seconds !== undefined
        ) {

            return new Date(
                sale.date.seconds * 1000
            );

        }


        return new Date(
            sale.date
        );

    }

    catch (error) {

        return null;

    }

}


// =====================================================
// GET SALE TOTAL
// =====================================================

function getSaleTotal(sale) {

    return Number(
        sale.total ?? 0
    ) || 0;

}


// =====================================================
// GET AMOUNT PAID
// =====================================================

function getAmountPaid(sale) {

    return Number(
        sale.amountPaid ?? 0
    ) || 0;

}


// =====================================================
// GET BALANCE
// =====================================================

function getBalance(sale) {

    if (
        sale.balance !== undefined
    ) {

        return Number(
            sale.balance
        ) || 0;

    }


    return (

        getAmountPaid(sale) -

        getSaleTotal(sale)

    );

}


// =====================================================
// GET PAYMENT METHODS
// =====================================================

function getPaymentMethods(sale) {

    if (
        Array.isArray(
            sale.paymentMethods
        )
    ) {

        return sale.paymentMethods;

    }


    const methods = [];


    if (
        Number(
            sale.cashAmount || 0
        ) > 0
    ) {

        methods.push("Cash");

    }


    if (
        Number(
            sale.mpesaAmount || 0
        ) > 0
    ) {

        methods.push("M-Pesa");

    }


    if (
        Number(
            sale.bankAmount || 0
        ) > 0
    ) {

        methods.push("Bank");

    }


    return methods;

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


    table.innerHTML = "";


    // =================================================
    // NO DATA
    // =================================================

    if (
        data.length === 0
    ) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="10"
                    class="no-data"
                >

                    No sales found for the
                    selected filters.

                </td>

            </tr>

        `;


        updateFooter([]);

        return;

    }


    // =================================================
    // DISPLAY SALES
    // =================================================

    data.forEach(
        (sale, index) => {


        const total =
            getSaleTotal(sale);


        const paid =
            getAmountPaid(sale);


        const balance =
            getBalance(sale);


        const date =
            getSaleDate(sale);


        const paymentMethods =
            getPaymentMethods(sale);


        // =============================================
        // PRODUCTS
        // =============================================

        let productsHTML = "-";


        if (

            Array.isArray(
                sale.items
            )

            &&

            sale.items.length > 0

        ) {

            productsHTML = `

                <div class="product-list">

                    ${
                        sale.items.map(
                            item => {

                                const quantity =
                                    Number(
                                        item.quantity || 0
                                    );


                                return `

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

                                            × ${quantity}

                                        </span>

                                    </div>

                                `;

                            }
                        ).join("")
                    }

                </div>

            `;

        }


        // =============================================
        // PAYMENT BADGES
        // =============================================

        let paymentHTML = "-";


        if (
            paymentMethods.length > 0
        ) {

            paymentHTML =

                paymentMethods.map(
                    method => {

                        const lower =
                            method
                                .toLowerCase()
                                .replace(
                                    /[^a-z]/g,
                                    ""
                                );


                        let className =
                            "payment-badge";


                        if (
                            lower === "cash"
                        ) {

                            className +=
                                " payment-cash";

                        }

                        else if (
                            lower === "mpesa"
                        ) {

                            className +=
                                " payment-mpesa";

                        }

                        else if (
                            lower === "bank"
                        ) {

                            className +=
                                " payment-bank";

                        }


                        return `

                            <span
                                class="${className}"
                            >

                                ${escapeHTML(
                                    method
                                )}

                            </span>

                        `;

                    }
                ).join("");

        }


        // =============================================
        // TABLE ROW
        // =============================================

        table.innerHTML += `

            <tr>

                <td>
                    ${index + 1}
                </td>


                <td class="products-column">

                    ${productsHTML}

                </td>


                <td>

                    ${escapeHTML(
                        sale.receiptNo ||
                        sale.id.substring(0, 8)
                    )}

                </td>


                <td>

                    ${escapeHTML(
                        sale.customerName ||
                        "Walk-in Customer"
                    )}

                </td>


                <td>

                    ${escapeHTML(
                        sale.cashier ||
                        "-"
                    )}

                </td>


                <td>

                    ${paymentHTML}

                </td>


                <td>

                    ${money(total)}

                </td>


                <td>

                    ${money(paid)}

                </td>


                <td
                    class="${
                        balance < 0
                        ? "negative"
                        : "positive"
                    }"
                >

                    ${money(balance)}

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

    });


    updateFooter(data);

}


// =====================================================
// UPDATE STATISTICS
// =====================================================

function updateStatistics(data) {

    let totalSales = 0;

    let transactions = 0;

    let cash = 0;

    let mpesa = 0;

    let bank = 0;

    let totalPaid = 0;

    let totalBalance = 0;


    data.forEach(
        sale => {

            totalSales +=
                getSaleTotal(
                    sale
                );


            transactions++;


            cash +=
                Number(
                    sale.cashAmount || 0
                ) || 0;


            mpesa +=
                Number(
                    sale.mpesaAmount || 0
                ) || 0;


            bank +=
                Number(
                    sale.bankAmount || 0
                ) || 0;


            totalPaid +=
                getAmountPaid(
                    sale
                );


            totalBalance +=
                getBalance(
                    sale
                );

        }
    );


    // =================================================
    // CARDS
    // =================================================

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


    // =================================================
    // SUMMARY
    // =================================================

    setText(
        "summarySales",
        money(totalSales)
    );


    setText(
        "summaryTransactions",
        transactions
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


    // =================================================
    // FOOTER
    // =================================================

    updateFooter(data);

}


// =====================================================
// UPDATE FOOTER
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


                // =====================================
                // DATE
                // =====================================

                let matchDate = true;


                if (
                    fromDate &&
                    date
                ) {

                    const from =
                        new Date(
                            fromDate +
                            "T00:00:00"
                        );


                    if (
                        date < from
                    ) {

                        matchDate = false;

                    }

                }


                if (
                    toDate &&
                    date
                ) {

                    const to =
                        new Date(
                            toDate +
                            "T23:59:59"
                        );


                    if (
                        date > to
                    ) {

                        matchDate = false;

                    }

                }


                if (
                    fromDate &&
                    !date
                ) {

                    matchDate = false;

                }


                if (
                    toDate &&
                    !date
                ) {

                    matchDate = false;

                }


                // =====================================
                // PAYMENT
                // =====================================

                const methods =
                    getPaymentMethods(
                        sale
                    );


                const matchPayment =

                    !payment ||

                    methods.some(
                        method =>

                            method
                                .toLowerCase() ===
                            payment
                                .toLowerCase()
                    );


                // =====================================
                // SEARCH
                // =====================================

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
                                    item.name || ""
                            )

                            .join(" ")

                            .toLowerCase();

                }


                const searchable = [

                    sale.customerName || "",

                    sale.cashier || "",

                    sale.receiptNo || "",

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
        )?.value;


    const to =
        document.getElementById(
            "toDate"
        )?.value;


    let text =
        "All Sales";


    if (
        from &&
        to
    ) {

        text =
            `From ${from} to ${to}`;

    }

    else if (from) {

        text =
            `From ${from}`;

    }

    else if (to) {

        text =
            `Up to ${to}`;

    }


    const payment =
        document.getElementById(
            "paymentFilter"
        )?.value;


    if (payment) {

        text +=
            ` • ${payment}`;

    }


    setText(
        "reportPeriod",
        text
    );

}


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


            const rows =
                document.querySelectorAll(
                    "#reportTable tr"
                );


            rows.forEach(
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
// GENERATE REPORT
// =====================================================

document
    .getElementById(
        "generateReportBtn"
    )
    ?.addEventListener(
        "click",
        filterSales
    );


// =====================================================
// FILTER EVENTS
// =====================================================

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
        "searchReport"
    )
    ?.addEventListener(
        "input",
        filterSales
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

            "Payment",

            "Sales",

            "Paid",

            "Balance",

            "Date"

        ]

    ];


    filteredSales.forEach(
        (sale, index) => {

            const products =

                Array.isArray(
                    sale.items
                )

                ?

                sale.items

                    .map(
                        item =>
                            `${
                                item.name ||
                                "Unknown"
                            } x ${
                                item.quantity ||
                                0
                            }`
                    )

                    .join(" | ")

                :

                "";


            const date =
                getSaleDate(
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

                getSaleTotal(
                    sale
                ),

                getAmountPaid(
                    sale
                ),

                getBalance(
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


    link.href = url;


    link.download =

        `Lebarto-Sales-Report-${
            getFileDate()
        }.csv`;


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

    const text =
        String(
            value ?? ""
        );


    return `"${text.replace(
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

        Number(
            value || 0
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


    if (element) {

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
// END
// =====================================================

console.log(
    "LEBARTO REPORTS MODULE LOADED SUCCESSFULLY."
);
