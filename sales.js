
// =====================================================
// LEBARTO ELECTRONICS - SALES.JS
// All-record statistics • Paginated sales table
// Search • Date/payment filters • Receipts • Logout
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
    orderBy,
    limit,
    startAfter
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// =====================================================
// CONFIGURATION AND GLOBALS
// =====================================================

const PAGE_SIZE = 50;

let sales = [];
let allSales = [];
let filteredSales = [];
let selectedSale = null;
let lastDocument = null;
let loadingSales = false;
let allSalesLoaded = false;
let authReady = false;

// =====================================================
// AUTHENTICATION
// =====================================================

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    if (authReady) return;
    authReady = true;

    await loadAllSales();
});

// =====================================================
// LOAD ALL SALES FOR ACCURATE STATISTICS
// =====================================================

async function loadAllSales() {
    const table = document.getElementById("salesTable");

    if (table) {
        table.innerHTML =
            '<tr><td colspan="10">Loading sales...</td></tr>';
    }

    try {
        const snapshot = await getDocs(collection(db, "sales"));

        allSales = snapshot.docs.map((d) => ({
            ...d.data(),
            id: d.id
        }));

        // Sort locally so missing dates do not exclude sales.
        allSales.sort((a, b) => {
            const dateA = getSaleDate(a)?.getTime() || 0;
            const dateB = getSaleDate(b)?.getTime() || 0;
            return dateB - dateA;
        });

        updateStatistics(allSales);
        updateMonthlySales(allSales);

        console.log("Total Firestore sales:", allSales.length);
        console.log("Sample sale:", allSales[0] || "No sale documents");

        await loadSales(true);

    } catch (error) {
        console.error("Unable to load all sales:", error);

        if (table) {
            table.innerHTML = `
                <tr>
                    <td colspan="10">
                        Failed to load sales:
                        ${escapeHTML(error.message)}
                    </td>
                </tr>
            `;
        }

        setText("totalSales", "Unavailable");
        setText("todaySales", "Unavailable");
        setText("currentMonthSales", "Unavailable");

        alert("Unable to read Firestore sales: " + error.message);
    }
}

// =====================================================
// LOAD TABLE IN PAGES OF 50
// =====================================================

async function loadSales(reset = false) {
    if (loadingSales || (!reset && allSalesLoaded)) return;

    loadingSales = true;
    updateLoadMoreButton();

    const table = document.getElementById("salesTable");

    if (reset) {
        sales = [];
        filteredSales = [];
        lastDocument = null;
        allSalesLoaded = false;

        if (table) {
            table.innerHTML =
                '<tr><td colspan="10">Loading sales...</td></tr>';
        }
    }

    try {
        const salesCollection = collection(db, "sales");

        const salesQuery = lastDocument
            ? query(
                salesCollection,
                orderBy("date", "desc"),
                startAfter(lastDocument),
                limit(PAGE_SIZE)
            )
            : query(
                salesCollection,
                orderBy("date", "desc"),
                limit(PAGE_SIZE)
            );

        const snapshot = await getDocs(salesQuery);

        if (!snapshot.empty) {
            lastDocument = snapshot.docs[snapshot.docs.length - 1];

            const existingIds = new Set(sales.map((sale) => sale.id));

            for (const d of snapshot.docs) {
                if (!existingIds.has(d.id)) {
                    sales.push({
                        ...d.data(),
                        id: d.id
                    });
                }
            }
        }

        if (snapshot.size < PAGE_SIZE) {
            allSalesLoaded = true;
        }

        filterSales();

        console.log(
            `Sales table loaded: ${sales.length}; batch: ${snapshot.size}`
        );

    } catch (error) {
        console.error("Sales page loading error:", error);

        if (table) {
            table.innerHTML = `
                <tr>
                    <td colspan="10">
                        Error loading sales table:
                        ${escapeHTML(error.message)}
                    </td>
                </tr>
            `;
        }

        alert("Unable to load the sales table: " + error.message);

    } finally {
        loadingSales = false;
        updateLoadMoreButton();
    }
}

// =====================================================
// LOAD MORE BUTTON
// =====================================================

function updateLoadMoreButton() {
    const button = document.getElementById("loadMoreSalesBtn");
    if (!button) return;

    button.disabled = loadingSales || allSalesLoaded;

    button.textContent = loadingSales
        ? "Loading..."
        : allSalesLoaded
            ? "All Sales Loaded"
            : "Load More Sales";
}

document.getElementById("loadMoreSalesBtn")
    ?.addEventListener("click", () => loadSales(false));

// =====================================================
// NUMBER AND MONEY HELPERS
// =====================================================

function numberValue(value) {
    if (value == null || value === "") return 0;

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "object" && value.toNumber) {
        return numberValue(value.toNumber());
    }

    const result = Number(
        String(value)
            .replace(/,/g, "")
            .replace(/KSh/gi, "")
            .trim()
    );

    return Number.isFinite(result) ? result : 0;
}

function money(value) {
    return "KSh " + numberValue(value).toLocaleString("en-KE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

// =====================================================
// DATE HELPERS
// =====================================================

function getSaleDate(sale) {
    const value =
        sale?.date ??
        sale?.createdAt ??
        sale?.saleDate ??
        sale?.timestamp ??
        null;

    if (value == null) return null;

    try {
        let date;

        if (typeof value.toDate === "function") {
            date = value.toDate();
        } else if (typeof value.seconds === "number") {
            date = new Date(value.seconds * 1000);
        } else if (value instanceof Date) {
            date = value;
        } else if (typeof value === "number") {
            date = new Date(
                value < 100000000000 ? value * 1000 : value
            );
        } else {
            date = new Date(value);
        }

        return Number.isNaN(date.getTime()) ? null : date;
    } catch (error) {
        console.error("Invalid sale date:", error);
        return null;
    }
}

function isToday(date) {
    if (!date) return false;

    const now = new Date();

    return date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
}

function isCurrentMonth(date) {
    if (!date) return false;

    const now = new Date();

    return date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth();
}

// =====================================================
// SALE TOTALS
// =====================================================

function getSaleTotal(sale) {
    if (sale?.total != null && sale.total !== "") {
        return Math.max(0, numberValue(sale.total));
    }

    if (sale?.grandTotal != null && sale.grandTotal !== "") {
        return Math.max(0, numberValue(sale.grandTotal));
    }

    if (sale?.subtotal != null && sale.subtotal !== "") {
        return Math.max(
            0,
            numberValue(sale.subtotal) - numberValue(sale.discount)
        );
    }

    if (!Array.isArray(sale?.items)) return 0;

    return sale.items.reduce((sum, item) => {
        const total = item?.total != null
            ? numberValue(item.total)
            : numberValue(item?.price ?? item?.sellingPrice) *
              numberValue(item?.quantity);

        return sum + total;
    }, 0);
}

// =====================================================
// PAYMENT HELPERS
// =====================================================

function normalizePaymentMethod(method) {
    const value = String(method || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, "");

    if (value.includes("kopokopo")) return "kopokopo";
    if (value.includes("mpesa")) return "mpesa";

    return value;
}

function getSavedPaymentMethods(sale) {
    const saved =
        sale?.paymentMethods ??
        sale?.paymentMethod ??
        sale?.paymentMethodsUsed ??
        [];

    const methods = Array.isArray(saved)
        ? saved
        : typeof saved === "string"
            ? saved.split(",")
            : [];

    return methods.map((method) => String(method).trim()).filter(Boolean);
}

function getPaymentAmounts(sale) {
    let cash = numberValue(sale?.cashAmount);
    let mpesa = numberValue(sale?.mpesaAmount ?? sale?.mPesaAmount);
    let bank = numberValue(sale?.bankAmount);

    let kopoKopo = numberValue(
        sale?.kopokopoAmount ??
        sale?.kopoKopoAmount ??
        sale?.kopoAmount ??
        sale?.kopoKopoPaid
    );

    const savedPaid = numberValue(sale?.amountPaid ?? sale?.paidAmount);
    const methods = getSavedPaymentMethods(sale);

    if (cash + mpesa + bank + kopoKopo === 0 &&
        savedPaid > 0 && methods.length === 1) {
        const method = normalizePaymentMethod(methods[0]);

        if (method === "cash") cash = savedPaid;
        else if (method === "mpesa") mpesa = savedPaid;
        else if (method === "bank") bank = savedPaid;
        else if (method === "kopokopo") kopoKopo = savedPaid;
    }

    return {
        cash,
        mpesa,
        bank,
        kopoKopo,
        totalPaid: savedPaid > 0
            ? savedPaid
            : cash + mpesa + bank + kopoKopo
    };
}

function getAmountPaid(sale) {
    return getPaymentAmounts(sale).totalPaid;
}

function getBalance(sale) {
    if (sale?.balance != null && sale.balance !== "") {
        return Math.max(0, numberValue(sale.balance));
    }

    return Math.max(0, getSaleTotal(sale) - getAmountPaid(sale));
}

function getChange(sale) {
    if (sale?.change != null && sale.change !== "") {
        return Math.max(0, numberValue(sale.change));
    }

    return Math.max(0, getAmountPaid(sale) - getSaleTotal(sale));
}

function getPaymentMethods(sale) {
    const amounts = getPaymentAmounts(sale);
    const methods = [];

    if (amounts.cash > 0) methods.push("Cash");
    if (amounts.mpesa > 0) methods.push("M-Pesa");
    if (amounts.bank > 0) methods.push("Bank");
    if (amounts.kopoKopo > 0) methods.push("Kopo Kopo");

    return methods.length ? methods : getSavedPaymentMethods(sale);
}

function getPaymentBreakdownHTML(sale) {
    const amounts = getPaymentAmounts(sale);

    const payments = [
        ["Cash", amounts.cash],
        ["M-Pesa", amounts.mpesa],
        ["Bank", amounts.bank],
        ["Kopo Kopo", amounts.kopoKopo]
    ];

    const rows = payments
        .filter(([, amount]) => amount > 0)
        .map(([name, amount]) => `
            <div class="payment-line">
                <span>${name}</span>
                <strong>${money(amount)}</strong>
            </div>
        `);

    return rows.length
        ? rows.join("")
        : getSavedPaymentMethods(sale)
            .map((method) => `<span>${escapeHTML(method)}</span>`)
            .join(", ") || "-";
}

// =====================================================
// STATISTICS — ALWAYS USE ALL FIRESTORE SALES
// =====================================================

function updateStatistics(data) {
    let total = 0;
    let todayTotal = 0;

    data.forEach((sale) => {
        const amount = getSaleTotal(sale);
        total += amount;

        if (isToday(getSaleDate(sale))) {
            todayTotal += amount;
        }
    });

    setText("totalSales", money(total));
    setText("totalTransactions", data.length);
    setText("todaySales", money(todayTotal));
}

function updateMonthlySales(data) {
    const now = new Date();

    const monthName = now.toLocaleString("en", {
        month: "long"
    });

    setText("currentMonthName", monthName);
    setText(
        "monthlySalesYear",
        `${monthName} ${now.getFullYear()} sales summary`
    );

    let total = 0;
    let transactions = 0;
    let items = 0;

    data.forEach((sale) => {
        if (!isCurrentMonth(getSaleDate(sale))) return;

        total += getSaleTotal(sale);
        transactions++;

        if (Array.isArray(sale.items)) {
            sale.items.forEach((item) => {
                items += numberValue(item?.quantity);
            });
        }
    });

    setText("currentMonthSales", money(total));
    setText("currentMonthTransactions", transactions);
    setText("currentMonthItems", items);
}

// =====================================================
// DISPLAY SALES TABLE
// =====================================================

function displaySales(data) {
    const table = document.getElementById("salesTable");
    if (!table) return;

    if (!data.length) {
        table.innerHTML = `
            <tr><td colspan="10">No sales found.</td></tr>
        `;
        return;
    }

    table.innerHTML = data.map((sale, index) => {
        const date = getSaleDate(sale);

        const productsHTML = Array.isArray(sale.items)
            ? sale.items.map((item) => `
                <div class="sale-product">
                    <strong>${escapeHTML(item?.name || "Unknown Product")}</strong>
                    <span>× ${numberValue(item?.quantity)}</span>
                </div>
            `).join("")
            : "-";

        return `
            <tr>
                <td>${index + 1}</td>
                <td class="products-column">${productsHTML || "-"}</td>
                <td>${escapeHTML(sale.receiptNo || sale.id.slice(0, 8))}</td>
                <td>${escapeHTML(sale.customerName || "Walk-in Customer")}</td>
                <td>${escapeHTML(sale.cashier || "-")}</td>
                <td>
                    <div class="payment-breakdown">
                        ${getPaymentBreakdownHTML(sale)}
                    </div>
                </td>
                <td>${money(getSaleTotal(sale))}</td>
                <td>${money(getAmountPaid(sale))}</td>
                <td>${date ? escapeHTML(date.toLocaleString("en-KE")) : "N/A"}</td>
                <td>
                    <button class="view-btn"
                        data-sale-id="${escapeHTML(sale.id)}"
                        title="View Receipt"
                        aria-label="View receipt">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    table.querySelectorAll("[data-sale-id]").forEach((button) => {
        button.addEventListener("click", () => {
            viewSale(button.dataset.saleId);
        });
    });
}

// =====================================================
// SEARCH AND FILTERS
// =====================================================

function filterSales() {
    const text = (
        document.getElementById("searchSale")?.value || ""
    ).toLowerCase().trim();

    const payment = document.getElementById("paymentFilter")?.value || "";
    const dateValue = document.getElementById("dateFilter")?.value || "";

    filteredSales = sales.filter((sale) => {
        const productNames = Array.isArray(sale.items)
            ? sale.items.map((item) => item?.name || "").join(" ")
            : "";

        const searchable = [
            sale.customerName || "",
            sale.cashier || "",
            sale.receiptNo || "",
            sale.id,
            productNames,
            getPaymentMethods(sale).join(" ")
        ].join(" ").toLowerCase();

        const matchText = !text || searchable.includes(text);

        const matchPayment = !payment ||
            getPaymentMethods(sale).some((method) =>
                normalizePaymentMethod(method) ===
                normalizePaymentMethod(payment)
            );

        const date = getSaleDate(sale);

        const matchDate = !dateValue || (
            date &&
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` === dateValue
        );

        return matchText && matchPayment && matchDate;
    });

    displaySales(filteredSales);

    // Keep headline totals independent of the table's loaded page.
    updateStatistics(allSales);
    updateMonthlySales(allSales);
}

document.getElementById("searchSale")
    ?.addEventListener("input", filterSales);

document.getElementById("paymentFilter")
    ?.addEventListener("change", filterSales);

document.getElementById("dateFilter")
    ?.addEventListener("change", filterSales);

// =====================================================
// VIEW RECEIPT
// =====================================================

function viewSale(id) {
    selectedSale =
        sales.find((sale) => sale.id === id) ||
        allSales.find((sale) => sale.id === id);

    if (!selectedSale) {
        alert("Sale not found.");
        return;
    }

    const date = getSaleDate(selectedSale);

    let html = `
        <h3>Lebarto Electronics</h3>
        <p><strong>Customer:</strong>
            ${escapeHTML(selectedSale.customerName || "Walk-in Customer")}</p>
        <p><strong>Cashier:</strong>
            ${escapeHTML(selectedSale.cashier || "-")}</p>
        <p><strong>Receipt:</strong>
            ${escapeHTML(selectedSale.receiptNo || selectedSale.id)}</p>
        <p><strong>Date:</strong>
            ${date ? escapeHTML(date.toLocaleString("en-KE")) : "N/A"}</p>
        <hr>
        <h4>Payment Breakdown</h4>
        ${getPaymentBreakdownHTML(selectedSale)}
        <p><strong>Total Paid:</strong> ${money(getAmountPaid(selectedSale))}</p>
        <p><strong>Total:</strong> ${money(getSaleTotal(selectedSale))}</p>
        <p><strong>Balance Due:</strong> ${money(getBalance(selectedSale))}</p>
        <p><strong>Change:</strong> ${money(getChange(selectedSale))}</p>
        <hr>
        <h4>Items Purchased</h4>
    `;

    if (Array.isArray(selectedSale.items) && selectedSale.items.length) {
        selectedSale.items.forEach((item) => {
            const itemTotal = item?.total != null
                ? numberValue(item.total)
                : numberValue(item?.price ?? item?.sellingPrice) *
                  numberValue(item?.quantity);

            html += `
                <div class="receipt-item">
                    <span>
                        ${escapeHTML(item?.name || "Unknown Product")}
                        × ${numberValue(item?.quantity)}
                    </span>
                    <span>${money(itemTotal)}</span>
                </div>
            `;
        });
    } else {
        html += "<p>No products recorded.</p>";
    }

    html += `
        <div class="receipt-total">
            Total: ${money(getSaleTotal(selectedSale))}
        </div>
    `;

    const details = document.getElementById("receiptDetails");
    if (details) details.innerHTML = html;

    const modal = document.getElementById("receiptModal");
    if (modal) modal.style.display = "flex";
}

window.viewSale = viewSale;

// =====================================================
// PRINT AND CLOSE RECEIPT
// =====================================================

document.getElementById("printReceiptBtn")
    ?.addEventListener("click", () => window.print());

document.getElementById("closeModal")
    ?.addEventListener("click", () => {
        const modal = document.getElementById("receiptModal");
        if (modal) modal.style.display = "none";
    });

document.getElementById("receiptModal")
    ?.addEventListener("click", (event) => {
        if (event.target.id === "receiptModal") {
            event.currentTarget.style.display = "none";
        }
    });

// =====================================================
// LOGOUT
// =====================================================

document.getElementById("logoutBtn")
    ?.addEventListener("click", async (event) => {
        event.preventDefault();

        try {
            await signOut(auth);
            window.location.href = "login.html";
        } catch (error) {
            console.error("Logout error:", error);
            alert("Unable to logout: " + error.message);
        }
    });

// =====================================================
// HTML ESCAPING
// =====================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

console.log("LEBARTO SALES MODULE LOADED — ALL-SALES STATISTICS.");
