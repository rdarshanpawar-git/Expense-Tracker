// Application Memory Management
let currentMonth = localStorage.getItem('last_visited_month') || new Date().toISOString().slice(0, 7); 
document.getElementById('monthSelector').value = currentMonth;
let chartInstance = null;
let newServiceWorkerReady = null;

const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

// --- SERVICE WORKER UPDATE MANAGEMENT ---
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('Service Worker not supported');
        return;
    }

    navigator.serviceWorker.register('sw.js').then(registration => {
        // Check for updates every 30 minutes
        setInterval(() => {
            registration.update();
        }, 30 * 60 * 1000);

        // Listen for new service worker waiting
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'waiting' && navigator.serviceWorker.controller) {
                    // New service worker is ready, show notification
                    newServiceWorkerReady = newWorker;
                    showUpdateNotification();
                }
            });
        });

        // Handle service worker controller change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // New service worker has taken control, reload page
            window.location.reload();
        });
    }).catch(err => console.error('Service Worker registration failed:', err));
}

function showUpdateNotification() {
    const banner = document.getElementById('updateNotification');
    if (banner) {
        banner.classList.remove('hidden');
    }
}

function dismissUpdate() {
    const banner = document.getElementById('updateNotification');
    if (banner) {
        banner.classList.add('hidden');
    }
}

function acceptUpdate() {
    if (newServiceWorkerReady) {
        // Tell the new service worker to skip waiting
        newServiceWorkerReady.postMessage({ type: 'SKIP_WAITING' });
    }
}

// --- DYNAMIC CATEGORY MANAGER ---
function loadCategories() {
    let savedCats = JSON.parse(localStorage.getItem('app_categories'));
    if (!savedCats || savedCats.length === 0) {
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
    document.getElementById('homeScreen').classList.remove('hidden');
}

function openExpenseTracker() {
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('splitExpenseApp').classList.add('hidden');
    loadCategories(); 
    loadData();
    loadStatements();
}

function openSplitExpense() {
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('splitExpenseApp').classList.remove('hidden');
    resetSplitForm();
}

function backToHome() {
    document.getElementById('homeScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('splitExpenseApp').classList.add('hidden');
}

function logout() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('splitExpenseApp').classList.add('hidden');
    document.getElementById('pinInput').value = '';
}

// --- SUB-MENU/TAB DISPATCHER ---
function switchTab(tab) {
    document.getElementById('tabHome').classList.add('hidden');
    document.getElementById('tabHistory').classList.add('hidden');
    document.getElementById('tabMenu').classList.add('hidden');
    document.getElementById('navHome').classList.remove('active');
    document.getElementById('navHistory').classList.remove('active');
    document.getElementById('navMenu').classList.remove('active');

    if (tab === 'home') {
        document.getElementById('tabHome').classList.remove('hidden');
        document.getElementById('navHome').classList.add('active');
        loadData();
    } else if (tab === 'history') {
        document.getElementById('tabHistory').classList.remove('hidden');
        document.getElementById('navHistory').classList.add('active');
        loadStatements();
    } else if (tab === 'menu') {
        document.getElementById('tabMenu').classList.remove('hidden');
        document.getElementById('navMenu').classList.add('active');
    }
}

// --- ACTIVE TRANSACTION METRICS ---
let editingExpenseId = null;

function toggleSplitMode() {
    const splitSection = document.getElementById('splitSection');
    const toggle = document.getElementById('splitToggle');
    if (toggle.checked) {
        splitSection.style.display = 'block';
        updateSplitFields();
    } else {
        splitSection.style.display = 'none';
    }
}

function updateSplitFields() {
    const count = parseInt(document.getElementById('splitCount').value) || 2;
    const container = document.getElementById('splitParticipants');
    container.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.style.marginBottom = '10px';
        div.innerHTML = `
            <label style="font-size: 12px; color: #666;">Person ${i + 1}:</label>
            <input type="text" class="split-name" placeholder="Name" style="width: 100%; margin-top: 4px;">
        `;
        container.appendChild(div);
    }
}

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

    let savedCats = JSON.parse(localStorage.getItem('app_categories')) || [];
    if (!savedCats.includes(category)) {
        savedCats.push(category);
        localStorage.setItem('app_categories', JSON.stringify(savedCats));
        loadCategories();
    }

    let splitData = null;
    if (document.getElementById('splitToggle').checked) {
        const participants = [];
        document.querySelectorAll('.split-name').forEach(input => {
            if (input.value.trim()) {
                participants.push(input.value.trim());
            }
        });
        
        if (participants.length < 2) {
            return alert("Enter at least 2 participants for split expense.");
        }
        
        const sharePerPerson = amount / participants.length;
        splitData = {
            isplit: true,
            participants: participants,
            sharePerPerson: parseFloat(sharePerPerson.toFixed(2))
        };
    }

    const data = JSON.parse(localStorage.getItem(currentMonth)) || { income: 0, expenses: [] };
    
    if (editingExpenseId) {
        const index = data.expenses.findIndex(exp => exp.id === editingExpenseId);
        if (index !== -1) data.expenses[index] = { id: editingExpenseId, name, amount, category, split: splitData };
        editingExpenseId = null;
        document.getElementById('addBtn').innerText = "Add Transaction";
    } else {
        data.expenses.unshift({ id: Date.now(), name, amount, category, split: splitData }); 
    }
    
    localStorage.setItem(currentMonth, JSON.stringify(data));
    
    document.getElementById('expenseName').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseCategory').value = '';
    document.getElementById('splitToggle').checked = false;
    document.getElementById('splitSection').style.display = 'none';
    document.getElementById('splitParticipants').innerHTML = '';
    loadData();
}

function editExpense(id) {
    const data = JSON.parse(localStorage.getItem(currentMonth));
    const expense = data.expenses.find(exp => exp.id === id);
    if (expense) {
        document.getElementById('expenseName').value = expense.name;
        document.getElementById('expenseAmount').value = expense.amount;
        document.getElementById('expenseCategory').value = expense.category;
        
        // Restore split data if exists
        if (expense.split && expense.split.isplit) {
            document.getElementById('splitToggle').checked = true;
            document.getElementById('splitCount').value = expense.split.participants.length;
            document.getElementById('splitSection').style.display = 'block';
            updateSplitFields();
            const inputs = document.querySelectorAll('.split-name');
            expense.split.participants.forEach((name, idx) => {
                if (inputs[idx]) inputs[idx].value = name;
            });
        }
        
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
        
        let splitInfo = '';
        if (exp.split && exp.split.isplit) {
            splitInfo = `
                <div style="font-size: 12px; color: #666; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e5ea;">
                    <strong>Split between:</strong> ${exp.split.participants.join(', ')}<br>
                    <strong>Each pays:</strong> ${formatMoney(exp.split.sharePerPerson)}
                </div>
            `;
        }
        
        item.innerHTML = `
            <div class="expense-info">
                <span class="expense-name">${exp.name}</span>
                <span class="expense-category">${exp.category}</span>
                ${splitInfo}
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
            labels: ['Spent', 'Net Leftover'],
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

        const cbRow = document.createElement('div');
        cbRow.className = 'checkbox-row';
        cbRow.innerHTML = `
            <input type="checkbox" class="export-cb" value="${month}" id="cb_${month}" checked>
            <label for="cb_${month}">${monthName}</label>
        `;
        checkboxContainer.appendChild(cbRow);

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

// Export Professional Excel Spreadsheet (Multiple Tabs)
function downloadExcel() {
    const selectedMonths = getSelectedMonths();
    if (selectedMonths.length === 0) return alert("Please select at least one month to export.");

    const workbook = XLSX.utils.book_new();

    selectedMonths.forEach(month => {
        const data = JSON.parse(localStorage.getItem(month));
        if (data) {
            const totalSpent = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
            const saved = data.income - totalSpent;
            
            const dateObj = new Date(month + '-02');
            const tabName = dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });

            const worksheetData = [
                ["Monthly Ledger Report", "", "", ""],
                ["Month", month, "", ""],
                ["", "", "", ""],
                ["Financial Overview", "", "", ""],
                ["Item", "Amount (INR)", "", ""],
                ["Monthly Income", data.income, "", ""],
                ["Total Expenses", totalSpent, "", ""],
                ["Saved / (Overdraft)", saved, "", ""],
                ["", "", "", ""],
                ["Transaction Details", "", "", ""],
                ["Description", "Category", "Amount (INR)", "Date"]
            ];

            data.expenses.forEach(exp => {
                const date = new Date(exp.id).toLocaleDateString('en-IN');
                worksheetData.push([exp.name, exp.category, exp.amount, date]);
            });

            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
            worksheet['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(workbook, worksheet, tabName);
        }
    });

    XLSX.writeFile(workbook, `Consolidated_Report_${Date.now()}.xlsx`);
}

// Share Detailed Text Summary Natively
async function shareSummary() {
    const selectedMonths = getSelectedMonths();
    if (selectedMonths.length === 0) return alert("Please select at least one month to share.");

    let summary = "📊 Detailed Expense Report (Consolidated)\n\n";
    let grandIncome = 0;
    let grandSpent = 0;

    selectedMonths.forEach(month => {
        const data = JSON.parse(localStorage.getItem(month));
        if (data) {
            const spent = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
            const saved = data.income - spent;
            const dateObj = new Date(month + '-02'); 
            const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

            summary += `[${monthName}]\n`;
            summary += `------------------------------\n`;
            summary += `Income: ${formatMoney(data.income)}\n`;
            summary += `Spent: ${formatMoney(spent)}\n`;
            summary += `Saved: ${formatMoney(saved)}\n`;
            
            if (data.expenses.length > 0) {
                summary += `\nTop Transactions:\n`;
                const sorted = [...data.expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);
                sorted.forEach(exp => {
                    summary += `- ${exp.name} (${formatMoney(exp.amount)}) [${exp.category}]\n`;
                });
            } else {
                summary += `No transactions logged.\n`;
            }
            summary += `------------------------------\n\n`;
            
            grandIncome += data.income;
            grandSpent += spent;
        }
    });

    if (selectedMonths.length > 1) {
        summary += `🌎 === GRAND TOTAL (ALL SELECTED MONTHS) ===\n`;
        summary += `Total Income: ${formatMoney(grandIncome)}\n`;
        summary += `Total Spent: ${formatMoney(grandSpent)}\n`;
        summary += `Total Saved: ${formatMoney(grandIncome - grandSpent)}\n`;
    }

    if (navigator.share) {
        try {
            await navigator.share({ title: 'Consolidated Expense Report', text: summary });
        } catch (err) { console.log('Share canceled or failed', err); }
    } else { alert("Sharing not supported on this device."); }
}

// Generate Graphical Print-to-PDF Report
function generatePrintReport() {
    const selectedMonths = getSelectedMonths();
    if (selectedMonths.length === 0) return alert("Please select months for the PDF report.");

    // Create a temporary container for PDF content
    const pdfContainer = document.createElement('div');
    pdfContainer.id = 'pdfReportContent';
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.width = '800px';
    pdfContainer.style.backgroundColor = '#ffffff';
    pdfContainer.style.padding = '40px';
    pdfContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    let htmlContent = `
        <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px solid #007aff; padding-bottom: 20px;">
            <h1 style="color: #1c1c1e; margin: 0 0 5px 0; font-size: 32px;">Expense Ledger Report</h1>
            <p style="color: #8e8e93; margin: 0; font-size: 14px;">Generated on ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-IN')}</p>
        </div>
    `;

    let grandIncome = 0;
    let grandSpent = 0;

    selectedMonths.forEach((month, idx) => {
        const data = JSON.parse(localStorage.getItem(month));
        if (data) {
            const spent = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
            const saved = data.income - spent;
            const dateObj = new Date(month + '-02');
            const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

            grandIncome += data.income;
            grandSpent += spent;

            htmlContent += `
                <div style="margin-bottom: 40px; page-break-inside: avoid; border: 1px solid #e5e5ea; padding: 20px; border-radius: 12px; ${idx > 0 ? 'margin-top: 30px;' : ''}">
                    <h2 style="color: #007aff; margin: 0 0 20px 0; font-size: 24px; border-bottom: 2px solid #f2f2f7; padding-bottom: 10px;">${monthName}</h2>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                        <div style="background: #f9f9fb; padding: 15px; border-radius: 8px;">
                            <p style="color: #8e8e93; margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase;">Monthly Income</p>
                            <p style="color: #34c759; margin: 0; font-size: 20px; font-weight: bold;">${formatMoney(data.income)}</p>
                        </div>
                        <div style="background: #f9f9fb; padding: 15px; border-radius: 8px;">
                            <p style="color: #8e8e93; margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase;">Total Expenses</p>
                            <p style="color: #ff3b30; margin: 0; font-size: 20px; font-weight: bold;">-${formatMoney(spent)}</p>
                        </div>
                        <div style="background: ${saved >= 0 ? '#d1f4d1' : '#ffd9d9'}; padding: 15px; border-radius: 8px;">
                            <p style="color: #8e8e93; margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase;">Balance</p>
                            <p style="color: ${saved >= 0 ? '#34c759' : '#ff3b30'}; margin: 0; font-size: 20px; font-weight: bold;">${formatMoney(saved)}</p>
                        </div>
                    </div>

                    <h3 style="color: #1c1c1e; margin: 20px 0 15px 0; font-size: 16px; border-bottom: 1px solid #e5e5ea; padding-bottom: 8px;">Transaction Details</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: #f2f2f7; border-bottom: 2px solid #e5e5ea;">
                                <th style="text-align: left; padding: 12px; color: #1c1c1e; font-weight: 600;">Description</th>
                                <th style="text-align: left; padding: 12px; color: #1c1c1e; font-weight: 600;">Category</th>
                                <th style="text-align: right; padding: 12px; color: #1c1c1e; font-weight: 600;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.expenses.length === 0 
                                ? `<tr><td colspan="3" style="text-align: center; color: #8e8e93; padding: 15px;">No transactions recorded</td></tr>`
                                : data.expenses.map(exp => `
                                    <tr style="border-bottom: 1px solid #e5e5ea;">
                                        <td style="padding: 12px; color: #1c1c1e;">${exp.name}</td>
                                        <td style="padding: 12px; color: #8e8e93; font-size: 12px;">${exp.category}</td>
                                        <td style="padding: 12px; text-align: right; color: #ff3b30; font-weight: 600;">-${formatMoney(exp.amount)}</td>
                                    </tr>
                                `).join('')
                            }
                        </tbody>
                    </table>
                </div>
            `;
        }
    });

    if (selectedMonths.length > 1) {
        htmlContent += `
            <div style="background: linear-gradient(135deg, #007aff, #005bb5); color: white; padding: 25px; border-radius: 12px; margin-top: 30px; page-break-inside: avoid;">
                <h2 style="color: white; margin: 0 0 15px 0; font-size: 22px;">Consolidated Summary</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                    <div>
                        <p style="margin: 0 0 5px 0; font-size: 12px; opacity: 0.9; text-transform: uppercase;">Total Income</p>
                        <p style="margin: 0; font-size: 24px; font-weight: bold;">${formatMoney(grandIncome)}</p>
                    </div>
                    <div>
                        <p style="margin: 0 0 5px 0; font-size: 12px; opacity: 0.9; text-transform: uppercase;">Total Expenses</p>
                        <p style="margin: 0; font-size: 24px; font-weight: bold;">-${formatMoney(grandSpent)}</p>
                    </div>
                    <div>
                        <p style="margin: 0 0 5px 0; font-size: 12px; opacity: 0.9; text-transform: uppercase;">Overall Balance</p>
                        <p style="margin: 0; font-size: 24px; font-weight: bold;">${formatMoney(grandIncome - grandSpent)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    pdfContainer.innerHTML = htmlContent;
    document.body.appendChild(pdfContainer);

    // Generate PDF using html2pdf
    const element = document.getElementById('pdfReportContent');
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `Expense_Report_${new Date().toISOString().slice(0, 7)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'], after: '.page-break' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        document.body.removeChild(pdfContainer);
    }).catch(err => {
        console.error('PDF generation failed:', err);
        alert('PDF generation failed. Please try again.');
        document.body.removeChild(pdfContainer);
    });
}

document.getElementById('monthSelector').addEventListener('change', loadData);

// --- SPLIT EXPENSE FEATURE ---
function updateSplitParticipantFields() {
    const count = parseInt(document.getElementById('splitParticipantCount').value) || 2;
    const container = document.getElementById('splitParticipantsList');
    container.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.style.marginBottom = '10px';
        div.innerHTML = `
            <label style="font-size: 12px; color: #666;">Person ${i + 1}:</label>
            <input type="text" class="split-participant-name" placeholder="Name (e.g., John)" style="width: 100%; margin-top: 4px;">
        `;
        container.appendChild(div);
    }
}

function resetSplitForm() {
    document.getElementById('splitExpenseName').value = '';
    document.getElementById('splitExpenseAmount').value = '';
    document.getElementById('splitParticipantCount').value = '2';
    document.getElementById('splitParticipantsList').innerHTML = '';
    document.getElementById('splitAmountPerPerson').innerText = '₹0';
    document.getElementById('splitSummaryOutput').classList.add('hidden');
    updateSplitParticipantFields();
}

function generateSplitSummary() {
    const expenseName = document.getElementById('splitExpenseName').value.trim();
    const totalAmount = parseFloat(document.getElementById('splitExpenseAmount').value);
    
    if (!expenseName || !totalAmount || totalAmount <= 0) {
        return alert('Please enter expense name and valid amount');
    }
    
    const participants = [];
    document.querySelectorAll('.split-participant-name').forEach(input => {
        if (input.value.trim()) {
            participants.push(input.value.trim());
        }
    });
    
    if (participants.length < 2) {
        return alert('Please add at least 2 participants');
    }
    
    const amountPerPerson = (totalAmount / participants.length).toFixed(2);
    document.getElementById('splitAmountPerPerson').innerText = formatMoney(amountPerPerson);
    
    // Generate summary text
    let summaryText = `💰 EXPENSE SPLIT SUMMARY\n`;
    summaryText += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    summaryText += `Expense: ${expenseName}\n`;
    summaryText += `Total Amount: ${formatMoney(totalAmount)}\n`;
    summaryText += `Number of People: ${participants.length}\n`;
    summaryText += `Amount per Person: ${formatMoney(amountPerPerson)}\n\n`;
    
    summaryText += `Participants & Amounts:\n`;
    summaryText += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    participants.forEach((name, idx) => {
        summaryText += `${idx + 1}. ${name}: ${formatMoney(amountPerPerson)}\n`;
    });
    
    summaryText += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summaryText += `Generated: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}\n`;
    
    document.getElementById('splitSummaryText').innerText = summaryText;
    document.getElementById('splitSummaryOutput').classList.remove('hidden');
}

function copySplitSummary() {
    const summaryText = document.getElementById('splitSummaryText').innerText;
    navigator.clipboard.writeText(summaryText).then(() => {
        alert('Summary copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

function shareSplitSummary() {
    const expenseName = document.getElementById('splitExpenseName').value;
    const summaryText = document.getElementById('splitSummaryText').innerText;
    
    if (navigator.share) {
        navigator.share({
            title: `Split Expense: ${expenseName}`,
            text: summaryText
        }).catch(err => console.log('Share canceled:', err));
    } else {
        alert('Sharing not supported. Use "Copy to Clipboard" instead.');
    }
}

function exportSplitPDF() {
    const expenseName = document.getElementById('splitExpenseName').value.trim();
    const totalAmount = parseFloat(document.getElementById('splitExpenseAmount').value);
    const participants = [];
    
    document.querySelectorAll('.split-participant-name').forEach(input => {
        if (input.value.trim()) {
            participants.push(input.value.trim());
        }
    });

    if (!expenseName || !totalAmount || participants.length < 2) {
        return alert('Please complete the split expense details');
    }

    const amountPerPerson = (totalAmount / participants.length).toFixed(2);

    // Create a temporary container for PDF content
    const pdfContainer = document.createElement('div');
    pdfContainer.id = 'splitPdfContent';
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.width = '800px';
    pdfContainer.style.backgroundColor = '#ffffff';
    pdfContainer.style.padding = '40px';
    pdfContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    const htmlContent = `
        <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px solid #007aff; padding-bottom: 20px;">
            <h1 style="color: #1c1c1e; margin: 0 0 10px 0; font-size: 32px;">💰 Expense Split Receipt</h1>
            <p style="color: #8e8e93; margin: 0; font-size: 14px;">Generated on ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-IN')}</p>
        </div>

        <div style="background: linear-gradient(135deg, #007aff, #005bb5); color: white; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
            <h2 style="color: white; margin: 0 0 15px 0; font-size: 24px;">${expenseName}</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <p style="margin: 0 0 5px 0; font-size: 12px; opacity: 0.9; text-transform: uppercase;">Total Amount</p>
                    <p style="margin: 0; font-size: 28px; font-weight: bold;">${formatMoney(totalAmount)}</p>
                </div>
                <div>
                    <p style="margin: 0 0 5px 0; font-size: 12px; opacity: 0.9; text-transform: uppercase;">Amount Per Person</p>
                    <p style="margin: 0; font-size: 28px; font-weight: bold;">${formatMoney(amountPerPerson)}</p>
                </div>
            </div>
        </div>

        <h3 style="color: #1c1c1e; margin: 25px 0 15px 0; font-size: 18px; border-bottom: 2px solid #e5e5ea; padding-bottom: 10px;">Participant Breakdown</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
                <tr style="background: #f2f2f7; border-bottom: 2px solid #e5e5ea;">
                    <th style="text-align: left; padding: 12px; color: #1c1c1e; font-weight: 600;">Participant</th>
                    <th style="text-align: right; padding: 12px; color: #1c1c1e; font-weight: 600;">Amount to Pay</th>
                </tr>
            </thead>
            <tbody>
                ${participants.map((name, idx) => `
                    <tr style="border-bottom: 1px solid #e5e5ea; ${idx % 2 === 0 ? 'background: #f9f9fb;' : ''}">
                        <td style="padding: 12px; color: #1c1c1e; font-weight: 500;">${idx + 1}. ${name}</td>
                        <td style="padding: 12px; text-align: right; color: #007aff; font-weight: 600; font-size: 16px;">${formatMoney(amountPerPerson)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="background: #f0f7ff; border-left: 4px solid #007aff; padding: 15px; margin-top: 30px; border-radius: 4px;">
            <p style="margin: 0; color: #1c1c1e; font-size: 13px;">
                <strong>Note:</strong> Each participant should pay the amount listed above. Total of all payments should equal ${formatMoney(totalAmount)}.
            </p>
        </div>
    `;

    pdfContainer.innerHTML = htmlContent;
    document.body.appendChild(pdfContainer);

    // Generate PDF using html2pdf
    const element = document.getElementById('splitPdfContent');
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `Split_Expense_${expenseName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        document.body.removeChild(pdfContainer);
        alert('PDF exported successfully!');
    }).catch(err => {
        console.error('PDF generation failed:', err);
        alert('PDF export failed. Please try again.');
        if (document.body.contains(pdfContainer)) {
            document.body.removeChild(pdfContainer);
        }
    });
}

// Initialize split form on load
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('splitParticipantsList')) {
        updateSplitParticipantFields();
    }
});
