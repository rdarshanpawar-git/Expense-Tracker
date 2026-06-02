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

// Navigation
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
    resetSplitForm(); loadSplitGroups();
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

// --- LEDGER STATEMENTS & EXPORT LOGIC ---
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

function getSelectedMonths() {
    return Array.from(document.querySelectorAll('.export-cb:checked')).map(cb => cb.value);
}

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
                [...data.expenses].sort((a, b) => b.amount - a.amount).slice(0, 5).forEach(exp => { summary += `- ${exp.name} (${formatMoney(exp.amount)}) [${exp.category}]\n`; });
            } else { summary += `No transactions logged.\n`; }
            summary += `------------------------------\n\n`;
            grandIncome += data.income; grandSpent += spent;
        }
    });

    if (selectedMonths.length > 1) {
        summary += `🌎 === GRAND TOTAL ===\nTotal Income: ${formatMoney(grandIncome)}\nTotal Spent: ${formatMoney(grandSpent)}\nTotal Saved: ${formatMoney(grandIncome - grandSpent)}\n`;
    }

    if (navigator.share) {
        try { await navigator.share({ title: 'Consolidated Expense Report', text: summary }); } 
        catch (err) { console.log('Share canceled', err); }
    } else { navigator.clipboard.writeText(summary); alert("Copied to clipboard!"); }
}

// Generate Image Report using html2canvas
function generateImageReport() {
    const selectedMonths = getSelectedMonths();
    if (selectedMonths.length === 0) return alert("Please select months for the report.");

    const reportContainer = document.createElement('div');
    reportContainer.id = 'tempImageReport';
    Object.assign(reportContainer.style, { position: 'absolute', left: '-9999px', top: '-9999px', width: '800px', backgroundColor: '#f2f2f7', padding: '40px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' });

    let html = `
        <div style="background: white; border-radius: 16px; padding: 30px; margin-bottom: 20px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <h1 style="margin:0 0 10px 0; color: #1c1c1e;">Consolidated Ledger Report</h1>
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
                <div style="background: white; border-radius: 16px; padding: 30px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
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
                    <div style="height: 250px; margin-bottom: 20px;"><canvas id="imgChart_${month}"></canvas></div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead><tr style="background: #f2f2f7;"><th style="text-align: left; padding: 10px; border-radius: 8px 0 0 8px;">Item</th><th style="text-align: left; padding: 10px;">Category</th><th style="text-align: right; padding: 10px; border-radius: 0 8px 8px 0;">Amount</th></tr></thead>
                        <tbody>
                            ${data.expenses.length === 0 ? `<tr><td colspan="3" style="text-align:center; padding:15px; color:#8e8e93;">No transactions</td></tr>` : ''}
                            ${data.expenses.map(e => `<tr style="border-bottom: 1px solid #f2f2f7;"><td style="padding:10px;">${e.name}</td><td style="padding:10px; color:#8e8e93;">${e.category}</td><td style="text-align:right; padding:10px; font-weight:600; color:var(--red);">-${formatMoney(e.amount)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    });

    reportContainer.innerHTML = html;
    document.body.appendChild(reportContainer);

    selectedMonths.forEach(month => {
        const data = JSON.parse(localStorage.getItem(month));
        if(data) {
            const spent = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
            const saved = Math.max(0, data.income - spent);
            new Chart(document.getElementById(`imgChart_${month}`).getContext('2d'), {
                type: 'doughnut',
                data: { labels: ['Spent', 'Remaining'], datasets: [{ data: [spent, saved], backgroundColor: ['#ff3b30', '#34c759'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '75%', animation: false, plugins: { legend: { position: 'right', labels: { usePointStyle: true } } } }
            });
        }
    });

    setTimeout(() => {
        html2canvas(reportContainer, { scale: 2, useCORS: true, backgroundColor: '#f2f2f7' }).then(canvas => {
            const link = document.createElement('a');
            link.download = `Expense_Report_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            document.body.removeChild(reportContainer);
        }).catch(e => { console.error(e); alert("Image generation failed."); document.body.removeChild(reportContainer); });
    }, 500);
}

document.getElementById('monthSelector').addEventListener('change', loadData);

// --- UNIVERSAL IMAGE DOWNLOAD HELPER ---
function downloadElementAsImage(elementId, filename) {
    const element = document.getElementById(elementId);
    if(!element) return;
    html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(canvas => {
        const link = document.createElement('a');
        link.download = `${filename}_${new Date().toISOString().slice(0,10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(err => { console.error(err); alert('Failed to generate image.'); });
}

// --- SPLIT EXPENSE APP FEATURE ---
window.currentSplitState = null;

function addSplitParticipantField() {
    const container = document.getElementById('splitParticipantsList');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'split-participant-name';
    input.placeholder = `Person ${container.children.length + 1}`;
    container.appendChild(input);
}

function resetSplitForm() {
    document.getElementById('splitExpenseName').value = '';
    document.getElementById('splitExpenseAmount').value = '';
    const container = document.getElementById('splitParticipantsList');
    container.innerHTML = '<input type="text" class="split-participant-name" placeholder="Person 1 (e.g., You)"><input type="text" class="split-participant-name" placeholder="Person 2">';
    document.getElementById('splitResultCard').classList.add('hidden');
    document.getElementById('groupActionArea').classList.add('hidden');
    window.currentSplitState = null;
}

function calculateQuickSplit() {
    const name = document.getElementById('splitExpenseName').value.trim();
    const total = parseFloat(document.getElementById('splitExpenseAmount').value);
    if (!name || !total || total <= 0) return alert('Please enter expense description and valid amount');
    
    const participants = [];
    document.querySelectorAll('.split-participant-name').forEach(input => {
        if (input.value.trim()) participants.push(input.value.trim());
    });
    
    if (participants.length < 2) return alert('Please add at least 2 participants');
    
    const perPerson = total / participants.length;
    
    const receipt = document.getElementById('splitReceipt');
    receipt.innerHTML = `
        <div style="text-align: center; border-bottom: 2px dashed #e5e5ea; padding-bottom: 16px; margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; color: #8e8e93; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Split Bill Receipt</p>
            <h2 style="margin: 0 0 8px 0; color: #1c1c1e; font-size: 24px;">${name}</h2>
            <p style="margin: 0; font-size: 32px; font-weight: bold; color: var(--accent-blue); letter-spacing: -1px;">${formatMoney(total)}</p>
            <p style="margin: 4px 0 0 0; color: #8e8e93; font-size: 14px;">Split evenly ${participants.length} ways</p>
        </div>
        <div style="font-size: 15px;">
            ${participants.map(p => `
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f2f2f7;">
                    <span style="font-weight: 500; color: #1c1c1e;">${p}</span>
                    <span style="font-weight: 600; color: var(--green);">${formatMoney(perPerson)}</span>
                </div>
            `).join('')}
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #8e8e93;">
            Generated via Expense Tracker • ${new Date().toLocaleDateString('en-IN')}
        </div>
    `;

    document.getElementById('splitResultCard').classList.remove('hidden');
    document.getElementById('groupActionArea').classList.remove('hidden');
    window.currentSplitState = { name, total, participants, perPerson };
}

function shareQuickSplitText() {
    if(!window.currentSplitState) return;
    const { name, total, participants, perPerson } = window.currentSplitState;
    let text = `💰 ${name} - ${formatMoney(total)}\nSplit ${participants.length} ways:\n\n`;
    participants.forEach(p => text += `${p} owes ${formatMoney(perPerson)}\n`);
    if (navigator.share) { navigator.share({ title: `Split: ${name}`, text }).catch(err => console.log('Share canceled:', err)); } 
    else { navigator.clipboard.writeText(text); alert("Copied to clipboard!"); }
}

function addCurrentSplitToGroup() {
    const groupId = document.getElementById('splitGroupSelect').value;
    if (!groupId) return alert('Please create or select a group in the Group Balances section first.');
    if (!window.currentSplitState) return alert('Calculate a split first.');

    const { name, total, participants, perPerson } = window.currentSplitState;
    const expense = {
        id: Date.now().toString(), name: name, total: total,
        participants: participants.map(p => ({ name: p, share: perPerson, paid: false })),
        createdAt: new Date().toISOString()
    };

    const key = `split_group_${groupId}`;
    const list = JSON.parse(localStorage.getItem(key)) || [];
    list.unshift(expense);
    localStorage.setItem(key, JSON.stringify(list));
    loadGroupExpenses(groupId);
    alert('Split successfully added to the active group ledger!');
    resetSplitForm();
}

// --- SPLIT GROUP MANAGEMENT ---
function loadSplitGroups() {
    const groups = JSON.parse(localStorage.getItem('split_groups')) || [];
    const sel = document.getElementById('splitGroupSelect');
    if (!sel) return;
    sel.innerHTML = '';
    groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id; opt.text = g.name; sel.appendChild(opt);
    });
    if (groups.length === 0) {
        const opt = document.createElement('option'); opt.value = ''; opt.text = 'No groups yet'; sel.appendChild(opt);
    }
}

function createSplitGroup() {
    const name = document.getElementById('newSplitGroupName').value.trim();
    if (!name) return alert('Enter a group name');
    const groups = JSON.parse(localStorage.getItem('split_groups')) || [];
    const id = Date.now().toString();
    groups.push({ id, name, createdAt: new Date().toISOString() });
    localStorage.setItem('split_groups', JSON.stringify(groups));
    document.getElementById('newSplitGroupName').value = '';
    loadSplitGroups();
    document.getElementById('splitGroupSelect').value = id;
    loadGroupExpenses(id);
}

function loadGroupExpenses(groupId) {
    if (!groupId) return;
    const key = `split_group_${groupId}`;
    const list = JSON.parse(localStorage.getItem(key)) || [];
    renderGroupExpenses(groupId, list);
}

function renderGroupExpenses(groupId, expenses) {
    const container = document.getElementById('splitGroupExpensesList');
    if (!container) return;
    container.innerHTML = '';
    if (!expenses || expenses.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 24px; border: 1px dashed var(--border-color); border-radius: 12px; color: var(--text-secondary);">No expenses in this group yet. Use the Quick Split Calculator above to add one.</div>';
        return;
    }

    expenses.forEach(exp => {
        const card = document.createElement('div');
        card.style.border = '1px solid var(--border-color)';
        card.style.borderRadius = '12px';
        card.style.padding = '16px';
        card.style.marginBottom = '12px';

        let participantsHtml = '';
        exp.participants.forEach((p, idx) => {
            const paidAmount = p.paidAmount ? parseFloat(p.paidAmount) : 0;
            participantsHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom: 1px solid #f2f2f7; gap:8px;">
                    <div style="flex:1; font-weight: 500; font-size: 14px;">${p.name}</div>
                    <div style="width:80px; text-align:right;">
                        <input type="number" step="0.01" min="0" value="${p.share}" data-group="${groupId}" data-exp="${exp.id}" data-idx="${idx}" onchange="saveParticipantShare(this)" style="width:100%; padding:6px; border-radius:6px; margin-bottom: 0; font-size: 13px;">
                    </div>
                    <div style="width:80px; text-align:right;">
                        <input type="number" step="0.01" min="0" value="${paidAmount}" data-group="${groupId}" data-exp="${exp.id}" data-idx="${idx}" onchange="saveParticipantPaidAmount(this)" placeholder="Paid" style="width:100%; padding:6px; border-radius:6px; margin-bottom: 0; font-size: 13px;">
                    </div>
                    <div style="width:30px; text-align:center;">
                        <input type="checkbox" data-group="${groupId}" data-exp="${exp.id}" data-idx="${idx}" ${p.paid? 'checked':''} onchange="toggleParticipantPaid(this)" style="width: 18px; height: 18px; accent-color: var(--green);">
                    </div>
                </div>
            `;
        });

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px;">
                <div>
                    <div style="font-weight:700; font-size: 16px; color: var(--text-primary);">${exp.name}</div>
                    <div style="font-size:13px; color:var(--text-secondary); margin-top: 2px;">Total: ${formatMoney(exp.total)}</div>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-sm" onclick="equalizeShares('${groupId}','${exp.id}')">Equalize</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteGroupExpense('${groupId}','${exp.id}')">Delete</button>
                </div>
            </div>
            <div>
                <div style="display:flex; gap:8px; font-size:12px; color:var(--text-secondary); margin-bottom:6px; font-weight: 600; text-transform: uppercase;">
                    <div style="flex:1">Participant</div>
                    <div style="width:80px; text-align:right;">Owes</div>
                    <div style="width:80px; text-align:right;">Paid</div>
                    <div style="width:30px; text-align:center;">Done</div>
                </div>
                ${participantsHtml}
            </div>
        `;
        container.appendChild(card);
    });
}

function saveParticipantShare(input) {
    const groupId = input.dataset.group; const expId = input.dataset.exp; const idx = parseInt(input.dataset.idx, 10);
    const val = parseFloat(input.value) || 0;
    const key = `split_group_${groupId}`;
    const list = JSON.parse(localStorage.getItem(key)) || [];
    const exp = list.find(e => e.id === expId);
    if (!exp) return;
    exp.participants[idx].share = val;
    const paid = parseFloat(exp.participants[idx].paidAmount || 0);
    if (paid > val) exp.participants[idx].paidAmount = val;
    localStorage.setItem(key, JSON.stringify(list));
}

function saveParticipantPaidAmount(input) {
    const groupId = input.dataset.group; const expId = input.dataset.exp; const idx = parseInt(input.dataset.idx, 10);
    const val = parseFloat(input.value) || 0;
    const key = `split_group_${groupId}`;
    const list = JSON.parse(localStorage.getItem(key)) || [];
    const exp = list.find(e => e.id === expId);
    if (!exp) return;
    exp.participants[idx].paidAmount = val;
    exp.participants[idx].paid = val >= (exp.participants[idx].share || 0);
    localStorage.setItem(key, JSON.stringify(list));
}

function equalizeShares(groupId, expId) {
    const key = `split_group_${groupId}`;
    const list = JSON.parse(localStorage.getItem(key)) || [];
    const exp = list.find(e=>e.id===expId);
    if (!exp) return;
    const cnt = exp.participants.length;
    const share = parseFloat((exp.total / cnt).toFixed(2));
    exp.participants.forEach(p => { p.share = share; if (p.paidAmount && p.paidAmount > share) p.paidAmount = share; p.paid = (p.paidAmount && p.paidAmount >= share) || false; });
    localStorage.setItem(key, JSON.stringify(list));
    loadGroupExpenses(groupId);
}

function toggleParticipantPaid(checkbox) {
    const groupId = checkbox.dataset.group; const expId = checkbox.dataset.exp; const idx = parseInt(checkbox.dataset.idx, 10);
    const key = `split_group_${groupId}`;
    const list = JSON.parse(localStorage.getItem(key)) || [];
    const exp = list.find(e=>e.id===expId);
    if (!exp) return;
    exp.participants[idx].paid = checkbox.checked;
    localStorage.setItem(key, JSON.stringify(list));
}

function deleteGroupExpense(groupId, expId) {
    if (!confirm('Delete this split expense from the ledger?')) return;
    const key = `split_group_${groupId}`;
    let list = JSON.parse(localStorage.getItem(key)) || [];
    list = list.filter(e => e.id !== expId);
    localStorage.setItem(key, JSON.stringify(list));
    loadGroupExpenses(groupId);
}

// Generate Group Ledger Image Report
function generateGroupImageReport() {
    const groupId = document.getElementById('splitGroupSelect').value;
    if (!groupId) return alert('Select a group first');
    
    const groups = JSON.parse(localStorage.getItem('split_groups')) || [];
    const group = groups.find(g=>g.id===groupId);
    if (!group) return;
    const expenses = JSON.parse(localStorage.getItem(`split_group_${groupId}`)) || [];

    const map = {};
    expenses.forEach(exp => {
        exp.participants.forEach(p => {
            if (!map[p.name]) map[p.name] = { owed: 0, paid: 0 };
            const share = parseFloat(p.share) || 0;
            const paidAmt = p.paidAmount ? parseFloat(p.paidAmount) : (p.paid ? share : 0);
            map[p.name].owed += share; map[p.name].paid += paidAmt;
        });
    });

    const reportContainer = document.getElementById('hiddenGroupReport');
    Object.assign(reportContainer.style, { width: '800px', backgroundColor: '#ffffff', padding: '40px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' });

    let html = `
        <div style="text-align:center; margin-bottom:30px; border-bottom: 2px solid var(--accent-blue); padding-bottom: 20px;">
            <h1 style="margin:0; font-size: 36px; color: #1c1c1e; letter-spacing: -1px;">${group.name} Ledger</h1>
            <p style="color:#8e8e93; margin:8px 0 0 0; font-size: 14px;">As of ${new Date().toLocaleDateString('en-IN')}</p>
        </div>
        <h3 style="margin-top:20px; font-size: 20px; color: #1c1c1e; border-bottom: 1px solid #e5e5ea; padding-bottom: 8px;">Participant Balances</h3>
        <table style="width:100%; border-collapse:collapse; font-size:15px; margin-bottom: 40px;">
            <thead><tr style="background:#f2f2f7;"><th style="text-align:left; padding:12px; border-radius: 8px 0 0 8px;">Participant</th><th style="text-align:right; padding:12px;">Total Owed</th><th style="text-align:right; padding:12px;">Amount Paid</th><th style="text-align:right; padding:12px; border-radius: 0 8px 8px 0;">Remaining Balance</th></tr></thead>
            <tbody>
    `;
    Object.keys(map).forEach((name, idx) => {
        const owed = map[name].owed; const paid = map[name].paid; const rem = owed - paid;
        html += `<tr style="border-bottom:1px solid #e5e5ea; ${idx % 2 === 0 ? 'background: #fafafa;' : ''}"><td style="padding:12px; font-weight: 600;">${name}</td><td style="padding:12px; text-align:right;">${formatMoney(owed)}</td><td style="padding:12px; text-align:right;">${formatMoney(paid)}</td><td style="padding:12px; text-align:right; font-weight: 700; color: ${rem > 0 ? 'var(--red)' : 'var(--green)'};">${formatMoney(rem)}</td></tr>`;
    });
    html += `</tbody></table><h3 style="margin-top:20px; font-size: 20px; color: #1c1c1e; border-bottom: 1px solid #e5e5ea; padding-bottom: 8px;">Expense History</h3><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">`;

    expenses.forEach(exp=>{
        html += `
            <div style="border:1px solid #e5e5ea; padding:20px; border-radius:12px; background: #fafafa;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed #d1d1d6; padding-bottom: 12px; margin-bottom: 12px;"><div style="font-weight:700; font-size: 18px;">${exp.name}</div><div style="font-weight:700; color:var(--accent-blue); font-size: 18px;">${formatMoney(exp.total)}</div></div>
                <div>${exp.participants.map(p=>`<div style='display:flex; justify-content:space-between; padding:6px 0; font-size: 14px;'><div style="color: #1c1c1e; font-weight: 500;">${p.name}${p.paid? ' <span style="color: var(--green); font-size: 12px; margin-left: 4px;">(Settled)</span>':''}</div><div style='font-weight:600'>${formatMoney(p.share)}</div></div>`).join('')}</div>
            </div>
        `;
    });
    html += '</div>';
    reportContainer.innerHTML = html;

    setTimeout(() => {
        html2canvas(reportContainer, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
            const link = document.createElement('a');
            link.download = `${group.name.replace(/\s+/g,'_')}_Ledger.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            reportContainer.innerHTML = '';
        });
    }, 100);
}