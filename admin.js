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


// ----------------------------
// Check Authentication
// ----------------------------

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "login.html";

        return;

    }

    try {

        // Find the user's Firestore profile
        // using the Firebase Authentication UID.

        const userQuery = query(
            collection(db, "users"),
            where("uid", "==", user.uid)
        );

        const userSnapshot = await getDocs(userQuery);


        if (userSnapshot.empty) {

            alert("User record not found.");

            await signOut(auth);

            return;

        }


        const userData =
            userSnapshot.docs[0].data();


        // Check admin permission

        if (userData.role !== "admin") {

            alert("Access denied.");

            window.location.href = "cashier.html";

            return;

        }


        // Display admin name

        document
            .getElementById("adminName")
            .textContent = userData.name || "Admin";


        // Load dashboard

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


// ----------------------------
// Dashboard
// ----------------------------

async function loadDashboard() {

    loadProducts();

    loadCashiers();

    loadLowStock();

    loadTodaySales();

    loadRecentSales();

}


// ----------------------------
// Total Products
// ----------------------------

async function loadProducts() {

    try {

        const snapshot =
            await getDocs(
                collection(db, "products")
            );


        document
            .getElementById("totalProducts")
            .innerHTML = snapshot.size;

    }

    catch (error) {

        console.error(
            "Products error:",
            error
        );

    }

}


// ----------------------------
// Cashiers
// ----------------------------

async function loadCashiers() {

    try {

        const snapshot =
            await getDocs(
                collection(db, "users")
            );


        let count = 0;


        snapshot.forEach((userDoc) => {

            if (
                userDoc.data().role === "cashier"
            ) {

                count++;

            }

        });


        document
            .getElementById("totalCashiers")
            .innerHTML = count;

    }

    catch (error) {

        console.error(
            "Cashiers error:",
            error
        );

    }

}


// ----------------------------
// Low Stock
// ----------------------------

async function loadLowStock() {

    try {

        const snapshot = await getDocs(
            collection(db, "products")
        );

        let low = 0;

        snapshot.forEach((productDoc) => {

            const product = productDoc.data();

            const quantity =
                Number(product.quantity || 0);

            const minimumStock =
                Number(product.minimumStock || 5);

            if (quantity <= minimumStock) {

                low++;

            }

        });

        document
            .getElementById("lowStock")
            .textContent = low;

    }

    catch (error) {

        console.error(
            "Low stock error:",
            error
        );

        document
            .getElementById("lowStock")
            .textContent = "0";

    }

}


// ----------------------------
// Today's Sales
// ----------------------------

async function loadTodaySales() {

    try {

        const snapshot =
            await getDocs(
                collection(db, "sales")
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


                if (saleDate === today) {

                    total +=
                        Number(sale.total) || 0;

                }

            }

        });


        document
            .getElementById("todaySales")
            .innerHTML =
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


// ----------------------------
// Recent Sales
// ----------------------------

async function loadRecentSales() {

    try {

        const salesBody =
            document.getElementById(
                "salesTable"
            );


        salesBody.innerHTML = "";


        const q = query(

            collection(db, "sales"),

            orderBy("date", "desc"),

            limit(10)

        );


        const snapshot =
            await getDocs(q);


        snapshot.forEach((saleDoc) => {

            const sale =
                saleDoc.data();


            salesBody.innerHTML += `

                <tr>

                    <td>
                        ${sale.receiptNo || "N/A"}
                    </td>

                    <td>
                        ${
                            sale.date
                            ?
                            sale.date
                                .toDate()
                                .toLocaleString()
                            :
                            "N/A"
                        }
                    </td>

                    <td>
                        ${sale.cashier || "N/A"}
                    </td>

                    <td>
                        KSh ${
                            Number(sale.total || 0)
                                .toLocaleString()
                        }
                    </td>

                    <td>

                        <button
                            class="action-btn edit-btn"
                            onclick="editSale('${saleDoc.id}')">

                            <i class="fa-solid fa-pen"></i>
                            Edit

                        </button>


                        <button
                            class="action-btn delete-btn"
                            onclick="deleteSale('${saleDoc.id}')">

                            <i class="fa-solid fa-trash"></i>
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


// ----------------------------
// Delete Sale
// ----------------------------

window.deleteSale = async function(id) {

    if (!confirm("Delete this sale?")) {

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


        alert("Sale deleted.");


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


// ----------------------------
// Edit Sale
// ----------------------------

window.editSale = async function(id) {

    const newTotal =
        prompt(
            "Enter new sale total:"
        );


    if (newTotal === null) {

        return;

    }


    const total =
        Number(newTotal);


    if (
        isNaN(total) ||
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


// ----------------------------
// Logout
// ----------------------------

document
    .getElementById("logoutBtn")
    .addEventListener(
        "click",
        async (e) => {

            e.preventDefault();


            await signOut(auth);


            window.location.href =
                "login.html";

        }
    );
