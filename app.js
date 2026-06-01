let currentMonth = new Date().toISOString().slice(0, 7); 
document.getElementById('monthSelector').value = currentMonth;
let chartInstance = null;

// Currency Formatter
const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

function loadData() {
    currentMonth = document.getElementById('monthSelector').value;
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
    // Add to the beginning of the array so newest is at the top
    data.expenses.unshift({ id: Date.now(), name, amount, category }); 
    
    localStorage.setItem(currentMonth, JSON.stringify(data));
    
    document.getElementById('expenseName').value = '';
    document.getElementById('expenseAmount').value = '';
    loadData();
}

// NEW: Render the list of expenses
function renderExpenseList(expenses) {
    const listContainer = document.getElementById('expenseList');
    listContainer.innerHTML = ''; // Clear current list

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

    // Professional Chart Styling
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Spent', 'Remaining'],
            datasets: [{
                data: [totalExpenses, remaining],
                backgroundColor: ['#ff3b30', '#34c759'], // iOS Red and Green
                borderWidth: 0, // Removes ugly borders
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%', // Makes the doughnut thinner and more modern
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { family: '-apple-system', size: 14 }
                    }
                }
            }
        }
    });
}

document.getElementById('monthSelector').addEventListener('change', loadData);
loadData();