// App State
let currentMonth = localStorage.getItem('last_visited_month') || new Date().toISOString().slice(0, 7); 
document.getElementById('monthSelector').value = currentMonth;
let chartInstance = null;

// Currency Formatter (Switched to Indian Rupee)
const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-IN', { 
        style: 'currency', 
        currency: 'INR',
        maximumFractionDigits: 0 
    }).format(amount);
};

// --- LOGIN LOGIC ---
const savedPin = localStorage.getItem('app_pin');

if (!savedPin) {
    document.getElementById('loginTitle').innerText = "Set Up";
    document.getElementById('loginSubtitle').innerText = "Create a 4-digit PIN for privacy";
}

function handleLogin() {
    const enteredPin = document.getElementById('pinInput').value;
    const errorText = document.getElementById('loginError');

    if (enteredPin.length < 4) {
        errorText.innerText = "Enter 4 digits";
        errorText.classList.remove('hidden');
        return;
    }

    if (!savedPin) {
        // Set new PIN
        localStorage.setItem('app_pin', enteredPin);
        unlockApp();
    } else {
        // Check existing PIN
        if (enteredPin === savedPin) {
            unlockApp();
        } else {
            errorText.innerText = "Incorrect PIN";
            errorText.classList.remove('hidden');
            document.getElementById('pinInput').value = '';
        }
    }
}

function unlockApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    loadData();
    loadStatements();
}

// --- NAVIGATION ---
function switchTab(tab) {
    document.getElementById('tabHome').classList.add('hidden');
    document.getElementById('tabHistory').classList.add('hidden');
    document.getElementById('navHome').classList.remove('active');
    document.getElementById('navHistory').classList.remove('active');

    if (tab === 'home') {
        document.getElementById('tabHome').classList.remove('hidden');
        document.getElementById('navHome').classList.add('active');
    } else {
        document.getElementById('tabHistory').classList.remove('hidden');
        document.getElementById('navHistory').classList.add('active');
        loadStatements();
    }
}

// --- CORE APP LOGIC ---
function loadData() {
    currentMonth = document.getElementById('monthSelector').value;
    
    // Remember where the user left off
    localStorage.setItem('last_visited_month', currentMonth);
    
    const data = JSON.parse(localStorage.getItem(currentMonth)) || { income: 0, expenses: [] };
    
    document.getElementById('incomeInput').value = data.income || '';
    updateChart(data);
    renderExpenseList(data.expenses);
}

function setIncome() {
    const income = parseFloat(document.getElementById('incomeInput').value);
    const data = JSON.parse(localStorage.getItem(currentMonth)) || { income: 0, expenses: [] };
    data.income = income;
    localStorage.setItem(currentMonth, JSON.stringify(data));
    loadData();
}

function addExpense() {
    const name = document.getElementById('expenseName').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;

    if (!name || !amount) return alert("Please fill out all fields");

    const data = JSON.parse(localStorage.getItem(currentMonth)) || { income: 0, expenses: [] };
    data.expenses.unshift({ id: Date.now(), name, amount, category }); 
    
    localStorage.setItem(currentMonth, JSON.stringify(data));
    
    document.getElementById('expenseName').value = '';
    document.getElementById('expenseAmount').value = '';
    loadData();
}

function renderExpenseList(expenses) {
    const listContainer = document.getElementById('expenseList');
    listContainer.innerHTML = ''; 

    if (expenses.length === 0) {
        listContainer.innerHTML = '<p style="color: #8e8e93; text-align: center;">No transactions yet.</p>';
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
            <span class="expense-amount">-${formatMoney(exp.amount)}</span>
        `;
        listContainer.appendChild(item);
    });
}

function updateChart(data) {
    const totalExpenses = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remaining = Math.max(0, data.income - totalExpenses);

    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    if (chartInstance) chartInstance.destroy(); 

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Spent', 'Remaining'],
            datasets: [{
                data: [totalExpenses, remaining],
                backgroundColor: ['#ff3b30', '#34c759'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { family: '-apple-system', size: 14 } } }
            }
        }
    });
}

// --- HISTORY STATEMENTS LOGIC ---
function loadStatements() {
    const container = document.getElementById('statementsList');
    container.innerHTML = '';

    // Find all keys in localStorage that match the YYYY-MM format
    const months = Object.keys(localStorage)
        .filter(key => key.match(/^\d{4}-\d{2}$/))
        .sort((a, b) => b.localeCompare(a)); // Sort newest first

    if (months.length === 0) {
        container.innerHTML = '<p style="color: #8e8e93; text-align: center;">No past statements available.</p>';
        return;
    }

    months.forEach(month => {
        const data = JSON.parse(localStorage.getItem(month));
        const totalExpenses = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const remaining = data.income - totalExpenses;
        
        // Convert '2023-10' to 'October 2023'
        const dateObj = new Date(month + '-02'); 
        const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

        const item = document.createElement('div');
        item.className = 'card statement-item';
        item.innerHTML = `
            <div class="expense-info">
                <span class="expense-name">${monthName}</span>
                <span class="expense-category">Income: ${formatMoney(data.income)}</span>
            </div>
            <div style="text-align: right;">
                <span class="expense-amount" style="color: var(--text-primary); display:block; font-size:14px;">Spent: ${formatMoney(totalExpenses)}</span>
                <span class="statement-amount ${remaining >= 0 ? 'positive' : ''}" style="font-size:12px; font-weight:600;">
                    Saved: ${formatMoney(remaining)}
                </span>
            </div>
        `;
        
        // Make the statement clickable to view that month
        item.onclick = () => {
            document.getElementById('monthSelector').value = month;
            switchTab('home');
            loadData();
        };

        container.appendChild(item);
    });
}

// Event Listeners
document.getElementById('monthSelector').addEventListener('change', loadData);