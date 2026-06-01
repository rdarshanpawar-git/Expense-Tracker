// Initialize state
let currentMonth = new Date().toISOString().slice(0, 7); // Format: YYYY-MM
document.getElementById('monthSelector').value = currentMonth;
let chartInstance = null;

// Load data when the page opens or month changes
function loadData() {
    currentMonth = document.getElementById('monthSelector').value;
    const data = JSON.parse(localStorage.getItem(currentMonth)) || { income: 0, expenses: [] };
    
    document.getElementById('incomeInput').value = data.income || '';
    updateChart(data);
}

// Save Income
function setIncome() {
    const income = parseFloat(document.getElementById('incomeInput').value);
    const data = JSON.parse(localStorage.getItem(currentMonth)) || { income: 0, expenses: [] };
    data.income = income;
    localStorage.setItem(currentMonth, JSON.stringify(data));
    loadData();
}

// Add Expense
function addExpense() {
    const name = document.getElementById('expenseName').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;

    if (!name || !amount) return alert("Please fill out all fields");

    const data = JSON.parse(localStorage.getItem(currentMonth)) || { income: 0, expenses: [] };
    data.expenses.push({ name, amount, category });
    
    localStorage.setItem(currentMonth, JSON.stringify(data));
    
    // Clear inputs
    document.getElementById('expenseName').value = '';
    document.getElementById('expenseAmount').value = '';
    loadData();
}

// Update the Graphical Representation
function updateChart(data) {
    const totalExpenses = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remaining = Math.max(0, data.income - totalExpenses);

    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    if (chartInstance) chartInstance.destroy(); // Clear old chart

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Total Spent', 'Remaining Income'],
            datasets: [{
                data: [totalExpenses, remaining],
                backgroundColor: ['#ff6384', '#36a2eb']
            }]
        }
    });
}

// Event Listeners
document.getElementById('monthSelector').addEventListener('change', loadData);

// Initial Load
loadData();