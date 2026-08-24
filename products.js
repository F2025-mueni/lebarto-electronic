// =====================================================
// LEBARTO ELECTRONICS
// PRODUCTS.JS
// PRODUCTS + RESTOCK + RESTOCK HISTORY
// DATE RANGE FILTER
// ADMIN + CASHIER PERMISSIONS
// =====================================================

import { auth, db, storage } from "./firebase-config.js";

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
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";


// =====================================================
// GLOBAL VARIABLES
// =====================================================

let currentUser = null;
let currentUserData = null;

let products = [];
let filteredProducts = [];

let restockHistory = [];
let filteredRestockHistory = [];

let editingProductId = null;

let selectedImage = "";

let stream = null;

let reportWindow = null;
let priceReportWindow = null;


// =====================================================
// CHECK LOGIN
// =====================================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "login.html";

        return;

    }

    currentUser = user;

    const allowed = await loadCurrentUser();

    if (!allowed) return;

    loadProducts();

    loadRestockHistory();

});


// =====================================================
// LOAD CURRENT USER
// =====================================================

async function loadCurrentUser() {

    try {

        const userQuery = query(
            collection(db, "users"),
            where("uid", "==", currentUser.uid)
        );

        const snapshot = await getDocs(userQuery);

        if (snapshot.empty) {

            alert("User account not found.");

            await signOut(auth);

            window.location.href = "login.html";

            return false;

        }

        currentUserData = snapshot.docs[0].data();

        const role = currentUserData.role;

        if (
            role !== "admin" &&
            role !== "cashier"
        ) {

            alert("Access denied.");

            window.location.href = "cashier.html";

            return false;

        }

        applyRolePermissions();

        return true;

    }

    catch (error) {

        console.error(
            "Load current user error:",
            error
        );

        alert(error.message);

        return false;

    }

}


// =====================================================
// APPLY ROLE PERMISSIONS
// =====================================================

function applyRolePermissions() {

    const isAdmin =
        currentUserData.role === "admin";

    const addButton =
        document.getElementById(
            "addProductBtn"
        );

    const restockModeBtn =
        document.getElementById(
            "restockModeBtn"
        );

    /*
     * Both admin and cashier can:
     * - Add new product
     * - Restock existing product
     *
     * Only admin can:
     * - Edit product
     * - Delete product
     */

    if (!isAdmin) {

        if (addButton) {

            addButton.innerHTML =
                '<i class="fa-solid fa-plus"></i> Add / Restock';

        }

        if (restockModeBtn) {

            restockModeBtn.style.display =
                "block";

        }

    }

}


// =====================================================
// LOAD PRODUCTS
// =====================================================

function loadProducts() {

    const q = query(
        collection(db, "products"),
        orderBy("name")
    );

    onSnapshot(
        q,
        (snapshot) => {

            products = [];

            snapshot.forEach(
                productDoc => {

                    products.push({

                        id:
                            productDoc.id,

                        ...productDoc.data()

                    });

                }
            );

            filteredProducts =
                [...products];

            displayProducts(
                filteredProducts
            );

            updateStatistics();

            populateRestockProducts();

        },

        error => {

            console.error(
                "Products loading error:",
                error
            );

            alert(
                "Unable to load products. " +
                error.message
            );

        }
    );

}


// =====================================================
// FIND DUPLICATE PRODUCTS
// =====================================================

function getDuplicateProducts() {

    const duplicates =
        new Set();

    const seen =
        new Map();

    products.forEach(product => {

        const key =
            (product.name || "")
                .trim()
                .toLowerCase()
            +
            "|"
            +
            (product.category || "")
                .trim()
                .toLowerCase();

        if (seen.has(key)) {

            duplicates.add(
                product.id
            );

            duplicates.add(
                seen.get(key)
            );

        }
        else {

            seen.set(
                key,
                product.id
            );

        }

    });

    return duplicates;

}


// =====================================================
// DISPLAY PRODUCTS
// =====================================================

function displayProducts(productArray) {

    const duplicateProducts =
        getDuplicateProducts();

    const tbody =
        document.getElementById(
            "productTable"
        );

    tbody.innerHTML = "";

    if (
        productArray.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="10"
                    style="
                        text-align:center;
                        padding:30px;
                    ">

                    No products found.

                </td>

            </tr>

        `;

        return;

    }

    const isAdmin =
        currentUserData?.role === "admin";


    productArray.forEach(product => {

        const quantity =
            Number(
                product.quantity || 0
            );

        const minimum =
            Number(
                product.minimumStock || 5
            );


        let status = "";
        let statusClass = "";


        if (quantity === 0) {

            status =
                "Out of Stock";

            statusClass =
                "out-stock";

        }

        else if (
            quantity <= minimum
        ) {

            status =
                "Low Stock";

            statusClass =
                "low-stock";

        }

        else {

            status =
                "In Stock";

            statusClass =
                "in-stock";

        }


        let actions = `

            <button
                class="restock-btn"
                onclick="restockProduct('${product.id}')">

                <i class="fa-solid fa-boxes-stacked"></i>

                Restock

            </button>

        `;


        if (isAdmin) {

            actions += `

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

            `;

        }


        tbody.innerHTML += `

            <tr
                class="${
                    duplicateProducts.has(product.id)
                        ? "duplicate-product"
                        : ""
                }">

                <td>

                    <img
                        src="${
                            product.image ||
                            "https://via.placeholder.com/60"
                        }"
                        width="60"
                        height="60"
                        style="
                            object-fit:cover;
                            border-radius:6px;
                        "
                        alt="Product">

                </td>


                <td>

                    ${product.barcode || "-"}

                </td>


                <td>

                    ${product.name || "-"}

                    ${
                        duplicateProducts.has(
                            product.id
                        )
                            ? `
                                <br>

                                <span class="duplicate-label">
                                    Duplicate
                                </span>
                              `
                            : ""
                    }

                </td>


                <td>

                    ${product.category || "-"}

                </td>


                <td>

                    ${product.supplier || "-"}

                </td>


                <td>

                    KSh
                    ${
                        Number(
                            product.buyingPrice || 0
                        ).toLocaleString()
                    }

                </td>


                <td>

                    KSh
                    ${
                        Number(
                            product.minSellingPrice || 0
                        ).toLocaleString()
                    }

                    -

                    KSh
                    ${
                        Number(
                            product.maxSellingPrice || 0
                        ).toLocaleString()
                    }

                </td>


                <td>

                    ${quantity}

                </td>


                <td>

                    <span class="${statusClass}">

                        ${status}

                    </span>

                </td>


                <td class="actions-cell">

                    ${actions}

                </td>

            </tr>

        `;

    });

}


// =====================================================
// UPDATE STATISTICS
// =====================================================

function updateStatistics() {

    let totalProducts =
        products.length;

    let totalStock = 0;

    let lowStock = 0;

    let inventoryValue = 0;


    products.forEach(product => {

        const quantity =
            Number(
                product.quantity || 0
            );

        const buying =
            Number(
                product.buyingPrice || 0
            );

        const minimum =
            Number(
                product.minimumStock || 5
            );


        totalStock += quantity;

        inventoryValue +=
            quantity * buying;


        if (
            quantity <= minimum
        ) {

            lowStock++;

        }

    });


    document
        .getElementById("totalProducts")
        .textContent =
        totalProducts;


    document
        .getElementById("totalStock")
        .textContent =
        totalStock;


    document
        .getElementById("lowStock")
        .textContent =
        lowStock;


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
    .addEventListener(
        "keyup",
        function () {

            const value =
                this.value
                    .trim()
                    .toLowerCase();


            filteredProducts =
                products.filter(
                    product => {

                        return (

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

                    }
                );


            displayProducts(
                filteredProducts
            );

        }
    );


// =====================================================
// OPEN NEW PRODUCT MODAL
// =====================================================

document
    .getElementById("addProductBtn")
    .addEventListener(
        "click",
        () => {

            resetForm();

            setNewProductMode();

            document
                .getElementById("modalTitle")
                .textContent =
                "Add New Product";

            document
                .getElementById("productModal")
                .style.display =
                "flex";

        }
    );


// =====================================================
// NEW PRODUCT MODE
// =====================================================

document
    .getElementById("newProductModeBtn")
    .addEventListener(
        "click",
        setNewProductMode
    );


function setNewProductMode() {

    document
        .getElementById("newProductModeBtn")
        .classList.add("active");


    document
        .getElementById("restockModeBtn")
        .classList.remove("active");


    document
        .getElementById("newProductModeBtn")
        .style.background =
        "#1565c0";


    document
        .getElementById("newProductModeBtn")
        .style.color =
        "#fff";


    document
        .getElementById("restockModeBtn")
        .style.background =
        "#e5e7eb";


    document
        .getElementById("restockModeBtn")
        .style.color =
        "#374151";


    document
        .getElementById("productForm")
        .style.display =
        "block";


    document
        .getElementById("restockSection")
        .style.display =
        "none";


    document
        .getElementById("modalTitle")
        .textContent =
        editingProductId
            ? "Edit Product"
            : "Add New Product";

}


// =====================================================
// RESTOCK MODE
// =====================================================

document
    .getElementById("restockModeBtn")
    .addEventListener(
        "click",
        setRestockMode
    );


function setRestockMode() {

    document
        .getElementById("restockModeBtn")
        .classList.add("active");


    document
        .getElementById("newProductModeBtn")
        .classList.remove("active");


    document
        .getElementById("restockModeBtn")
        .style.background =
        "#1565c0";


    document
        .getElementById("restockModeBtn")
        .style.color =
        "#fff";


    document
        .getElementById("newProductModeBtn")
        .style.background =
        "#e5e7eb";


    document
        .getElementById("newProductModeBtn")
        .style.color =
        "#374151";


    document
        .getElementById("productForm")
        .style.display =
        "none";


    document
        .getElementById("restockSection")
        .style.display =
        "block";


    document
        .getElementById("modalTitle")
        .textContent =
        "Restock Existing Product";


    populateRestockProducts();

}


// =====================================================
// POPULATE RESTOCK PRODUCTS
// =====================================================

function populateRestockProducts() {

    const select =
        document.getElementById(
            "restockProduct"
        );


    if (!select) return;


    select.innerHTML = `

        <option value="">

            Select product to restock

        </option>

    `;


    products.forEach(product => {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            product.id;


        option.textContent =
            `${product.name} — Current Stock: ${
                Number(
                    product.quantity || 0
                )
            }`;


        select.appendChild(
            option
        );

    });

}


// =====================================================
// SELECT RESTOCK PRODUCT
// =====================================================

document
    .getElementById("restockProduct")
    .addEventListener(
        "change",
        function () {

            const product =
                products.find(
                    p =>
                        p.id ===
                        this.value
                );


            const info =
                document.getElementById(
                    "selectedProductInfo"
                );


            if (!product) {

                info.innerHTML = `

                    <p>
                        Select a product to see its current stock.
                    </p>

                `;

                return;

            }


            info.innerHTML = `

                <div
                    class="restock-info-grid"
                    style="
                        display:grid;
                        grid-template-columns:
                            repeat(3,1fr);
                        gap:15px;
                    ">

                    <div>

                        <strong>
                            Product
                        </strong>

                        <span
                            style="
                                display:block;
                                margin-top:5px;
                            ">

                            ${product.name}

                        </span>

                    </div>


                    <div>

                        <strong>
                            Current Stock
                        </strong>

                        <span
                            style="
                                display:block;
                                margin-top:5px;
                            ">

                            ${
                                Number(
                                    product.quantity || 0
                                )
                            }

                        </span>

                    </div>


                    <div>

                        <strong>
                            Category
                        </strong>

                        <span
                            style="
                                display:block;
                                margin-top:5px;
                            ">

                            ${
                                product.category ||
                                "-"
                            }

                        </span>

                    </div>

                </div>

            `;

        }
    );


// =====================================================
// RESTOCK PRODUCT FROM TABLE
// =====================================================

window.restockProduct =
    function (id) {

        document
            .getElementById(
                "productModal"
            )
            .style.display =
            "flex";


        setRestockMode();


        document
            .getElementById(
                "restockProduct"
            )
            .value =
            id;


        document
            .getElementById(
                "restockProduct"
            )
            .dispatchEvent(
                new Event("change")
            );

    };


// =====================================================
// SAVE RESTOCK
// =====================================================

document
    .getElementById("saveRestockBtn")
    .addEventListener(
        "click",
        saveRestock
    );


async function saveRestock() {

    const productId =
        document
            .getElementById(
                "restockProduct"
            )
            .value;


    const amount =
        Number(
            document
                .getElementById(
                    "restockQuantity"
                )
                .value
        );


    if (!productId) {

        alert(
            "Please select a product."
        );

        return;

    }


    if (
        !amount ||
        amount <= 0 ||
        !Number.isInteger(amount)
    ) {

        alert(
            "Enter a valid whole quantity to add."
        );

        return;

    }


    const product =
        products.find(
            p =>
                p.id === productId
        );


    if (!product) {

        alert(
            "Product could not be found."
        );

        return;

    }


    try {

        const previousQuantity =
            Number(
                product.quantity || 0
            );


        const currentQuantity =
            previousQuantity +
            amount;


        // =================================================
        // UPDATE PRODUCT
        // =================================================

        await updateDoc(
            doc(
                db,
                "products",
                productId
            ),
            {

                quantity:
                    currentQuantity,

                updatedAt:
                    serverTimestamp()

            }
        );


        // =================================================
        // SAVE RESTOCK HISTORY
        // =================================================

        await addDoc(
            collection(
                db,
                "restockHistory"
            ),
            {

                productId,

                productName:
                    product.name || "",

                barcode:
                    product.barcode || "",

                category:
                    product.category || "",

                previousQuantity,

                quantityAdded:
                    amount,

                currentQuantity,

                type:
                    "Restock",

                addedBy:
                    currentUserData.name ||
                    currentUserData.fullName ||
                    currentUser.email,

                addedByUid:
                    currentUser.uid,

                addedByRole:
                    currentUserData.role,

                createdAt:
                    serverTimestamp()

            }
        );


        alert(
            `${product.name} restocked successfully.\n\n` +
            `Previous stock: ${previousQuantity}\n` +
            `Added: ${amount}\n` +
            `Current stock: ${currentQuantity}`
        );


        document
            .getElementById(
                "restockQuantity"
            )
            .value = "";


        document
            .getElementById(
                "restockProduct"
            )
            .value = "";


        document
            .getElementById(
                "selectedProductInfo"
            )
            .innerHTML = `

                <p>
                    Select a product to see its current stock.
                </p>

            `;


        closeModal();

    }

    catch (error) {

        console.error(
            "Restock error:",
            error
        );

        alert(
            "Restock failed: " +
            error.message
        );

    }

}


// =====================================================
// SAVE NEW PRODUCT / EDIT PRODUCT
// =====================================================

document
    .getElementById("productForm")
    .addEventListener(
        "submit",
        saveProduct
    );


async function saveProduct(e) {

    e.preventDefault();


    try {

        const name =
            document
                .getElementById(
                    "productName"
                )
                .value
                .trim();


        const barcode =
            document
                .getElementById(
                    "barcode"
                )
                .value
                .trim();


        const category =
            document
                .getElementById(
                    "category"
                )
                .value
                .trim();


        const supplier =
            document
                .getElementById(
                    "supplier"
                )
                .value
                .trim();


        const buyingPrice =
            Number(
                document
                    .getElementById(
                        "buyingPrice"
                    )
                    .value
            );


        const minSellingPrice =
            Number(
                document
                    .getElementById(
                        "minSellingPrice"
                    )
                    .value
            );


        const maxSellingPrice =
            Number(
                document
                    .getElementById(
                        "maxSellingPrice"
                    )
                    .value
            );


        const quantity =
            Number(
                document
                    .getElementById(
                        "quantity"
                    )
                    .value
            );


        const minimumStock =
            Number(
                document
                    .getElementById(
                        "minimumStock"
                    )
                    .value
            );


        // =================================================
        // VALIDATION
        // =================================================

        if (!name) {

            alert(
                "Product name is required."
            );

            return;

        }


        if (!category) {

            alert(
                "Category is required."
            );

            return;

        }


        if (
            buyingPrice <= 0
        ) {

            alert(
                "Enter a valid buying price."
            );

            return;

        }


        if (
            minSellingPrice <= 0
        ) {

            alert(
                "Enter a valid minimum selling price."
            );

            return;

        }


        if (
            maxSellingPrice <= 0
        ) {

            alert(
                "Enter a valid maximum selling price."
            );

            return;

        }


        if (
            minSellingPrice <
            buyingPrice
        ) {

            alert(
                "Minimum selling price cannot be lower than buying price."
            );

            return;

        }


        if (
            maxSellingPrice <
            minSellingPrice
        ) {

            alert(
                "Maximum selling price cannot be lower than minimum selling price."
            );

            return;

        }


        if (
            quantity < 0
        ) {

            alert(
                "Quantity cannot be negative."
            );

            return;

        }


        // =================================================
        // BARCODE DUPLICATE CHECK
        // =================================================

        if (
            barcode !== ""
        ) {

            const barcodeQuery =
                query(
                    collection(
                        db,
                        "products"
                    ),
                    where(
                        "barcode",
                        "==",
                        barcode
                    )
                );


            const barcodeSnapshot =
                await getDocs(
                    barcodeQuery
                );


            const barcodeDuplicate =
                barcodeSnapshot.docs.some(
                    item =>
                        item.id !==
                        editingProductId
                );


            if (
                barcodeDuplicate
            ) {

                alert(
                    "Barcode already exists."
                );

                return;

            }

        }


        // =================================================
        // DUPLICATE NAME + CATEGORY
        // =================================================

        const normalizedName =
            name
                .toLowerCase()
                .trim();


        const normalizedCategory =
            category
                .toLowerCase()
                .trim();


        const duplicateExists =
            products.some(
                product => {

                    if (
                        product.id ===
                        editingProductId
                    ) {

                        return false;

                    }


                    const existingName =
                        (
                            product.name ||
                            ""
                        )
                            .toLowerCase()
                            .trim();


                    const existingCategory =
                        (
                            product.category ||
                            ""
                        )
                            .toLowerCase()
                            .trim();


                    return (

                        existingName ===
                        normalizedName

                        &&

                        existingCategory ===
                        normalizedCategory

                    );

                }
            );


        if (
            duplicateExists
        ) {

            alert(
                "This product already exists. Use Restock instead."
            );

            return;

        }


        // =================================================
        // IMAGE
        // =================================================

        let imageURL =
            "";


        /*
         * If editing and no new image
         * is selected, keep old image.
         */

        if (
            editingProductId
        ) {

            const existingProduct =
                products.find(
                    p =>
                        p.id ===
                        editingProductId
                );


            imageURL =
                existingProduct?.image ||
                "";

        }


        if (
            selectedImage instanceof File ||
            selectedImage instanceof Blob
        ) {

            const imageName =
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .substring(2);


            const storageRef =
                ref(
                    storage,
                    "products/" +
                    imageName
                );


            await uploadBytes(
                storageRef,
                selectedImage
            );


            imageURL =
                await getDownloadURL(
                    storageRef
                );

        }


        // =================================================
        // PRODUCT DATA
        // =================================================

        const productData = {

            name,

            barcode:
                barcode === ""
                    ? null
                    : barcode,

            category,

            supplier,

            buyingPrice,

            minSellingPrice,

            maxSellingPrice,

            quantity,

            minimumStock,

            image:
                imageURL,

            updatedAt:
                serverTimestamp()

        };


        // =================================================
        // EDIT EXISTING PRODUCT
        // =================================================

        if (
            editingProductId
        ) {

            await updateDoc(
                doc(
                    db,
                    "products",
                    editingProductId
                ),
                productData
            );


            alert(
                "Product updated successfully."
            );


            closeModal();

            return;

        }


        // =================================================
        // ADD NEW PRODUCT
        // =================================================

        productData.createdAt =
            serverTimestamp();


        const productRef =
            await addDoc(
                collection(
                    db,
                    "products"
                ),
                productData
            );


        // =================================================
        // NEW PRODUCT = RESTOCK HISTORY
        // =================================================

        if (
            quantity > 0
        ) {

            await addDoc(
                collection(
                    db,
                    "restockHistory"
                ),
                {

                    productId:
                        productRef.id,

                    productName:
                        name,

                    barcode:
                        barcode || "",

                    category,

                    previousQuantity:
                        0,

                    quantityAdded:
                        quantity,

                    currentQuantity:
                        quantity,

                    type:
                        "New Stock",

                    addedBy:
                        currentUserData.name ||
                        currentUserData.fullName ||
                        currentUser.email,

                    addedByUid:
                        currentUser.uid,

                    addedByRole:
                        currentUserData.role,

                    createdAt:
                        serverTimestamp()

                }
            );

        }


        alert(
            "Product added successfully."
        );


        closeModal();

    }

    catch (error) {

        console.error(
            "Save product error:",
            error
        );

        alert(
            "Unable to save product: " +
            error.message
        );

    }

}


// =====================================================
// ADMIN ONLY — EDIT PRODUCT
// =====================================================

window.editProduct =
    function (id) {

        if (
            currentUserData?.role !==
            "admin"
        ) {

            alert(
                "Cashiers cannot edit existing products. Use Restock instead."
            );

            return;

        }


        editingProductId =
            id;


        const product =
            products.find(
                p =>
                    p.id === id
            );


        if (!product) {

            alert(
                "Product not found."
            );

            return;

        }


        document
            .getElementById(
                "modalTitle"
            )
            .textContent =
            "Edit Product";


        document
            .getElementById(
                "productName"
            )
            .value =
            product.name || "";


        document
            .getElementById(
                "barcode"
            )
            .value =
            product.barcode || "";


        document
            .getElementById(
                "category"
            )
            .value =
            product.category || "";


        document
            .getElementById(
                "supplier"
            )
            .value =
            product.supplier || "";


        document
            .getElementById(
                "buyingPrice"
            )
            .value =
            product.buyingPrice || 0;


        document
            .getElementById(
                "minSellingPrice"
            )
            .value =
            product.minSellingPrice || 0;


        document
            .getElementById(
                "maxSellingPrice"
            )
            .value =
            product.maxSellingPrice || 0;


        document
            .getElementById(
                "quantity"
            )
            .value =
            product.quantity || 0;


        document
            .getElementById(
                "minimumStock"
            )
            .value =
            product.minimumStock || 5;


        selectedImage =
            "";


        if (
            product.image
        ) {

            document
                .getElementById(
                    "imagePreview"
                )
                .src =
                product.image;


            document
                .getElementById(
                    "imagePreview"
                )
                .style.display =
                "block";


            document
                .getElementById(
                    "fileName"
                )
                .textContent =
                "Current Image";

        }
        else {

            document
                .getElementById(
                    "imagePreview"
                )
                .style.display =
                "none";


            document
                .getElementById(
                    "fileName"
                )
                .textContent =
                "No image selected";

        }


        setNewProductMode();


        document
            .getElementById(
                "productModal"
            )
            .style.display =
            "flex";

    };


// =====================================================
// ADMIN ONLY — DELETE PRODUCT
// =====================================================

window.deleteProduct =
    async function (id) {

        if (
            currentUserData?.role !==
            "admin"
        ) {

            alert(
                "Cashiers cannot delete products."
            );

            return;

        }


        const product =
            products.find(
                p =>
                    p.id === id
            );


        if (!product) return;


        const answer =
            confirm(
                `Delete "${product.name}"?\n\n` +
                `This action cannot be undone.`
            );


        if (!answer) return;


        try {

            await deleteDoc(
                doc(
                    db,
                    "products",
                    id
                )
            );


            alert(
                "Product deleted successfully."
            );

        }

        catch (error) {

            console.error(
                "Delete error:",
                error
            );

            alert(
                "Delete failed: " +
                error.message
            );

        }

    };


// =====================================================
// LOAD RESTOCK HISTORY
// =====================================================

function loadRestockHistory() {

    const historyQuery =
        query(
            collection(
                db,
                "restockHistory"
            ),
            orderBy(
                "createdAt",
                "desc"
            )
        );


    onSnapshot(
        historyQuery,

        snapshot => {

            restockHistory = [];


            snapshot.forEach(
                historyDoc => {

                    restockHistory.push({

                        id:
                            historyDoc.id,

                        ...historyDoc.data()

                    });

                }
            );


            /*
             * Initially display all records.
             */

            filteredRestockHistory =
                [...restockHistory];


            displayRestockHistory(
                filteredRestockHistory
            );

        },


        error => {

            console.error(
                "Restock history error:",
                error
            );


            const tbody =
                document.getElementById(
                    "restockHistoryTable"
                );


            tbody.innerHTML = `

                <tr>

                    <td
                        colspan="8"
                        style="
                            text-align:center;
                            padding:30px;
                            color:red;
                        ">

                        Unable to load restock history.

                    </td>

                </tr>

            `;

        }
    );

}


// =====================================================
// GET HISTORY DATE
// =====================================================

function getHistoryDate(item) {

    if (
        item.createdAt &&
        typeof item.createdAt.toDate ===
            "function"
    ) {

        return item.createdAt.toDate();

    }


    return null;

}


// =====================================================
// DISPLAY RESTOCK HISTORY
// =====================================================

function displayRestockHistory(historyArray) {

    const tbody =
        document.getElementById(
            "restockHistoryTable"
        );


    tbody.innerHTML = "";


    // =================================================
    // SORT NEWEST FIRST
    // =================================================

    const sortedHistory =
        [...historyArray].sort(
            (a, b) => {

                const dateA =
                    getHistoryDate(a);

                const dateB =
                    getHistoryDate(b);


                if (!dateA && !dateB)
                    return 0;

                if (!dateA)
                    return 1;

                if (!dateB)
                    return -1;


                return (
                    dateB.getTime() -
                    dateA.getTime()
                );

            }
        );


    // =================================================
    // UPDATE SUMMARY
    // =================================================

    updateRestockSummary(
        sortedHistory
    );


    // =================================================
    // EMPTY
    // =================================================

    if (
        sortedHistory.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:40px;
                    ">

                    No restock history found
                    for the selected date range.

                </td>

            </tr>

        `;

        return;

    }


    // =================================================
    // DISPLAY RECORDS
    // =================================================

    sortedHistory.forEach(
        item => {

            const date =
                getHistoryDate(item);


            let formattedDate =
                "-";


            if (date) {

                formattedDate =
                    date.toLocaleString(
                        "en-KE",
                        {
                            year:
                                "numeric",

                            month:
                                "2-digit",

                            day:
                                "2-digit",

                            hour:
                                "2-digit",

                            minute:
                                "2-digit",

                            second:
                                "2-digit"
                        }
                    );

            }


            const typeClass =
                item.type ===
                "New Stock"
                    ? "new-stock"
                    : "restock";


            tbody.innerHTML += `

                <tr>

                    <td>

                        ${formattedDate}

                    </td>


                    <td>

                        ${
                            item.productName ||
                            "-"
                        }

                    </td>


                    <td>

                        ${
                            item.barcode ||
                            "-"
                        }

                    </td>


                    <td>

                        <span
                            class="history-type ${typeClass}">

                            ${
                                item.type ||
                                "Restock"
                            }

                        </span>

                    </td>


                    <td>

                        ${
                            Number(
                                item.previousQuantity ||
                                0
                            ).toLocaleString()
                        }

                    </td>


                    <td
                        class="added-quantity"
                        style="
                            font-weight:700;
                            color:#2e7d32;
                        ">

                        +${
                            Number(
                                item.quantityAdded ||
                                0
                            ).toLocaleString()
                        }

                    </td>


                    <td>

                        ${
                            Number(
                                item.currentQuantity ||
                                0
                            ).toLocaleString()
                        }

                    </td>


                    <td>

                        ${
                            item.addedBy ||
                            "-"
                        }

                    </td>

                </tr>

            `;

        }
    );

}


// =====================================================
// UPDATE RESTOCK SUMMARY
// =====================================================

function updateRestockSummary(
    historyArray
) {

    const totalRecords =
        historyArray.length;


    let totalQuantity =
        0;


    historyArray.forEach(
        item => {

            totalQuantity +=
                Number(
                    item.quantityAdded ||
                    0
                );

        }
    );


    document
        .getElementById(
            "restockTotalRecords"
        )
        .textContent =
        totalRecords.toLocaleString();


    document
        .getElementById(
            "restockTotalQuantity"
        )
        .textContent =
        totalQuantity.toLocaleString();

}


// =====================================================
// DATE RANGE FILTER
// =====================================================

document
    .getElementById(
        "filterRestockBtn"
    )
    .addEventListener(
        "click",
        filterRestockHistory
    );


function filterRestockHistory() {

    const fromValue =
        document
            .getElementById(
                "restockFromDate"
            )
            .value;


    const toValue =
        document
            .getElementById(
                "restockToDate"
            )
            .value;


    // =================================================
    // VALIDATE DATE RANGE
    // =================================================

    if (
        fromValue &&
        toValue &&
        fromValue > toValue
    ) {

        alert(
            "The From Date cannot be later than the To Date."
        );

        return;

    }


    let fromDate =
        null;


    let toDate =
        null;


    if (fromValue) {

        const [
            year,
            month,
            day
        ] =
            fromValue
                .split("-")
                .map(Number);


        fromDate =
            new Date(
                year,
                month - 1,
                day,
                0,
                0,
                0,
                0
            );

    }


    if (toValue) {

        const [
            year,
            month,
            day
        ] =
            toValue
                .split("-")
                .map(Number);


        /*
         * End of selected date.
         * This makes the To Date inclusive.
         */

        toDate =
            new Date(
                year,
                month - 1,
                day,
                23,
                59,
                59,
                999
            );

    }


    filteredRestockHistory =
        restockHistory.filter(
            item => {

                const historyDate =
                    getHistoryDate(item);


                /*
                 * If Firestore timestamp
                 * is temporarily unavailable,
                 * don't include it in a
                 * date-filtered result.
                 */

                if (!historyDate) {

                    return !fromDate &&
                           !toDate;

                }


                if (
                    fromDate &&
                    historyDate <
                        fromDate
                ) {

                    return false;

                }


                if (
                    toDate &&
                    historyDate >
                        toDate
                ) {

                    return false;

                }


                return true;

            }
        );


    displayRestockHistory(
        filteredRestockHistory
    );


    // =================================================
    // UPDATE LABEL
    // =================================================

    updateDateRangeLabel(
        fromValue,
        toValue
    );

}


// =====================================================
// CLEAR DATE FILTER
// =====================================================

document
    .getElementById(
        "clearRestockFilterBtn"
    )
    .addEventListener(
        "click",
        clearRestockFilter
    );


function clearRestockFilter() {

    document
        .getElementById(
            "restockFromDate"
        )
        .value = "";


    document
        .getElementById(
            "restockToDate"
        )
        .value = "";


    filteredRestockHistory =
        [...restockHistory];


    displayRestockHistory(
        filteredRestockHistory
    );


    updateDateRangeLabel(
        "",
        ""
    );

}


// =====================================================
// DATE RANGE LABEL
// =====================================================

function updateDateRangeLabel(
    fromValue,
    toValue
) {

    const label =
        document.getElementById(
            "restockDateRangeLabel"
        );


    if (
        !fromValue &&
        !toValue
    ) {

        label.textContent =
            "All Dates";

        return;

    }


    if (
        fromValue &&
        !toValue
    ) {

        label.textContent =
            `From ${formatInputDate(fromValue)}`;

        return;

    }


    if (
        !fromValue &&
        toValue
    ) {

        label.textContent =
            `Up to ${formatInputDate(toValue)}`;

        return;

    }


    label.textContent =
        `${formatInputDate(fromValue)} → ${formatInputDate(toValue)}`;

}


// =====================================================
// FORMAT DATE INPUT
// =====================================================

function formatInputDate(
    value
) {

    if (!value)
        return "";


    const [
        year,
        month,
        day
    ] =
        value.split("-");


    return `${day}/${month}/${year}`;

}


// =====================================================
// ENTER KEY ON DATE INPUTS
// =====================================================

[
    "restockFromDate",
    "restockToDate"
].forEach(id => {

    document
        .getElementById(id)
        .addEventListener(
            "keydown",
            e => {

                if (
                    e.key === "Enter"
                ) {

                    filterRestockHistory();

                }

            }
        );

});


// =====================================================
// RESET FORM
// =====================================================

function resetForm() {

    editingProductId = null;

    selectedImage = "";


    document
        .getElementById(
            "productForm"
        )
        .reset();


    document
        .getElementById(
            "imagePreview"
        )
        .src = "";


    document
        .getElementById(
            "imagePreview"
        )
        .style.display =
        "none";


    document
        .getElementById(
            "fileName"
        )
        .textContent =
        "No image selected";


    document
        .getElementById(
            "restockQuantity"
        )
        .value = "";


    document
        .getElementById(
            "restockProduct"
        )
        .value = "";


    document
        .getElementById(
            "selectedProductInfo"
        )
        .innerHTML = `

            <p>
                Select a product to see its current stock.
            </p>

        `;


    stopCamera();

}


// =====================================================
// CLOSE MODAL
// =====================================================

function closeModal() {

    resetForm();


    document
        .getElementById(
            "productModal"
        )
        .style.display =
        "none";

}


document
    .getElementById(
        "cancelBtn"
    )
    .addEventListener(
        "click",
        closeModal
    );


document
    .getElementById(
        "cancelRestockBtn"
    )
    .addEventListener(
        "click",
        closeModal
    );


document
    .getElementById(
        "closeModal"
    )
    .addEventListener(
        "click",
        closeModal
    );


// =====================================================
// CLOSE MODAL BY CLICKING OUTSIDE
// =====================================================

window.addEventListener(
    "click",
    e => {

        const modal =
            document.getElementById(
                "productModal"
            );


        if (
            e.target === modal
        ) {

            closeModal();

        }

    }
);


// =====================================================
// ESCAPE CLOSE
// =====================================================

document.addEventListener(
    "keydown",
    e => {

        if (
            e.key !== "Escape"
        ) return;


        const modal =
            document.getElementById(
                "productModal"
            );


        if (
            modal.style.display ===
            "flex"
        ) {

            closeModal();

        }

    }
);


// =====================================================
// GALLERY
// =====================================================

document
    .getElementById(
        "galleryBtn"
    )
    .addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "galleryInput"
                )
                .click();

        }
    );


document
    .getElementById(
        "galleryInput"
    )
    .addEventListener(
        "change",
        e => {

            const file =
                e.target.files[0];


            if (!file)
                return;


            selectedImage =
                file;


            document
                .getElementById(
                    "imagePreview"
                )
                .src =
                URL.createObjectURL(
                    file
                );


            document
                .getElementById(
                    "imagePreview"
                )
                .style.display =
                "block";


            document
                .getElementById(
                    "fileName"
                )
                .textContent =
                file.name;

        }
    );


// =====================================================
// CAMERA
// =====================================================

document
    .getElementById(
        "cameraBtn"
    )
    .addEventListener(
        "click",
        async () => {

            try {

                stream =
                    await navigator
                        .mediaDevices
                        .getUserMedia({

                            video: {

                                facingMode:
                                    "environment"

                            }

                        });


                document
                    .getElementById(
                        "camera"
                    )
                    .srcObject =
                    stream;


                document
                    .getElementById(
                        "cameraContainer"
                    )
                    .style.display =
                    "block";

            }

            catch (error) {

                console.error(
                    error
                );

                alert(
                    "Unable to access camera."
                );

            }

        }
    );


// =====================================================
// CAPTURE PHOTO
// =====================================================

document
    .getElementById(
        "capturePhoto"
    )
    .addEventListener(
        "click",
        () => {

            const video =
                document.getElementById(
                    "camera"
                );


            const canvas =
                document.getElementById(
                    "canvas"
                );


            if (
                !video.videoWidth
            ) {

                alert(
                    "Camera is not ready yet."
                );

                return;

            }


            canvas.width =
                video.videoWidth;


            canvas.height =
                video.videoHeight;


            const ctx =
                canvas.getContext(
                    "2d"
                );


            ctx.drawImage(
                video,
                0,
                0
            );


            canvas.toBlob(
                blob => {

                    if (!blob)
                        return;


                    selectedImage =
                        blob;


                    document
                        .getElementById(
                            "imagePreview"
                        )
                        .src =
                        URL.createObjectURL(
                            blob
                        );


                    document
                        .getElementById(
                            "imagePreview"
                        )
                        .style.display =
                        "block";


                    document
                        .getElementById(
                            "fileName"
                        )
                        .textContent =
                        "Captured Image";


                    stopCamera();

                },
                "image/png"
            );

        }
    );


// =====================================================
// CLOSE CAMERA
// =====================================================

document
    .getElementById(
        "closeCamera"
    )
    .addEventListener(
        "click",
        stopCamera
    );


function stopCamera() {

    if (stream) {

        stream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        stream = null;

    }


    document
        .getElementById(
            "cameraContainer"
        )
        .style.display =
        "none";

}


// =====================================================
// PRICE VALIDATION
// =====================================================

function validatePrices() {

    const buying =
        Number(
            document
                .getElementById(
                    "buyingPrice"
                )
                .value
        ) || 0;


    const min =
        Number(
            document
                .getElementById(
                    "minSellingPrice"
                )
                .value
        ) || 0;


    const max =
        Number(
            document
                .getElementById(
                    "maxSellingPrice"
                )
                .value
        ) || 0;


    const minInput =
        document.getElementById(
            "minSellingPrice"
        );


    const maxInput =
        document.getElementById(
            "maxSellingPrice"
        );


    if (
        min < buying
    ) {

        minInput.style.border =
            "2px solid red";

    }
    else {

        minInput.style.border =
            "";

    }


    if (
        max < min
    ) {

        maxInput.style.border =
            "2px solid red";

    }
    else {

        maxInput.style.border =
            "";

    }

}


[
    "buyingPrice",
    "minSellingPrice",
    "maxSellingPrice"
].forEach(id => {

    document
        .getElementById(id)
        .addEventListener(
            "input",
            validatePrices
        );

});


// =====================================================
// QUANTITY VALIDATION
// =====================================================

document
    .getElementById(
        "quantity"
    )
    .addEventListener(
        "input",
        e => {

            if (
                Number(
                    e.target.value
                ) < 0
            ) {

                e.target.value =
                    0;

            }

        }
    );


document
    .getElementById(
        "minimumStock"
    )
    .addEventListener(
        "input",
        e => {

            if (
                Number(
                    e.target.value
                ) < 0
            ) {

                e.target.value =
                    0;

            }

        }
    );


// =====================================================
// LOGOUT
// =====================================================

document
    .getElementById(
        "logoutBtn"
    )
    .addEventListener(
        "click",
        async e => {

            e.preventDefault();


            if (
                confirm(
                    "Logout from the system?"
                )
            ) {

                await signOut(
                    auth
                );


                window.location.href =
                    "login.html";

            }

        }
    );


// =====================================================
// LOW STOCK REPORT
// =====================================================

function generateLowStockReport() {

    const lowStockProducts =
        products.filter(
            product => {

                const quantity =
                    Number(
                        product.quantity ||
                        0
                    );


                const minimum =
                    Number(
                        product.minimumStock ||
                        5
                    );


                return (
                    quantity <=
                    minimum
                );

            }
        );


    if (
        lowStockProducts.length ===
        0
    ) {

        alert(
            "No low stock products found."
        );

        return;

    }


    let html = `

        <!DOCTYPE html>

        <html>

        <head>

            <title>
                Low Stock Report
            </title>

            <style>

                body{
                    font-family:Arial;
                    padding:30px;
                    color:#333;
                }

                h1,h2{
                    text-align:center;
                }

                table{
                    width:100%;
                    border-collapse:collapse;
                    margin-top:20px;
                }

                th,td{
                    border:1px solid #999;
                    padding:10px;
                    text-align:left;
                }

                th{
                    background:#1565c0;
                    color:#fff;
                }

            </style>

        </head>

        <body>

            <h1>
                LEBARTO ELECTRONICS
            </h1>

            <h2>
                LOW STOCK REPORT
            </h2>

            <p>

                <strong>Date:</strong>

                ${new Date().toLocaleString()}

            </p>

            <table>

                <tr>

                    <th>No.</th>

                    <th>Barcode</th>

                    <th>Product</th>

                    <th>Category</th>

                    <th>Supplier</th>

                    <th>Buying Price</th>

                    <th>Selling Price</th>

                    <th>Quantity</th>

                    <th>Minimum</th>

                    <th>Status</th>

                </tr>

    `;


    lowStockProducts.forEach(
        (product, index) => {

            html += `

                <tr>

                    <td>
                        ${index + 1}
                    </td>

                    <td>
                        ${product.barcode || "-"}
                    </td>

                    <td>
                        ${product.name}
                    </td>

                    <td>
                        ${product.category || "-"}
                    </td>

                    <td>
                        ${product.supplier || "-"}
                    </td>

                    <td>
                        KSh ${
                            Number(
                                product.buyingPrice ||
                                0
                            ).toLocaleString()
                        }
                    </td>

                    <td>
                        KSh ${
                            Number(
                                product.minSellingPrice ||
                                0
                            ).toLocaleString()
                        }

                        -

                        KSh ${
                            Number(
                                product.maxSellingPrice ||
                                0
                            ).toLocaleString()
                        }
                    </td>

                    <td>
                        ${product.quantity}
                    </td>

                    <td>
                        ${product.minimumStock}
                    </td>

                    <td>
                        LOW STOCK
                    </td>

                </tr>

            `;

        }
    );


    html += `

            </table>

            <p>

                <strong>
                    Total Low Stock Products:
                </strong>

                ${lowStockProducts.length}

            </p>

        </body>

        </html>

    `;


    reportWindow =
        window.open(
            "",
            "_blank"
        );


    reportWindow.document.open();

    reportWindow.document.write(
        html
    );

    reportWindow.document.close();


    document
        .getElementById(
            "printLowStockBtn"
        )
        .disabled =
        false;


    document
        .getElementById(
            "downloadLowStockBtn"
        )
        .disabled =
        false;

}


// =====================================================
// PRINT LOW STOCK
// =====================================================

function printLowStockReport() {

    if (
        !reportWindow ||
        reportWindow.closed
    ) {

        alert(
            "Generate the report first."
        );

        return;

    }


    reportWindow.focus();

    reportWindow.print();

}


// =====================================================
// LOW STOCK PDF
// =====================================================

async function downloadLowStockPDF() {

    const lowStockProducts =
        products.filter(
            product => {

                const qty =
                    Number(
                        product.quantity ||
                        0
                    );


                const minimum =
                    Number(
                        product.minimumStock ||
                        5
                    );


                return (
                    qty <=
                    minimum
                );

            }
        );


    if (
        lowStockProducts.length ===
        0
    ) {

        alert(
            "No low stock products found."
        );

        return;

    }


    const {
        jsPDF
    } =
        window.jspdf;


    const pdf =
        new jsPDF();


    pdf.setFontSize(18);

    pdf.text(
        "LEBARTO ELECTRONICS",
        14,
        15
    );


    pdf.setFontSize(14);

    pdf.text(
        "LOW STOCK REPORT",
        14,
        25
    );


    pdf.autoTable({

        startY: 35,

        head: [[
            "No",
            "Barcode",
            "Product",
            "Category",
            "Supplier",
            "Buying",
            "Min Selling",
            "Max Selling",
            "Qty",
            "Minimum"
        ]],

        body:
            lowStockProducts.map(
                (product, index) => [

                    index + 1,

                    product.barcode || "-",

                    product.name,

                    product.category || "-",

                    product.supplier || "-",

                    "KSh " +
                    Number(
                        product.buyingPrice ||
                        0
                    ).toLocaleString(),

                    "KSh " +
                    Number(
                        product.minSellingPrice ||
                        0
                    ).toLocaleString(),

                    "KSh " +
                    Number(
                        product.maxSellingPrice ||
                        0
                    ).toLocaleString(),

                    product.quantity,

                    product.minimumStock

                ]
            )

    });


    pdf.save(
        "Low_Stock_Report.pdf"
    );

}


// =====================================================
// LOW STOCK BUTTONS
// =====================================================

document
    .getElementById(
        "generateLowStockBtn"
    )
    .addEventListener(
        "click",
        generateLowStockReport
    );


document
    .getElementById(
        "printLowStockBtn"
    )
    .addEventListener(
        "click",
        printLowStockReport
    );


document
    .getElementById(
        "downloadLowStockBtn"
    )
    .addEventListener(
        "click",
        downloadLowStockPDF
    );


// =====================================================
// PRICE REPORT
// =====================================================

function generatePriceReport() {

    if (
        products.length ===
        0
    ) {

        alert(
            "No products found."
        );

        return;

    }


    let html = `

        <!DOCTYPE html>

        <html>

        <head>

            <title>
                Product Price Report
            </title>

            <style>

                body{
                    font-family:Arial;
                    padding:30px;
                }

                table{
                    width:100%;
                    border-collapse:collapse;
                    margin-top:20px;
                }

                th,td{
                    border:1px solid #999;
                    padding:10px;
                }

                th{
                    background:#1565c0;
                    color:#fff;
                }

            </style>

        </head>

        <body>

            <h1>
                LEBARTO ELECTRONICS
            </h1>

            <h2>
                PRODUCT PRICE REPORT
            </h2>

            <p>

                Date:
                ${new Date().toLocaleString()}

            </p>

            <table>

                <tr>

                    <th>No</th>

                    <th>Barcode</th>

                    <th>Product</th>

                    <th>Category</th>

                    <th>Supplier</th>

                    <th>Buying Price</th>

                    <th>Min Selling</th>

                    <th>Max Selling</th>

                    <th>Stock</th>

                </tr>

    `;


    products.forEach(
        (product, index) => {

            html += `

                <tr>

                    <td>
                        ${index + 1}
                    </td>

                    <td>
                        ${product.barcode || "-"}
                    </td>

                    <td>
                        ${product.name}
                    </td>

                    <td>
                        ${product.category || "-"}
                    </td>

                    <td>
                        ${product.supplier || "-"}
                    </td>

                    <td>
                        KSh ${
                            Number(
                                product.buyingPrice ||
                                0
                            ).toLocaleString()
                        }
                    </td>

                    <td>
                        KSh ${
                            Number(
                                product.minSellingPrice ||
                                0
                            ).toLocaleString()
                        }
                    </td>

                    <td>
                        KSh ${
                            Number(
                                product.maxSellingPrice ||
                                0
                            ).toLocaleString()
                        }
                    </td>

                    <td>
                        ${product.quantity}
                    </td>

                </tr>

            `;

        }
    );


    html += `

            </table>

            <p>

                Total Products:
                ${products.length}

            </p>

        </body>

        </html>

    `;


    priceReportWindow =
        window.open(
            "",
            "_blank"
        );


    priceReportWindow.document.open();

    priceReportWindow.document.write(
        html
    );

    priceReportWindow.document.close();


    document
        .getElementById(
            "printPriceReportBtn"
        )
        .disabled =
        false;


    document
        .getElementById(
            "downloadPriceReportBtn"
        )
        .disabled =
        false;

}


// =====================================================
// PRINT PRICE REPORT
// =====================================================

function printPriceReport() {

    if (
        !priceReportWindow ||
        priceReportWindow.closed
    ) {

        alert(
            "Generate the report first."
        );

        return;

    }


    priceReportWindow.focus();

    priceReportWindow.print();

}


// =====================================================
// DOWNLOAD PRICE REPORT PDF
// =====================================================

async function downloadPriceReportPDF() {

    if (
        products.length ===
        0
    ) {

        alert(
            "No products found."
        );

        return;

    }


    const {
        jsPDF
    } =
        window.jspdf;


    const pdf =
        new jsPDF(
            "landscape"
        );


    pdf.setFontSize(18);

    pdf.text(
        "LEBARTO ELECTRONICS",
        14,
        15
    );


    pdf.setFontSize(14);

    pdf.text(
        "PRODUCT PRICE REPORT",
        14,
        25
    );


    pdf.autoTable({

        startY: 35,

        head: [[
            "No",
            "Barcode",
            "Product",
            "Category",
            "Supplier",
            "Buying",
            "Min Selling",
            "Max Selling",
            "Stock"
        ]],

        body:
            products.map(
                (product, index) => [

                    index + 1,

                    product.barcode || "-",

                    product.name,

                    product.category || "-",

                    product.supplier || "-",

                    "KSh " +
                    Number(
                        product.buyingPrice ||
                        0
                    ).toLocaleString(),

                    "KSh " +
                    Number(
                        product.minSellingPrice ||
                        0
                    ).toLocaleString(),

                    "KSh " +
                    Number(
                        product.maxSellingPrice ||
                        0
                    ).toLocaleString(),

                    product.quantity

                ]
            )

    });


    pdf.save(
        "Product_Price_Report.pdf"
    );

}


// =====================================================
// PRICE REPORT BUTTONS
// =====================================================

document
    .getElementById(
        "generatePriceReportBtn"
    )
    .addEventListener(
        "click",
        generatePriceReport
    );


document
    .getElementById(
        "printPriceReportBtn"
    )
    .addEventListener(
        "click",
        printPriceReport
    );


document
    .getElementById(
        "downloadPriceReportBtn"
    )
    .addEventListener(
        "click",
        downloadPriceReportPDF
    );


// =====================================================
// MODULE LOADED
// =====================================================

console.log(
    "LEBARTO PRODUCTS MODULE LOADED SUCCESSFULLY."
);
