
/* =====================================================
   LEBARTO ELECTRONICS
   REPORTS.JS - SALES REPORT
   Payments: Cash, M-Pesa, Bank, Kopo Kopo
   ===================================================== */

import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* ===================== GLOBALS ===================== */

let currentUser = null;
let currentUserData = null;
let sales = [];
let filteredSales = [];
let loadingSales = false;

/* ===================== AUTHENTICATION ===================== */

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    await Promise.allSettled([
        loadCurrentUser(),
        loadSales()
    ]);
});

/* ===================== USER PROFILE ===================== */

async function loadCurrentUser() {
    try {
        const userQuery = query(
            collection(db, "users"),
            where("uid", "==", currentUser.uid)
        );

        const snapshot = await getDocs(userQuery);

        if (!snapshot.empty) {
            currentUserData = snapshot.docs[0].data();
        }

        setText(
            "adminName",
            currentUserData?.name ||
            currentUser.email ||
            "Admin"
        );
    } catch (error) {
        console.error("User loading error:", error);

        setText(
            "adminName",
            currentUser?.email || "Admin"
        );
    }
}

/* ===================== LOAD SALES ===================== */

async function loadSales() {
    if (loadingSales) return;

    loadingSales = true;

    const table = document.getElementById("reportTable");

    if (table) {
        table.innerHTML = `
            <tr>
                <td colspan="10" class="no-data">
                    Loading sales report...
                </td>
            </tr>
        `;
    }

    try {
        const snapshot = await getDocs(
            collection(db, "sales")
        );

        sales = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id
        }));

        sales.sort((a, b) => {
            const dateA = getSaleDate(a);
            const dateB = getSaleDate(b);

            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;

            return dateB.getTime() - dateA.getTime();
        });

        filteredSales = [...sales];

        displayReport(filteredSales);
        updateStatistics(filteredSales);
        updateReportPeriod();

        console.log(
            "LEBARTO REPORT:",
            sales.length,
            "sales loaded"
        );
    } catch (error) {
        console.error("Load sales error:", error);

        if (table) {
            table.innerHTML = `
                <tr>
                    <td colspan="10" class="no-data">
                        Unable to load sales.<br><br>
                        ${escapeHTML(error.message)}
                    </td>
                </tr>
            `;
        }
    } finally {
        loadingSales = false;
    }
}

/* ===================== NUMBER HELPERS ===================== */

function numberValue(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return 0;
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    const cleaned = String(value)
        .replace(/,/g, "")
        .replace(/KSh/gi, "")
        .trim();

    const result = Number(cleaned);

    return Number.isFinite(result) ? result : 0;
}

/* ===================== DATES ===================== */

function getSaleDate(sale) {
    const value =
        sale?.date ??
        sale?.createdAt ??
        sale?.saleDate ??
        sale?.timestamp ??
        null;

    if (value === null || value === undefined) {
        return null;
    }

    try {
        let date;

        if (typeof value.toDate === "function") {
            date = value.toDate();
        } else if (typeof value.seconds === "number") {
            date = new Date(value.seconds * 1000);
        } else if (value instanceof Date) {
            date = value;
        } else if (typeof value === "number") {
            // Support Unix timestamps in seconds or milliseconds.
            date = new Date(
                value < 100000000000
                    ? value * 1000
                    : value
            );
        } else {
            date = new Date(value);
        }

        return Number.isNaN(date.getTime()) ? null : date;
    } catch (error) {
        console.error("Date conversion error:", error);
        return null;
    }
}

/* ===================== PAYMENT METHODS ===================== */

function normalizePaymentMethod(method) {
    const value = String(method || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, "");

    if (["kopokopo", "kopokopopay"].includes(value)) {
        return "kopokopo";
    }

    if (["mpesa", "safaricommpesa"].includes(value)) {
        return "mpesa";
    }

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

    return methods
        .map((method) => String(method).trim())
        .filter(Boolean);
}

/* ===================== PAYMENT AMOUNTS ===================== */

function getPaymentAmounts(sale) {
    const cash = numberValue(sale?.cashAmount);

    const mpesa = numberValue(
        sale?.mpesaAmount ?? sale?.mPesaAmount
    );

    const bank = numberValue(sale?.bankAmount);

    const kopoKopo = numberValue(
        sale?.kopoKopoAmount ??
        sale?.kopoKopo ??
        sale?.kopoAmount ??
        sale?.kopokopoAmount ??
        sale?.kopoKopoPaid ??
        0
    );

    const savedAmountPaid = numberValue(
        sale?.amountPaid ?? sale?.paidAmount
    );

    let amounts = { cash, mpesa, bank, kopoKopo };

    const fieldsTotal = cash + mpesa + bank + kopoKopo;

    /*
     * Older records may only contain amountPaid
     * and a single saved payment method.
     */
    if (fieldsTotal === 0 && savedAmountPaid > 0) {
        const methods = getSavedPaymentMethods(sale);

        if (methods.length === 1) {
            const method = normalizePaymentMethod(methods[0]);

            if (method === "cash") {
                amounts.cash = savedAmountPaid;
            } else if (method === "mpesa") {
                amounts.mpesa = savedAmountPaid;
            } else if (method === "bank") {
                amounts.bank = savedAmountPaid;
            } else if (method === "kopokopo") {
                amounts.kopoKopo = savedAmountPaid;
            }
        }
    }

    const calculatedTotal =
        amounts.cash +
        amounts.mpesa +
        amounts.bank +
        amounts.kopoKopo;

    return {
        ...amounts,
        totalPaid: savedAmountPaid > 0
            ? savedAmountPaid
            : calculatedTotal
    };
}

function getPaymentMethods(sale) {
    const amounts = getPaymentAmounts(sale);
    const methods = [];

    if (amounts.cash > 0) methods.push("Cash");
    if (amounts.mpesa > 0) methods.push("M-Pesa");
    if (amounts.bank > 0) methods.push("Bank");
    if (amounts.kopoKopo > 0) methods.push("Kopo Kopo");

    if (methods.length > 0) return methods;

    return getSavedPaymentMethods(sale);
}

function saleUsesPaymentMethod(sale, requestedMethod) {
    const requested = normalizePaymentMethod(requestedMethod);

    if (!requested) return true;

    const amounts = getPaymentAmounts(sale);

    const amountByMethod = {
        cash: amounts.cash,
        mpesa: amounts.mpesa,
        bank: amounts.bank,
        kopokopo: amounts.kopoKopo
    };

    if (Object.prototype.hasOwnProperty.call(
        amountByMethod,
        requested
    )) {
        if (amountByMethod[requested] > 0) return true;
    }

    return getSavedPaymentMethods(sale).some(
        (method) => normalizePaymentMethod(method) === requested
    );
}

/* ===================== ITEM HELPERS ===================== */

function getItemSellingPrice(item) {
    return numberValue(
        item?.sellingPrice ??
        item?.price ??
        item?.unitPrice ??
        item?.salePrice ??
        0
    );
}

function getItemBuyingPrice(item) {
    return numberValue(
        item?.buyingPrice ??
        item?.costPrice ??
        item?.purchasePrice ??
        item?.buyPrice ??
        item?.cost ??
        0
    );
}

function getItemQuantity(item) {
    return numberValue(item?.quantity);
}

function calculateItemsTotal(sale) {
    if (!Array.isArray(sale?.items)) return 0;

    return sale.items.reduce((total, item) => {
        const hasTotal =
            item?.total !== undefined &&
            item?.total !== null &&
            item?.total !== "";

        const hasRevenue =
            item?.revenue !== undefined &&
            item?.revenue !== null &&
            item?.revenue !== "";

        if (hasTotal) {
            return total + numberValue(item.total);
        }

        if (hasRevenue) {
            return total + numberValue(item.revenue);
        }

        return total +
            getItemSellingPrice(item) *
            getItemQuantity(item);
    }, 0);
}

/* ===================== SALE TOTALS ===================== */

function getSaleTotal(sale) {
    if (
        sale?.total !== undefined &&
        sale?.total !== null &&
        sale?.total !== ""
    ) {
        return Math.max(0, numberValue(sale.total));
    }

    const grandTotal = numberValue(sale?.grandTotal);

    if (grandTotal > 0) return grandTotal;

    const subtotal = numberValue(sale?.subtotal);
    const discount = numberValue(sale?.discount);

    if (subtotal > 0) {
        return Math.max(0, subtotal - discount);
    }

    return calculateItemsTotal(sale);
}

function getAmountPaid(sale) {
    return getPaymentAmounts(sale).totalPaid;
}

function getBalance(sale) {
    if (
        sale?.balance !== undefined &&
        sale?.balance !== null &&
        sale?.balance !== ""
    ) {
        return Math.max(0, numberValue(sale.balance));
    }

    return Math.max(
        0,
        getSaleTotal(sale) - getAmountPaid(sale)
    );
}

function getChange(sale) {
    if (
        sale?.change !== undefined &&
        sale?.change !== null &&
        sale?.change !== ""
    ) {
        return Math.max(0, numberValue(sale.change));
    }

    return Math.max(
        0,
        getAmountPaid(sale) - getSaleTotal(sale)
    );
}

/* ===================== PAYMENT BREAKDOWN HTML ===================== */

function getPaymentBreakdownHTML(sale) {
    const payments = getPaymentAmounts(sale);
    const parts = [];

    if (payments.cash > 0) {
        parts.push(`
            <div class="payment-line">
                <span>Cash</span>
                <strong>${money(payments.cash)}</strong>
            </div>
        `);
    }

    if (payments.mpesa > 0) {
        parts.push(`
            <div class="payment-line">
                <span>M-Pesa</span>
                <strong>${money(payments.mpesa)}</strong>
            </div>
        `);
    }

    if (payments.bank > 0) {
        parts.push(`
            <div class="payment-line">
                <span>Bank</span>
                <strong>${money(payments.bank)}</strong>
            </div>
        `);
    }

    if (payments.kopoKopo > 0) {
        parts.push(`
            <div class="payment-line">
                <span>Kopo Kopo</span>
                <strong>${money(payments.kopoKopo)}</strong>
            </div>
        `);
    }

    if (parts.length > 0) {
        return parts.join("");
    }

    const saved = getSavedPaymentMethods(sale);

    if (saved.length > 0) {
        return saved.map((method) => `
            <span class="payment-badge">
                ${escapeHTML(method)}
            </span>
        `).join("");
    }

    return "-";
}

/* ===================== DISPLAY REPORT ===================== */

function displayReport(data) {
    const table = document.getElementById("reportTable");

    if (!table) {
        console.error(
            'Missing HTML element: id="reportTable"'
        );
        return;
    }

    if (!data.length) {
        table.innerHTML = `
            <tr>
                <td colspan="10" class="no-data">
                    No sales found.
                </td>
            </tr>
        `;

        updateFooter([]);
        return;
    }

    const rows = data.map((sale, index) => {
        const total = getSaleTotal(sale);
        const paid = getAmountPaid(sale);
        const balance = getBalance(sale);
        const change = getChange(sale);
        const date = getSaleDate(sale);

        const productsHTML = Array.isArray(sale.items) &&
            sale.items.length > 0
            ? `
                <div class="product-list">
                    ${sale.items.map((item) => `
                        <div class="product-item">
                            <span class="product-name">
                                ${escapeHTML(item?.name || "Unknown Product")}
                            </span>
                            <span class="product-quantity">
                                × ${getItemQuantity(item)}
                            </span>
                        </div>
                    `).join("")}
                </div>
            `
            : "-";

        const receipt = sale.receiptNo || sale.id || "-";
        const customer = sale.customerName || "Walk-in Customer";
        const cashier = sale.cashier || "-";

        const balanceHTML = balance > 0
            ? `<span class="negative">${money(balance)}</span>`
            : `<span class="positive">${money(0)}</span>`;

        const changeHTML = change > 0
            ? `<br><small>Change: ${money(change)}</small>`
            : "";

        return `
            <tr>
                <td>${index + 1}</td>
                <td class="products-column">${productsHTML}</td>
                <td>${escapeHTML(receipt)}</td>
                <td>${escapeHTML(customer)}</td>
                <td>${escapeHTML(cashier)}</td>
                <td>
                    <div class="payment-breakdown">
                        ${getPaymentBreakdownHTML(sale)}
                    </div>
                </td>
                <td>${money(total)}</td>
                <td>${money(paid)}</td>
                <td>${balanceHTML}${changeHTML}</td>
                <td>${date ? escapeHTML(date.toLocaleString("en-KE")) : "N/A"}</td>
            </tr>
        `;
    });

    table.innerHTML = rows.join("");
    updateFooter(data);
}

/* ===================== STATISTICS ===================== */

function updateStatistics(data) {
    let totalSales = 0;
    let cash = 0;
    let mpesa = 0;
    let bank = 0;
    let kopoKopo = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    let totalCost = 0;
    let totalProfit = 0;

    data.forEach((sale) => {
        const saleTotal = getSaleTotal(sale);
        const payments = getPaymentAmounts(sale);

        totalSales += saleTotal;
        cash += payments.cash;
        mpesa += payments.mpesa;
        bank += payments.bank;
        kopoKopo += payments.kopoKopo;

        totalPaid += getAmountPaid(sale);
        totalBalance += getBalance(sale);

        let saleCost = numberValue(sale.totalCost);

        if (saleCost === 0) {
            saleCost = numberValue(sale.cost);
        }

        if (saleCost === 0 && Array.isArray(sale.items)) {
            saleCost = sale.items.reduce(
                (sum, item) =>
                    sum +
                    getItemBuyingPrice(item) *
                    getItemQuantity(item),
                0
            );
        }

        totalCost += saleCost;

        const profit = sale.profit !== undefined &&
            sale.profit !== null
            ? numberValue(sale.profit)
            : saleTotal - saleCost;

        totalProfit += profit;
    });

    const transactions = data.length;

    // Main dashboard cards.
    setText("totalSales", money(totalSales));
    setText("totalTransactions", transactions);
    setText("cashSales", money(cash));
    setText("mpesaSales", money(mpesa));
    setText("bankSales", money(bank));
    setText("kopoKopoSales", money(kopoKopo));
    setText("grandTotal", money(totalSales));

    // Summary cards.
    setText("summarySales", money(totalSales));
    setText("summaryTransactions", transactions);
    setText("summaryCash", money(cash));
    setText("summaryMpesa", money(mpesa));
    setText("summaryBank", money(bank));
    setText("summaryKopoKopo", money(kopoKopo));
    setText("summaryPaid", money(totalPaid));
    setText("summaryBalance", money(totalBalance));
    setText("summaryGrandTotal", money(totalSales));

    // Optional elements.
    setText("totalCost", money(totalCost));
    setText("totalProfit", money(totalProfit));
}

/* ===================== TABLE FOOTER ===================== */

function updateFooter(data) {
    let salesTotal = 0;
    let paidTotal = 0;
    let balanceTotal = 0;

    data.forEach((sale) => {
        salesTotal += getSaleTotal(sale);
        paidTotal += getAmountPaid(sale);
        balanceTotal += getBalance(sale);
    });

    setText("footerSales", money(salesTotal));
    setText("footerPaid", money(paidTotal));
    setText("footerBalance", money(balanceTotal));
}

/* ===================== FILTER SALES ===================== */

function filterSales() {
    const fromDate =
        document.getElementById("fromDate")?.value || "";

    const toDate =
        document.getElementById("toDate")?.value || "";

    const payment =
        document.getElementById("paymentFilter")?.value || "";

    const search = (
        document.getElementById("searchReport")?.value || ""
    ).toLowerCase().trim();

    filteredSales = sales.filter((sale) => {
        const date = getSaleDate(sale);
        let matchDate = true;

        if (fromDate) {
            const from = new Date(`${fromDate}T00:00:00`);

            if (!date || date < from) {
                matchDate = false;
            }
        }

        if (toDate) {
            const to = new Date(`${toDate}T23:59:59.999`);

            if (!date || date > to) {
                matchDate = false;
            }
        }

        const matchPayment = !payment ||
            saleUsesPaymentMethod(sale, payment);

        const productNames = Array.isArray(sale.items)
            ? sale.items
                .map((item) => item?.name || "")
                .join(" ")
            : "";

        const searchable = [
            sale.customerName || "",
            sale.cashier || "",
            sale.receiptNo || "",
            sale.id || "",
            productNames,
            getPaymentMethods(sale).join(" ")
        ].join(" ").toLowerCase();

        const matchSearch = !search ||
            searchable.includes(search);

        return matchDate && matchPayment && matchSearch;
    });

    displayReport(filteredSales);
    updateStatistics(filteredSales);
    updateReportPeriod();
}

/* ===================== REPORT PERIOD ===================== */

function updateReportPeriod() {
    const from = document.getElementById("fromDate")?.value || "";
    const to = document.getElementById("toDate")?.value || "";
    const payment = document.getElementById("paymentFilter")?.value || "";

    let period = "All Sales";

    if (from && to) {
        period = `From ${from} to ${to}`;
    } else if (from) {
        period = `From ${from}`;
    } else if (to) {
        period = `Up to ${to}`;
    }

    if (payment) {
        period += ` • ${payment}`;
    }

    setText("reportPeriod", period);
}

/* ===================== EVENT LISTENERS ===================== */

document.getElementById("searchReport")
    ?.addEventListener("input", filterSales);

document.getElementById("generateReportBtn")
    ?.addEventListener("click", filterSales);

document.getElementById("paymentFilter")
    ?.addEventListener("change", filterSales);

document.getElementById("fromDate")
    ?.addEventListener("change", filterSales);

document.getElementById("toDate")
    ?.addEventListener("change", filterSales);

document.getElementById("tableSearch")
    ?.addEventListener("input", function () {
        const value = this.value.toLowerCase().trim();

        document.querySelectorAll("#reportTable tr").forEach((row) => {
            row.style.display = !value ||
                row.textContent.toLowerCase().includes(value)
                ? ""
                : "none";
        });
    });

document.getElementById("printReportBtn")
    ?.addEventListener("click", () => {
        window.print();
    });

document.getElementById("downloadReportBtn")
    ?.addEventListener("click", downloadCSV);

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

/* ===================== CSV EXPORT ===================== */

function downloadCSV() {
    if (!filteredSales.length) {
        alert("There is no report data to download.");
        return;
    }

    const rows = [[
        "#",
        "Products",
        "Receipt",
        "Customer",
        "Cashier",
        "Payment Methods",
        "Cash",
        "M-Pesa",
        "Bank",
        "Kopo Kopo",
        "Sales",
        "Paid",
        "Balance",
        "Change",
        "Date"
    ]];

    filteredSales.forEach((sale, index) => {
        const products = Array.isArray(sale.items)
            ? sale.items.map((item) =>
                `${item?.name || "Unknown"} x ${getItemQuantity(item)}`
            ).join(" | ")
            : "";

        const date = getSaleDate(sale);
        const payments = getPaymentAmounts(sale);

        rows.push([
            index + 1,
            products,
            sale.receiptNo || sale.id || "",
            sale.customerName || "Walk-in Customer",
            sale.cashier || "",
            getPaymentMethods(sale).join(", "),
            payments.cash,
            payments.mpesa,
            payments.bank,
            payments.kopoKopo,
            getSaleTotal(sale),
            getAmountPaid(sale),
            getBalance(sale),
            getChange(sale),
            date ? date.toLocaleString("en-KE") : ""
        ]);
    });

    const csv = rows
        .map((row) => row.map(csvEscape).join(","))
        .join("\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `Lebarto-Sales-Report-${getFileDate()}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/* ===================== UTILITIES ===================== */

function money(value) {
    return "KSh " + numberValue(value).toLocaleString("en-KE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function getFileDate() {
    const date = new Date();

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ===================== MODULE READY ===================== */

console.log("LEBARTO SALES REPORT MODULE LOADED.");
