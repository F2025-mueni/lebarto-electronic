// =====================================================
// LEBARTO ELECTRONICS
// POS.JS
// PART 1
// Authentication • Products • Search • Cart
// =====================================================

import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {

    collection,

    query,

    orderBy,

    onSnapshot,

    doc,

    getDoc,

    addDoc,

    updateDoc,

    serverTimestamp,

    increment

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

onAuthStateChanged(auth, async(user)=>{

    if(!user){

        window.location.href="login.html";

        return;

    }

    currentUser=user;

    await loadCurrentUser();

    loadProducts();

});


// =====================================================
// LOAD CURRENT USER
// =====================================================

async function loadCurrentUser(){

    try{

        const userRef=
        doc(db,"users",currentUser.uid);

        const userSnap=
        await getDoc(userRef);

        if(userSnap.exists()){

            currentUserData=userSnap.data();

        }

    }

    catch(error){

        console.error(error);

    }

}


// =====================================================
// LOAD PRODUCTS
// =====================================================

function loadProducts(){

    const q=query(

        collection(db,"products"),

        orderBy("name")

    );

    onSnapshot(q,(snapshot)=>{

        products=[];

        snapshot.forEach(doc=>{

            products.push({

                id:doc.id,

                ...doc.data()

            });

        });

        filteredProducts=[...products];

        displayProducts(filteredProducts);

    });

}


// =====================================================
// DISPLAY PRODUCTS
// =====================================================

function displayProducts(productArray){

    const container=
    document.getElementById("productList");

    container.innerHTML="";

    if(productArray.length===0){

        container.innerHTML=`

        <p class="empty">

        No products found.

        </p>

        `;

        return;

    }

    productArray.forEach(product=>{

        const stock=
        Number(product.quantity);

        container.innerHTML+=`

        <div class="product-card">

            <h3>

                ${product.name}

            </h3>

            <p>

                Barcode:

                ${product.barcode}

            </p>

            <p>

                Category:

                ${product.category}

            </p>

            <p>

                Stock:

                ${stock}

            </p>

           <h4>

KSh ${Number(product.minSellingPrice).toLocaleString()}

-

KSh ${Number(product.maxSellingPrice).toLocaleString()}

</h4>

            <button

            onclick="addToCart('${product.id}')"

            ${stock<=0?"disabled":""}

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

.addEventListener("keyup",function(){

    const value=

    this.value.toLowerCase();

    filteredProducts=

   products.filter(product=>{

    return(

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

window.addToCart=function(id){

    const product=

    products.find(p=>p.id===id);

    if(!product){

        return;

    }

    if(Number(product.quantity)<=0){

        alert("Product is out of stock.");

        return;

    }

    const existing=

    cart.find(item=>item.id===id);

    if(existing){

        if(existing.quantity>=Number(product.quantity)){

            alert("Not enough stock.");

            return;

        }

        existing.quantity++;

    }

    else{

     cart.push({

    id:product.id,

    barcode:product.barcode,

    name:product.name,

    minPrice:Number(product.minSellingPrice),

    maxPrice:Number(product.maxSellingPrice),

    price:Number(product.minSellingPrice),

    buyingPrice:Number(product.buyingPrice),

    quantity:1,

    stock:Number(product.quantity)

});

    }

    updateCart();

};


// =====================================================
// UPDATE CART
// =====================================================

function updateCart(){

    const table=

    document.getElementById("cartTable");

    table.innerHTML="";

    if(cart.length===0){

        table.innerHTML=`

        <tr>

        <td colspan="5">

        Cart is empty

        </td>

        </tr>

        `;

        calculateTotals();

        return;

    }

    cart.forEach(item=>{

        table.innerHTML+=`

        <tr>

        <td>

        ${item.name}

        </td>

        <td>

        <button
        onclick="decreaseQty('${item.id}')">

        -

        </button>

        ${item.quantity}

        <button
        onclick="increaseQty('${item.id}')">

        +

        </button>

        </td>

      <td>

<input

type="number"

value="${item.price}"

min="${item.minPrice}"

oninput="updateSellingPrice('${item.id}',this.value)"

style="width:90px;">

<br>

<small>

Min:
KSh ${item.minPrice.toLocaleString()}

</small>

</td>

        <td>

        KSh

        ${(item.price*item.quantity).toLocaleString()}

        </td>

        <td>

        <button

        onclick="removeItem('${item.id}')">

        <i class="fa-solid fa-trash"></i>

        </button>

        </td>

        </tr>

        `;

    });

    calculateTotals();

}


// =====================================================
// PLACEHOLDERS
// (Implemented in Part 2)
// =====================================================




// =====================================================
// POS.JS
// PART 2
// CART MANAGEMENT • TOTALS • PAYMENT
// =====================================================


// =====================================================
// INCREASE QUANTITY
// =====================================================

window.increaseQty = function(id){

    const item =
    cart.find(product=>product.id===id);

    if(!item){

        return;

    }

    if(item.quantity >= item.stock){

        alert("Insufficient stock.");

        return;

    }

    item.quantity++;

    updateCart();

};
window.updateSellingPrice = function(id,value){

    const item = cart.find(p=>p.id===id);

    if(!item){

        return;

    }

    const price = Number(value);

    if(isNaN(price)){

        return;

    }

    if(price < item.minPrice){

        alert(

            `Selling price cannot be below KSh ${item.minPrice.toLocaleString()}`

        );

        updateCart();

        return;

    }

    item.price = price;

    calculateTotals();

    updateCart();

};


// =====================================================
// DECREASE QUANTITY
// =====================================================

window.decreaseQty = function(id){

    const item =
    cart.find(product=>product.id===id);

    if(!item){

        return;

    }

    item.quantity--;

    if(item.quantity <= 0){

        cart = cart.filter(product=>product.id!==id);

    }

    updateCart();

};


// =====================================================
// REMOVE ITEM
// =====================================================

window.removeItem = function(id){

    cart = cart.filter(product=>product.id!==id);

    updateCart();

};


// =====================================================
// CALCULATE TOTALS
// =====================================================

function calculateTotals(){

    let subtotal = 0;

    cart.forEach(item=>{

        subtotal +=
        item.price * item.quantity;

    });

    let discount = Number(

        document
        .getElementById("discount")
        .value

    ) || 0;

    if(discount < 0){

        discount = 0;

        document
        .getElementById("discount")
        .value = 0;

    }

    if(discount > subtotal){

        discount = subtotal;

        document
        .getElementById("discount")
        .value = subtotal;

    }

    const grandTotal =
    subtotal - discount;

    document
    .getElementById("subtotal")
    .textContent =
    "KSh " + subtotal.toLocaleString();

    document
    .getElementById("grandTotal")
    .textContent =
    "KSh " + grandTotal.toLocaleString();

    calculateBalance();

}


// =====================================================
// CALCULATE BALANCE
// =====================================================

function calculateBalance(){

    let subtotal = 0;

    cart.forEach(item=>{

        subtotal +=
        item.price * item.quantity;

    });

    const discount =
    Number(

        document
        .getElementById("discount")
        .value

    ) || 0;

    const total =
    subtotal - discount;

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

    balance.toLocaleString();

}


// =====================================================
// DISCOUNT CHANGE
// =====================================================

document

.getElementById("discount")

.addEventListener("input",()=>{

    calculateTotals();

});


// =====================================================
// AMOUNT PAID CHANGE
// =====================================================

document

.getElementById("amountPaid")

.addEventListener("input",()=>{

    calculateBalance();

});


// =====================================================
// CLEAR CART
// =====================================================

document

.getElementById("clearCart")

.addEventListener("click",()=>{

    if(cart.length===0){

        return;

    }

    if(confirm("Clear cart?")){

        cart=[];

        updateCart();

        document
        .getElementById("discount")
        .value=0;

        document
        .getElementById("amountPaid")
        .value="";

    }

});


// =====================================================
// BACK BUTTON
// =====================================================

document

.getElementById("backBtn")

.addEventListener("click",()=>{

    window.location.href="cashier.html";

});


// =====================================================
// GET GRAND TOTAL
// =====================================================

function getGrandTotal(){

    let subtotal = 0;

    cart.forEach(item=>{

        subtotal +=
        item.price * item.quantity;

    });

    const discount =
    Number(

        document
        .getElementById("discount")
        .value

    ) || 0;

    return subtotal - discount;

}


// =====================================================
// PAYMENT VALIDATION
// =====================================================

function validateSale(){

    if(cart.length===0){

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

    if(paid < total){

        alert("Amount paid is less than total.");

        return false;

    }

    return true;

}
// =====================================================
// POS.JS
// PART 3A-1
// COMPLETE SALE
// =====================================================



// =====================================================
// COMPLETE SALE BUTTON
// =====================================================

document

.getElementById("completeSale")

.addEventListener("click",async()=>{

    if(!validateSale()){

        return;

    }

    const btn =
    document.getElementById("completeSale");

    btn.disabled = true;

    try{

        await completeSale();

    }

    finally{

        btn.disabled = false;

    }

});


// =====================================================
// COMPLETE SALE
// =====================================================

async function completeSale(){

    try{

        const customerName =

        document
        .getElementById("customerName")
        .value
        .trim()

        ||

        "Walk-in Customer";



      const paymentMethods = [...document.querySelectorAll(
    'input[name="paymentMethod"]:checked'
)].map(item => item.value);

console.log(paymentMethods);
if (paymentMethods.length === 0) {
    alert("Please select at least one payment method.");
    return;
}

        const discount =

        Number(

            document
            .getElementById("discount")
            .value

        ) || 0;



        const amountPaid =

        Number(

            document
            .getElementById("amountPaid")
            .value

        ) || 0;



     let subtotal = 0;
let profit = 0;

cart.forEach(item => {

    const price = Number(item.price) || 0;
    const buyingPrice = Number(item.buyingPrice) || 0;
    const qty = Number(item.quantity) || 0;

    subtotal += price * qty;
    profit += (price - buyingPrice) * qty;

});



      const grandTotal = Number(subtotal) - Number(discount);



        const balance =

        amountPaid -

        grandTotal;



        const receiptNo =

        generateReceiptNumber();



  const saleItems = [];

cart.forEach(item=>{

    saleItems.push({

        productId: item.id,

        barcode: item.barcode,

        name: item.name,

        quantity: item.quantity,

        price: item.price,

        total: item.price * item.quantity

    });

});
// =====================================================
// SALE OBJECT
// =====================================================

        const saleData = {

            receiptNo:

            receiptNo,



            customerName:

            customerName,



         cashier:

currentUserData?.name || currentUser.email || "Unknown Cashier",


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




// =====================================================
// SAVE SALE
// =====================================================

        await addDoc(

            collection(db,"sales"),

            saleData

        );




// =====================================================
// UPDATE PRODUCT STOCK
// =====================================================

        for(const item of cart){

            const product =

            products.find(

                p=>p.id===item.id

            );

            if(product){

                await updateDoc(

                    doc(

                        db,

                        "products",

                        item.id

                    ),

                    {

                    quantity:
Number(product.quantity)-Number(item.quantity)

                    }

                );

            }

        }



        // Continue in Part 3A-2...

            alert("Sale completed successfully!");

        // Save last completed sale for printing
        window.lastSale = {

            receiptNo: receiptNo,

            customerName: customerName,

            cashier: currentUser.email,

            paymentMethods: paymentMethods,

            subtotal: subtotal,

            discount: discount,
            profit: profit,

            total: grandTotal,

            amountPaid: amountPaid,

            balance: balance,

            items: [...saleItems],

            date: new Date()

        };

        // Print automatically
        generateReceipt();

        // Clear cart
        cart = [];

        updateCart();

        // Reset form
        document.getElementById("customerName").value = "";
        document.getElementById("discount").value = 0;
        document.getElementById("amountPaid").value = "";
        document.getElementById("balance").textContent = "KSh 0";
       document.querySelectorAll('input[name="paymentMethod"]').forEach(box => {
    box.checked = false;
});

        calculateTotals();

       

    }

    catch(error){

        console.error(error);

        alert("Unable to complete sale.");

    }

}

// =====================================================
// RECEIPT NUMBER
// =====================================================

function generateReceiptNumber(){

    const now = new Date();

    return "INV-" +

        now.getFullYear() +

        String(now.getMonth()+1).padStart(2,"0") +

        String(now.getDate()).padStart(2,"0") +

        String(now.getHours()).padStart(2,"0") +

        String(now.getMinutes()).padStart(2,"0") +

        String(now.getSeconds()).padStart(2,"0");

}
// =====================================================
// PRINT RECEIPT BUTTON
// =====================================================

document

.getElementById("printReceipt")

.addEventListener("click",()=>{

    if(!window.lastSale){

        alert("No completed sale available to print.");

        return;

    }

    generateReceipt();

});



// =====================================================
// FORMAT CURRENCY
// =====================================================

function money(value){

    return "KSh " +

    Number(value)

    .toLocaleString();

}



// =====================================================
// FORMAT DATE
// =====================================================

function formatDate(date){

    return new Date(date)

    .toLocaleString();

}
// =====================================================
// POS.JS
// PART 3B
// RECEIPT GENERATION & PRINTING
// =====================================================


// =====================================================
// GENERATE RECEIPT
// =====================================================

function generateReceipt(){

    if(!window.lastSale){

        alert("No receipt available.");

        return;

    }

    const sale = window.lastSale;

    let itemsHTML = "";

    sale.items.forEach(item=>{

        itemsHTML += `

        <tr>

            <td>${item.name}</td>

            <td style="text-align:center;">
                ${item.quantity}
            </td>

            <td style="text-align:right;">
                ${money(item.total)}
            </td>

        </tr>

        `;

    });


    const receipt = window.open(

    "",

    "_blank",

    "width=400,height=700"

);

if(!receipt){

    alert("Please allow pop-ups to print receipts.");

    return;

}


    receipt.document.write(`

<!DOCTYPE html>

<html>

<head>

<title>Receipt</title>

<style>

body{

    font-family:Arial,sans-serif;

    width:300px;

    margin:auto;

    padding:10px;

    font-size:13px;

}

h2{

    text-align:center;

    margin-bottom:5px;

}

p{

    margin:3px 0;

}

hr{

    border:none;

    border-top:1px dashed #000;

}

table{

    width:100%;

    border-collapse:collapse;

}

td{

    padding:3px 0;

}

.total{

    font-size:16px;

    font-weight:bold;

}

.center{

    text-align:center;

}

.right{

    text-align:right;

}

</style>

</head>

<body>

<h2>LEBARTO ELECTRONICS</h2>

<p class="center">

Quality Electronics & Accessories

</p>

<hr>

<p>

<strong>Receipt:</strong>

${sale.receiptNo}

</p>

<p>

<strong>Date:</strong>

${formatDate(sale.date)}

</p>

<p>

<strong>Cashier:</strong>

${sale.cashier}

</p>

<p>

<strong>Customer:</strong>

${sale.customerName}

</p>

<p>

<strong>Payment:</strong>

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

<span class="right" style="float:right;">

${money(sale.subtotal)}

</span>

</p>

<p>

Discount

<span class="right" style="float:right;">

${money(sale.discount)}

</span>

</p>

<p class="total">

TOTAL

<span style="float:right;">

${money(sale.total)}

</span>

</p>

<p>

Paid

<span style="float:right;">

${money(sale.amountPaid)}

</span>

</p>

<p>

Balance

<span style="float:right;">

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

    setTimeout(()=>{

        receipt.print();

        receipt.close();

    },500);

}
