// =====================================================
// LEBARTO ELECTRONICS
// PRODUCTS.JS
// PRODUCTS + RESTOCK + RESTOCK HISTORY
// ADMIN + CASHIER PERMISSIONS
// SEARCHABLE RESTOCK SELECTOR
// REPORTS + CAMERA + GALLERY
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
// DOM READY
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    initializeProductPage();

});


// =====================================================
// INITIALIZE
// =====================================================

function initializeProductPage() {

    setupProductButtons();

    setupRestockSearch();

    setupDateFilters();

    setupCameraAndGallery();

    setupPriceValidation();

    setupQuantityValidation();

    setupLogout();

    setupReportButtons();

}


// =====================================================
// AUTHENTICATION
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

        alert(
            "Unable to load user: " +
            error.message
        );

        return false;

    }

}


// =====================================================
// ROLE PERMISSIONS
// =====================================================

function applyRolePermissions() {

    const isAdmin =
        currentUserData?.role === "admin";

    const addButton =
        document.getElementById("addProductBtn");

    const restockModeButton =
        document.getElementById("restockModeBtn");

    const newProductModeButton =
        document.getElementById("newProductModeBtn");


    /*
     * BOTH ADMIN AND CASHIER CAN:
     * - Add new products
     * - Restock
     */


    if (addButton) {

        addButton.innerHTML = `

            <i class="fa-solid fa-plus"></i>

            Add Product

        `;

    }


    /*
     * Edit/delete buttons are controlled
     * when products are displayed.
     */


    if (restockModeButton) {

        restockModeButton.style.display =
            "inline-flex";

    }


    if (newProductModeButton) {

        newProductModeButton.style.display =
            "inline-flex";

    }


    /*
     * Extra protection:
     * If somehow a non-admin is in edit mode,
     * editing will still be rejected by saveProduct().
     */

    console.log(
        "Current role:",
        isAdmin ? "admin" : "cashier"
    );

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
        snapshot => {

            products = [];

            snapshot.forEach(productDoc => {

                products.push({

                    id: productDoc.id,

                    ...productDoc.data()

                });

            });

            filteredProducts =
                [...products];

            displayProducts(
                filteredProducts
            );

            updateStatistics();

            updateRestockDropdown(
                getRestockSearchValue()
            );

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
// GET RESTOCK SEARCH
// =====================================================

function getRestockSearchValue() {

    const input =
        document.getElementById(
            "restockProductSearch"
        );

    return input
        ? input.value
        : "";

}


// =====================================================
// DUPLICATE PRODUCTS
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

    if (!tbody) return;

    tbody.innerHTML = "";


    if (productArray.length === 0) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="10"
                    style="
                        text-align:center;
                        padding:30px;
                    "
                >

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

        else if (quantity <= minimum) {

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


        /*
         * RESTOCK IS AVAILABLE TO BOTH
         * ADMIN AND CASHIER.
         */

        let actions = `

            <button
                class="restock-btn"
                onclick="restockProduct('${product.id}')"
                type="button"
            >

                <i class="fa-solid fa-boxes-stacked"></i>

                Restock

            </button>

        `;


        /*
         * ONLY ADMIN GETS EDIT AND DELETE.
         */

        if (isAdmin) {

            actions += `

                <button
                    class="edit-btn"
                    onclick="editProduct('${product.id}')"
                    type="button"
                >

                    <i class="fa-solid fa-pen"></i>

                </button>


                <button
                    class="delete-btn"
                    onclick="deleteProduct('${product.id}')"
                    type="button"
                >

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
                }"
            >

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
                        alt="Product"
                    >

                </td>


                <td>

                    ${escapeHTML(
                        product.barcode || "-"
                    )}

                </td>


                <td>

                    ${escapeHTML(
                        product.name || "-"
                    )}

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

                    ${escapeHTML(
                        product.category || "-"
                    )}

                </td>


                <td>

                    ${escapeHTML(
                        product.supplier || "-"
                    )}

                </td>


                <td>

                    KSh
                    ${Number(
                        product.buyingPrice || 0
                    ).toLocaleString()}

                </td>


                <td>

                    KSh
                    ${Number(
                        product.minSellingPrice || 0
                    ).toLocaleString()}

                    -

                    KSh
                    ${Number(
                        product.maxSellingPrice || 0
                    ).toLocaleString()}

                </td>


                <td>

                    ${quantity}

                </td>


                <td>

                    <span
                        class="${statusClass}"
                    >

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
// STATISTICS
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


        if (quantity <= minimum) {

            lowStock++;

        }

    });


    const totalProductsElement =
        document.getElementById(
            "totalProducts"
        );


    const totalStockElement =
        document.getElementById(
            "totalStock"
        );


    const lowStockElement =
        document.getElementById(
            "lowStock"
        );


    const inventoryValueElement =
        document.getElementById(
            "inventoryValue"
        );


    if (totalProductsElement) {

        totalProductsElement.textContent =
            totalProducts;

    }


    if (totalStockElement) {

        totalStockElement.textContent =
            totalStock;

    }


    if (lowStockElement) {

        lowStockElement.textContent =
            lowStock;

    }


    if (inventoryValueElement) {

        inventoryValueElement.textContent =
            "KSh " +
            inventoryValue.toLocaleString();

    }

}


// =====================================================
// PRODUCT BUTTONS
// =====================================================

function setupProductButtons() {

    const addProductBtn =
        document.getElementById(
            "addProductBtn"
        );


    if (addProductBtn) {

        addProductBtn.addEventListener(
            "click",
            () => {

                resetForm();

                setNewProductMode();

                const title =
                    document.getElementById(
                        "modalTitle"
                    );

                if (title) {

                    title.textContent =
                        "Add New Product";

                }


                const modal =
                    document.getElementById(
                        "productModal"
                    );

                if (modal) {

                    modal.style.display =
                        "flex";

                }

            }
        );

    }


    const newProductModeBtn =
        document.getElementById(
            "newProductModeBtn"
        );


    if (newProductModeBtn) {

        newProductModeBtn.addEventListener(
            "click",
            () => {

                /*
                 * If switching from edit mode,
                 * reset editing first.
                 */

                editingProductId = null;

                setNewProductMode();

            }
        );

    }


    const restockModeBtn =
        document.getElementById(
            "restockModeBtn"
        );


    if (restockModeBtn) {

        restockModeBtn.addEventListener(
            "click",
            setRestockMode
        );

    }


    const productForm =
        document.getElementById(
            "productForm"
        );


    if (productForm) {

        productForm.addEventListener(
            "submit",
            saveProduct
        );

    }


    const saveRestockBtn =
        document.getElementById(
            "saveRestockBtn"
        );


    if (saveRestockBtn) {

        saveRestockBtn.addEventListener(
            "click",
            saveRestock
        );

    }


    const cancelBtn =
        document.getElementById(
            "cancelBtn"
        );


    if (cancelBtn) {

        cancelBtn.addEventListener(
            "click",
            closeModal
        );

    }


    const cancelRestockBtn =
        document.getElementById(
            "cancelRestockBtn"
        );


    if (cancelRestockBtn) {

        cancelRestockBtn.addEventListener(
            "click",
            closeModal
        );

    }


    const closeModalBtn =
        document.getElementById(
            "closeModal"
        );


    if (closeModalBtn) {

        closeModalBtn.addEventListener(
            "click",
            closeModal
        );

    }

}


// =====================================================
// NEW PRODUCT MODE
// =====================================================

function setNewProductMode() {

    const newBtn =
        document.getElementById(
            "newProductModeBtn"
        );


    const restockBtn =
        document.getElementById(
            "restockModeBtn"
        );


    const form =
        document.getElementById(
            "productForm"
        );


    const restockSection =
        document.getElementById(
            "restockSection"
        );


    const title =
        document.getElementById(
            "modalTitle"
        );


    if (newBtn) {

        newBtn.classList.add(
            "active"
        );

        newBtn.style.background =
            "#1565c0";

        newBtn.style.color =
            "#fff";

    }


    if (restockBtn) {

        restockBtn.classList.remove(
            "active"
        );

        restockBtn.style.background =
            "#e5e7eb";

        restockBtn.style.color =
            "#374151";

    }


    if (form) {

        form.style.display =
            "block";

    }


    if (restockSection) {

        restockSection.style.display =
            "none";

    }


    if (title) {

        title.textContent =
            editingProductId
                ? "Edit Product"
                : "Add New Product";

    }

}


// =====================================================
// RESTOCK MODE
// =====================================================

function setRestockMode() {

    /*
     * Restocking should never edit
     * the existing product fields.
     */

    editingProductId = null;


    const newBtn =
        document.getElementById(
            "newProductModeBtn"
        );


    const restockBtn =
        document.getElementById(
            "restockModeBtn"
        );


    const form =
        document.getElementById(
            "productForm"
        );


    const restockSection =
        document.getElementById(
            "restockSection"
        );


    const title =
        document.getElementById(
            "modalTitle"
        );


    if (restockBtn) {

        restockBtn.classList.add(
            "active"
        );

        restockBtn.style.background =
            "#1565c0";

        restockBtn.style.color =
            "#fff";

    }


    if (newBtn) {

        newBtn.classList.remove(
            "active"
        );

        newBtn.style.background =
            "#e5e7eb";

        newBtn.style.color =
            "#374151";

    }


    if (form) {

        form.style.display =
            "none";

    }


    if (restockSection) {

        restockSection.style.display =
            "block";

    }


    if (title) {

        title.textContent =
            "Restock Existing Product";

    }


    updateRestockDropdown("");


    const search =
        document.getElementById(
            "restockProductSearch"
        );


    if (search) {

        setTimeout(() => {

            search.focus();

            updateRestockDropdown(
                search.value
            );

            showRestockDropdown();

        }, 100);

    }

}


// =====================================================
// RESTOCK SEARCH
// =====================================================

function setupRestockSearch() {

    const searchInput =
        document.getElementById(
            "restockProductSearch"
        );


    const dropdown =
        document.getElementById(
            "restockDropdown"
        );


    if (!searchInput || !dropdown) {

        console.warn(
            "Restock search elements not found."
        );

        return;

    }


    searchInput.addEventListener(
        "focus",
        () => {

            updateRestockDropdown(
                searchInput.value
            );

            showRestockDropdown();

        }
    );


    searchInput.addEventListener(
        "click",
        () => {

            updateRestockDropdown(
                searchInput.value
            );

            showRestockDropdown();

        }
    );


    searchInput.addEventListener(
        "input",
        () => {

            updateRestockDropdown(
                searchInput.value
            );

            showRestockDropdown();

        }
    );


    searchInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                hideRestockDropdown();

            }

        }
    );

}


// =====================================================
// SHOW DROPDOWN
// =====================================================

function showRestockDropdown() {

    const dropdown =
        document.getElementById(
            "restockDropdown"
        );


    if (!dropdown) return;


    dropdown.style.display =
        "block";

    dropdown.style.visibility =
        "visible";

    dropdown.style.opacity =
        "1";

    dropdown.style.zIndex =
        "99999";

}


// =====================================================
// HIDE DROPDOWN
// =====================================================

function hideRestockDropdown() {

    const dropdown =
        document.getElementById(
            "restockDropdown"
        );


    if (!dropdown) return;


    dropdown.style.display =
        "none";

}


// =====================================================
// UPDATE RESTOCK DROPDOWN
// =====================================================

function updateRestockDropdown(
    searchTerm = ""
) {

    const dropdown =
        document.getElementById(
            "restockDropdown"
        );


    if (!dropdown) return;


    const search =
        String(searchTerm || "")
            .trim()
            .toLowerCase();


    if (
        !products ||
        products.length === 0
    ) {

        dropdown.innerHTML = `

            <div
                style="
                    padding:15px;
                    text-align:center;
                    color:#777;
                "
            >

                No products available.

            </div>

        `;

        return;

    }


    const matchingProducts =
        products.filter(product => {

            if (!search) {

                return true;

            }


            const name =
                String(
                    product.name || ""
                ).toLowerCase();


            const barcode =
                String(
                    product.barcode || ""
                ).toLowerCase();


            const category =
                String(
                    product.category || ""
                ).toLowerCase();


            const supplier =
                String(
                    product.supplier || ""
                ).toLowerCase();


            return (

                name.includes(search)

                ||

                barcode.includes(search)

                ||

                category.includes(search)

                ||

                supplier.includes(search)

            );

        });


    dropdown.innerHTML = "";


    if (
        matchingProducts.length === 0
    ) {

        dropdown.innerHTML = `

            <div
                style="
                    padding:15px;
                    text-align:center;
                    color:#777;
                "
            >

                No matching products found.

            </div>

        `;

        return;

    }


    matchingProducts.forEach(
        product => {

            const option =
                document.createElement(
                    "div"
                );


            option.className =
                "restock-option";


            option.style.display =
                "block";

            option.style.padding =
                "12px 15px";

            option.style.cursor =
                "pointer";

            option.style.borderBottom =
                "1px solid #eeeeee";

            option.style.background =
                "#ffffff";


            const name =
                escapeHTML(
                    product.name ||
                    "Unnamed Product"
                );


            const barcode =
                escapeHTML(
                    String(
                        product.barcode ||
                        ""
                    )
                );


            const category =
                escapeHTML(
                    product.category ||
                    ""
                );


            const supplier =
                escapeHTML(
                    product.supplier ||
                    ""
                );


            const quantity =
                Number(
                    product.quantity ||
                    0
                );


            option.innerHTML = `

                <div
                    style="
                        font-weight:700;
                        color:#222;
                        margin-bottom:5px;
                    "
                >

                    ${name}

                </div>


                <div
                    style="
                        font-size:13px;
                        color:#666;
                    "
                >

                    Stock:
                    <strong>
                        ${quantity}
                    </strong>


                    ${
                        barcode
                            ? `
                                &nbsp; | &nbsp;
                                Barcode:
                                ${barcode}
                              `
                            : ""
                    }


                    ${
                        category
                            ? `
                                &nbsp; | &nbsp;
                                ${category}
                              `
                            : ""
                    }


                    ${
                        supplier
                            ? `
                                &nbsp; | &nbsp;
                                ${supplier}
                              `
                            : ""
                    }

                </div>

            `;


            option.addEventListener(
                "mousedown",
                event => {

                    event.preventDefault();

                }
            );


            option.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    selectRestockProduct(
                        product
                    );

                }
            );


            option.addEventListener(
                "mouseenter",
                () => {

                    option.style.background =
                        "#f1f5f9";

                }
            );


            option.addEventListener(
                "mouseleave",
                () => {

                    option.style.background =
                        "#ffffff";

                }
            );


            dropdown.appendChild(
                option
            );

        }
    );


    showRestockDropdown();

}


// =====================================================
// SELECT RESTOCK PRODUCT
// =====================================================

function selectRestockProduct(product) {

    if (!product) return;


    const hiddenProduct =
        document.getElementById(
            "restockProduct"
        );


    const searchInput =
        document.getElementById(
            "restockProductSearch"
        );


    if (hiddenProduct) {

        hiddenProduct.value =
            product.id;

    }


    if (searchInput) {

        searchInput.value =
            product.name || "";

    }


    hideRestockDropdown();


    showSelectedProductInfo(
        product
    );


    const quantityInput =
        document.getElementById(
            "restockQuantity"
        );


    if (quantityInput) {

        quantityInput.focus();

    }

}


// =====================================================
// SELECTED PRODUCT INFO
// =====================================================

function showSelectedProductInfo(
    product
) {

    const info =
        document.getElementById(
            "selectedProductInfo"
        );


    if (!info) return;


    if (!product) {

        info.innerHTML = `

            <p>
                Click the product field and type a product name to select a product.
            </p>

        `;

        return;

    }


    info.innerHTML = `

        <div
            style="
                display:grid;
                grid-template-columns:
                    repeat(3,1fr);
                gap:15px;
            "
        >

            <div>

                <strong>
                    Product
                </strong>

                <span
                    style="
                        display:block;
                        margin-top:5px;
                    "
                >

                    ${escapeHTML(
                        product.name || "-"
                    )}

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
                    "
                >

                    ${Number(
                        product.quantity || 0
                    )}

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
                    "
                >

                    ${escapeHTML(
                        product.category || "-"
                    )}

                </span>

            </div>

        </div>

    `;

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return String(value)

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
// CLOSE DROPDOWN OUTSIDE
// =====================================================

document.addEventListener(
    "click",
    event => {

        const selector =
            document.getElementById(
                "restockSelector"
            );


        if (!selector) return;


        if (
            !selector.contains(
                event.target
            )
        ) {

            hideRestockDropdown();

        }

    }
);


// =====================================================
// RESTOCK FROM TABLE
// =====================================================

window.restockProduct =
    function(id) {

        const product =
            products.find(
                product =>
                    product.id === id
            );


        if (!product) {

            alert(
                "Product not found."
            );

            return;

        }


        const modal =
            document.getElementById(
                "productModal"
            );


        if (modal) {

            modal.style.display =
                "flex";

        }


        setRestockMode();


        setTimeout(
            () => {

                selectRestockProduct(
                    product
                );

            },
            100
        );

    };


// =====================================================
// SAVE RESTOCK
// =====================================================

async function saveRestock() {

    const hiddenProduct =
        document.getElementById(
            "restockProduct"
        );


    const quantityInput =
        document.getElementById(
            "restockQuantity"
        );


    const productId =
        hiddenProduct
            ? hiddenProduct.value
            : "";


    const amount =
        quantityInput
            ? Number(
                quantityInput.value
            )
            : 0;


    if (!productId) {

        alert(
            "Please select a product from the search results."
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


        /*
         * UPDATE PRODUCT
         */

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


        /*
         * SAVE RESTOCK HISTORY
         */

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


        if (quantityInput) {

            quantityInput.value = "";

        }


        resetRestockSelector();

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
// RESET RESTOCK SELECTOR
// =====================================================

function resetRestockSelector() {

    const search =
        document.getElementById(
            "restockProductSearch"
        );


    const hidden =
        document.getElementById(
            "restockProduct"
        );


    const info =
        document.getElementById(
            "selectedProductInfo"
        );


    const quantity =
        document.getElementById(
            "restockQuantity"
        );


    if (search) {

        search.value = "";

    }


    if (hidden) {

        hidden.value = "";

    }


    if (quantity) {

        quantity.value = "";

    }


    hideRestockDropdown();


    const dropdown =
        document.getElementById(
            "restockDropdown"
        );


    if (dropdown) {

        dropdown.innerHTML = "";

    }


    if (info) {

        info.innerHTML = `

            <p>

                Click the product field and type a product name to select a product.

            </p>

        `;

    }

}


// =====================================================
// SAVE NEW PRODUCT / EDIT PRODUCT
// =====================================================

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
            !Number.isFinite(
                buyingPrice
            ) ||
            buyingPrice <= 0
        ) {

            alert(
                "Enter a valid buying price."
            );

            return;

        }


        if (
            !Number.isFinite(
                minSellingPrice
            ) ||
            minSellingPrice <= 0
        ) {

            alert(
                "Enter a valid minimum selling price."
            );

            return;

        }


        if (
            !Number.isFinite(
                maxSellingPrice
            ) ||
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
            quantity < 0 ||
            !Number.isInteger(quantity)
        ) {

            alert(
                "Quantity must be a whole number and cannot be negative."
            );

            return;

        }


        if (
            minimumStock < 0 ||
            !Number.isInteger(minimumStock)
        ) {

            alert(
                "Minimum stock must be a whole number and cannot be negative."
            );

            return;

        }


        /*
         * BARCODE DUPLICATE CHECK
         */

        if (barcode !== "") {

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


            const duplicate =
                barcodeSnapshot.docs.some(
                    item =>
                        item.id !==
                        editingProductId
                );


            if (duplicate) {

                alert(
                    "Barcode already exists."
                );

                return;

            }

        }


        /*
         * NAME + CATEGORY DUPLICATE CHECK
         */

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


        if (duplicateExists) {

            alert(
                "This product already exists. Use Restock instead."
            );

            return;

        }


        /*
         * IMAGE
         */

        let imageURL = "";


        if (editingProductId) {

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


        /*
         * PRODUCT DATA
         */

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


        /*
         * EDIT EXISTING PRODUCT
         *
         * ADMIN ONLY.
         */

        if (editingProductId) {

            if (
                currentUserData?.role !==
                "admin"
            ) {

                alert(
                    "Cashiers cannot edit existing products. Use Restock instead."
                );

                return;

            }


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


        /*
         * ADD NEW PRODUCT
         *
         * ADMIN + CASHIER.
         */

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


        /*
         * SAVE INITIAL STOCK HISTORY
         */

        if (quantity > 0) {

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
// ADMIN ONLY — EDIT
// =====================================================

window.editProduct =
    function(id) {

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


        selectedImage = "";


        const imagePreview =
            document.getElementById(
                "imagePreview"
            );


        const fileName =
            document.getElementById(
                "fileName"
            );


        if (product.image) {

            if (imagePreview) {

                imagePreview.src =
                    product.image;

                imagePreview.style.display =
                    "block";

            }


            if (fileName) {

                fileName.textContent =
                    "Current Image";

            }

        }

        else {

            if (imagePreview) {

                imagePreview.src =
                    "";

                imagePreview.style.display =
                    "none";

            }


            if (fileName) {

                fileName.textContent =
                    "No image selected";

            }

        }


        setNewProductMode();


        const modal =
            document.getElementById(
                "productModal"
            );


        if (modal) {

            modal.style.display =
                "flex";

        }

    };


// =====================================================
// ADMIN ONLY — DELETE
// =====================================================

window.deleteProduct =
    async function(id) {

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


            if (tbody) {

                tbody.innerHTML = `

                    <tr>

                        <td
                            colspan="8"
                            style="
                                text-align:center;
                                padding:30px;
                                color:red;
                            "
                        >

                            Unable to load restock history.

                        </td>

                    </tr>

                `;

            }

        }
    );

}


// =====================================================
// HISTORY DATE
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
// DISPLAY HISTORY
// =====================================================

function displayRestockHistory(
    historyArray
) {

    const tbody =
        document.getElementById(
            "restockHistoryTable"
        );


    if (!tbody) return;


    tbody.innerHTML = "";


    const sortedHistory =
        [...historyArray].sort(
            (a, b) => {

                const dateA =
                    getHistoryDate(a);


                const dateB =
                    getHistoryDate(b);


                if (
                    !dateA &&
                    !dateB
                )
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


    updateRestockSummary(
        sortedHistory
    );


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
                    "
                >

                    No restock history found
                    for the selected date range.

                </td>

            </tr>

        `;

        return;

    }


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
                        ${escapeHTML(
                            item.productName ||
                            "-"
                        )}
                    </td>


                    <td>
                        ${escapeHTML(
                            item.barcode ||
                            "-"
                        )}
                    </td>


                    <td>

                        <span
                            class="history-type ${typeClass}"
                        >

                            ${
                                item.type ||
                                "Restock"
                            }

                        </span>

                    </td>


                    <td>

                        ${Number(
                            item.previousQuantity ||
                            0
                        ).toLocaleString()}

                    </td>


                    <td
                        class="added-quantity"
                        style="
                            font-weight:700;
                            color:#2e7d32;
                        "
                    >

                        +${Number(
                            item.quantityAdded ||
                            0
                        ).toLocaleString()}

                    </td>


                    <td>

                        ${Number(
                            item.currentQuantity ||
                            0
                        ).toLocaleString()}

                    </td>


                    <td>

                        ${escapeHTML(
                            item.addedBy ||
                            "-"
                        )}

                    </td>

                </tr>

            `;

        }
    );

}


// =====================================================
// HISTORY SUMMARY
// =====================================================

function updateRestockSummary(
    historyArray
) {

    const totalRecords =
        historyArray.length;


    let totalQuantity = 0;


    historyArray.forEach(
        item => {

            totalQuantity +=
                Number(
                    item.quantityAdded ||
                    0
                );

        }
    );


    const recordsElement =
        document.getElementById(
            "restockTotalRecords"
        );


    const quantityElement =
        document.getElementById(
            "restockTotalQuantity"
        );


    if (recordsElement) {

        recordsElement.textContent =
            totalRecords.toLocaleString();

    }


    if (quantityElement) {

        quantityElement.textContent =
            totalQuantity.toLocaleString();

    }

}


// =====================================================
// DATE FILTERS
// =====================================================

function setupDateFilters() {

    const filterRestockBtn =
        document.getElementById(
            "filterRestockBtn"
        );


    if (filterRestockBtn) {

        filterRestockBtn.addEventListener(
            "click",
            filterRestockHistory
        );

    }


    const clearBtn =
        document.getElementById(
            "clearRestockFilterBtn"
        );


    if (clearBtn) {

        clearBtn.addEventListener(
            "click",
            clearRestockFilter
        );

    }


    [
        "restockFromDate",
        "restockToDate"
    ].forEach(
        id => {

            const input =
                document.getElementById(
                    id
                );


            if (!input) return;


            input.addEventListener(
                "keydown",
                e => {

                    if (
                        e.key === "Enter"
                    ) {

                        filterRestockHistory();

                    }

                }
            );

        }
    );

}


// =====================================================
// FILTER HISTORY
// =====================================================

function filterRestockHistory() {

    const fromInput =
        document.getElementById(
            "restockFromDate"
        );


    const toInput =
        document.getElementById(
            "restockToDate"
        );


    const fromValue =
        fromInput
            ? fromInput.value
            : "";


    const toValue =
        toInput
            ? toInput.value
            : "";


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


    let fromDate = null;
    let toDate = null;


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


                if (!historyDate) {

                    return (
                        !fromDate &&
                        !toDate
                    );

                }


                if (
                    fromDate &&
                    historyDate < fromDate
                ) {

                    return false;

                }


                if (
                    toDate &&
                    historyDate > toDate
                ) {

                    return false;

                }


                return true;

            }
        );


    displayRestockHistory(
        filteredRestockHistory
    );


    updateDateRangeLabel(
        fromValue,
        toValue
    );

}


// =====================================================
// CLEAR FILTER
// =====================================================

function clearRestockFilter() {

    const fromInput =
        document.getElementById(
            "restockFromDate"
        );


    const toInput =
        document.getElementById(
            "restockToDate"
        );


    if (fromInput) {

        fromInput.value = "";

    }


    if (toInput) {

        toInput.value = "";

    }


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


    if (!label) return;


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
            `From ${formatInputDate(
                fromValue
            )}`;

        return;

    }


    if (
        !fromValue &&
        toValue
    ) {

        label.textContent =
            `Up to ${formatInputDate(
                toValue
            )}`;

        return;

    }


    label.textContent =
        `${formatInputDate(
            fromValue
        )} → ${formatInputDate(
            toValue
        )}`;

}


// =====================================================
// FORMAT DATE
// =====================================================

function formatInputDate(value) {

    if (!value) return "";


    const [
        year,
        month,
        day
    ] =
        value.split("-");


    return `${day}/${month}/${year}`;

}


// =====================================================
// RESET FORM
// =====================================================

function resetForm() {

    editingProductId = null;

    selectedImage = "";


    const form =
        document.getElementById(
            "productForm"
        );


    if (form) {

        form.reset();

    }


    const imagePreview =
        document.getElementById(
            "imagePreview"
        );


    if (imagePreview) {

        imagePreview.src =
            "";

        imagePreview.style.display =
            "none";

    }


    const fileName =
        document.getElementById(
            "fileName"
        );


    if (fileName) {

        fileName.textContent =
            "No image selected";

    }


    const restockQuantity =
        document.getElementById(
            "restockQuantity"
        );


    if (restockQuantity) {

        restockQuantity.value =
            "";

    }


    resetRestockSelector();

    stopCamera();

}


// =====================================================
// CLOSE MODAL
// =====================================================

function closeModal() {

    resetForm();


    const modal =
        document.getElementById(
            "productModal"
        );


    if (modal) {

        modal.style.display =
            "none";

    }

}


// =====================================================
// MODAL CLICK
// =====================================================

window.addEventListener(
    "click",
    e => {

        const modal =
            document.getElementById(
                "productModal"
            );


        if (
            modal &&
            e.target === modal
        ) {

            closeModal();

        }

    }
);


// =====================================================
// ESCAPE MODAL
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
            modal &&
            modal.style.display ===
            "flex"
        ) {

            closeModal();

        }

    }
);


// =====================================================
// CAMERA + GALLERY
// =====================================================

function setupCameraAndGallery() {

    const galleryBtn =
        document.getElementById(
            "galleryBtn"
        );


    const galleryInput =
        document.getElementById(
            "galleryInput"
        );


    if (
        galleryBtn &&
        galleryInput
    ) {

        galleryBtn.addEventListener(
            "click",
            () => {

                galleryInput.click();

            }
        );


        galleryInput.addEventListener(
            "change",
            e => {

                const file =
                    e.target.files[0];


                if (!file) return;


                selectedImage =
                    file;


                const preview =
                    document.getElementById(
                        "imagePreview"
                    );


                if (preview) {

                    preview.src =
                        URL.createObjectURL(
                            file
                        );

                    preview.style.display =
                        "block";

                }


                const fileName =
                    document.getElementById(
                        "fileName"
                    );


                if (fileName) {

                    fileName.textContent =
                        file.name;

                }

            }
        );

    }


    const cameraBtn =
        document.getElementById(
            "cameraBtn"
        );


    if (cameraBtn) {

        cameraBtn.addEventListener(
            "click",
            openCamera
        );

    }


    const capturePhoto =
        document.getElementById(
            "capturePhoto"
        );


    if (capturePhoto) {

        capturePhoto.addEventListener(
            "click",
            captureCameraPhoto
        );

    }


    const closeCamera =
        document.getElementById(
            "closeCamera"
        );


    if (closeCamera) {

        closeCamera.addEventListener(
            "click",
            stopCamera
        );

    }

}


// =====================================================
// OPEN CAMERA
// =====================================================

async function openCamera() {

    try {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            alert(
                "Camera is not supported by this browser."
            );

            return;

        }


        stream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    video: {

                        facingMode:
                            "environment"

                    }

                });


        const camera =
            document.getElementById(
                "camera"
            );


        const container =
            document.getElementById(
                "cameraContainer"
            );


        if (camera) {

            camera.srcObject =
                stream;

        }


        if (container) {

            container.style.display =
                "block";

        }

    }

    catch (error) {

        console.error(
            "Camera error:",
            error
        );

        alert(
            "Unable to access camera. Please check your browser camera permission."
        );

    }

}


// =====================================================
// CAPTURE PHOTO
// =====================================================

function captureCameraPhoto() {

    const video =
        document.getElementById(
            "camera"
        );


    const canvas =
        document.getElementById(
            "canvas"
        );


    if (
        !video ||
        !canvas
    ) return;


    if (!video.videoWidth) {

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

            if (!blob) return;


            selectedImage =
                blob;


            const preview =
                document.getElementById(
                    "imagePreview"
                );


            if (preview) {

                preview.src =
                    URL.createObjectURL(
                        blob
                    );

                preview.style.display =
                    "block";

            }


            const fileName =
                document.getElementById(
                    "fileName"
                );


            if (fileName) {

                fileName.textContent =
                    "Captured Image";

            }


            stopCamera();

        },
        "image/png"
    );

}


// =====================================================
// STOP CAMERA
// =====================================================

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


    const container =
        document.getElementById(
            "cameraContainer"
        );


    if (container) {

        container.style.display =
            "none";

    }

}


// =====================================================
// PRICE VALIDATION
// =====================================================

function setupPriceValidation() {

    [

        "buyingPrice",

        "minSellingPrice",

        "maxSellingPrice"

    ].forEach(
        id => {

            const input =
                document.getElementById(
                    id
                );


            if (!input) return;


            input.addEventListener(
                "input",
                validatePrices
            );

        }
    );

}


function validatePrices() {

    const buying =
        Number(
            document
                .getElementById(
                    "buyingPrice"
                )?.value
        ) || 0;


    const min =
        Number(
            document
                .getElementById(
                    "minSellingPrice"
                )?.value
        ) || 0;


    const max =
        Number(
            document
                .getElementById(
                    "maxSellingPrice"
                )?.value
        ) || 0;


    const minInput =
        document.getElementById(
            "minSellingPrice"
        );


    const maxInput =
        document.getElementById(
            "maxSellingPrice"
        );


    if (minInput) {

        minInput.style.border =
            min < buying
                ? "2px solid red"
                : "";

    }


    if (maxInput) {

        maxInput.style.border =
            max < min
                ? "2px solid red"
                : "";

    }

}


// =====================================================
// QUANTITY VALIDATION
// =====================================================

function setupQuantityValidation() {

    const quantityInput =
        document.getElementById(
            "quantity"
        );


    if (quantityInput) {

        quantityInput.addEventListener(
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

    }


    const minimumStockInput =
        document.getElementById(
            "minimumStock"
        );


    if (minimumStockInput) {

        minimumStockInput.addEventListener(
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

    }


    const restockQuantity =
        document.getElementById(
            "restockQuantity"
        );


    if (restockQuantity) {

        restockQuantity.addEventListener(
            "input",
            e => {

                const value =
                    Number(
                        e.target.value
                    );


                if (
                    value < 1
                ) {

                    if (
                        e.target.value !== ""
                    ) {

                        e.target.value =
                            1;

                    }

                }

            }
        );

    }

}


// =====================================================
// LOGOUT
// =====================================================

function setupLogout() {

    const logoutBtn =
        document.getElementById(
            "logoutBtn"
        );


    if (!logoutBtn) return;


    logoutBtn.addEventListener(
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

}


// =====================================================
// LOW STOCK REPORT
// =====================================================

function generateLowStockReport() {

    const lowStockProducts =
        products.filter(
            product => {

                const quantity =
                    Number(
                        product.quantity || 0
                    );


                const minimum =
                    Number(
                        product.minimumStock || 5
                    );


                return quantity <= minimum;

            }
        );


    if (
        lowStockProducts.length === 0
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
                        ${escapeHTML(
                            product.barcode || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            product.name || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            product.category || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            product.supplier || "-"
                        )}
                    </td>

                    <td>
                        KSh ${Number(
                            product.buyingPrice || 0
                        ).toLocaleString()}
                    </td>

                    <td>
                        KSh ${Number(
                            product.minSellingPrice || 0
                        ).toLocaleString()}
                        -
                        KSh ${Number(
                            product.maxSellingPrice || 0
                        ).toLocaleString()}
                    </td>

                    <td>
                        ${Number(
                            product.quantity || 0
                        )}
                    </td>

                    <td>
                        ${Number(
                            product.minimumStock || 0
                        )}
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


    if (!reportWindow) {

        alert(
            "Please allow popups for this website."
        );

        return;

    }


    reportWindow.document.open();

    reportWindow.document.write(
        html
    );

    reportWindow.document.close();


    const printBtn =
        document.getElementById(
            "printLowStockBtn"
        );


    const downloadBtn =
        document.getElementById(
            "downloadLowStockBtn"
        );


    if (printBtn)
        printBtn.disabled =
            false;


    if (downloadBtn)
        downloadBtn.disabled =
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
// DOWNLOAD LOW STOCK PDF
// =====================================================

async function downloadLowStockPDF() {

    const lowStockProducts =
        products.filter(
            product => {

                const qty =
                    Number(
                        product.quantity || 0
                    );


                const minimum =
                    Number(
                        product.minimumStock || 5
                    );


                return qty <= minimum;

            }
        );


    if (
        lowStockProducts.length === 0
    ) {

        alert(
            "No low stock products found."
        );

        return;

    }


    if (!window.jspdf) {

        alert(
            "PDF library is not loaded."
        );

        return;

    }


    const { jsPDF } =
        window.jspdf;


    const pdf =
        new jsPDF();


    pdf.setFontSize(
        18
    );


    pdf.text(
        "LEBARTO ELECTRONICS",
        14,
        15
    );


    pdf.setFontSize(
        14
    );


    pdf.text(
        "LOW STOCK REPORT",
        14,
        25
    );


    if (
        typeof pdf.autoTable !==
        "function"
    ) {

        alert(
            "PDF table library is not loaded."
        );

        return;

    }


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
                (
                    product,
                    index
                ) => [

                    index + 1,

                    product.barcode || "-",

                    product.name,

                    product.category || "-",

                    product.supplier || "-",

                    "KSh " +
                    Number(
                        product.buyingPrice || 0
                    ).toLocaleString(),

                    "KSh " +
                    Number(
                        product.minSellingPrice || 0
                    ).toLocaleString(),

                    "KSh " +
                    Number(
                        product.maxSellingPrice || 0
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
// PRICE REPORT
// =====================================================

function generatePriceReport() {

    if (
        products.length === 0
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
                        ${escapeHTML(
                            product.barcode || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            product.name || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            product.category || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            product.supplier || "-"
                        )}
                    </td>

                    <td>
                        KSh ${Number(
                            product.buyingPrice || 0
                        ).toLocaleString()}
                    </td>

                    <td>
                        KSh ${Number(
                            product.minSellingPrice || 0
                        ).toLocaleString()}
                    </td>

                    <td>
                        KSh ${Number(
                            product.maxSellingPrice || 0
                        ).toLocaleString()}
                    </td>

                    <td>
                        ${Number(
                            product.quantity || 0
                        )}
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


    if (!priceReportWindow) {

        alert(
            "Please allow popups for this website."
        );

        return;

    }


    priceReportWindow.document.open();

    priceReportWindow.document.write(
        html
    );

    priceReportWindow.document.close();


    const printBtn =
        document.getElementById(
            "printPriceReportBtn"
        );


    const downloadBtn =
        document.getElementById(
            "downloadPriceReportBtn"
        );


    if (printBtn)
        printBtn.disabled =
            false;


    if (downloadBtn)
        downloadBtn.disabled =
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
// DOWNLOAD PRICE PDF
// =====================================================

async function downloadPriceReportPDF() {

    if (
        products.length === 0
    ) {

        alert(
            "No products found."
        );

        return;

    }


    if (!window.jspdf) {

        alert(
            "PDF library is not loaded."
        );

        return;

    }


    const { jsPDF } =
        window.jspdf;


    const pdf =
        new jsPDF(
            "landscape"
        );


    pdf.setFontSize(
        18
    );


    pdf.text(
        "LEBARTO ELECTRONICS",
        14,
        15
    );


    pdf.setFontSize(
        14
    );


    pdf.text(
        "PRODUCT PRICE REPORT",
        14,
        25
    );


    if (
        typeof pdf.autoTable !==
        "function"
    ) {

        alert(
            "PDF table library is not loaded."
        );

        return;

    }


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
                (
                    product,
                    index
                ) => [

                    index + 1,

                    product.barcode || "-",

                    product.name,

                    product.category || "-",

                    product.supplier || "-",

                    "KSh " +
                    Number(
                        product.buyingPrice || 0
                    ).toLocaleString(),

                    "KSh " +
                    Number(
                        product.minSellingPrice || 0
                    ).toLocaleString(),

                    "KSh " +
                    Number(
                        product.maxSellingPrice || 0
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
// REPORT BUTTONS
// =====================================================

function setupReportButtons() {

    const generateLowStockBtn =
        document.getElementById(
            "generateLowStockBtn"
        );


    if (generateLowStockBtn) {

        generateLowStockBtn.addEventListener(
            "click",
            generateLowStockReport
        );

    }


    const printLowStockBtn =
        document.getElementById(
            "printLowStockBtn"
        );


    if (printLowStockBtn) {

        printLowStockBtn.addEventListener(
            "click",
            printLowStockReport
        );

    }


    const downloadLowStockBtn =
        document.getElementById(
            "downloadLowStockBtn"
        );


    if (downloadLowStockBtn) {

        downloadLowStockBtn.addEventListener(
            "click",
            downloadLowStockPDF
        );

    }


    const generatePriceReportBtn =
        document.getElementById(
            "generatePriceReportBtn"
        );


    if (generatePriceReportBtn) {

        generatePriceReportBtn.addEventListener(
            "click",
            generatePriceReport
        );

    }


    const printPriceReportBtn =
        document.getElementById(
            "printPriceReportBtn"
        );


    if (printPriceReportBtn) {

        printPriceReportBtn.addEventListener(
            "click",
            printPriceReport
        );

    }


    const downloadPriceReportBtn =
        document.getElementById(
            "downloadPriceReportBtn"
        );


    if (downloadPriceReportBtn) {

        downloadPriceReportBtn.addEventListener(
            "click",
            downloadPriceReportPDF
        );

    }

}


// =====================================================
// MODULE LOADED
// =====================================================

console.log(
    "LEBARTO PRODUCTS MODULE LOADED SUCCESSFULLY."
);

console.log(
    "Products + Restock + History + Reports initialized."
);
