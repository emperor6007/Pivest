// ===================================
// DASHBOARD.JS - User Dashboard Script with Investment Plans
// ===================================

let currentUser = null;
let platformWallet = DEFAULT_PLATFORM_WALLET;
let currentPlan = null;

// Investment Plans Configuration
const INVESTMENT_PLANS = {
    starter: {
        name: 'Starter Plan',
        minAmount: 100,
        maxAmount: 1000,
        returnRate: 0.05, // 5%
        durationHours: 24
    },
    growth: {
        name: 'Growth Plan',
        minAmount: 1000,
        maxAmount: 5000,
        returnRate: 0.10, // 10%
        durationHours: 48
    },
    premium: {
        name: 'Premium Plan',
        minAmount: 5000,
        maxAmount: 15000,
        returnRate: 0.15, // 15%
        durationHours: 72
    }
};

// ===================================
// AUTH CHECK
// ===================================
auth.onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    if (user.email === ADMIN_EMAIL) {
        window.location.href = 'admin.html';
        return;
    }
    
    currentUser = user;
    
    await loadUserData();
    await loadPlatformWallet();
    await loadDashboardData();
    setupEventListeners();
    
    // Check for matured investments periodically
    checkMaturedInvestments();
    setInterval(checkMaturedInvestments, 60000); // Check every minute
});

// ===================================
// LOAD USER DATA
// ===================================
async function loadUserData() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            const userName = document.getElementById('userName');
            const userAvatar = document.getElementById('userAvatar');
            
            if (userName) {
                userName.textContent = userData.fullName || 'User';
            }
            
            if (userAvatar) {
                userAvatar.textContent = userData.fullName ? userData.fullName.charAt(0).toUpperCase() : 'U';
            }
            
            document.getElementById('profileName').textContent = userData.fullName || 'N/A';
            document.getElementById('profileEmail').textContent = userData.email || 'N/A';
            document.getElementById('profileUserId').textContent = currentUser.uid;
            
            if (userData.createdAt) {
                const joinDate = userData.createdAt.toDate();
                document.getElementById('profileJoined').textContent = joinDate.toLocaleDateString();
            } else {
                document.getElementById('profileJoined').textContent = 'N/A';
            }
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// ===================================
// LOAD PLATFORM WALLET
// ===================================
async function loadPlatformWallet() {
    try {
        const settingsDoc = await db.collection('settings').doc('platform').get();
        
        if (settingsDoc.exists) {
            const settings = settingsDoc.data();
            platformWallet = settings.walletAddress || DEFAULT_PLATFORM_WALLET;
        }
        
        const platformWalletElement = document.getElementById('platformWallet');
        if (platformWalletElement) {
            platformWalletElement.textContent = platformWallet;
        }
    } catch (error) {
        console.error('Error loading platform wallet:', error);
    }
}

// ===================================
// LOAD DASHBOARD DATA
// ===================================
async function loadDashboardData() {
    try {
        // Load deposits
        const depositsSnapshot = await db.collection('deposits')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        let totalInvested = 0;
        let pendingDeposits = 0;
        
        depositsSnapshot.forEach(doc => {
            const deposit = doc.data();
            if (deposit.status === 'approved') {
                totalInvested += parseFloat(deposit.amount);
            } else if (deposit.status === 'pending') {
                pendingDeposits += parseFloat(deposit.amount);
            }
        });
        
        // Load active investments
        const investmentsSnapshot = await db.collection('investments')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        let activeInvestmentsTotal = 0;
        let totalInvestmentAmount = 0;
        
        investmentsSnapshot.forEach(doc => {
            const investment = doc.data();
            totalInvestmentAmount += parseFloat(investment.amount);
            
            if (investment.status === 'active') {
                activeInvestmentsTotal += parseFloat(investment.amount);
            }
        });
        
        // Load withdrawals
        const withdrawalsSnapshot = await db.collection('withdrawals')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        let totalWithdrawals = 0;
        
        withdrawalsSnapshot.forEach(doc => {
            const withdrawal = doc.data();
            if (withdrawal.status === 'approved') {
                totalWithdrawals += parseFloat(withdrawal.amount);
            }
        });
        
        // Calculate available balance (approved deposits - active investments - approved withdrawals)
        const availableBalance = totalInvested - totalInvestmentAmount - totalWithdrawals;
        
        // Update stats
        document.getElementById('totalInvested').textContent = `${totalInvested.toFixed(2)} π`;
        document.getElementById('activeInvestments').textContent = `${activeInvestmentsTotal.toFixed(2)} π`;
        document.getElementById('pendingDeposits').textContent = `${pendingDeposits.toFixed(2)} π`;
        document.getElementById('availableBalance').textContent = `${availableBalance.toFixed(2)} π`;
        document.getElementById('withdrawableBalance').textContent = `${availableBalance.toFixed(2)} π`;
        document.getElementById('investBalance').textContent = `${availableBalance.toFixed(2)} π`;
        
        // Load various lists
        loadRecentActivity(depositsSnapshot, withdrawalsSnapshot, investmentsSnapshot);
        loadDepositsHistory(depositsSnapshot);
        loadInvestmentsHistory(investmentsSnapshot);
        loadWithdrawalsHistory(withdrawalsSnapshot);
        loadActiveInvestments(investmentsSnapshot);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// ===================================
// LOAD ACTIVE INVESTMENTS
// ===================================
function loadActiveInvestments(investmentsSnapshot) {
    const activeInvestmentsList = document.getElementById('activeInvestmentsList');
    
    const activeInvestments = [];
    investmentsSnapshot.forEach(doc => {
        const investment = doc.data();
        if (investment.status === 'active') {
            activeInvestments.push({
                ...investment,
                id: doc.id
            });
        }
    });
    
    if (activeInvestments.length === 0) {
        activeInvestmentsList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📊</span>
                <p>No active investments</p>
            </div>
        `;
        return;
    }
    
    activeInvestmentsList.innerHTML = activeInvestments.map(inv => {
        const now = new Date();
        const createdAt = inv.createdAt.toDate();
        const maturityDate = inv.maturityDate.toDate();
        const totalDuration = maturityDate - createdAt;
        const elapsed = now - createdAt;
        const progress = Math.min((elapsed / totalDuration) * 100, 100);
        
        const timeRemaining = maturityDate > now ? 
            formatTimeRemaining(maturityDate - now) : 
            'Matured - Processing';
        
        return `
            <div class="investment-item">
                <div class="investment-icon">📈</div>
                <div class="investment-details">
                    <h4>${inv.planName}</h4>
                    <p>Invested: ${new Date(inv.createdAt.toDate()).toLocaleDateString()}</p>
                    <p>Matures: ${maturityDate.toLocaleDateString()} ${maturityDate.toLocaleTimeString()}</p>
                    <p><strong>Time Remaining:</strong> ${timeRemaining}</p>
                    <div class="investment-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                    </div>
                </div>
                <div class="investment-info">
                    <div class="investment-amount">${parseFloat(inv.amount).toFixed(2)} π</div>
                    <div class="investment-status active">Active</div>
                    <p style="font-size: 0.875rem; color: var(--gray-600); margin-top: 4px;">
                        Expected: ${parseFloat(inv.expectedPayout).toFixed(2)} π
                    </p>
                </div>
            </div>
        `;
    }).join('');
}

// ===================================
// LOAD RECENT ACTIVITY
// ===================================
function loadRecentActivity(depositsSnapshot, withdrawalsSnapshot, investmentsSnapshot) {
    const recentActivity = document.getElementById('recentActivity');
    
    const activities = [];
    
    depositsSnapshot.forEach(doc => {
        const deposit = doc.data();
        activities.push({
            type: 'deposit',
            ...deposit,
            id: doc.id,
            timestamp: deposit.createdAt
        });
    });
    
    withdrawalsSnapshot.forEach(doc => {
        const withdrawal = doc.data();
        activities.push({
            type: 'withdrawal',
            ...withdrawal,
            id: doc.id,
            timestamp: withdrawal.createdAt
        });
    });
    
    investmentsSnapshot.forEach(doc => {
        const investment = doc.data();
        activities.push({
            type: 'investment',
            ...investment,
            id: doc.id,
            timestamp: investment.createdAt
        });
    });
    
    activities.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return b.timestamp.toDate() - a.timestamp.toDate();
    });
    
    const recentActivities = activities.slice(0, 5);
    
    if (recentActivities.length === 0) {
        recentActivity.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📭</span>
                <p>No recent activity</p>
            </div>
        `;
        return;
    }
    
    recentActivity.innerHTML = recentActivities.map(activity => {
        let icon, title;
        if (activity.type === 'deposit') {
            icon = '💰';
            title = 'Deposit';
        } else if (activity.type === 'withdrawal') {
            icon = '🏦';
            title = 'Withdrawal';
        } else {
            icon = '📈';
            title = 'Investment - ' + activity.planName;
        }
        
        return `
            <div class="activity-item">
                <div class="activity-info">
                    <span class="activity-icon">${icon}</span>
                    <div class="activity-details">
                        <h4>${title}</h4>
                        <p>${formatDate(activity.timestamp)}</p>
                    </div>
                </div>
                <div class="activity-amount">
                    <div class="amount-value">${parseFloat(activity.amount).toFixed(2)} π</div>
                    <span class="activity-status status-${activity.status}">${activity.status}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ===================================
// LOAD DEPOSITS HISTORY
// ===================================
function loadDepositsHistory(depositsSnapshot) {
    const depositsHistory = document.getElementById('depositsHistory');
    
    if (depositsSnapshot.empty) {
        depositsHistory.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📭</span>
                <p>No deposit history</p>
            </div>
        `;
        return;
    }
    
    depositsHistory.innerHTML = '';
    
    depositsSnapshot.forEach(doc => {
        const deposit = doc.data();
        
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <span class="history-icon">💰</span>
            <div class="history-details">
                <h4>Deposit</h4>
                <p>${formatDate(deposit.createdAt)}</p>
                <p>TX: ${deposit.txHash.substring(0, 20)}...</p>
            </div>
            <div class="history-amount">${parseFloat(deposit.amount).toFixed(2)} π</div>
            <span class="activity-status status-${deposit.status}">${deposit.status}</span>
        `;
        
        depositsHistory.appendChild(item);
    });
}

// ===================================
// LOAD INVESTMENTS HISTORY
// ===================================
function loadInvestmentsHistory(investmentsSnapshot) {
    const investmentsHistory = document.getElementById('investmentsHistory');
    
    if (investmentsSnapshot.empty) {
        investmentsHistory.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📭</span>
                <p>No investment history</p>
            </div>
        `;
        return;
    }
    
    investmentsHistory.innerHTML = '';
    
    investmentsSnapshot.forEach(doc => {
        const investment = doc.data();
        
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <span class="history-icon">📈</span>
            <div class="history-details">
                <h4>${investment.planName}</h4>
                <p>Started: ${formatDate(investment.createdAt)}</p>
                <p>Matures: ${formatDate(investment.maturityDate)}</p>
                <p>Return Rate: ${(investment.returnRate * 100).toFixed(0)}%</p>
            </div>
            <div class="history-amount">
                <div>${parseFloat(investment.amount).toFixed(2)} π</div>
                <div style="font-size: 0.875rem; color: var(--gray-600);">
                    Payout: ${parseFloat(investment.expectedPayout).toFixed(2)} π
                </div>
            </div>
            <span class="activity-status status-${investment.status === 'active' ? 'pending' : investment.status === 'completed' ? 'approved' : investment.status}">${investment.status}</span>
        `;
        
        investmentsHistory.appendChild(item);
    });
}

// ===================================
// LOAD WITHDRAWALS HISTORY
// ===================================
function loadWithdrawalsHistory(withdrawalsSnapshot) {
    const withdrawalsHistory = document.getElementById('withdrawalsHistory');
    
    if (withdrawalsSnapshot.empty) {
        withdrawalsHistory.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📭</span>
                <p>No withdrawal history</p>
            </div>
        `;
        return;
    }
    
    withdrawalsHistory.innerHTML = '';
    
    withdrawalsSnapshot.forEach(doc => {
        const withdrawal = doc.data();
        
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <span class="history-icon">🏦</span>
            <div class="history-details">
                <h4>Withdrawal</h4>
                <p>${formatDate(withdrawal.createdAt)}</p>
                <p>To: ${withdrawal.walletAddress.substring(0, 20)}...</p>
            </div>
            <div class="history-amount">${parseFloat(withdrawal.amount).toFixed(2)} π</div>
            <span class="activity-status status-${withdrawal.status}">${withdrawal.status}</span>
        `;
        
        withdrawalsHistory.appendChild(item);
    });
}

// ===================================
// SETUP EVENT LISTENERS
// ===================================
function setupEventListeners() {
    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            navItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            const page = this.dataset.page;
            document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
            document.getElementById(`${page}Page`).classList.add('active');
        });
    });
    
    // View all links
    document.querySelectorAll('.view-all').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetPage = this.dataset.page;
            
            const historyNav = document.querySelector(`.nav-item[data-page="${targetPage}"]`);
            if (historyNav) {
                historyNav.click();
            }
        });
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async function() {
        try {
            await auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
    
    // Copy wallet
    const copyWalletBtn = document.getElementById('copyWalletBtn');
    if (copyWalletBtn) {
        copyWalletBtn.addEventListener('click', function() {
            navigator.clipboard.writeText(platformWallet).then(() => {
                this.textContent = 'Copied!';
                setTimeout(() => {
                    this.textContent = 'Copy';
                }, 2000);
            });
        });
    }
    
    // Deposit form
    const depositForm = document.getElementById('depositForm');
    if (depositForm) {
        depositForm.addEventListener('submit', handleDepositSubmit);
    }
    
    // Withdrawal form
    const withdrawForm = document.getElementById('withdrawForm');
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', handleWithdrawalSubmit);
    }
    
    // Investment buttons
    const investButtons = document.querySelectorAll('.btn-invest');
    investButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const plan = this.dataset.plan;
            openInvestModal(plan);
        });
    });
    
    // Investment form
    const investForm = document.getElementById('investForm');
    if (investForm) {
        investForm.addEventListener('submit', handleInvestmentSubmit);
    }
    
    // Investment modal cancel
    const investModalCancel = document.getElementById('investModalCancel');
    if (investModalCancel) {
        investModalCancel.addEventListener('click', closeInvestModal);
    }
    
    // Investment amount input - live calculation
    const investAmount = document.getElementById('investAmount');
    if (investAmount) {
        investAmount.addEventListener('input', updateInvestmentSummary);
    }
    
    // History tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.getElementById(`${tab}Tab`).classList.add('active');
        });
    });
}

// ===================================
// INVESTMENT MODAL FUNCTIONS
// ===================================
function openInvestModal(plan) {
    currentPlan = INVESTMENT_PLANS[plan];
    const modal = document.getElementById('investModal');
    const modalTitle = document.getElementById('investModalTitle');
    const investHint = document.getElementById('investHint');
    const investAmount = document.getElementById('investAmount');
    
    modalTitle.textContent = `Invest in ${currentPlan.name}`;
    investHint.textContent = `Min: ${currentPlan.minAmount} π - Max: ${currentPlan.maxAmount} π`;
    investAmount.min = currentPlan.minAmount;
    investAmount.max = currentPlan.maxAmount;
    investAmount.value = '';
    
    document.getElementById('investSummary').style.display = 'none';
    document.getElementById('investModalMessage').style.display = 'none';
    
    modal.classList.add('active');
}

function closeInvestModal() {
    const modal = document.getElementById('investModal');
    modal.classList.remove('active');
    document.getElementById('investForm').reset();
    currentPlan = null;
}

function updateInvestmentSummary() {
    const amount = parseFloat(document.getElementById('investAmount').value);
    
    if (!amount || !currentPlan) {
        document.getElementById('investSummary').style.display = 'none';
        return;
    }
    
    if (amount < currentPlan.minAmount || amount > currentPlan.maxAmount) {
        document.getElementById('investSummary').style.display = 'none';
        return;
    }
    
    const returns = amount * currentPlan.returnRate;
    const payout = amount + returns;
    const maturityDate = new Date();
    maturityDate.setHours(maturityDate.getHours() + currentPlan.durationHours);
    
    document.getElementById('summaryPlan').textContent = currentPlan.name;
    document.getElementById('summaryAmount').textContent = `${amount.toFixed(2)} π`;
    document.getElementById('summaryDuration').textContent = `${currentPlan.durationHours} hours`;
    document.getElementById('summaryReturn').textContent = `${returns.toFixed(2)} π (${(currentPlan.returnRate * 100).toFixed(0)}%)`;
    document.getElementById('summaryPayout').textContent = `${payout.toFixed(2)} π`;
    document.getElementById('summaryMaturity').textContent = maturityDate.toLocaleString();
    
    document.getElementById('investSummary').style.display = 'block';
}

// ===================================
// HANDLE INVESTMENT SUBMIT
// ===================================
async function handleInvestmentSubmit(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('investAmount').value);
    const investModalMessage = document.getElementById('investModalMessage');
    const submitBtn = document.getElementById('investModalConfirm');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    investModalMessage.style.display = 'none';
    
    // Validation
    if (!currentPlan) {
        showMessage(investModalMessage, 'Invalid plan selected', 'error');
        return;
    }
    
    if (amount < currentPlan.minAmount || amount > currentPlan.maxAmount) {
        showMessage(investModalMessage, `Amount must be between ${currentPlan.minAmount} π and ${currentPlan.maxAmount} π`, 'error');
        return;
    }
    
    // Check available balance
    const availableBalance = parseFloat(document.getElementById('investBalance').textContent);
    if (amount > availableBalance) {
        showMessage(investModalMessage, 'Insufficient available balance', 'error');
        return;
    }
    
    // Show loading
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        
        const returns = amount * currentPlan.returnRate;
        const payout = amount + returns;
        const maturityDate = new Date();
        maturityDate.setHours(maturityDate.getHours() + currentPlan.durationHours);
        
        // Create investment
        await db.collection('investments').add({
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: userData.fullName,
            planName: currentPlan.name,
            amount: amount,
            returnRate: currentPlan.returnRate,
            durationHours: currentPlan.durationHours,
            expectedReturns: returns,
            expectedPayout: payout,
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            maturityDate: firebase.firestore.Timestamp.fromDate(maturityDate)
        });
        
        showMessage(investModalMessage, `Investment successful! Your ${currentPlan.name} is now active.`, 'success');
        
        // Reload dashboard
        setTimeout(() => {
            closeInvestModal();
            loadDashboardData();
        }, 2000);
        
    } catch (error) {
        console.error('Error creating investment:', error);
        showMessage(investModalMessage, 'Error creating investment. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
    }
}

// ===================================
// CHECK MATURED INVESTMENTS
// ===================================
async function checkMaturedInvestments() {
    if (!currentUser) return;
    
    try {
        const now = firebase.firestore.Timestamp.now();
        
        const maturedInvestments = await db.collection('investments')
            .where('userId', '==', currentUser.uid)
            .where('status', '==', 'active')
            .where('maturityDate', '<=', now)
            .get();
        
        if (maturedInvestments.empty) return;
        
        // Process matured investments
        const batch = db.batch();
        
        maturedInvestments.forEach(doc => {
            const investment = doc.data();
            
            // Mark investment as completed
            batch.update(doc.ref, {
                status: 'completed',
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // The payout is automatically added to available balance
            // because we subtract total investments from deposits when calculating available balance
            // When an investment is marked 'completed', it no longer counts as active investment
        });
        
        await batch.commit();
        
        // Reload dashboard to show updated data
        loadDashboardData();
        
    } catch (error) {
        console.error('Error checking matured investments:', error);
    }
}

// ===================================
// HANDLE DEPOSIT SUBMIT
// ===================================
async function handleDepositSubmit(e) {
    e.preventDefault();
    
    const amount = document.getElementById('depositAmount').value;
    const txHash = document.getElementById('txHash').value.trim();
    const txDate = document.getElementById('txDate').value;
    
    const depositMessage = document.getElementById('depositMessage');
    const submitBtn = e.target.querySelector('.btn-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    depositMessage.style.display = 'none';
    
    if (!amount || parseFloat(amount) <= 0) {
        showMessage(depositMessage, 'Please enter a valid amount', 'error');
        return;
    }
    
    if (!txHash) {
        showMessage(depositMessage, 'Please enter transaction hash', 'error');
        return;
    }
    
    if (!txDate) {
        showMessage(depositMessage, 'Please select transaction date', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        
        await db.collection('deposits').add({
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: userData.fullName,
            amount: parseFloat(amount),
            txHash: txHash,
            txDate: txDate,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showMessage(depositMessage, 'Deposit notification submitted successfully! Awaiting admin approval.', 'success');
        
        e.target.reset();
        
        setTimeout(() => {
            loadDashboardData();
        }, 2000);
        
    } catch (error) {
        console.error('Error submitting deposit:', error);
        showMessage(depositMessage, 'Error submitting deposit. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
    }
}

// ===================================
// HANDLE WITHDRAWAL SUBMIT
// ===================================
async function handleWithdrawalSubmit(e) {
    e.preventDefault();
    
    const amount = document.getElementById('withdrawAmount').value;
    const address = document.getElementById('withdrawAddress').value.trim();
    
    const withdrawMessage = document.getElementById('withdrawMessage');
    const submitBtn = e.target.querySelector('.btn-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    withdrawMessage.style.display = 'none';
    
    if (!amount || parseFloat(amount) < 1) {
        showMessage(withdrawMessage, 'Minimum withdrawal amount is 1 π', 'error');
        return;
    }
    
    if (!address) {
        showMessage(withdrawMessage, 'Please enter your Pi wallet address', 'error');
        return;
    }
    
    const availableBalance = parseFloat(document.getElementById('withdrawableBalance').textContent);
    if (parseFloat(amount) > availableBalance) {
        showMessage(withdrawMessage, 'Insufficient balance', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        
        await db.collection('withdrawals').add({
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: userData.fullName,
            amount: parseFloat(amount),
            walletAddress: address,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showMessage(withdrawMessage, 'Withdrawal request submitted successfully! Awaiting admin approval.', 'success');
        
        e.target.reset();
        
        setTimeout(() => {
            loadDashboardData();
        }, 2000);
        
    } catch (error) {
        console.error('Error submitting withdrawal:', error);
        showMessage(withdrawMessage, 'Error submitting withdrawal. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
    }
}

// ===================================
// HELPER FUNCTIONS
// ===================================
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatTimeRemaining(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m`;
    } else {
        return 'Less than 1m';
    }
}

function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `message ${type === 'error' ? 'error-message' : 'success-message'}`;
    element.style.display = 'block';
}