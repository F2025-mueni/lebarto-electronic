```javascript
// =============================================
// LEBARTO ELECTRONICS SALES SYSTEM
// cashier.js
// =============================================

import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// =============================
// Check Logged In User
// =============================

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            alert("User account not found.");
            await signOut(auth);
            window.location.href = "login.html";
            return;
        }

        const userData = userSnap.data();

        if (userData.role !== "cashier") {
            window.location.href = "admin.html";
            return;
        }

        document.getElementById("cashierName").textContent = userData.name;

        loadDashboard(userData.name);

    } catch (error) {

        console.error(error);
        alert(error.message);

    }

});


// =============================
// Dashboard
// =============================

async function loadDashboard(cashierName){

    updateClock();

    setInterval(updateClock,1000);

    await loadTodaySales(cashierName);

    await loadRecentSales(cashierName);

}


// =============================
// Live Clock
// =============================

function updateClock(){

    const now = new Date();

    document.getElementById("currentTime").textContent =
        now.toLocaleTimeString();

}


// =============================
// Today's Sales
// =============================

async function loadTodaySales(cashierName){

    const today = new Date().toISOString().split("T")[0];

    const q = query(
        collection(db,"sales"),
        where("cashier","==",cashierName)
    );

    const snapshot = await getDocs(q);

    let totalSales = 0;
    let totalTransactions = 0;
    let totalItems = 0;

    snapshot.forEach((doc)=>{

        const sale = doc.data();

        if(sale.date === today){

            totalSales += Number(sale.total);

            totalTransactions++;

            if(Array.isArray(sale.items)){

                sale.items.forEach(item=>{

                    totalItems += Number(item.quantity);

                });

            }

        }

    });

    document.getElementById("todaySales").textContent =
        "KSh " + totalSales.toLocaleString();

    document.getElementById("todayTransactions").textContent =
        totalTransactions;

    document.getElementById("productsSold").textContent =
        totalItems;

}


// =============================
// Recent Sales
// =============================

async function loadRecentSales(cashierName){

    const tbody = document.getElementById("salesTable");

    tbody.innerHTML = "";

    const q = query(
        collection(db,"sales"),
        orderBy("timestamp","desc"),
        limit(20)
    );

    const snapshot = await getDocs(q);

    snapshot.forEach((doc)=>{

        const sale = doc.data();

        if(sale.cashier !== cashierName) return;

        tbody.innerHTML += `
        <tr>
            <td>${sale.receiptNo}</td>
            <td>${sale.customer || "Walk-in Customer"}</td>
            <td>KSh ${Number(sale.total).toLocaleString()}</td>
            <td>${sale.paymentMethod}</td>
            <td>${sale.date}</td>
        </tr>
        `;

    });

}


// =============================
// Search Sales
// =============================

document.getElementById("searchSale")
.addEventListener("keyup",function(){

    const value = this.value.toLowerCase();

    const rows = document.querySelectorAll("#salesTable tr");

    rows.forEach(row=>{

        row.style.display =
            row.innerText.toLowerCase().includes(value)
            ? ""
            : "none";

    });

});


// =============================
// Logout
// =============================

document.getElementById("logoutBtn")
.addEventListener("click", async(e)=>{

    e.preventDefault();

    if(confirm("Are you sure you want to logout?")){

        await signOut(auth);

        window.location.href="login.html";

    }

});
```
