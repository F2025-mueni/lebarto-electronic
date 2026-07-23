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
    doc,
    getDoc,
    getDocs,
    query,
    orderBy,
    limit,
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ----------------------------
// Check Authentication
// ----------------------------

onAuthStateChanged(auth, async(user)=>{

    if(!user){

        window.location.href="login.html";
        return;

    }

    const userRef = doc(db,"users",user.uid);
    const userSnap = await getDoc(userRef);

    if(!userSnap.exists()){

        alert("User record not found.");
        await signOut(auth);
        return;

    }

    const userData = userSnap.data();

    if(userData.role !== "admin"){

        alert("Access denied.");

        window.location.href="cashier.html";

        return;

    }

    document.getElementById("adminName").textContent = userData.name;

    loadDashboard();

});


// ----------------------------
// Dashboard
// ----------------------------

async function loadDashboard(){

    loadProducts();

    loadCashiers();

    loadLowStock();

    loadTodaySales();

    loadRecentSales();

}


// ----------------------------
// Total Products
// ----------------------------

async function loadProducts(){

    const snapshot = await getDocs(collection(db,"products"));

    document.getElementById("totalProducts").innerHTML = snapshot.size;

}


// ----------------------------
// Cashiers
// ----------------------------

async function loadCashiers(){

    const snapshot = await getDocs(collection(db,"users"));

    let count = 0;

    snapshot.forEach(doc=>{

        if(doc.data().role==="cashier"){

            count++;

        }

    });

    document.getElementById("totalCashiers").innerHTML = count;

}


// ----------------------------
// Low Stock
// ----------------------------

async function loadLowStock(){

    const snapshot = await getDocs(collection(db,"products"));

    let low = 0;

    snapshot.forEach(doc=>{

        const product = doc.data();

        if(product.quantity <= product.reorderLevel){

            low++;

        }

    });

    document.getElementById("lowStock").innerHTML = low;

}


// ----------------------------
// Today's Sales
// ----------------------------

async function loadTodaySales(){

    const snapshot = await getDocs(collection(db,"sales"));

    const today = new Date().toDateString();

    let total = 0;

    snapshot.forEach(doc=>{

        const sale = doc.data();

        if(sale.date){

            const saleDate = sale.date.toDate().toDateString();

            if(saleDate === today){

                total += Number(sale.total) || 0;

            }

        }

    });

    document.getElementById("todaySales").innerHTML =
        "KSh " + total.toLocaleString();

}


// ----------------------------
// Recent Sales
// ----------------------------

async function loadRecentSales(){

    const salesBody = document.getElementById("salesTable");

    salesBody.innerHTML = "";

   const q = query(
    collection(db,"sales"),
    orderBy("date","desc"),
    limit(10)
);

    const snapshot = await getDocs(q);

    snapshot.forEach((saleDoc) => {

    const sale = saleDoc.data();

    salesBody.innerHTML += `
    <tr>
        <td>${sale.receiptNo}</td>
        <td>${sale.date ? sale.date.toDate().toLocaleString() : "N/A"}</td>
        <td>${sale.cashier}</td>
        <td>KSh ${Number(sale.total).toLocaleString()}</td>
        <td>

    <button class="action-btn edit-btn" onclick="editSale('${saleDoc.id}')">
        <i class="fa-solid fa-pen"></i> Edit
    </button>

    <button class="action-btn delete-btn" onclick="deleteSale('${saleDoc.id}')">
        <i class="fa-solid fa-trash"></i> Delete
    </button>

</td>
    </tr>
    `;
});

}
window.deleteSale = async function(id){

    if(!confirm("Delete this sale?")) return;

    try{

        await deleteDoc(doc(db,"sales",id));

        alert("Sale deleted.");

        loadRecentSales();
        loadTodaySales();

    }catch(error){

        console.error(error);
        alert("Failed to delete sale.");

    }

}
window.editSale = async function(id){

    const newTotal = prompt("Enter new sale total:");

    if(newTotal === null) return;

    const total = Number(newTotal);

    if(isNaN(total) || total < 0){

        alert("Please enter a valid amount.");
        return;

    }

    try{

        await updateDoc(doc(db,"sales",id),{

            total: total

        });

        alert("Sale updated successfully.");

        loadRecentSales();
        loadTodaySales();

    }catch(error){

        console.error(error);

        alert("Failed to update sale.");

    }

}


// ----------------------------
// Logout
// ----------------------------

document.getElementById("logoutBtn")
.addEventListener("click", async(e)=>{

    e.preventDefault();

    await signOut(auth);

    window.location.href="login.html";

});
