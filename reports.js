
/* =====================================================
   LEBARTO ELECTRONICS
   REPORTS.JS - SALES REPORT
   Latest 50 sales displayed; totals from all sales.
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
    orderBy,
    limit,
    where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;

let allSales = [];
let sales = [];
let filteredSales = [];

let loadingSales = false;

const DISPLAY_LIMIT = 50;

/* =====================================================
   AUTHENTICATION
   ===================================================== */

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    await loadCurrentUser();
    await loadSales();
});

/* =====================================================
   USER PROFILE
   ===================================================== */

async function loadCurrentUser() {
    try {
        const q = query(
            collection(db, "users"),
            where("uid", "==", currentUser.uid)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            currentUserData = snapshot.docs[0].data();
        }

        setText(
            "adminName",
            currentUserData?.name || currentUser.email || "Admin"
        );
    } catch (error) {
        console.error("User loading error:", error);
        setText("adminName", currentUser?.email || "Admin");
    }
}

/* =====================================================
   LOAD SALES
   ===================================================== */

async function loadSales() {
    if (loadingSales) return;

    loadingSales = true;

    setTableMessage("Loading sales report...");

    try {
        /*
         * First attempt: fetch the newest 50 records using
         * a Firestore query on the date field.
         *
         * If the query fails because of missing fields or
         * indexing, fall back to loading the collection.
         */
        let recentSnapshot;

        try {
            recentSnapshot = await getDocs(
                query(
                    collection(db, "sales"),
                    orderBy("date", "desc"),
                    limit(DISPLAY_LIMIT)
                )
            );
        } catch (error) {
            console.warn(
                "Could not order sales by date. Using fallback:",
                error
            );

            recentSnapshot = null;
        }

        /*
         * Totals must use all records, not just the latest 50.
         * Therefore fetch the complete collection for statistics.
         */
        const allSnapshot = await getDocs(
            collection(db, "sales")
        );

        allSales = allSnapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id
        }));

        allSales.sort((a, b) => {
            const da = getSaleDate(a);
            const dbDate = getSaleDate(b);

            return (dbDate?.getTime() || 0) -
                   (da?.getTime() || 0);
        });

        /*
         * Prefer the indexed query result when available.
         * Otherwise take the newest 50 after sorting all records.
         */
        if (recentSnapshot && recentSnapshot.docs.length > 0) {
            const recentIds = new Set(
                recentSnapshot.docs.map((doc) => doc.id)
            );

            sales = allSales
                .filter((sale) => recentIds.has(sale.id))
                .sort((a, b) =>
                    (getSaleDate(b)?.getTime() || 0) -
                    (getSaleDate(a)?.getTime() || 0)
                )
                .slice(0, DISPLAY_LIMIT);
        } else {
            sales = allSales.slice(0, DISPLAY_LIMIT);
        }

        filteredSales = [...sales];

        displayReport(filteredSales);

        // Statistics always use the complete collection.
        updateStatistics(allSales);
        updateReportPeriod();

        setText(
            "reportCount",
            `Showing ${filteredSales.length} recent sales of ${allSales.length} total records`
        );

        console.log("LEBARTO REPORT:", {
            allRecords: allSales.length,
            displayedRecords: sales.length
        });

    } catch (error) {
        console.error("Load sales error:", error);

        setTableMessage(
            "Unable to load sales: " + error.message
        );
    } finally {
        loadingSales = false;
    }
}

/* =====================================================
   NUMBER HELPERS
   ===================================================== */

function numberValue(value) {
    if (value === null || value === undefined || value === "") {
        return 0;
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "object" && value !== null) {
        return 0;
    }

    const result = Number(
        String(value)
            .replace(/,/g, "")
            .replace(/KSh/gi, "")
            .replace(/\s/g, "")
            .trim()
    );

    return Number.isFinite(result) ? result : 0;
}

/* =====================================================
   DATE HELPERS
   ===================================================== */

function getSaleDate(sale) {
    const value =
        sale?.date ??
        sale?.createdAt ??
        sale?.saleDate ??
        sale?.timestamp ??
        sale?.created_at ??
        null;

    if (value === null || value === undefined || value === "") {
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
            date = new Date(
                value < 100000000000 ? value * 1000 : value
            );
        } else {
            date = new Date(value);
        }

        return Number.isNaN(date.getTime()) ? null : date;
    } catch {
        return null;
    }
}

/* =====================================================
   PAYMENT HELPERS
   ===================================================== */

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

    return methods.map((item) => String(item).trim()).filter(Boolean);
}

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
        sale?.kopoKopoPaid
    );

    const savedAmountPaid = numberValue(
        sale?.amountPaid ?? sale?.paidAmount
    );

    const amounts = { cash, mpesa, bank, kopoKopo };

    const sum = cash + mpesa + bank + kopoKopo;

    if (sum === 0 && savedAmountPaid > 0) {
        const methods = getSavedPaymentMethods(sale);

        if (methods.length === 1) {
            const method = normalizePaymentMethod(methods[0]);

            if (method === "cash") amounts.cash = savedAmountPaid;
            if (method === "mpesa") amounts.mpesa = savedAmountPaid;
            if (method === "bank") amounts.bank = savedAmountPaid;
            if (method === "kopokopo") amounts.kopoKopo = savedAmountPaid;
        }
    }

    const calculated =
        amounts.cash +
        amounts.mpesa +
        amounts.bank +
        amounts.kopoKopo;

    return {
        ...amounts,
        totalPaid: savedAmountPaid > 0
            ? savedAmountPaid
            : calculated
    };
}

function getPaymentMethods(sale) {
    const p = getPaymentAmounts(sale);
    const result = [];

    if (p.cash > 0) result.push("Cash");
    if (p.mpesa > 0) result.push("M-Pesa");
    if (p.bank > 0) result.push("Bank");
    if (p.kopoKopo > 0) result.push("Kopo Kopo");

    return result.length ? result : getSavedPaymentMethods(sale);
}

function saleUsesPaymentMethod(sale, method) {
    const requested = normalizePaymentMethod(method);
    if (!requested) return true;

    const payments = getPaymentAmounts(sale);

    const fields = {
        cash: payments.cash,
        mpesa: payments.mpesa,
        bank: payments.bank,
        kopokopo: payments.kopoKopo
    };

    if (fields[requested] > 0) return true;

    return getSavedPaymentMethods(sale).some(
        (item) => normalizePaymentMethod(item) === requested
    );
}

/* =====================================================
   PRODUCT HELPERS
   ===================================================== */

function getItemSellingPrice(item) {
    return numberValue(
        item?.sellingPrice ??
        item?.price ??
        item?.unitPrice ??
        item?.salePrice
    );
}

function getItemBuyingPrice(item) {
    return numberValue(
        item?.buyingPrice ??
        item?.costPrice ??
        item?.purchasePrice ??
        item?.buyPrice ??
        item?.cost
    );
}

function getItemQuantity(item) {
    return numberValue(item?.quantity);
}

function calculateItemsTotal(sale) {
    if (!Array.isArray(sale?.items)) return 0;

    return sale.items.reduce((sum, item) => {
        if (item?.total !== undefined && item.total !== null && item.total !== "") {
            return sum + numberValue(item.total);
        }

        if (item?.revenue !== undefined && item.revenue !== null && item.revenue !== "") {
            return sum + numberValue(item.revenue);
        }

        return sum + getItemSellingPrice(item) * getItemQuantity(item);
    }, 0);
}

/* =====================================================
   SALES TOTALS
   ===================================================== */

function getSaleTotal(sale) {
    const total = numberValue(sale?.total);
    if (sale?.total !== undefined && sale?.total !== null && sale?.total !== "") {
        return Math.max(0, total);
    }

    const grandTotal = numberValue(sale?.grandTotal);
    if (grandTotal > 0) return grandTotal;

    const subtotal = numberValue(sale?.subtotal);
    if (subtotal > 0) {
        return Math.max(0, subtotal - numberValue(sale?.discount));
    }

    return calculateItemsTotal(sale);
}

function getAmountPaid(sale) {
    return getPaymentAmounts(sale).totalPaid;
}

function getBalance(sale) {
    if (sale?.balance !== undefined && sale.balance !== null && sale.balance !== "") {
        return Math.max(0, numberValue(sale.balance));
    }

    return Math.max(0, getSaleTotal(sale) - getAmountPaid(sale));
}

function getChange(sale) {
    if (sale?.change !== undefined && sale.change !== null && sale.change !== "") {
        return Math.max(0, numberValue(sale.change));
    }

    return Math.max(0, getAmountPaid(sale) - getSaleTotal(sale));
}

/* =====================================================
   PAYMENT BREAKDOWN
   ===================================================== */

function getPaymentBreakdownHTML(sale) {
    const p = getPaymentAmounts(sale);
    const parts = [];

    if (p.cash > 0) parts.push(`<div>Cash: ${money(p.cash)}</div>`);
    if (p.mpesa > 0) parts.push(`<div>M-Pesa: ${money(p.mpesa)}</div>`);
    if (p.bank > 0) parts.push(`<div>Bank: ${money(p.bank)}</div>`);
    if (p.kopoKopo > 0) parts.push(`<div>Kopo Kopo: ${money(p.kopoKopo)}</div>`);

    if (parts.length) return parts.join("");

    const methods = getSavedPaymentMethods(sale);
    return methods.length
        ? methods.map((method) => `<span>${escapeHTML(method)}</span>`).join(", ")
        : "-";
}

/* =====================================================
   DISPLAY TABLE
   ===================================================== */

function displayReport(data) {
    const table = document.getElementById("reportTable");
    if (!table) {
        console.error('Missing HTML element: id="reportTable"');
        return;
    }

    if (!data.length) {
        table.innerHTML = `
            <tr>
                <td colspan="10" class="no-data">No sales found for these filters.</td>
            </tr>
        `;
        updateFooter([]);
        return;
    }

    table.innerHTML = data.map((sale, index) => {
        const date = getSaleDate(sale);
        const items = Array.isArray(sale.items) ? sale.items : [];

        const productsHTML = items.length
            ? `<div class="product-list">${items.map((item) => `
                <div class="product-item">
                    <span class="product-name">${escapeHTML(item?.name || item?.productName || "Unknown Product")}</span>
                    <span class="product-quantity">× ${getItemQuantity(item)}</span>
                </div>
            `).join("")}</div>`
            : "-";

        const balance = getBalance(sale);
        const change = getChange(sale);

        return `
            <tr>
                <td>${index + 1}</td>
                <td class="products-column">${productsHTML}</td>
                <td>${escapeHTML(sale.receiptNo || sale.id || "-")}</td>
                <td>${escapeHTML(sale.customerName || "Walk-in Customer")}</td>
                <td>${escapeHTML(sale.cashier || "-")}</td>
                <td><div class="payment-breakdown">${getPaymentBreakdownHTML(sale)}</div></td>
                <td>${money(getSaleTotal(sale))}</td>
                <td>${money(getAmountPaid(sale))}</td>
                <td>${money(balance)}${change > 0 ? `<br><small>Change: ${money(change)}</small>` : ""}</td>
                <td>${date ? escapeHTML(date.toLocaleString("en-KE")) : "N/A"}</td>
            </tr>
        `;
    }).join("");

    updateFooter(data);
}

/* =====================================================
   STATISTICS - ALL SALES, NOT JUST THE LATEST 50
   ===================================================== */

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
        const total = getSaleTotal(sale);
        const payments = getPaymentAmounts(sale);

        totalSales += total;
        cash += payments.cash;
        mpesa += payments.mpesa;
        bank += payments.bank;
        kopoKopo += payments.kopoKopo;

        totalPaid += getAmountPaid(sale);
        totalBalance += getBalance(sale);

        let cost = numberValue(sale.totalCost || sale.cost);

        if (cost === 0 && Array.isArray(sale.items)) {
            cost = sale.items.reduce(
                (sum, item) =>
                    sum + getItemBuyingPrice(item) * getItemQuantity(item),
                0
            );
        }

        totalCost += cost;

        totalProfit += sale.profit !== undefined && sale.profit !== null
            ? numberValue(sale.profit)
            : total - cost;
    });

    const transactions = data.length;

    setText("totalSales", money(totalSales));
    setText("totalTransactions", transactions);
    setText("cashSales", money(cash));
    setText("mpesaSales", money(mpesa));
    setText("bankSales", money(bank));
    setText("kopoKopoSales", money(kopoKopo));
    setText("grandTotal", money(totalSales));

    setText("summarySales", money(totalSales));
    setText("summaryTransactions", transactions);
    setText("summaryCash", money(cash));
    setText("summaryMpesa", money(mpesa));
    setText("summaryBank", money(bank));
    setText("summaryKopoKopo", money(kopoKopo));
    setText("summaryPaid", money(totalPaid));
    setText("summaryBalance", money(totalBalance));
    setText("summaryGrandTotal", money(totalSales));

    setText("totalCost", money(totalCost));
    setText("totalProfit", money(totalProfit));
}

/* =====================================================
   FOOTER
   ===================================================== */

function updateFooter(data) {
    let total = 0;
    let paid = 0;
    let balance = 0;

    data.forEach((sale) => {
        total += getSaleTotal(sale);
        paid += getAmountPaid(sale);
        balance += getBalance(sale);
    });

    setText("footerSales", money(total));
    setText("footerPaid", money(paid));
    setText("footerBalance", money(balance));
}

/* =====================================================
   FILTERS
   ===================================================== */

function filterSales() {
    const fromValue = document.getElementById("fromDate")?.value || "";
    const toValue = document.getElementById("toDate")?.value || "";
    const payment = document.getElementById("paymentFilter")?.value || "";
    const search = (document.getElementById("searchReport")?.value || "").toLowerCase().trim();

    /*
     * Date and payment filters run over all sales so users
     * can find older transactions. The default table shows
     * the latest 50.
     */
    let result = allSales.filter((sale) => {
        const date = getSaleDate(sale);

        if (fromValue) {
            const from = new Date(`${fromValue}T00:00:00`);
            if (!date || date < from) return false;
        }

        if (toValue) {
            const to = new Date(`${toValue}T23:59:59.999`);
            if (!date || date > to) return false;
        }

        if (payment && !saleUsesPaymentMethod(sale, payment)) {
            return false;
        }

        const names = Array.isArray(sale.items)
            ? sale.items.map((item) => item?.name || item?.productName || "").join(" ")
            : "";

        const searchable = [
            sale.customerName,
            sale.cashier,
            sale.receiptNo,
            sale.id,
            names,
            getPaymentMethods(sale).join(" ")
        ].join(" ").toLowerCase();

        return !search || searchable.includes(search);
    });

    const hasFilters = Boolean(fromValue || toValue || payment || search);

    if (!hasFilters) {
        result = allSales.slice(0, DISPLAY_LIMIT);
    }

    filteredSales = result;

    displayReport(filteredSales);

    // Keep overall cards based on every sale unless a filter is active.
    updateStatistics(hasFilters ? filteredSales : allSales);
    updateReportPeriod();

    setText(
        "reportCount",
        `Showing ${filteredSales.length} records of ${allSales.length} total sales`
    );
}

/* =====================================================
   REPORT PERIOD
   ===================================================== */

function updateReportPeriod() {
    const from = document.getElementById("fromDate")?.value || "";
    const to = document.getElementById("toDate")?.value || "";
    const payment = document.getElementById("paymentFilter")?.value || "";

    let period = "All Sales";

    if (from && to) period = `From ${from} to ${to}`;
    else if (from) period = `From ${from}`;
    else if (to) period = `Up to ${to}`;

    if (payment) period += ` • ${payment}`;

    setText("reportPeriod", period);
}

/* =====================================================
   CSV EXPORT
   ===================================================== */

function downloadCSV() {
    if (!filteredSales.length) {
        alert("There is no report data to download.");
        return;
    }

    const rows = [[
        "#", "Products", "Receipt", "Customer", "Cashier",
        "Payment Methods", "Cash", "M-Pesa", "Bank", "Kopo Kopo",
        "Sales", "Paid", "Balance", "Change", "Date"
    ]];

    filteredSales.forEach((sale, index) => {
        const items = Array.isArray(sale.items) ? sale.items : [];
        const payments = getPaymentAmounts(sale);
        const date = getSaleDate(sale);

        rows.push([
            index + 1,
            items.map((item) =>
                `${item?.name || item?.productName || "Unknown"} x ${getItemQuantity(item)}`
            ).join(" | "),
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
        .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `Lebarto-Sales-Report-${getFileDate()}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/* =====================================================
   EVENT LISTENERS
   ===================================================== */

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
            row.style.display =
                !value || row.textContent.toLowerCase().includes(value)
                    ? ""
                    : "none";
        });
    });

document.getElementById("printReportBtn")
    ?.addEventListener("click", () => window.print());

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

/* =====================================================
   UTILITIES
   ===================================================== */

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

function setTableMessage(message) {
    const table = document.getElementById("reportTable");
    if (!table) return;

    table.innerHTML = `
        <tr>
            <td colspan="10" class="no-data">${escapeHTML(message)}</td>
        </tr>
    `;
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

console.log("LEBARTO SALES REPORT MODULE LOADED.");
