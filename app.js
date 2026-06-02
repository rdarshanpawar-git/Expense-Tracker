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
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then(registration => {
        setInterval(() => { registration.update(); }, 30 * 60 * 1000);
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'waiting' && navigator.serviceWorker.controller) {
                    newServiceWorkerReady = newWorker;
                    const banner = document.getElementById('updateNotification');
                    if (banner) banner.classList.remove('hidden');
                }
            });
        });
        navigator.serviceWorker.addEventListener('controllerchange', () => { window.location.reload(); });
    }).catch(err => console.error('SW error:', err));
}
function dismissUpdate() { document.getElementById('updateNotification').classList.add('hidden'); }
function acceptUpdate() { if (newServiceWorkerReady) newServiceWorkerReady.postMessage({ type: 'SKIP_WAITING' }); }

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
function updateLoginHints() {
    const currentPin = localStorage.getItem('app_pin');
    const titleEl = document.getElementById('loginTitle');
    const subtitleEl = document.getElementById('loginSubtitle');
    if (!currentPin) {
        if (titleEl) titleEl.innerText = "Set Up App";
        if (subtitleEl) subtitleEl.innerText = "Create a 4-digit security PIN";
    } else {
        if (titleEl) titleEl.innerText = "Welcome Back";
        if (subtitleEl) subtitleEl.innerText = "Enter your 4-digit PIN";
    }
}

function handleLogin() {
    const enteredPin = document.getElementById('pinInput').value;
    const errorText = document.getElementById('loginError');
    errorText.classList.add('hidden');

    if (enteredPin.length < 4) {
        errorText.innerText = "PIN must be exactly 4 digits";
        errorText.classList.remove('hidden');
        return;
    }

    const savedPin = localStorage.getItem('app_pin');
    if (!savedPin) {
        localStorage.setItem('app_pin', enteredPin);
        document.getElementById('pinInput').value = '';
        updateLoginHints();
        unlockApp();
    } else {
        if (enteredPin === savedPin) {
            document.getElementById('pinInput').value = '';
            unlockApp();
        } else {
            errorText.innerText = "Incorrect PIN code";
            errorText.classList.remove('hidden');
            document.getElementById('pinInput').value = '';
        }
    }
}

function resetPin() {
    if (!confirm('Clear saved PIN and return to setup?')) return;
    localStorage.removeItem('app_pin');
    updateLoginHints();
    document.getElementById('pinInput').value = '';
    alert('PIN cleared. Please create a new PIN to continue.');
}

window.handleLogin = handleLogin; window.resetPin = resetPin; window.updateLoginHints = updateLoginHints;
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => { window.updateLoginHints(); }); } else { window.updateLoginHints(); }

function unlockApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('homeScreen').classList.remove('hidden');
}
function openExpenseTracker() {
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('splitExpenseApp').classList.add('hidden');
    loadCategories(); loadData(); loadStatements();
}
function openSplitExpense() {
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('splitExpenseApp').classList.remove('hidden');
    sgLoadGroups();
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

function switchTab(tab) {
    document.getElementById('tabHome').classList.add('hidden');
    document.getElementById('tabHistory').classList.add('hidden');
    document.getElementById('tabMenu').classList.add('hidden');
    document.getElementById('navHome').classList.remove('active');
    document.getElementById('navHistory').classList.remove('active');
    document.getElementById('navMenu').classList.remove('active');

    if (tab === 'home') { document.getElementById('tabHome').classList.remove('hidden'); document.getElementById('navHome').classList.add('active'); loadData(); }
    else if (tab === 'history') { document.getElementById('tabHistory').classList.remove('hidden'); document.getElementById('navHistory').classList.add('active'); loadStatements(); }
    else if (tab === 'menu') { document.getElementById('tabMenu').classList.remove('hidden'); document.getElementById('navMenu').classList.add('active'); }
}

// --- PERSONAL EXPENSE TRACKER ---
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

    let savedCats = JSON.parse(localStorage.getItem('app_categories')) || [];
    if (!savedCats.includes(category)) {
        savedCats.push(category); localStorage.setItem('app_categories', JSON.stringify(savedCats)); loadCategories();
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
        listContainer.innerHTML = '<p style="color: #8e8e93; text-align: center; padding: 16px;">No recorded charges.</p>';
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
                <span class="expense-amount" style="margin-right: 12px;">-${formatMoney(exp.amount)}</span>
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
        data: { labels: ['Spent', 'Net Leftover'], datasets: [{ data: [totalExpenses, chartRemaining], backgroundColor: ['#ff3b30', '#34c759'], borderWidth: 0, hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15, font: { family: '-apple-system', size: 13 } } } } }
    });
}

// Personal Reports
function loadStatements() {
    const container = document.getElementById('statementsList');
    const checkboxContainer = document.getElementById('exportMonthCheckboxes');
    container.innerHTML = ''; checkboxContainer.innerHTML = '';

    const months = Object.keys(localStorage).filter(key => key.match(/^\d{4}-\d{2}$/)).sort((a, b) => b.localeCompare(a));
    if (months.length === 0) {
        container.innerHTML = '<p style="color: #8e8e93; text-align: center; padding: 20px;">No historical timelines logged.</p>';
        checkboxContainer.innerHTML = '<p style="font-size: 13px; color: #8e8e93;">No data to export.</p>';
        return;
    }

    months.forEach(month => {
        const data = JSON.parse(localStorage.getItem(month));
        const totalExpenses = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const remaining = data.income - totalExpenses;
        const monthName = new Date(month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' });

        const cbRow = document.createElement('div');
        cbRow.className = 'checkbox-row';
        cbRow.innerHTML = `<input type="checkbox" class="export-cb" value="${month}" id="cb_${month}" checked><label for="cb_${month}">${monthName}</label>`;
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
                <span class="statement-amount ${remaining >= 0 ? 'positive' : ''}" style="font-size:13px; font-weight:600;">
                    ${remaining >= 0 ? 'Saved' : 'Overdraft'}: ${formatMoney(Math.abs(remaining))}
                </span>
            </div>
        `;
        item.onclick = () => { document.getElementById('monthSelector').value = month; switchTab('home'); };
        container.appendChild(item);
    });
}

function getSelectedMonths() { return Array.from(document.querySelectorAll('.export-cb:checked')).map(cb => cb.value); }

function downloadExcel() {
    const selectedMonths = getSelectedMonths();
    if (selectedMonths.length === 0) return alert("Please select at least one month to export.");
    const workbook = XLSX.utils.book_new();

    selectedMonths.forEach(month => {
        const data = JSON.parse(localStorage.getItem(month));
        if (data) {
            const totalSpent = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
            const saved = data.income - totalSpent;
            const tabName = new Date(month + '-02').toLocaleString('default', { month: 'short', year: 'numeric' });

            const worksheetData = [
                ["Monthly Ledger Report", "", "", ""], ["Month", month, "", ""], ["", "", "", ""],
                ["Financial Overview", "", "", ""], ["Item", "Amount (INR)", "", ""],
                ["Monthly Income", data.income, "", ""], ["Total Expenses", totalSpent, "", ""],
                ["Saved / (Overdraft)", saved, "", ""], ["", "", "", ""],
                ["Transaction Details", "", "", ""], ["Description", "Category", "Amount (INR)", "Date"]
            ];
            data.expenses.forEach(exp => { worksheetData.push([exp.name, exp.category, exp.amount, new Date(exp.id).toLocaleDateString('en-IN')]); });
            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
            worksheet['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(workbook, worksheet, tabName);
        }
    });
    XLSX.writeFile(workbook, `Consolidated_Report_${Date.now()}.xlsx`);
}

async function shareSummary() {
    const selectedMonths = getSelectedMonths();
    if (selectedMonths.length === 0) return alert("Please select at least one month to share.");

    let summary = "📊 Detailed Expense Report\n\n";
    let grandIncome = 0, grandSpent = 0;

    selectedMonths.forEach(month => {
        const data = JSON.parse(localStorage.getItem(month));
        if (data) {
            const spent = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
            const saved = data.income - spent;
            const monthName = new Date(month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' });

            summary += `[${monthName}]\n------------------------------\nIncome: ${formatMoney(data.income)}\nSpent: ${formatMoney(spent)}\nSaved: ${formatMoney(saved)}\n`;
            if (data.expenses.length > 0) {
                summary += `\nTop Transactions:\n`;
                [...data.expenses].sort((a, b) => b.amount - a.amount).slice(0, 5).forEach(exp => { summary += `- ${exp.name} (${formatMoney(exp.amount)})\n`; });
            }
            summary += `------------------------------\n\n`;
            grandIncome += data.income; grandSpent += spent;
        }
    });

    if (navigator.share) {
        try { await navigator.share({ title: 'Consolidated Expense Report', text: summary }); } catch (err) {}
    } else { navigator.clipboard.writeText(summary); alert("Copied to clipboard!"); }
}

function generatePersonalImageReport() {
    const selectedMonths = getSelectedMonths();
    if (selectedMonths.length === 0) return alert("Please select months for the report.");

    const reportContainer = document.createElement('div');
    Object.assign(reportContainer.style, { position: 'absolute', left: '-9999px', top: '-9999px', width: '800px', backgroundColor: '#f2f2f7', padding: '40px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' });

    let html = `
        <div style="background: white; border-radius: 16px; padding: 30px; margin-bottom: 20px; text-align: center;">
            <h1 style="margin:0 0 10px 0; color: #1c1c1e;">Personal Ledger Report</h1>
            <p style="margin:0; color: #8e8e93;">Generated: ${new Date().toLocaleDateString('en-IN')}</p>
        </div>
    `;

    selectedMonths.forEach(month => {
        const data = JSON.parse(localStorage.getItem(month));
        if (data) {
            const spent = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
            const saved = data.income - spent;
            const monthName = new Date(month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' });

            html += `
                <div style="background: white; border-radius: 16px; padding: 30px; margin-bottom: 20px;">
                    <h2 style="margin: 0 0 20px 0; color: var(--accent-blue); border-bottom: 2px solid #e5e5ea; padding-bottom: 10px;">${monthName}</h2>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div style="background: #f9f9fb; padding: 15px; border-radius: 8px;">
                            <p style="margin:0 0 5px 0; font-size:12px; color:#8e8e93; text-transform:uppercase;">Income</p>
                            <p style="margin:0; font-size:20px; font-weight:bold; color:#1c1c1e;">${formatMoney(data.income)}</p>
                        </div>
                        <div style="background: #f9f9fb; padding: 15px; border-radius: 8px;">
                            <p style="margin:0 0 5px 0; font-size:12px; color:#8e8e93; text-transform:uppercase;">Spent</p>
                            <p style="margin:0; font-size:20px; font-weight:bold; color:var(--red);">${formatMoney(spent)}</p>
                        </div>
                        <div style="background: ${saved >= 0 ? '#e4f8eb' : '#ffeaea'}; padding: 15px; border-radius: 8px;">
                            <p style="margin:0 0 5px 0; font-size:12px; color:#8e8e93; text-transform:uppercase;">Balance</p>
                            <p style="margin:0; font-size:20px; font-weight:bold; color:${saved >= 0 ? 'var(--green)' : 'var(--red)'};">${formatMoney(saved)}</p>
                        </div>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead><tr style="background: #f2f2f7;"><th style="text-align: left; padding: 10px; border-radius: 8px 0 0 8px;">Item</th><th style="text-align: right; padding: 10px; border-radius: 0 8px 8px 0;">Amount</th></tr></thead>
                        <tbody>
                            ${data.expenses.map(e => `<tr style="border-bottom: 1px solid #f2f2f7;"><td style="padding:10px;">${e.name}</td><td style="text-align:right; padding:10px; font-weight:600; color:var(--red);">-${formatMoney(e.amount)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    });

    reportContainer.innerHTML = html;
    document.body.appendChild(reportContainer);

    setTimeout(() => {
        html2canvas(reportContainer, { scale: 2, useCORS: true, backgroundColor: '#f2f2f7' }).then(canvas => {
            const link = document.createElement('a');
            link.download = `Expense_Report_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            document.body.removeChild(reportContainer);
        });
    }, 500);
}

document.getElementById('monthSelector').addEventListener('change', loadData);

// ==========================================
// --- NEW PROFESSIONAL SPLIT GROUP LOGIC ---
// ==========================================

let currentSplitGroupId = null;

// Initialization and Data Retrieval
function sgGetGroups() { return JSON.parse(localStorage.getItem('split_groups_pro')) || []; }
function sgSaveGroups(groups) { localStorage.setItem('split_groups_pro', JSON.stringify(groups)); }
function sgGetExpenses(groupId) { return JSON.parse(localStorage.getItem(`split_exps_${groupId}`)) || []; }
function sgSaveExpenses(groupId, exps) { localStorage.setItem(`split_exps_${groupId}`, JSON.stringify(exps)); }

function sgLoadGroups() {
    const groups = sgGetGroups();
    const container = document.getElementById('sgGroupCards');
    container.innerHTML = '';
    
    if (groups.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-secondary);">No groups yet. Create one below to start splitting bills.</div>';
        return;
    }

    groups.forEach(g => {
        const exps = sgGetExpenses(g.id);
        const card = document.createElement('div');
        card.style.cssText = "padding: 16px; border: 1px solid var(--border-color); border-radius: 12px; cursor: pointer; transition: 0.2s;";
        card.onclick = () => sgOpenGroup(g.id);
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin:0; border:none; padding:0; color: var(--accent-blue);">${g.name}</h3>
                <span style="font-size: 12px; color: var(--text-secondary); background: #f2f2f7; padding: 4px 8px; border-radius: 12px;">${g.members.length} members</span>
            </div>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: var(--text-secondary);">${exps.length} transactions recorded</p>
        `;
        container.appendChild(card);
    });
}

function sgCreateGroup() {
    const name = document.getElementById('sgNewGroupName').value.trim();
    const membersRaw = document.getElementById('sgNewGroupMembers').value;
    
    if (!name) return alert("Please enter a group name.");
    
    let members = membersRaw.split(',').map(m => m.trim()).filter(m => m);
    if (members.length < 2) return alert("A group needs at least 2 members.");
    
    // Ensure unique names
    members = [...new Set(members)];

    const groups = sgGetGroups();
    const id = 'sg_' + Date.now();
    groups.unshift({ id, name, members, createdAt: new Date().toISOString() });
    sgSaveGroups(groups);
    
    document.getElementById('sgNewGroupName').value = '';
    document.getElementById('sgNewGroupMembers').value = '';
    
    sgOpenGroup(id);
}

function sgOpenGroup(id) {
    currentSplitGroupId = id;
    document.getElementById('sgListView').classList.add('hidden');
    document.getElementById('sgDetailView').classList.remove('hidden');
    sgRenderGroup();
}

function sgCloseGroup() {
    currentSplitGroupId = null;
    document.getElementById('sgDetailView').classList.add('hidden');
    document.getElementById('sgListView').classList.remove('hidden');
    sgLoadGroups();
}

function sgRenderGroup() {
    const group = sgGetGroups().find(g => g.id === currentSplitGroupId);
    if (!group) return sgCloseGroup();
    
    document.getElementById('sgGroupTitle').innerText = group.name;
    
    // Render Add Expense Form inputs
    const membersList = document.getElementById('sgExpMembersList');
    membersList.innerHTML = '';
    group.members.forEach(m => {
        membersList.innerHTML += `
            <div style="display: grid; grid-template-columns: 2fr 1.2fr 1.2fr; gap: 8px; margin-bottom: 8px; align-items: center;">
                <div style="font-weight: 500; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m}</div>
                <input type="number" class="sg-input-paid" data-member="${m}" placeholder="0" min="0" step="0.01" oninput="sgUpdateTotal()" style="margin:0; padding: 10px; font-size: 14px; background: white;">
                <input type="number" class="sg-input-share" data-member="${m}" placeholder="0" min="0" step="0.01" style="margin:0; padding: 10px; font-size: 14px; background: white;">
            </div>
        `;
    });
    document.getElementById('sgExpTotal').innerText = '₹0';
    document.getElementById('sgExpName').value = '';

    // Calculate Data
    const exps = sgGetExpenses(currentSplitGroupId);
    
    // Compute Net Balances (Paid - Share = Balance. Positive = Owed money. Negative = Owes money)
    let balances = {};
    group.members.forEach(m => balances[m] = 0);
    
    exps.forEach(exp => {
        for (let m in exp.details) {
            if (balances[m] !== undefined) {
                balances[m] += (exp.details[m].paid || 0) - (exp.details[m].share || 0);
            }
        }
    });

    // Render Settlements Algorithm
    let debtors = [];
    let creditors = [];
    for (let [name, bal] of Object.entries(balances)) {
        if (bal < -0.01) debtors.push({ name, amount: Math.abs(bal) });
        else if (bal > 0.01) creditors.push({ name, amount: bal });
    }
    
    // Greedy matching
    debtors.sort((a,b) => b.amount - a.amount);
    creditors.sort((a,b) => b.amount - a.amount);
    
    let settlements = [];
    let d = 0, c = 0;
    while (d < debtors.length && c < creditors.length) {
        let debtor = debtors[d];
        let creditor = creditors[c];
        let amount = Math.min(debtor.amount, creditor.amount);
        
        settlements.push({ from: debtor.name, to: creditor.name, amount });
        
        debtor.amount -= amount;
        creditor.amount -= amount;
        
        if (debtor.amount < 0.01) d++;
        if (creditor.amount < 0.01) c++;
    }

    // Display Balances
    const balContainer = document.getElementById('sgBalancesList');
    if (settlements.length === 0) {
        balContainer.innerHTML = '<div style="text-align: center; color: var(--green); font-weight: 600; padding: 10px;">All settled up! 🎉</div>';
    } else {
        let html = '';
        settlements.forEach(s => {
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border-color);">
                    <div style="font-size: 15px;"><span style="font-weight: 600; color: var(--red);">${s.from}</span> owes <span style="font-weight: 600; color: var(--green);">${s.to}</span></div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-weight: 700; font-size: 16px;">${formatMoney(s.amount)}</span>
                        <button class="btn btn-sm btn-success" style="padding: 6px 12px;" onclick="sgSettleUp('${s.from}', '${s.to}', ${s.amount})">Mark Paid ✓</button>
                    </div>
                </div>
            `;
        });
        balContainer.innerHTML = html;
    }

    // Display Ledger
    const ledgerContainer = document.getElementById('sgLedgerList');
    if (exps.length === 0) {
        ledgerContainer.innerHTML = '<div style="text-align:center; color: var(--text-secondary); padding: 10px;">No expenses yet.</div>';
    } else {
        let html = '';
        exps.forEach(exp => {
            const isSettlement = exp.isSettlement;
            const icon = isSettlement ? '💸' : '🧾';
            const color = isSettlement ? 'var(--green)' : 'var(--text-primary)';
            
            html += `
                <div style="padding: 14px 0; border-bottom: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <div>
                            <div style="font-weight: 600; font-size: 15px; color: ${color};">${icon} ${exp.name}</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">${new Date(exp.date).toLocaleDateString('en-IN')}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-weight: 700; font-size: 15px;">${formatMoney(exp.total)}</span>
                            <button class="btn btn-sm btn-outline" style="padding: 4px 8px; border-color: var(--red); color: var(--red);" onclick="sgDeleteExpense('${exp.id}')">✖</button>
                        </div>
                    </div>
            `;
            
            if (!isSettlement) {
                html += `<div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">`;
                let paidStrs = [];
                for (let m in exp.details) {
                    if (exp.details[m].paid > 0) paidStrs.push(`${m} paid ${formatMoney(exp.details[m].paid)}`);
                }
                html += paidStrs.join(', ') + `</div>`;
            }
            html += `</div>`;
        });
        ledgerContainer.innerHTML = html;
    }
}

function sgUpdateTotal() {
    let total = 0;
    document.querySelectorAll('.sg-input-paid').forEach(inp => total += (parseFloat(inp.value) || 0));
    document.getElementById('sgExpTotal').innerText = formatMoney(total);
}

function sgSplitEqually() {
    let total = 0;
    document.querySelectorAll('.sg-input-paid').forEach(inp => total += (parseFloat(inp.value) || 0));
    if (total <= 0) return alert("Enter Paid amounts first.");
    
    const shares = document.querySelectorAll('.sg-input-share');
    const perPerson = parseFloat((total / shares.length).toFixed(2));
    
    // Distribute evenly, adjust last person for rounding errors
    let runningTotal = 0;
    shares.forEach((inp, idx) => {
        if (idx === shares.length - 1) {
            inp.value = (total - runningTotal).toFixed(2);
        } else {
            inp.value = perPerson;
            runningTotal += perPerson;
        }
    });
}

function sgSaveExpense() {
    const name = document.getElementById('sgExpName').value.trim();
    if (!name) return alert("Enter an expense description.");
    
    let totalPaid = 0;
    let totalShare = 0;
    const details = {};
    
    const group = sgGetGroups().find(g => g.id === currentSplitGroupId);
    
    group.members.forEach(m => {
        const paidInp = document.querySelector(`.sg-input-paid[data-member="${m}"]`);
        const shareInp = document.querySelector(`.sg-input-share[data-member="${m}"]`);
        const paid = parseFloat(paidInp.value) || 0;
        const share = parseFloat(shareInp.value) || 0;
        
        totalPaid += paid;
        totalShare += share;
        details[m] = { paid, share };
    });

    if (totalPaid <= 0) return alert("Total paid must be greater than 0.");
    if (Math.abs(totalPaid - totalShare) > 0.05) return alert(`Check your math! Total Paid (${totalPaid}) must equal Total Split (${totalShare}).`);

    const exps = sgGetExpenses(currentSplitGroupId);
    exps.unshift({
        id: 'exp_' + Date.now(),
        name: name,
        total: totalPaid,
        date: new Date().toISOString(),
        isSettlement: false,
        details: details
    });
    
    sgSaveExpenses(currentSplitGroupId, exps);
    sgRenderGroup();
}

function sgSettleUp(from, to, amount) {
    const exps = sgGetExpenses(currentSplitGroupId);
    const details = {};
    const group = sgGetGroups().find(g => g.id === currentSplitGroupId);
    
    // The person paying (from) fronts the cash. The person receiving (to) consumes it.
    group.members.forEach(m => {
        details[m] = { paid: 0, share: 0 };
    });
    details[from].paid = amount;
    details[to].share = amount;

    exps.unshift({
        id: 'set_' + Date.now(),
        name: `Settlement: ${from} paid ${to}`,
        total: amount,
        date: new Date().toISOString(),
        isSettlement: true,
        details: details
    });
    
    sgSaveExpenses(currentSplitGroupId, exps);
    sgRenderGroup();
}

function sgDeleteExpense(expId) {
    if (!confirm("Delete this record from the ledger?")) return;
    let exps = sgGetExpenses(currentSplitGroupId);
    exps = exps.filter(e => e.id !== expId);
    sgSaveExpenses(currentSplitGroupId, exps);
    sgRenderGroup();
}

function sgAddMember() {
    const name = document.getElementById('sgNewMemberName').value.trim();
    if (!name) return;
    
    let groups = sgGetGroups();
    const groupIndex = groups.findIndex(g => g.id === currentSplitGroupId);
    if (groups[groupIndex].members.includes(name)) return alert("Member already exists.");
    
    groups[groupIndex].members.push(name);
    sgSaveGroups(groups);
    document.getElementById('sgNewMemberName').value = '';
    sgRenderGroup();
}

function sgDeleteGroup() {
    if (!confirm("Are you sure you want to completely delete this group and all its history?")) return;
    let groups = sgGetGroups();
    groups = groups.filter(g => g.id !== currentSplitGroupId);
    sgSaveGroups(groups);
    localStorage.removeItem(`split_exps_${currentSplitGroupId}`);
    sgCloseGroup();
}

// Download Group Ledger Image
function sgDownloadLedgerImage() {
    const group = sgGetGroups().find(g => g.id === currentSplitGroupId);
    const exps = sgGetExpenses(currentSplitGroupId);
    if (exps.length === 0) return alert("No expenses to export.");

    const reportContainer = document.createElement('div');
    Object.assign(reportContainer.style, { position: 'absolute', left: '-9999px', top: '-9999px', width: '800px', backgroundColor: '#ffffff', padding: '40px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' });

    let html = `
        <div style="text-align:center; margin-bottom:30px; border-bottom: 2px solid var(--accent-blue); padding-bottom: 20px;">
            <h1 style="margin:0; font-size: 36px; color: #1c1c1e;">${group.name} — Full Ledger</h1>
            <p style="color:#8e8e93; margin:8px 0 0 0; font-size: 14px;">As of ${new Date().toLocaleDateString('en-IN')}</p>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom: 30px;">
            <thead><tr style="background:#f2f2f7;"><th style="text-align:left; padding:12px;">Date</th><th style="text-align:left; padding:12px;">Expense</th><th style="text-align:right; padding:12px;">Total</th></tr></thead>
            <tbody>
    `;
    
    exps.forEach((exp, idx) => {
        html += `
            <tr style="border-bottom:1px solid #e5e5ea; ${idx % 2 === 0 ? 'background: #fafafa;' : ''}">
                <td style="padding:12px;">${new Date(exp.date).toLocaleDateString('en-IN')}</td>
                <td style="padding:12px; font-weight: 500;">${exp.name}</td>
                <td style="padding:12px; text-align:right; font-weight:600; color: ${exp.isSettlement ? 'var(--green)' : 'var(--text-primary)'};">${formatMoney(exp.total)}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    reportContainer.innerHTML = html;
    document.body.appendChild(reportContainer);

    setTimeout(() => {
        html2canvas(reportContainer, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
            const link = document.createElement('a');
            link.download = `${group.name.replace(/\s+/g,'_')}_Ledger.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            document.body.removeChild(reportContainer);
        });
    }, 500);
}