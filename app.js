// Application Memory Management
let currentMonth = localStorage.getItem('last_visited_month') || new Date().toISOString().slice(0, 7); 
document.getElementById('monthSelector').value = currentMonth;
let chartInstance = null;

const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

// --- DYNAMIC CATEGORY MANAGER ---
function loadCategories() {
    let savedCats = JSON.parse(localStorage.getItem('app_categories'));
    if (!savedCats || savedCats.length === 0) {
        // Default base categories
        savedCats = ["Food & Dining", "Transportation", "Utilities & Bills", "Shopping", "Entertainment"];
        localStorage.setItem('app_categories', JSON.stringify(savedCats));
    }
    const datalist = document.getElementById('categoryOptions');
    datalist.innerHTML = '';
    savedCats.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        datalist.appendChild(option);
    });
}

// --- SECURITY AND IDENTITY VERIFICATION ---
const savedPin = localStorage.getItem('app_pin');
if (!savedPin) {
    document.getElementById('loginTitle').innerText = "Set Up App";
    document.getElementById('loginSubtitle').innerText = "Create a 4-digit security PIN";
}

function handleLogin() {
    const enteredPin = document.getElementById('pinInput').value;
    const errorText = document.getElementById('loginError');

    if (enteredPin.length < 4) {
        errorText.innerText = "PIN must be exactly 4 digits";
        errorText.classList.remove('hidden');
        return;
    }

    if (!savedPin) {
        localStorage.setItem('app_pin', enteredPin);
        unlockApp();
    } else {
        if (enteredPin === savedPin) {
            unlockApp();
        } else {
            errorText.innerText = "Incorrect PIN code";
            errorText.classList.remove('hidden');
            document.getElementById('pinInput').value = '';
        }
    }
}

function unlockApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    loadCategories(); // Load saved categories on unlock
    loadData();
    loadStatements();
}

// --- SUB-MENU/TAB DISPATCHER ---
function switchTab(tab) {
    document.getElementById('tabHome').classList.add('hidden');
    document.getElementById('tabHistory').classList.add('hidden');
    document.getElementById('navHome').classList.remove('active');
    document.getElementById('navHistory').classList.remove('active');

    if (tab === 'home') {
        document.getElementById('tabHome').classList.remove('hidden');
        document.getElementById('navHome').classList.add('active');
        loadData();
    } else {
        document.getElementById('tabHistory').classList.remove('hidden');
        document.getElementById('navHistory').classList.add('active');
        loadStatements();
    }
}

// --- ACTIVE TRANSACTION METRICS ---
let editingExpenseId = null;

function loadData() {
    currentMonth = document.getElementById('monthSelector').value;
    localStorage.setItem('last_visited_month', currentMonth);
    
    const data = JSON.parse(localStorage.getItem(currentMonth)) || { income: 0, expenses: [] };
    document.getElementById('incomeInput').value = data.income || '';
    
    const totalExpenses = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const balance = data.income - totalExpenses;
    document.getElementById('currentBalance').innerText = formatMoney(balance);

    updateChart(data, totalExpenses, balance);
    renderExpenseList(data.expenses);
}

function setIncome() {
    const income = parseFloat(document.getElementById('incomeInput').value) || 0;
    const data = JSON.parse(localStorage.getItem(currentMonth)) || { income: 0, expenses: [] };
    data.income = income;
    localStorage.setItem(currentMonth, JSON.stringify(data));
    loadData();
}

function addExpense() {
    const name = document.getElementById('expenseName').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value || "Miscellaneous";

    if (!name || !amount) return alert("Please clarify item details and pricing.");

    // Auto-Save Custom Category Feature
    let savedCats = JSON.parse(localStorage.getItem('app_categories')) || [];
    if (!savedCats.includes(category)) {
        savedCats.push(category);
        localStorage.setItem('app_categories', JSON.stringify(savedCats));
        loadCategories(); // Instantly refresh dropdown
    }

    const data = JSON.parse(localStorage.getItem(currentMonth)) || { income: 0, expenses: [] };
    
    if (editingExpenseId) {
        const index = data.expenses.findIndex(exp => exp.id === editingExpenseId);
        if (index !== -1) data.expenses[index] = { id: editingExpenseId, name, amount, category };
        editingExpenseId = null;
        document.getElementById('addBtn').innerText = "Add Transaction";
    } else {
        data.expenses.unshift({ id: Date.now(), name, amount, category }); 
    }
    
    localStorage.setItem(currentMonth, JSON.stringify(data));
    
    document.getElementById('expenseName').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseCategory').value = '';
    loadData();
}

function editExpense(id) {
    const data = JSON.parse(localStorage.getItem(currentMonth));
    const expense = data.expenses.find(exp => exp.id === id);
    if (expense) {
        document.getElementById('expenseName').value = expense.name;
        document.getElementById('expenseAmount').value = expense.amount;
        document.getElementById('expenseCategory').value = expense.category;
        editingExpenseId = id;
        document.getElementById('addBtn').innerText = "Update Transaction";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function deleteExpense(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    const data = JSON.parse(localStorage.getItem(currentMonth));
    data.expenses = data.expenses.filter(exp => exp.id !== id);
    localStorage.setItem(currentMonth, JSON.stringify(data));
    loadData();
}

function renderExpenseList(expenses) {
    const listContainer = document.getElementById('expenseList');
    listContainer.innerHTML = ''; 
    if (expenses.length === 0) {
        listContainer.innerHTML = '<p style="color: #8e8e93; text-align: center; padding: 10px;">No recorded charges.</p>';
        return;
    }
    expenses.forEach(exp => {
        const item = document.createElement('div');
        item.className = 'expense-item';
        item.innerHTML = `
            <div class="expense-info">
                <span class="expense-name">${exp.name}</span>
                <span class="expense-category">${exp.category}</span>
            </div>
            <div style="display: flex; align-items: center;">
                <span class="expense-amount" style="margin-right: 10px;">-${formatMoney(exp.amount)}</span>
                <div class="action-btns">
                    <button onclick="editExpense(${exp.id})" class="icon-btn edit-btn">✎</button>
                    <button onclick="deleteExpense(${exp.id})" class="icon-btn delete-btn">✖</button>
                </div>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

function updateChart(data, totalExpenses, balance) {
    const chartRemaining = Math.max(0, balance);
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (chartInstance) chartInstance.destroy(); 
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Total Expenditures', 'Net Leftover'],
            datasets: [{
                data: [totalExpenses, chartRemaining],
                backgroundColor: ['#ff3b30', '#34c759'],
                borderWidth: 0, hoverOffset: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '75%',
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15, font: { family: '-apple-system', size: 13 } } } }
        }
    });
}

// --- LEDGER STATEMENTS & EXPORT LOGIC ---
function loadStatements() {
    const container = document.getElementById('statementsList');
    const checkboxContainer = document.getElementById('exportMonthCheckboxes');
    
    container.innerHTML = '';
    checkboxContainer.innerHTML = '';

    const months = Object.keys(localStorage)
        .filter(key => key.match(/^\d{4}-\d{2}$/))
        .sort((a, b) => b.localeCompare(a));

    if (months.length === 0) {
        container.innerHTML = '<p style="color: #8e8e93; text-align: center; padding: 20px;">No historical timelines logged.</p>';
        checkboxContainer.innerHTML = '<p style="font-size: 13px; color: #8e8e93;">No data to export.</p>';
        return;
    }

    months.forEach(month => {
        const data = JSON.parse(localStorage.getItem(month));
        const totalExpenses = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const remaining = data.income - totalExpenses;
        
        const dateObj = new Date(month + '-02'); 
        const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

        // 1. Populate the Export Checkboxes
        const cbRow = document.createElement('div');
        cbRow.className = 'checkbox-row';
        cbRow.innerHTML = `
            <input type="checkbox" class="export-cb" value="${month}" id="cb_${month}" checked>
            <label for="cb_${month}">${monthName}</label>
        `;
        checkboxContainer.appendChild(cbRow);

        // 2. Populate the History List below it
        const item = document.createElement('div');
        item.className = 'card statement-item';
        item.style.cursor = 'pointer';
        item.innerHTML = `
            <div class="expense-info">
                <span class="expense-name">${monthName}</span>
                <span class="expense-category">Budgeted: ${formatMoney(data.income)}</span>
            </div>
            <div style="text-align: right;">
                <span class="expense-amount" style="color: var(--text-primary); display:block; font-size:14px;">Used: ${formatMoney(totalExpenses)}</span>
                <span class="statement-amount ${remaining >= 0 ? 'positive' : ''}" style="font-size:12px; font-weight:600;">
                    ${remaining >= 0 ? 'Saved' : 'Overdraft'}: ${formatMoney(Math.abs(remaining))}
                </span>
            </div>
        `;
        
        item.onclick = () => {
            document.getElementById('monthSelector').value = month;
            switchTab('home');
        };

        container.appendChild(item);
    });
}

function getSelectedMonths() {
    const checkboxes = document.querySelectorAll('.export-cb:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Export to CSV Spreadsheet
function downloadCSV() {
    const selectedMonths = getSelectedMonths();
    if (selectedMonths.length === 0) return alert("Please select at least one month to export.");

    let csvContent = "Month,Type,Description,Category,Amount (INR)\n";

    selectedMonths.forEach(month => {
        const data = JSON.parse(localStorage.getItem(month));
        if (data) {
            csvContent += `"${month}","Income","Total Monthly Budget","Income","${data.income}"\n`;
            data.expenses.forEach(exp => {
                const safeName = exp.name.replace(/"/g, '""'); 
                const safeCat = exp.category.replace(/"/g, '""');
                csvContent += `"${month}","Expense","${safeName}","${safeCat}","${exp.amount}"\n`;
            });
        }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Expense_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Native iOS Sharing (WhatsApp, Mail, iMessage)
async function shareSummary() {
    const selectedMonths = getSelectedMonths();
    if (selectedMonths.length === 0) return alert("Please select at least one month to share.");

    let summary = "📊 Expense Report\n\n";
    let grandIncome = 0;
    let grandSpent = 0;

    selectedMonths.forEach(month => {
        const data = JSON.parse(localStorage.getItem(month));
        if (data) {
            const spent = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
            const saved = data.income - spent;
            
            const dateObj = new Date(month + '-02'); 
            const monthName = dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });

            summary += `[${monthName}]\n`;
            summary += `Income: ${formatMoney(data.income)}\n`;
            summary += `Spent: ${formatMoney(spent)}\n`;
            summary += `Saved: ${formatMoney(saved)}\n\n`;
            
            grandIncome += data.income;
            grandSpent += spent;
        }
    });

    if (selectedMonths.length > 1) {
        summary += `=== CONSOLIDATED ===\n`;
        summary += `Total Income: ${formatMoney(grandIncome)}\n`;
        summary += `Total Spent: ${formatMoney(grandSpent)}\n`;
        summary += `Total Saved: ${formatMoney(grandIncome - grandSpent)}\n`;
    }

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Expense Report',
                text: summary
            });
        } catch (err) {
            console.log('Share canceled or failed', err);
        }
    } else {
        alert("Your device doesn't support native sharing. Please use Download CSV instead.");
    }
}

document.getElementById('monthSelector').addEventListener('change', loadData);
