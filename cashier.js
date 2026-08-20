// =============================================
// LEBARTO ELECTRONICS
// CASHIER DASHBOARD.JS
// =============================================


import {
    auth,
    db
} from "./firebase-config.js";


import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";



// =============================================
// VARIABLES
// =============================================

let currentUser = null;

let currentCashier = null;

let recentSales = [];

let clockInterval = null;



// =============================================
// AUTHENTICATION
// =============================================

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        currentUser = user;


        try {

            // =============================================
            // FIND CASHIER PROFILE
            // =============================================

            const userQuery =
                query(

                    collection(
                        db,
                        "users"
                    ),

                    where(
                        "uid",
                        "==",
                        user.uid
                    )

                );


            const userSnapshot =
                await getDocs(
                    userQuery
                );


            if (
                userSnapshot.empty
            ) {

                console.error(
                    "Cashier profile not found."
                );


                await signOut(auth);


                window.location.href =
                    "login.html";


                return;

            }


            const userData =
                userSnapshot
                    .docs[0]
                    .data();



            // =============================================
            // CHECK ROLE
            // =============================================

            if (
                userData.role !==
                "cashier"
            ) {

                window.location.href =
                    "admin.html";

                return;

            }



            // =============================================
            // SAVE CASHIER NAME
            // =============================================

            currentCashier =
                userData.name ||
                user.email ||
                "Cashier";



            // =============================================
            // DISPLAY CASHIER NAME
            // =============================================

            setText(
                "cashierName",
                currentCashier
            );



            // =============================================
            // LOAD DASHBOARD
            // =============================================

            await loadDashboard();


        }

        catch (error) {

            console.error(
                "Cashier authentication error:",
                error
            );


            alert(
                "Unable to load cashier account."
            );

        }

    }
);



// =============================================
// LOAD DASHBOARD
// =============================================

async function loadDashboard() {


    updateClock();


    if (!clockInterval) {

        clockInterval =
            setInterval(
                updateClock,
                1000
            );

    }


    await loadTodaySales();


    await loadRecentSales();

}



// =============================================
// CLOCK
// =============================================

function updateClock() {


    const clock =
        document.getElementById(
            "currentTime"
        );


    if (!clock) {

        return;

    }


    clock.textContent =
        new Date().toLocaleString(
            "en-KE",
            {

                dateStyle:
                    "medium",

                timeStyle:
                    "medium"

            }
        );

}



// =============================================
// GET SALE DATE
// =============================================

function getSaleDate(sale) {


    if (
        !sale ||
        !sale.date
    ) {

        return null;

    }


    try {


        // Firestore Timestamp

        if (
            typeof sale.date.toDate ===
            "function"
        ) {

            return sale.date.toDate();

        }


        // Firestore Timestamp object

        if (
            sale.date.seconds !==
            undefined
        ) {

            return new Date(
                sale.date.seconds *
                1000
            );

        }


        // JavaScript Date/string

        const date =
            new Date(
                sale.date
            );


        if (
            isNaN(
                date.getTime()
            )
        ) {

            return null;

        }


        return date;


    }

    catch (error) {

        console.error(
            "Date conversion error:",
            error
        );


        return null;

    }

}



// =============================================
// CHECK CASHIER SALE
// =============================================

function isCashierSale(sale) {


    if (!sale) {

        return false;

    }


    /*
        POS saves the cashier name
        inside sale.cashier.

        Only show sales belonging
        to the logged-in cashier.
    */

    return (
        sale.cashier ===
        currentCashier
    );

}



// =============================================
// TODAY'S SALES
// =============================================

async function loadTodaySales() {


    try {


        const snapshot =
            await getDocs(
                collection(
                    db,
                    "sales"
                )
            );


        let salesAmount = 0;

        let transactions = 0;

        let productsSold = 0;


        const today =
            new Date();


        snapshot.forEach(
            (docSnap) => {


                const sale =
                    docSnap.data();


                // =================================
                // ONLY CURRENT CASHIER
                // =================================

                if (
                    !isCashierSale(
                        sale
                    )
                ) {

                    return;

                }


                // =================================
                // SALE DATE
                // =================================

                const saleDate =
                    getSaleDate(
                        sale
                    );


                if (!saleDate) {

                    return;

                }


                // =================================
                // ONLY TODAY
                // =================================

                if (
                    saleDate.toDateString()
                    !==
                    today.toDateString()
                ) {

                    return;

                }


                // =================================
                // TOTAL SALES
                // =================================

                salesAmount +=
                    Number(
                        sale.total ||
                        0
                    );


                // =================================
                // TRANSACTION
                // =================================

                transactions++;


                // =================================
                // PRODUCTS SOLD
                // =================================

                if (
                    Array.isArray(
                        sale.items
                    )
                ) {


                    sale.items.forEach(
                        item => {


                            productsSold +=
                                Number(
                                    item.quantity ||
                                    0
                                );


                        }
                    );

                }


            }
        );



        // =============================================
        // UPDATE DASHBOARD
        // =============================================

        setText(
            "todaySales",
            money(
                salesAmount
            )
        );


        setText(
            "todayTransactions",
            transactions
        );


        setText(
            "productsSold",
            productsSold
        );


    }

    catch (error) {

        console.error(
            "Today's sales error:",
            error
        );


        setText(
            "todaySales",
            "KSh 0"
        );


        setText(
            "todayTransactions",
            "0"
        );


        setText(
            "productsSold",
            "0"
        );

    }

}



// =============================================
// RECENT SALES
// =============================================

async function loadRecentSales() {


    const table =
        document.getElementById(
            "salesTable"
        );


    if (!table) {

        return;

    }


    try {


        table.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="no-data"
                >

                    <i class="fa-solid fa-spinner fa-spin"></i>

                    Loading recent sales...

                </td>

            </tr>

        `;



        /*
            We load the latest sales ordered
            by date.

            Then we select only the current
            cashier's sales.
        */

        const q =
            query(

                collection(
                    db,
                    "sales"
                ),

                orderBy(
                    "date",
                    "desc"
                ),

                limit(100)

            );


        const snapshot =
            await getDocs(
                q
            );


        recentSales = [];



        snapshot.forEach(
            (docSnap) => {


                const sale =
                    docSnap.data();


                // =============================================
                // CURRENT CASHIER ONLY
                // =============================================

                if (
                    !isCashierSale(
                        sale
                    )
                ) {

                    return;

                }


                recentSales.push({

                    id:
                        docSnap.id,

                    ...sale

                });


            }
        );



        // =============================================
        // SHOW ONLY LATEST 20
        // =============================================

        recentSales =
            recentSales.slice(
                0,
                20
            );



        displayRecentSales(
            recentSales
        );


    }

    catch (error) {

        console.error(
            "Recent sales error:",
            error
        );


        table.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="no-data"
                >

                    <i class="fa-solid fa-triangle-exclamation"></i>

                    Unable to load recent sales.

                    <br><br>

                    ${escapeHTML(
                        error.message
                    )}

                </td>

            </tr>

        `;

    }

}



// =============================================
// DISPLAY RECENT SALES
// =============================================

function displayRecentSales(
    data
) {


    const table =
        document.getElementById(
            "salesTable"
        );


    if (!table) {

        return;

    }


    table.innerHTML = "";



    // =============================================
    // NO SALES
    // =============================================

    if (
        data.length === 0
    ) {


        table.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="no-data"
                >

                    <i class="fa-solid fa-receipt"></i>

                    <br><br>

                    No recent sales found.

                </td>

            </tr>

        `;


        return;

    }



    // =============================================
    // DISPLAY SALES
    // =============================================

    data.forEach(
        (sale, index) => {


            // =========================================
            // PRODUCTS
            // =========================================

            let productsHTML = "-";


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
                                    item => {


                                        const name =
                                            escapeHTML(
                                                item.name ||
                                                "Unknown Product"
                                            );


                                        const quantity =
                                            Number(
                                                item.quantity ||
                                                0
                                            );


                                        return `

                                            <div class="sale-product">

                                                <strong>
                                                    ${name}
                                                </strong>

                                                <span>
                                                    × ${quantity}
                                                </span>

                                            </div>

                                        `;

                                    }
                                )
                                .join("")
                        }

                    </div>

                `;

            }



            // =========================================
            // PAYMENT
            // =========================================

            const paymentMethods =
                getPaymentMethods(
                    sale
                );


            let paymentHTML = "-";


            if (
                paymentMethods.length >
                0
            ) {


                paymentHTML =
                    paymentMethods
                        .map(
                            method => {


                                const normalized =
                                    String(
                                        method
                                    )
                                    .toLowerCase()
                                    .replace(
                                        /[^a-z]/g,
                                        ""
                                    );


                                let className =
                                    "payment-badge";


                                if (
                                    normalized ===
                                    "cash"
                                ) {

                                    className +=
                                        " payment-cash";

                                }

                                else if (
                                    normalized ===
                                    "mpesa"
                                ) {

                                    className +=
                                        " payment-mpesa";

                                }

                                else if (
                                    normalized ===
                                    "bank"
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
                        )
                        .join("");

            }



            // =========================================
            // DATE
            // =========================================

            const saleDate =
                getSaleDate(
                    sale
                );


            const formattedDate =
                saleDate
                ? saleDate.toLocaleString(
                    "en-KE",
                    {

                        dateStyle:
                            "short",

                        timeStyle:
                            "short"

                    }
                )
                : "-";



            // =========================================
            // RECEIPT
            // =========================================

            const receipt =
                escapeHTML(

                    sale.receiptNo ||

                    sale.id.substring(
                        0,
                        8
                    )

                );



            // =========================================
            // CUSTOMER
            // =========================================

            const customer =
                escapeHTML(

                    sale.customerName ||

                    "Walk-in Customer"

                );



            // =========================================
            // TOTAL
            // =========================================

            const total =
                money(
                    sale.total ||
                    0
                );



            // =========================================
            // ROW
            // =========================================

            table.innerHTML += `

                <tr>


                    <!-- NUMBER -->

                    <td>

                        ${index + 1}

                    </td>



                    <!-- PRODUCTS -->

                    <td class="products-column">

                        ${productsHTML}

                    </td>



                    <!-- RECEIPT -->

                    <td>

                        <strong>

                            ${receipt}

                        </strong>

                    </td>



                    <!-- CUSTOMER -->

                    <td>

                        ${customer}

                    </td>



                    <!-- TOTAL -->

                    <td>

                        <strong>

                            ${total}

                        </strong>

                    </td>



                    <!-- PAYMENT -->

                    <td>

                        ${paymentHTML}

                    </td>



                    <!-- DATE -->

                    <td>

                        ${formattedDate}

                    </td>


                </tr>

            `;


        }
    );

}



// =============================================
// SEARCH RECENT SALES
// =============================================

const search =
    document.getElementById(
        "searchSale"
    );


if (search) {


    search.addEventListener(
        "input",
        function () {


            const value =
                this.value
                    .toLowerCase()
                    .trim();


            if (!value) {

                displayRecentSales(
                    recentSales
                );

                return;

            }



            const filtered =
                recentSales.filter(
                    sale => {


                        // PRODUCTS

                        let products = "";


                        if (
                            Array.isArray(
                                sale.items
                            )
                        ) {


                            products =
                                sale.items
                                    .map(
                                        item =>
                                            item.name ||
                                            ""
                                    )
                                    .join(" ");

                        }



                        // SEARCHABLE DATA

                        const searchable = [

                            sale.receiptNo ||
                            "",

                            sale.customerName ||
                            "",

                            sale.cashier ||
                            "",

                            products,

                            getPaymentMethods(
                                sale
                            ).join(" ")

                        ]
                        .join(" ")
                        .toLowerCase();



                        return searchable
                            .includes(
                                value
                            );

                    }
                );



            displayRecentSales(
                filtered
            );


        }
    );

}



// =============================================
// PAYMENT METHODS
// =============================================

function getPaymentMethods(
    sale
) {


    // =============================================
    // NORMAL PAYMENT METHODS ARRAY
    // =============================================

    if (
        Array.isArray(
            sale.paymentMethods
        ) &&
        sale.paymentMethods.length >
        0
    ) {

        return sale.paymentMethods;

    }



    // =============================================
    // FALLBACK PAYMENT AMOUNTS
    // =============================================

    const methods = [];



    if (
        Number(
            sale.cashAmount ||
            0
        ) > 0
    ) {

        methods.push(
            "Cash"
        );

    }



    if (
        Number(
            sale.mpesaAmount ||
            0
        ) > 0
    ) {

        methods.push(
            "M-Pesa"
        );

    }



    if (
        Number(
            sale.bankAmount ||
            0
        ) > 0
    ) {

        methods.push(
            "Bank"
        );

    }



    // =============================================
    // FALLBACK FOR paymentMethod
    // =============================================

    if (
        methods.length === 0 &&
        sale.paymentMethod
    ) {

        methods.push(
            sale.paymentMethod
        );

    }



    return methods;

}



// =============================================
// LOGOUT
// =============================================

const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );


if (logoutBtn) {


    logoutBtn.addEventListener(
        "click",
        async (event) => {


            event.preventDefault();


            try {


                await signOut(
                    auth
                );


                window.location.replace(
                    "login.html"
                );


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

}



// =============================================
// MONEY FORMAT
// =============================================

function money(value) {


    return (

        "KSh " +

        Number(
            value || 0
        ).toLocaleString(
            "en-KE",
            {

                minimumFractionDigits:
                    0,

                maximumFractionDigits:
                    2

            }
        )

    );

}



// =============================================
// SET TEXT
// =============================================

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



// =============================================
// ESCAPE HTML
// =============================================

function escapeHTML(
    value
) {


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



// =============================================
// MODULE LOADED
// =============================================

console.log(
    "LEBARTO CASHIER DASHBOARD LOADED SUCCESSFULLY."
);
