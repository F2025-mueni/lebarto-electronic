// =====================================================
// LEBARTO ELECTRONICS
// PRODUCTS.JS
// PART 1
// Authentication • Load Products • Statistics • Search
// =====================================================

import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
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
    deleteDoc,
    serverTimestamp,
    getDocs,
    where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// =====================================================
// GLOBAL VARIABLES
// =====================================================

let currentUser = null;
let currentUserData = null;

let products = [];
let filteredProducts = [];

let editingProductId = null;


// =====================================================
// CHECK LOGIN
// =====================================================

onAuthStateChanged(auth, async(user)=>{

    if(!user){

        window.location.href = "login.html";

        return;

    }

    currentUser = user;

    await loadCurrentUser();

    loadProducts();

});


// =====================================================
// LOAD CURRENT USER
// =====================================================

async function loadCurrentUser(){

    try{

        const userRef = doc(
            db,
            "users",
            currentUser.uid
        );

        const userSnap = await getDoc(userRef);

        if(!userSnap.exists()){

            alert("User account not found.");

            await signOut(auth);

            window.location.href="login.html";

            return;

        }

        currentUserData = userSnap.data();

        if(currentUserData.role !== "admin"){

            alert("Access denied.");

            window.location.href="cashier.html";

            return;

        }

    }

    catch(error){

        console.error(error);

        alert(error.message);

    }

}


// =====================================================
// LOAD PRODUCTS
// =====================================================

function loadProducts(){

    const q = query(

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

        updateStatistics();

    });

}


// =====================================================
// DISPLAY PRODUCTS
// =====================================================

function displayProducts(productArray){

    const tbody =
    document.getElementById("productTable");

    tbody.innerHTML="";

    if(productArray.length===0){

        tbody.innerHTML=`

        <tr>

            <td colspan="10"
            style="text-align:center;padding:30px;">

                No products found.

            </td>

        </tr>

        `;

        return;

    }

    productArray.forEach(product=>{

        const quantity =
        Number(product.quantity || 0);

        const minimum =
        Number(product.minimumStock || 5);

        let status = "";
        let statusClass = "";

        if(quantity===0){

            status="Out of Stock";

            statusClass="out-stock";

        }

        else if(quantity<=minimum){

            status="Low Stock";

            statusClass="low-stock";

        }

        else{

            status="In Stock";

            statusClass="in-stock";

        }

        tbody.innerHTML += `

        <tr>

            <td>

                <img
                src="${
                    product.image ||
                    "https://via.placeholder.com/60"
                }"
                width="60"
                height="60"
                style="object-fit:cover;border-radius:6px;">

            </td>

            <td>

                ${product.barcode || "-"}

            </td>

            <td>

                ${product.name || "-"}

            </td>

            <td>

                ${product.category || "-"}

            </td>

            <td>

                ${product.supplier || "-"}

            </td>

            <td>

                KSh
                ${Number(product.buyingPrice || 0)
                .toLocaleString()}

            </td>

           <td>

KSh 
${Number(product.minSellingPrice || 0)
.toLocaleString()}

-
KSh
${Number(product.maxSellingPrice || 0)
.toLocaleString()}

</td>

            <td>

                ${quantity}

            </td>

            <td>

                <span class="${statusClass}">

                    ${status}

                </span>

            </td>

            <td>

                <button
                class="edit-btn"
                onclick="editProduct('${product.id}')">

                    <i class="fa-solid fa-pen"></i>

                </button>

                <button
                class="delete-btn"
                onclick="deleteProduct('${product.id}')">

                    <i class="fa-solid fa-trash"></i>

                </button>

            </td>

        </tr>

        `;

    });

}


// =====================================================
// UPDATE DASHBOARD
// =====================================================

function updateStatistics(){

    let totalProducts = products.length;

    let totalStock = 0;

    let lowStock = 0;

    let inventoryValue = 0;

    products.forEach(product=>{

        const qty =
        Number(product.quantity || 0);

        const buying =
        Number(product.buyingPrice || 0);

        const minimum =
        Number(product.minimumStock || 5);

        totalStock += qty;

        inventoryValue += qty * buying;

        if(qty<=minimum){

            lowStock++;

        }

    });

    document
    .getElementById("totalProducts")
    .textContent = totalProducts;

    document
    .getElementById("totalStock")
    .textContent = totalStock;

    document
    .getElementById("lowStock")
    .textContent = lowStock;

    document
    .getElementById("inventoryValue")
    .textContent =
    "KSh " +
    inventoryValue.toLocaleString();

}


// =====================================================
// SEARCH PRODUCTS
// =====================================================

document

.getElementById("searchProduct")

.addEventListener("keyup",function(){

    const value =
    this.value
    .trim()
    .toLowerCase();

    filteredProducts = products.filter(product=>{

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

            ||

            (product.supplier || "")
            .toLowerCase()
            .includes(value)

        );

    });

    displayProducts(filteredProducts);

});


// =====================================================
// OPEN PRODUCT MODAL
// =====================================================
// =====================================================
// CLOSE MODAL
// =====================================================



// =====================================================
// LOGOUT
// =====================================================

document

.getElementById("logoutBtn")

.addEventListener("click",async(e)=>{

    e.preventDefault();

    if(confirm("Logout from the system?")){

        await signOut(auth);

        window.location.href="login.html";

    }

});


// =====================================================
// PLACEHOLDERS
// (Implemented in Part 2)
// =====================================================

window.editProduct=function(id){};

window.deleteProduct=function(id){};
// =====================================================
// PRODUCTS.JS
// PART 2
// SAVE PRODUCT • EDIT PRODUCT • IMAGE PREVIEW
// =====================================================




// =====================================================
// IMAGE PREVIEW
// =====================================================

let selectedImage = "";

document

.getElementById("productImage")

.addEventListener("change",(e)=>{

    const file = e.target.files[0];

    if(!file){

        selectedImage = "";

        return;

    }

    const reader = new FileReader();

    reader.onload = function(event){

        selectedImage = event.target.result;

    };

    reader.readAsDataURL(file);

});


// =====================================================
// SAVE PRODUCT
// =====================================================

document

.getElementById("productForm")

.addEventListener("submit",saveProduct);


async function saveProduct(e){

    e.preventDefault();

    try{

        const name =
        document
        .getElementById("productName")
        .value
        .trim();

        const barcode =
        document
        .getElementById("barcode")
        .value
        .trim();

        const category =
        document
        .getElementById("category")
        .value
        .trim();

        const supplier =
        document
        .getElementById("supplier")
        .value
        .trim();

        const buyingPrice =
        Number(
            document
            .getElementById("buyingPrice")
            .value
        );

        const minSellingPrice =
Number(
    document
    .getElementById("minSellingPrice")
    .value
);


const maxSellingPrice =
Number(
    document
    .getElementById("maxSellingPrice")
    .value
);

        const quantity =
        Number(
            document
            .getElementById("quantity")
            .value
        );

        const minimumStock =
        Number(
            document
            .getElementById("minimumStock")
            .value
        );



       // ===================================
// VALIDATION
// REQUIRED PRODUCT FIELDS
// ===================================

if(name===""){

    alert("Product name is required.");

    return;

}


if(category===""){

    alert("Category is required.");

    return;

}


// Check empty buying price
if(document.getElementById("buyingPrice").value.trim()===""){

    alert("Buying price is required.");

    return;

}


// Check empty minimum selling price
if(document.getElementById("minSellingPrice").value.trim()===""){

    alert("Minimum selling price is required.");

    return;

}


// Check empty maximum selling price
if(document.getElementById("maxSellingPrice").value.trim()===""){

    alert("Maximum selling price is required.");

    return;

}


// ===================================
// PRICE RULES
// ===================================

if(buyingPrice <= 0){

    alert("Enter a valid buying price.");

    return;

}


if(minSellingPrice <= 0){

    alert("Enter a valid minimum selling price.");

    return;

}


if(maxSellingPrice <= 0){

    alert("Enter a valid maximum selling price.");

    return;

}


if(minSellingPrice < buyingPrice){

    alert("Minimum selling price cannot be lower than buying price.");

    return;

}


if(maxSellingPrice < minSellingPrice){

    alert("Maximum selling price cannot be lower than minimum selling price.");

    return;

}



        // ===================================
        // CHECK DUPLICATE BARCODE
        // ===================================

        const barcodeQuery = query(

            collection(db,"products"),

            where("barcode","==",barcode)

        );

        const barcodeSnapshot =
        await getDocs(barcodeQuery);

        let barcodeExists = false;

        barcodeSnapshot.forEach(doc=>{

            if(doc.id!==editingProductId){

                barcodeExists = true;

            }

        });

        if(barcodeExists){

            alert("Barcode already exists.");

            return;

        }



        // ===================================
        // PRODUCT OBJECT
        // ===================================

        const productData = {

            name,

            barcode,

            category,

            supplier,

            buyingPrice,

            minSellingPrice,

            maxSellingPrice,

            quantity,

            minimumStock,

            image:selectedImage,

            updatedAt:serverTimestamp()

        };



        // ===================================
        // UPDATE PRODUCT
        // ===================================

        if(editingProductId){

            if(selectedImage===""){

                const oldProduct =
                products.find(
                    p=>p.id===editingProductId
                );

                if(oldProduct){

                    productData.image =
                    oldProduct.image || "";

                }

            }

            await updateDoc(

                doc(
                    db,
                    "products",
                    editingProductId
                ),

                productData

            );

            alert("Product updated successfully.");

        }



        // ===================================
        // ADD PRODUCT
        // ===================================

        else{

            productData.createdAt =
            serverTimestamp();

            await addDoc(

                collection(db,"products"),

                productData

            );

            alert("Product added successfully.");

        }



        // ===================================
        // RESET FORM
        // ===================================

        editingProductId = null;

        selectedImage = "";

        document
        .getElementById("productForm")
        .reset();

        document
        .getElementById("productModal")
        .style.display="none";

    }

    catch(error){

        console.error(error);

        alert(error.message);

    }

}


// =====================================================
// EDIT PRODUCT
// =====================================================

window.editProduct = function(id){

    editingProductId = id;

    const product =
    products.find(
        p=>p.id===id
    );

    if(!product){

        return;

    }

    document
    .getElementById("modalTitle")
    .textContent =
    "Edit Product";

    document
    .getElementById("productName")
    .value =
    product.name || "";

    document
    .getElementById("barcode")
    .value =
    product.barcode || "";

    document
    .getElementById("category")
    .value =
    product.category || "";

    document
    .getElementById("supplier")
    .value =
    product.supplier || "";

    document
    .getElementById("buyingPrice")
    .value =
    product.buyingPrice || 0;

    document
.getElementById("minSellingPrice")
.value =
product.minSellingPrice || 0;


document
.getElementById("maxSellingPrice")
.value =
product.maxSellingPrice || 0;

    document
    .getElementById("quantity")
    .value =
    product.quantity || 0;

    document
    .getElementById("minimumStock")
    .value =
    product.minimumStock || 5;

    selectedImage =
    product.image || "";

    document
    .getElementById("productModal")
    .style.display = "flex";

};


// =====================================================
// PART 3
// Delete Product • Close Modal • Helpers
// =====================================================
// =====================================================
// PRODUCTS.JS
// PART 3
// DELETE PRODUCT • MODAL • HELPERS
// =====================================================
// =====================================================
// DELETE PRODUCT
// =====================================================

window.deleteProduct = async function(id){

    const product =
    products.find(
        p => p.id === id
    );

    if(!product){

        return;

    }

    const answer = confirm(

        `Delete "${product.name}"?\n\nThis action cannot be undone.`

    );

    if(!answer){

        return;

    }

    try{

        await deleteDoc(

            doc(
                db,
                "products",
                id
            )

        );

        alert("Product deleted successfully.");

    }

    catch(error){

        console.error(error);

        alert(error.message);

    }

};


// =====================================================
// RESET FORM
// =====================================================

function resetForm(){

    editingProductId = null;

    selectedImage = "";

    document
    .getElementById("productForm")
    .reset();

}


// =====================================================
// CLOSE MODAL
// =====================================================

function closeModal(){

    resetForm();

    document
    .getElementById("productModal")
    .style.display = "none";

}


// =====================================================
// CLICK CANCEL BUTTON
// =====================================================

document

.getElementById("cancelBtn")

.addEventListener("click",closeModal);


// =====================================================
// CLICK CLOSE (X)
// =====================================================

document

.getElementById("closeModal")

.addEventListener("click",closeModal);


// =====================================================
// CLICK OUTSIDE MODAL
// =====================================================

window.addEventListener("click",(e)=>{

    const modal =

    document.getElementById("productModal");

    if(e.target===modal){

        closeModal();

    }

});


// =====================================================
// ESC KEY CLOSE
// =====================================================

document.addEventListener("keydown",(e)=>{

    if(e.key==="Escape"){

        const modal =

        document.getElementById("productModal");

        if(modal.style.display==="flex"){

            closeModal();

        }

    }

});


// =====================================================
// CLEAR IMAGE WHEN OPENING NEW PRODUCT
// =====================================================

document

.getElementById("addProductBtn")

.addEventListener("click",()=>{

    resetForm();

    document
    .getElementById("modalTitle")
    .textContent="Add Product";

    document
    .getElementById("productModal")
    .style.display="flex";

});


// =====================================================
// LIVE PRICE VALIDATION
// =====================================================


// MINIMUM SELLING PRICE CHECK
function validateMinSellingPrice(){

    const buying = Number(
        document.getElementById("buyingPrice").value
    ) || 0;


    const minSelling = Number(
        document.getElementById("minSellingPrice").value
    ) || 0;


    const input =
    document.getElementById("minSellingPrice");


    if(minSelling < buying){

        input.style.border = "2px solid red";
        input.title =
        "Minimum selling price cannot be lower than buying price";

    }

    else{

        input.style.border = "";
        input.title = "";

    }

}



// MAXIMUM SELLING PRICE CHECK
function validateMaxSellingPrice(){

    const minSelling = Number(
        document.getElementById("minSellingPrice").value
    ) || 0;


    const maxSelling = Number(
        document.getElementById("maxSellingPrice").value
    ) || 0;


    const input =
    document.getElementById("maxSellingPrice");


    if(maxSelling < minSelling){

        input.style.border = "2px solid red";
        input.title =
        "Maximum selling price cannot be lower than minimum selling price";

    }

    else{

        input.style.border = "";
        input.title = "";

    }

}



// BUYING PRICE CHANGED
document
.getElementById("buyingPrice")
.addEventListener("input",()=>{

    validateMinSellingPrice();

});



// MIN SELLING PRICE CHANGED
document
.getElementById("minSellingPrice")
.addEventListener("input",()=>{

    validateMinSellingPrice();
    validateMaxSellingPrice();

});



// MAX SELLING PRICE CHANGED
document
.getElementById("maxSellingPrice")
.addEventListener("input",()=>{

    validateMaxSellingPrice();

});





// =====================================================
// QUANTITY VALIDATION
// =====================================================

document

.getElementById("quantity")

.addEventListener("input",(e)=>{

    if(Number(e.target.value) < 0){

        e.target.value = 0;

    }

});


// =====================================================
// MINIMUM STOCK VALIDATION
// =====================================================

document

.getElementById("minimumStock")

.addEventListener("input",(e)=>{

    if(Number(e.target.value) < 0){

        e.target.value = 0;

    }

});


// =====================================================
// PREVENT NEGATIVE PRICES
// =====================================================

["buyingPrice","minSellingPrice","maxSellingPrice"].forEach(id=>{

    document
    .getElementById(id)
    .addEventListener("input",(e)=>{

        if(Number(e.target.value) < 0){

            e.target.value = 0;

        }

    });

});


// =====================================================
// END OF PRODUCTS.JS
// =====================================================

console.log(
    "LEBARTO PRODUCTS MODULE LOADED SUCCESSFULLY."
);
