
 // =====================================================
 // LEBARTO ELECTRONICS
 // SALES.JS
 // SALES HISTORY • PRODUCTS • FILTER • RECEIPTS
 // CASH + M-PESA + BANK + KOPO KOPO
 // SPLIT PAYMENT SUPPORT
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
// AUTHENTICATION
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
        updateMonthlySales();

    } catch (error) {
        console.error("Error loading sales:", error);

        alert(
            "Unable to load sales: " + error.message
        );
    }
}


// =====================================================
// GET SALE DATE
// =====================================================

function getSaleDate(sale) {
    if (!sale || !sale.date) return null;

    try {
        if (typeof sale.date.toDate === "function") {
            return sale.date.toDate();
        }

        if (typeof sale.date.seconds === "number") {
            return new Date(sale.date.seconds * 1000);
        }

        const parsed = new Date(sale.date);

        return Number.isNaN(parsed.getTime())
            ? null
            : parsed;

    } catch (error) {
        console.error("Date conversion error:", error);
        return null;
    }
}


// =====================================================
// PAYMENT AMOUNT HELPERS
// =====================================================

function getCashAmount(sale) {
    return Number(sale?.cashAmount ?? 0) || 0;
}

function getMpesaAmount(sale) {
    return Number(sale?.mpesaAmount ?? 0) || 0;
}

function getBankAmount(sale) {
    return Number(sale?.bankAmount ?? 0) || 0;
}

function getKopokopoAmount(sale) {
    return Number(sale?.kopokopoAmount ?? 0) || 0;
}


// =====================================================
// TOTAL AMOUNT PAID
// =====================================================

function getAmountPaid(sale) {
    if (sale?.amountPaid !== undefined &&
        sale?.amountPaid !== null) {
        return Number(sale.amountPaid) || 0;
    }

    return (
        getCashAmount(sale) +
        getMpesaAmount(sale) +
        getBankAmount(sale) +
        getKopokopoAmount(sale)
    );
}


// =====================================================
// SALE TOTAL
// =====================================================

function getSaleTotal(sale) {
    return Number(sale?.total ?? 0) || 0;
}


// =====================================================
// BALANCE
// =====================================================

function getBalance(sale) {
    if (sale?.balance !== undefined &&
        sale?.balance !== null) {
        return Math.max(0, Number(sale.balance) || 0);
    }

    return Math.max(
        0,
        getSaleTotal(sale) - getAmountPaid(sale)
    );
}


// =====================================================
// CHANGE
// =====================================================

function getChange(sale) {
    if (sale?.change !== undefined &&
        sale?.change !== null) {
        return Math.max(0, Number(sale.change) || 0);
    }

    return Math.max(
        0,
        getAmountPaid(sale) - getSaleTotal(sale)
    );
}


// =====================================================
// GET PAYMENT METHODS
// =====================================================

function getPaymentMethods(sale) {
    const methods = [];

    if (getCashAmount(sale) > 0) {
        methods.push("Cash");
    }

    if (getMpesaAmount(sale) > 0) {
        methods.push("M-Pesa");
    }

    if (getBankAmount(sale) > 0) {
        methods.push("Bank");
    }

    if (getKopokopoAmount(sale) > 0) {
        methods.push("Kopo Kopo");
    }

    // Support older records without payment amounts.
    if (
        methods.length === 0 &&
        Array.isArray(sale?.paymentMethods)
    ) {
        return sale.paymentMethods;
    }

    return methods;
}


// =====================================================
// PAYMENT BREAKDOWN HTML
// =====================================================

function getPaymentBreakdownHTML(sale) {
    const payments = [
        {
            name: "Cash",
            amount: getCashAmount(sale)
        },
        {
            name: "M-Pesa",
            amount: getMpesaAmount(sale)
        },
        {
            name: "Bank",
            amount: getBankAmount(sale)
        },
        {
            name: "Kopo Kopo",
            amount: getKopokopoAmount(sale)
        }
    ];

    const parts = payments
        .filter((payment) => payment.amount > 0)
        .map((payment) => `
            <div class="payment-line">
                <span>${payment.name}</span>
                <strong>${money(payment.amount)}</strong>
            </div>
        `);

    if (parts.length === 0) {
        return getPaymentMethods(sale)
            .map((method) => `
                <div class="payment-line">
                    <span>${escapeHTML(method)}</span>
                </div>
            `)
            .join("") || "-";
    }

    return parts.join("");
}


// =====================================================
// DISPLAY SALES TABLE
// =====================================================

function displaySales(data) {
    const table = document.getElementById("salesTable");

    if (!table) return;

    table.innerHTML = "";

    if (data.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="10">No Sales Found</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = data.map((sale, index) => {
        let productsHTML = "-";

        if (Array.isArray(sale.items) && sale.items.length > 0) {
            productsHTML = sale.items.map((item) => `
                <div class="sale-product">
                    <strong>
                        ${escapeHTML(item.name || "Unknown Product")}
                    </strong>
                    <span>× ${Number(item.quantity || 0)}</span>
                </div>
            `).join("");
        }

        const payment = getPaymentBreakdownHTML(sale);
        const date = getSaleDate(sale);

        const saleDate = date
            ? date.toLocaleString("en-KE")
            : "N/A";

        const receiptNo =
            sale.receiptNo || sale.id.substring(0, 8);

        return `
            <tr>
                <td>${index + 1}</td>

                <td class="products-column">
                    ${productsHTML}
                </td>

                <td>${escapeHTML(receiptNo)}</td>

                <td>
                    ${escapeHTML(sale.customerName || "Walk-in Customer")}
                </td>

                <td>
                    ${escapeHTML(sale.cashier || "-")}
                </td>

                <td>
                    <div class="payment-breakdown">
                        ${payment}
                    </div>
                </td>

                <td>${money(getSaleTotal(sale))}</td>

                <td>${money(getAmountPaid(sale))}</td>

                <td>${escapeHTML(saleDate)}</td>

                <td>
                    <button
                        class="view-btn"
                        onclick="viewSale('${sale.id}')"
                        title="View Receipt"
                    >
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}


// =====================================================
// UPDATE TOP STATISTICS
// =====================================================

function updateStatistics() {
    let total = 0;
    let totalTransactions = 0;
    let todayTotal = 0;

    const today = new Date();

    sales.forEach((sale) => {
        total += getSaleTotal(sale);
        totalTransactions++;

        const saleDate = getSaleDate(sale);

        if (!saleDate) return;

        if (
            saleDate.getFullYear() === today.getFullYear() &&
            saleDate.getMonth() === today.getMonth() &&
            saleDate.getDate() === today.getDate()
        ) {
            todayTotal += getSaleTotal(sale);
        }
    });

    setText("totalSales", money(total));
    setText("totalTransactions", totalTransactions);
    setText("todaySales", money(todayTotal));
}


// =====================================================
// CURRENT MONTH SALES
// =====================================================

function updateMonthlySales() {
    const now = new Date();

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthName = now.toLocaleString("default", {
        month: "long"
    });

    setText("currentMonthName", monthName);

    setText(
        "monthlySalesYear",
        `${monthName} ${currentYear} sales summary`
    );

    let monthlyTotal = 0;
    let monthlyTransactions = 0;
    let monthlyItems = 0;

    sales.forEach((sale) => {
        const saleDate = getSaleDate(sale);

        if (!saleDate) return;

        if (
            saleDate.getFullYear() !== currentYear ||
            saleDate.getMonth() !== currentMonth
        ) {
            return;
        }

        monthlyTotal += getSaleTotal(sale);
        monthlyTransactions++;

        if (Array.isArray(sale.items)) {
            sale.items.forEach((item) => {
                monthlyItems += Number(item.quantity || 0);
            });
        }
    });

    setText("currentMonthSales", money(monthlyTotal));
    setText("currentMonthTransactions", monthlyTransactions);
    setText("currentMonthItems", monthlyItems);
}


// =====================================================
// VIEW SALE / RECEIPT MODAL
// =====================================================

window.viewSale = function(id) {
    selectedSale = sales.find((sale) => sale.id === id);

    if (!selectedSale) return;

    const saleDate = getSaleDate(selectedSale);

    const formattedDate = saleDate
        ? saleDate.toLocaleString("en-KE")
        : "N/A";

    const receiptNo =
        selectedSale.receiptNo || selectedSale.id;

    let html = `
        <h3>Lebarto Electronics</h3>

        <p>
            <strong>Customer:</strong>
            ${escapeHTML(selectedSale.customerName || "Walk-in Customer")}
        </p>

        <p>
            <strong>Cashier:</strong>
            ${escapeHTML(selectedSale.cashier || "-")}
        </p>

        <p>
            <strong>Receipt:</strong>
            ${escapeHTML(receiptNo)}
        </p>

        <p>
            <strong>Date:</strong>
            ${escapeHTML(formattedDate)}
        </p>

        <hr>

        <h4>Payment Breakdown</h4>

        <div class="receipt-payment-breakdown">
            ${getPaymentBreakdownHTML(selectedSale)}
        </div>

        <p>
            <strong>Total Paid:</strong>
            ${money(getAmountPaid(selectedSale))}
        </p>

        <p>
            <strong>Total:</strong>
            ${money(getSaleTotal(selectedSale))}
        </p>

        <p>
            <strong>Balance Due:</strong>
            ${money(getBalance(selectedSale))}
        </p>

        <p>
            <strong>Change:</strong>
            ${money(getChange(selectedSale))}
        </p>

        <hr>

        <h4>Items Purchased</h4>
    `;

    if (
        Array.isArray(selectedSale.items) &&
        selectedSale.items.length > 0
    ) {
        selectedSale.items.forEach((item) => {
            const itemTotal =
                Number(item.total) ||
                Number(item.price || item.sellingPrice || 0) *
                Number(item.quantity || 0);

            html += `
                <div class="receipt-item">
                    <span>
                        ${escapeHTML(item.name || "Unknown Product")}
                        × ${Number(item.quantity || 0)}
                    </span>

                    <span>${money(itemTotal)}</span>
                </div>
            `;
        });
    } else {
        html += `<p>No products recorded.</p>`;
    }

    html += `
        <div class="receipt-total">
            Total: ${money(getSaleTotal(selectedSale))}
        </div>
    `;

    const receiptDetails =
        document.getElementById("receiptDetails");

    if (receiptDetails) {
        receiptDetails.innerHTML = html;
    }

    const receiptModal =
        document.getElementById("receiptModal");

    if (receiptModal) {
        receiptModal.style.display = "flex";
    }
};


// =====================================================
// SEARCH AND FILTER LISTENERS
// =====================================================

document.getElementById("searchSale")
    ?.addEventListener("input", filterSales);

document.getElementById("paymentFilter")
    ?.addEventListener("change", filterSales);

document.getElementById("dateFilter")
    ?.addEventListener("change", filterSales);


// =====================================================
// FILTER SALES
// =====================================================

function filterSales() {
    const text = document.getElementById("searchSale")
        ?.value?.toLowerCase().trim() || "";

    const payment = document.getElementById("paymentFilter")
        ?.value || "";

    const date = document.getElementById("dateFilter")
        ?.value || "";

    const filtered = sales.filter((sale) => {
        const customer =
            String(sale.customerName || "").toLowerCase();

        const cashier =
            String(sale.cashier || "").toLowerCase();

        const receipt =
            String(sale.receiptNo || "").toLowerCase();

        const productNames = Array.isArray(sale.items)
            ? sale.items
                .map((item) => item.name || "")
                .join(" ")
                .toLowerCase()
            : "";

        const searchable = [
            customer,
            cashier,
            receipt,
            productNames
        ].join(" ");

        const matchText =
            !text || searchable.includes(text);

        const methods = getPaymentMethods(sale);

        const matchPayment =
            !payment ||
            methods.some((method) =>
                method.toLowerCase() === payment.toLowerCase()
            );

        let matchDate = true;

        if (date) {
            const saleDate = getSaleDate(sale);

            if (!saleDate) {
                matchDate = false;
            } else {
                const year = saleDate.getFullYear();
                const month = String(
                    saleDate.getMonth() + 1
                ).padStart(2, "0");

                const day = String(
                    saleDate.getDate()
                ).padStart(2, "0");

                matchDate =
                    `${year}-${month}-${day}` === date;
            }
        }

        return matchText && matchPayment && matchDate;
    });

    displaySales(filtered);
}


// =====================================================
// PRINT RECEIPT
// =====================================================

document.getElementById("printReceiptBtn")
    ?.addEventListener("click", () => {
        window.print();
    });


// =====================================================
// CLOSE RECEIPT MODAL
// =====================================================

document.getElementById("closeModal")
    ?.addEventListener("click", () => {
        const modal = document.getElementById("receiptModal");

        if (modal) {
            modal.style.display = "none";
        }
    });


// =====================================================
// CLOSE MODAL BY CLICKING OUTSIDE
// =====================================================

const receiptModal = document.getElementById("receiptModal");

if (receiptModal) {
    receiptModal.addEventListener("click", (event) => {
        if (event.target.id === "receiptModal") {
            receiptModal.style.display = "none";
        }
    });
}


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
            alert("Unable to logout. Please try again.");
        }
    });


// =====================================================
// MONEY FORMATTING
// =====================================================

function money(value) {
    return "KSh " + Number(value || 0).toLocaleString("en-KE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}


// =====================================================
// SET TEXT
// =====================================================

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =====================================================
// READY
// =====================================================

console.log(
    "LEBARTO SALES MODULE LOADED - KOPO KOPO ENABLED."
);
