// =====================================================
// LEBARTO ELECTRONICS
// SALES.JS
// SALES HISTORY • PRODUCTS • FILTER • RECEIPTS
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
// AUTH CHECK
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


        displaySales(sales);

        updateStatistics();


    }

    catch (error) {


        console.error(error);

        alert(error.message);


    }

}





// =====================================================
// DISPLAY SALES TABLE
// =====================================================


function displaySales(data) {


    const table =
        document.getElementById("salesTable");


    table.innerHTML = "";


    // =============================================
    // NO SALES
    // =============================================


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





    // =============================================
    // DISPLAY EACH SALE
    // =============================================


    data.forEach((sale, index) => {


        // =============================================
        // CREATE PRODUCTS LIST
        // =============================================


        let products = "-";


        if (
            Array.isArray(sale.items) &&
            sale.items.length > 0
        ) {


            products = sale.items.map((item) => {


                return `

                    <div class="sale-product">

                        <strong>

                            ${item.name || "Unknown Product"}

                        </strong>


                        <span>

                            × ${Number(item.quantity || 0)}

                        </span>

                    </div>

                `;


            }).join("");

        }





        // =============================================
        // PAYMENT METHODS
        // =============================================


        let payment = "-";


        if (
            Array.isArray(sale.paymentMethods) &&
            sale.paymentMethods.length > 0
        ) {

            payment =
                sale.paymentMethods.join(", ");

        }





        // =============================================
        // DATE
        // =============================================


        let saleDate = "N/A";


        if (sale.date) {

            try {

                saleDate =
                    sale.date.toDate().toLocaleString();

            }

            catch (error) {

                saleDate = "N/A";

            }

        }





        // =============================================
        // CREATE TABLE ROW
        // =============================================


        table.innerHTML += `

            <tr>


                <!-- NUMBER -->

                <td>

                    ${index + 1}

                </td>



                <!-- PRODUCTS -->

                <td class="products-column">

                    ${products}

                </td>



                <!-- RECEIPT NUMBER -->

                <td>

                    ${
                        sale.receiptNo ||
                        sale.id.substring(0, 8)
                    }

                </td>



                <!-- CUSTOMER -->

                <td>

                    ${
                        sale.customerName ||
                        "Walk-in Customer"
                    }

                </td>



                <!-- CASHIER -->

                <td>

                    ${sale.cashier || "-"}

                </td>



                <!-- PAYMENT -->

                <td>

                    ${payment}

                </td>



                <!-- TOTAL -->

                <td>

                    KSh ${Number(
                        sale.total || 0
                    ).toLocaleString()}

                </td>



                <!-- DATE -->

                <td>

                    ${saleDate}

                </td>



                <!-- ACTION -->

                <td>

                    <button

                        class="view-btn"

                        onclick="viewSale('${sale.id}')"

                        title="View Receipt">

                        <i class="fa-solid fa-eye"></i>

                    </button>

                </td>


            </tr>

        `;

    });

}





// =====================================================
// UPDATE STATISTICS
// =====================================================


function updateStatistics() {


    // =============================================
    // TOTAL SALES
    // =============================================


    let total = 0;


    sales.forEach((sale) => {


        total +=
            Number(sale.total) || 0;


    });


    document
        .getElementById("totalSales")
        .textContent =
        "KSh " + total.toLocaleString();





    // =============================================
    // TOTAL TRANSACTIONS
    // =============================================


    document
        .getElementById("totalTransactions")
        .textContent =
        sales.length;





    // =============================================
    // TODAY'S SALES
    // =============================================


    let todayTotal = 0;


    let today =
        new Date().toDateString();


    sales.forEach((sale) => {


        if (sale.date) {


            try {


                let saleDate =
                    new Date(
                        sale.date.seconds * 1000
                    ).toDateString();


                if (saleDate === today) {


                    todayTotal +=
                        Number(sale.total || 0);

                }


            }

            catch (error) {

                console.error(
                    "Date error:",
                    error
                );

            }

        }

    });


    document
        .getElementById("todaySales")
        .textContent =
        "KSh " +
        todayTotal.toLocaleString();

}





// =====================================================
// VIEW RECEIPT
// =====================================================


window.viewSale = function (id) {


    selectedSale =
        sales.find(
            (sale) => sale.id === id
        );


    if (!selectedSale) {

        return;

    }





    // =============================================
    // PAYMENT
    // =============================================


    let payment = "-";


    if (
        Array.isArray(
            selectedSale.paymentMethods
        )
    ) {

        payment =
            selectedSale.paymentMethods.join(", ");

    }





    // =============================================
    // RECEIPT INFORMATION
    // =============================================


    let html = `

        <h3>

            Lebarto Electronics

        </h3>


        <p>

            Customer:

            ${
                selectedSale.customerName ||
                "Walk-in Customer"
            }

        </p>


        <p>

            Payment:

            ${payment}

        </p>


        <p>

            Cashier:

            ${selectedSale.cashier || "-"}

        </p>


        <p>

            Receipt:

            ${
                selectedSale.receiptNo ||
                selectedSale.id
            }

        </p>


        <p>

            Discount:

            KSh ${Number(
                selectedSale.discount || 0
            ).toLocaleString()}

        </p>


        <p>

            Paid:

            KSh ${Number(
                selectedSale.amountPaid || 0
            ).toLocaleString()}

        </p>


        <p>

            Balance:

            KSh ${Number(
                selectedSale.balance || 0
            ).toLocaleString()}

        </p>


        <hr>

    `;





    // =============================================
    // PRODUCTS
    // =============================================


    if (
        Array.isArray(selectedSale.items) &&
        selectedSale.items.length > 0
    ) {


        selectedSale.items.forEach((item) => {


            let itemTotal =
                Number(item.total) ||
                (
                    Number(item.price || 0) *
                    Number(item.quantity || 0)
                ) ||
                0;


            html += `

                <div class="receipt-item">


                    <span>

                        ${item.name || "Unknown Product"}

                        x

                        ${Number(
                            item.quantity || 0
                        )}

                    </span>


                    <span>

                        KSh ${itemTotal.toLocaleString()}

                    </span>


                </div>

            `;

        });


    }

    else {


        html += `

            <p>

                No products recorded.

            </p>

        `;

    }





    // =============================================
    // TOTAL
    // =============================================


    html += `

        <div class="receipt-total">


            Total:

            KSh ${Number(
                selectedSale.total || 0
            ).toLocaleString()}


        </div>

    `;





    // =============================================
    // SHOW RECEIPT
    // =============================================


    document
        .getElementById("receiptDetails")
        .innerHTML = html;


    document
        .getElementById("receiptModal")
        .style.display = "flex";


};





// =====================================================
// SEARCH SALES
// =====================================================


document
    .getElementById("searchSale")
    .addEventListener(
        "keyup",
        function () {

            filterSales();

        }
    );





// =====================================================
// PAYMENT FILTER
// =====================================================


document
    .getElementById("paymentFilter")
    .addEventListener(
        "change",
        filterSales
    );





// =====================================================
// DATE FILTER
// =====================================================


document
    .getElementById("dateFilter")
    .addEventListener(
        "change",
        filterSales
    );





// =====================================================
// FILTER SALES
// =====================================================


function filterSales() {


    let text =
        document
            .getElementById("searchSale")
            .value
            .toLowerCase()
            .trim();


    let payment =
        document
            .getElementById("paymentFilter")
            .value;


    let date =
        document
            .getElementById("dateFilter")
            .value;





    let filtered =
        sales.filter((sale) => {


            // =============================================
            // SEARCH CUSTOMER
            // =============================================


            let customer =
                (
                    sale.customerName || ""
                )
                .toLowerCase();





            // =============================================
            // SEARCH CASHIER
            // =============================================


            let cashier =
                (
                    sale.cashier || ""
                )
                .toLowerCase();





            // =============================================
            // SEARCH RECEIPT
            // =============================================


            let receipt =
                (
                    sale.receiptNo || ""
                )
                .toLowerCase();





            // =============================================
            // SEARCH PRODUCTS
            // =============================================


            let productNames = "";


            if (
                Array.isArray(sale.items)
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





            // =============================================
            // TEXT MATCH
            // =============================================


            let matchText =

                customer.includes(text)

                ||

                cashier.includes(text)

                ||

                receipt.includes(text)

                ||

                productNames.includes(text);





            // =============================================
            // PAYMENT MATCH
            // =============================================


            let matchPayment =

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





            // =============================================
            // DATE MATCH
            // =============================================


            let matchDate = true;


            if (date && sale.date) {


                try {


                    let saleDate =

                        new Date(
                            sale.date.seconds * 1000
                        )
                        .toISOString()
                        .substring(0, 10);


                    matchDate =
                        saleDate === date;


                }

                catch (error) {

                    matchDate = false;

                }

            }





            return (

                matchText

                &&

                matchPayment

                &&

                matchDate

            );

        });





    displaySales(filtered);

}





// =====================================================
// PRINT RECEIPT
// =====================================================


document
    .getElementById("printReceiptBtn")
    .onclick = function () {


        window.print();


    };





// =====================================================
// CLOSE RECEIPT MODAL
// =====================================================


document
    .getElementById("closeModal")
    .onclick = () => {


        document
            .getElementById("receiptModal")
            .style.display = "none";


    };





// =====================================================
// LOGOUT
// =====================================================


document
    .getElementById("logoutBtn")
    .onclick = async () => {


        try {


            await signOut(auth);


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
