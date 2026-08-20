// ==========================================
// LEBARTO ELECTRONICS SALES SYSTEM
// ADMIN DASHBOARD
// admin.js
// ==========================================


import { auth, db } from "./firebase-config.js";


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
    limit,
    doc,
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";





// ==========================================
// CHECK AUTHENTICATION
// ==========================================


onAuthStateChanged(auth, async (user) => {


    if (!user) {

        window.location.href = "login.html";

        return;

    }


    try {


        // ==========================================
        // FIND USER PROFILE
        // ==========================================


        const userQuery = query(

            collection(db, "users"),

            where("uid", "==", user.uid)

        );


        const userSnapshot =
            await getDocs(userQuery);


        if (userSnapshot.empty) {


            alert(
                "User record not found."
            );


            await signOut(auth);


            return;

        }


        const userData =
            userSnapshot.docs[0].data();





        // ==========================================
        // CHECK ADMIN PERMISSION
        // ==========================================


        if (userData.role !== "admin") {


            alert(
                "Access denied."
            );


            window.location.href =
                "cashier.html";


            return;

        }





        // ==========================================
        // DISPLAY ADMIN NAME
        // ==========================================


        document
            .getElementById("adminName")
            .textContent =
            userData.name || "Admin";





        // ==========================================
        // LOAD DASHBOARD
        // ==========================================


        loadDashboard();


    }


    catch (error) {


        console.error(
            "Authentication check error:",
            error
        );


        alert(
            "Unable to load your account information."
        );

    }

});





// ==========================================
// DASHBOARD
// ==========================================


async function loadDashboard() {


    loadProducts();

    loadCashiers();

    loadLowStock();

    loadTodaySales();

    loadRecentSales();

}





// ==========================================
// TOTAL PRODUCTS
// ==========================================


async function loadProducts() {


    try {


        const snapshot =
            await getDocs(
                collection(
                    db,
                    "products"
                )
            );


        document
            .getElementById("totalProducts")
            .textContent =
            snapshot.size;


    }


    catch (error) {


        console.error(
            "Products error:",
            error
        );


    }

}





// ==========================================
// CASHIERS
// ==========================================


async function loadCashiers() {


    try {


        const snapshot =
            await getDocs(
                collection(
                    db,
                    "users"
                )
            );


        let count = 0;


        snapshot.forEach((userDoc) => {


            if (
                userDoc.data().role ===
                "cashier"
            ) {

                count++;

            }

        });


        document
            .getElementById("totalCashiers")
            .textContent =
            count;


    }


    catch (error) {


        console.error(
            "Cashiers error:",
            error
        );


    }

}





// ==========================================
// LOW STOCK
// ==========================================


async function loadLowStock() {


    try {


        const snapshot =
            await getDocs(
                collection(
                    db,
                    "products"
                )
            );


        let low = 0;


        snapshot.forEach((productDoc) => {


            const product =
                productDoc.data();


            const quantity =
                Number(
                    product.quantity || 0
                );


            const minimumStock =
                Number(
                    product.minimumStock || 5
                );


            if (
                quantity <= minimumStock
            ) {

                low++;

            }

        });


        document
            .getElementById("lowStock")
            .textContent =
            low;


    }


    catch (error) {


        console.error(
            "Low stock error:",
            error
        );


        document
            .getElementById("lowStock")
            .textContent =
            "0";


    }

}





// ==========================================
// TODAY'S SALES
// ==========================================


async function loadTodaySales() {


    try {


        const snapshot =
            await getDocs(
                collection(
                    db,
                    "sales"
                )
            );


        const today =
            new Date().toDateString();


        let total = 0;


        snapshot.forEach((saleDoc) => {


            const sale =
                saleDoc.data();


            if (sale.date) {


                const saleDate =
                    sale.date
                        .toDate()
                        .toDateString();


                if (
                    saleDate === today
                ) {


                    total +=
                        Number(
                            sale.total
                        ) || 0;

                }

            }

        });


        document
            .getElementById("todaySales")
            .textContent =
            "KSh " +
            total.toLocaleString();


    }


    catch (error) {


        console.error(
            "Today's sales error:",
            error
        );


    }

}





// ==========================================
// RECENT SALES
// ==========================================


async function loadRecentSales() {


    try {


        const salesBody =
            document.getElementById(
                "salesTable"
            );


        salesBody.innerHTML = "";


        const q = query(


            collection(
                db,
                "sales"
            ),


            orderBy(
                "date",
                "desc"
            ),


            limit(10)

        );


        const snapshot =
            await getDocs(q);





        // ==========================================
        // NO SALES
        // ==========================================


        if (snapshot.empty) {


            salesBody.innerHTML = `

                <tr>

                    <td
                        colspan="6"
                        style="text-align:center;"
                    >

                        No recent sales found.

                    </td>

                </tr>

            `;


            return;

        }





        // ==========================================
        // DISPLAY SALES
        // ==========================================


        snapshot.forEach((saleDoc) => {


            const sale =
                saleDoc.data();





            // ==========================================
            // PRODUCTS
            // ==========================================


            let products = "-";


            if (
                Array.isArray(
                    sale.items
                )
                &&
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
                                        × ${
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





            // ==========================================
            // DATE
            // ==========================================


            let saleDate = "N/A";


            if (sale.date) {


                try {


                    saleDate =
                        sale.date
                            .toDate()
                            .toLocaleString();


                }


                catch (error) {


                    saleDate = "N/A";


                }

            }





            // ==========================================
            // ADD ROW
            // ==========================================


            salesBody.innerHTML += `

                <tr>


                    <!-- PRODUCTS -->


                    <td class="products-column">

                        ${products}

                    </td>



                    <!-- RECEIPT NUMBER -->


                    <td>

                        ${
                            sale.receiptNo ||
                            "N/A"
                        }

                    </td>



                    <!-- DATE -->


                    <td>

                        ${saleDate}

                    </td>



                    <!-- CASHIER -->


                    <td>

                        ${
                            sale.cashier ||
                            "N/A"
                        }

                    </td>



                    <!-- TOTAL -->


                    <td>

                        KSh ${
                            Number(
                                sale.total ||
                                0
                            )
                            .toLocaleString()
                        }

                    </td>



                    <!-- ACTIONS -->


                    <td>


                        <button

                            class="action-btn edit-btn"

                            onclick="
                                editSale(
                                    '${saleDoc.id}'
                                )
                            ">

                            <i
                                class="fa-solid fa-pen"
                            ></i>

                            Edit

                        </button>



                        <button

                            class="action-btn delete-btn"

                            onclick="
                                deleteSale(
                                    '${saleDoc.id}'
                                )
                            ">

                            <i
                                class="fa-solid fa-trash"
                            ></i>

                            Delete

                        </button>


                    </td>


                </tr>

            `;

        });

    }


    catch (error) {


        console.error(
            "Recent sales error:",
            error
        );


    }

}





// ==========================================
// DELETE SALE
// ==========================================


window.deleteSale =
    async function(id) {


        if (
            !confirm(
                "Delete this sale?"
            )
        ) {

            return;

        }


        try {


            await deleteDoc(

                doc(
                    db,
                    "sales",
                    id
                )

            );


            alert(
                "Sale deleted."
            );


            loadRecentSales();

            loadTodaySales();


        }


        catch (error) {


            console.error(
                "Delete sale error:",
                error
            );


            alert(
                "Failed to delete sale."
            );


        }

    };





// ==========================================
// EDIT SALE
// ==========================================


window.editSale =
    async function(id) {


        const newTotal =
            prompt(
                "Enter new sale total:"
            );


        if (
            newTotal === null
        ) {

            return;

        }


        const total =
            Number(newTotal);


        if (
            isNaN(total)
            ||
            total < 0
        ) {


            alert(
                "Please enter a valid amount."
            );


            return;

        }


        try {


            await updateDoc(

                doc(
                    db,
                    "sales",
                    id
                ),

                {

                    total: total

                }

            );


            alert(
                "Sale updated successfully."
            );


            loadRecentSales();

            loadTodaySales();


        }


        catch (error) {


            console.error(
                "Edit sale error:",
                error
            );


            alert(
                "Failed to update sale."
            );


        }

    };





// ==========================================
// LOGOUT
// ==========================================


document
    .getElementById("logoutBtn")
    .addEventListener(
        "click",
        async (e) => {


            e.preventDefault();


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
                    "Unable to logout."
                );


            }

        }
    );
