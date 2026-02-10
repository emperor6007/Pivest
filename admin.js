// ===================================
// ADMIN.JS - Admin Panel Script
// ===================================

let currentAdmin = null;
let currentFilter = 'all';

// ===================================
// AUTH CHECK
// ===================================
auth.onAuthStateChanged(async user => {
    if (!user) {
        // Not logged in, redirect to login
        window.location.href = 'login.html';
        return;
    }
    
    // Check if admin
    if (user.email !== ADMIN_EMAIL) {
        // Not admin, redirect to dashboard
        window.location.href = 'dashboard.html';
        return;
    }
    
    currentAdmin = user;
    
    // Load admin data
    await loadAdminData();
    await loadPlatformSettings();
    
    // Setup event listeners
    setupEventListeners();
});

// ===================================
// LOAD ADMIN DATA
// ===================================
async function loadAdminData() {
    try {
        // Load all users
        const usersSnapshot = await db.collection('users').get();
        const totalUsers = usersSnapshot.size;
        
        // Load all deposits
        const depositsSnapshot = await db.collection('deposits')
            .orderBy('createdAt', 'desc')
            .get();
        
        let totalDeposits = 0;
        let pendingApprovals = 0;
        
        depositsSnapshot.forEach(doc => {
            const deposit = doc.data();
            if (deposit.status === 'approved') {
                totalDeposits += parseFloat(deposit.amount);
            } else if (deposit.status === 'pending') {
                pendingApprovals++;
            }
        });
        
        // Load all withdrawals
        const withdrawalsSnapshot = await db.collection('withdrawals')
            .orderBy('createdAt', 'desc')
            .get();
        
        let totalWithdrawals = 0;
        
        withdrawalsSnapshot.forEach(doc => {
            const withdrawal = doc.data();
            if (withdrawal.status === 'approved') {
                totalWithdrawals += parseFloat(withdrawal.amount);
            } else if (withdrawal.status === 'pending') {
                pendingApprovals++;
            }
        });
        
        // Update stats
        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('totalDeposits').textContent = `${totalDeposits.toFixed(2)} π`;
        document.getElementById('pendingApprovals').textContent = pendingApprovals;
        document.getElementById('totalWithdrawals').textContent = `${totalWithdrawals.toFixed(2)} π`;
        
        // Load users table
        loadUsersTable(usersSnapshot);
        
        // Load deposits table
        loadDepositsTable(depositsSnapshot);
        
        // Load withdrawals table
        loadWithdrawalsTable(withdrawalsSnapshot);
        
        // Load recent activity
        loadRecentActivity(depositsSnapshot, withdrawalsSnapshot);
        
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

// ===================================
// LOAD PLATFORM SETTINGS
// ===================================
async function loadPlatformSettings() {
    try {
        const settingsDoc = await db.collection('settings').doc('platform').get();
        
        if (settingsDoc.exists) {
            const settings = settingsDoc.data();
            
            document.getElementById('platformWalletAddress').value = settings.walletAddress || '';
            document.getElementById('currentWallet').textContent = settings.walletAddress || 'Not set';
            
            if (settings.updatedAt) {
                const updateDate = settings.updatedAt.toDate();
                document.getElementById('lastUpdated').textContent = updateDate.toLocaleString();
            }
        }
    } catch (error) {
        console.error('Error loading platform settings:', error);
    }
}

// ===================================
// LOAD USERS TABLE
// ===================================
async function loadUsersTable(usersSnapshot) {
    const tableBody = document.getElementById('usersTableBody');
    
    if (usersSnapshot.empty) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No users found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = '';
    
    for (const doc of usersSnapshot.docs) {
        const user = doc.data();
        const userId = doc.id;
        
        // Calculate total invested
        const depositsSnapshot = await db.collection('deposits')
            .where('userId', '==', userId)
            .where('status', '==', 'approved')
            .get();
        
        let totalInvested = 0;
        depositsSnapshot.forEach(d => {
            totalInvested += parseFloat(d.data().amount);
        });
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><code>${userId.substring(0, 8)}...</code></td>
            <td>${user.fullName || 'N/A'}</td>
            <td>${user.email}</td>
            <td>${user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A'}</td>
            <td class="amount-cell">${totalInvested.toFixed(2)} π</td>
            <td>
                <div class="table-actions">
                    <button class="btn-action btn-view" onclick="viewUserDetails('${userId}')">View</button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    }
}

// ===================================
// LOAD DEPOSITS TABLE
// ===================================
function loadDepositsTable(depositsSnapshot) {
    const tableBody = document.getElementById('depositsTableBody');
    
    if (depositsSnapshot.empty) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No deposits found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = '';
    
    depositsSnapshot.forEach(doc => {
        const deposit = doc.data();
        const depositId = doc.id;
        
        // Apply filter
        if (currentFilter !== 'all' && deposit.status !== currentFilter) {
            return;
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${deposit.createdAt ? deposit.createdAt.toDate().toLocaleDateString() : 'N/A'}</td>
            <td>
                <div class="user-cell">
                    <span class="user-name">${deposit.userName || 'Unknown'}</span>
                    <span class="user-email">${deposit.userEmail || ''}</span>
                </div>
            </td>
            <td class="amount-cell">${parseFloat(deposit.amount).toFixed(2)} π</td>
            <td><span class="tx-hash" title="${deposit.txHash}">${deposit.txHash}</span></td>
            <td><span class="table-status ${deposit.status}">${deposit.status}</span></td>
            <td>
                <div class="table-actions">
                    ${deposit.status === 'pending' ? `
                        <button class="btn-action btn-approve" onclick="approveDeposit('${depositId}')">Approve</button>
                        <button class="btn-action btn-reject" onclick="rejectDeposit('${depositId}')">Reject</button>
                    ` : `
                        <button class="btn-action btn-view" disabled>Processed</button>
                    `}
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    if (tableBody.children.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No deposits match the filter</td></tr>';
    }
}

// ===================================
// LOAD WITHDRAWALS TABLE
// ===================================
function loadWithdrawalsTable(withdrawalsSnapshot) {
    const tableBody = document.getElementById('withdrawalsTableBody');
    
    if (withdrawalsSnapshot.empty) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No withdrawals found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = '';
    
    withdrawalsSnapshot.forEach(doc => {
        const withdrawal = doc.data();
        const withdrawalId = doc.id;
        
        // Apply filter (using the same currentFilter variable)
        if (currentFilter !== 'all' && withdrawal.status !== currentFilter) {
            return;
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${withdrawal.createdAt ? withdrawal.createdAt.toDate().toLocaleDateString() : 'N/A'}</td>
            <td>
                <div class="user-cell">
                    <span class="user-name">${withdrawal.userName || 'Unknown'}</span>
                    <span class="user-email">${withdrawal.userEmail || ''}</span>
                </div>
            </td>
            <td class="amount-cell">${parseFloat(withdrawal.amount).toFixed(2)} π</td>
            <td><span class="wallet-addr" title="${withdrawal.walletAddress}">${withdrawal.walletAddress}</span></td>
            <td><span class="table-status ${withdrawal.status}">${withdrawal.status}</span></td>
            <td>
                <div class="table-actions">
                    ${withdrawal.status === 'pending' ? `
                        <button class="btn-action btn-approve" onclick="approveWithdrawal('${withdrawalId}')">Approve</button>
                        <button class="btn-action btn-reject" onclick="rejectWithdrawal('${withdrawalId}')">Reject</button>
                    ` : `
                        <button class="btn-action btn-view" disabled>Processed</button>
                    `}
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    if (tableBody.children.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No withdrawals match the filter</td></tr>';
    }
}

// ===================================
// LOAD RECENT ACTIVITY
// ===================================
function loadRecentActivity(depositsSnapshot, withdrawalsSnapshot) {
    const recentActivity = document.getElementById('recentActivity');
    
    const activities = [];
    
    depositsSnapshot.forEach(doc => {
        const deposit = doc.data();
        if (deposit.status === 'pending') {
            activities.push({
                type: 'deposit',
                ...deposit,
                id: doc.id,
                timestamp: deposit.createdAt
            });
        }
    });
    
    withdrawalsSnapshot.forEach(doc => {
        const withdrawal = doc.data();
        if (withdrawal.status === 'pending') {
            activities.push({
                type: 'withdrawal',
                ...withdrawal,
                id: doc.id,
                timestamp: withdrawal.createdAt
            });
        }
    });
    
    // Sort by timestamp
    activities.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return b.timestamp.toDate() - a.timestamp.toDate();
    });
    
    const recentActivities = activities.slice(0, 10);
    
    if (recentActivities.length === 0) {
        recentActivity.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">✅</span>
                <p>All caught up! No pending items.</p>
            </div>
        `;
        return;
    }
    
    recentActivity.innerHTML = recentActivities.map(activity => `
        <div class="activity-item">
            <div class="activity-info">
                <span class="activity-icon">${activity.type === 'deposit' ? '💰' : '🏦'}</span>
                <div class="activity-details">
                    <h4>Pending ${activity.type === 'deposit' ? 'Deposit' : 'Withdrawal'} - ${activity.userName}</h4>
                    <p>${formatDate(activity.timestamp)}</p>
                </div>
            </div>
            <div class="activity-amount">
                <div class="amount-value">${parseFloat(activity.amount).toFixed(2)} π</div>
                <span class="activity-status status-${activity.status}">${activity.status}</span>
            </div>
        </div>
    `).join('');
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
            
            const page = this.dataset.page;
            
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
            document.getElementById(`${page}Page`).classList.add('active');
        });
    });
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', async function() {
        try {
            await auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
    
    // Filter buttons for deposits page
    const depositsFilterBtns = document.querySelectorAll('#depositsPage .filter-btn');
    depositsFilterBtns.forEach(btn => {
        btn.addEventListener('click', async function() {
            depositsFilterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentFilter = this.dataset.filter;
            
            // Reload deposits
            const depositsSnapshot = await db.collection('deposits').orderBy('createdAt', 'desc').get();
            loadDepositsTable(depositsSnapshot);
        });
    });
    
    // Filter buttons for withdrawals page
    const withdrawalsFilterBtns = document.querySelectorAll('#withdrawalsPage .filter-btn');
    withdrawalsFilterBtns.forEach(btn => {
        btn.addEventListener('click', async function() {
            withdrawalsFilterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentFilter = this.dataset.filter;
            
            // Reload withdrawals
            const withdrawalsSnapshot = await db.collection('withdrawals').orderBy('createdAt', 'desc').get();
            loadWithdrawalsTable(withdrawalsSnapshot);
        });
    });
    
    // Wallet form
    const walletForm = document.getElementById('walletForm');
    if (walletForm) {
        walletForm.addEventListener('submit', handleWalletUpdate);
    }
}

// ===================================
// APPROVE DEPOSIT
// ===================================
async function approveDeposit(depositId) {
    const confirmed = await showConfirmModal(
        'Approve Deposit',
        'Are you sure you want to approve this deposit? This will add the amount to the user\'s balance.'
    );
    
    if (!confirmed) return;
    
    try {
        const depositDoc = await db.collection('deposits').doc(depositId).get();
        const deposit = depositDoc.data();
        
        // Update deposit status
        await db.collection('deposits').doc(depositId).update({
            status: 'approved',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedBy: currentAdmin.email
        });
        
        showSuccessMessage('depositsMessage', 'Deposit approved successfully!');
        
        // Reload data
        setTimeout(() => {
            loadAdminData();
        }, 1000);
        
    } catch (error) {
        console.error('Error approving deposit:', error);
        showErrorMessage('depositsMessage', 'Error approving deposit. Please try again.');
    }
}

// ===================================
// REJECT DEPOSIT
// ===================================
async function rejectDeposit(depositId) {
    const confirmed = await showConfirmModal(
        'Reject Deposit',
        'Are you sure you want to reject this deposit? This action cannot be undone.'
    );
    
    if (!confirmed) return;
    
    try {
        await db.collection('deposits').doc(depositId).update({
            status: 'rejected',
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            rejectedBy: currentAdmin.email
        });
        
        showSuccessMessage('depositsMessage', 'Deposit rejected.');
        
        // Reload data
        setTimeout(() => {
            loadAdminData();
        }, 1000);
        
    } catch (error) {
        console.error('Error rejecting deposit:', error);
        showErrorMessage('depositsMessage', 'Error rejecting deposit. Please try again.');
    }
}

// ===================================
// APPROVE WITHDRAWAL
// ===================================
async function approveWithdrawal(withdrawalId) {
    const confirmed = await showConfirmModal(
        'Approve Withdrawal',
        'Are you sure you want to approve this withdrawal? Make sure you have sent the Pi to the user\'s wallet.'
    );
    
    if (!confirmed) return;
    
    try {
        await db.collection('withdrawals').doc(withdrawalId).update({
            status: 'approved',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedBy: currentAdmin.email
        });
        
        showSuccessMessage('withdrawalsMessage', 'Withdrawal approved successfully!');
        
        // Reload data
        setTimeout(() => {
            loadAdminData();
        }, 1000);
        
    } catch (error) {
        console.error('Error approving withdrawal:', error);
        showErrorMessage('withdrawalsMessage', 'Error approving withdrawal. Please try again.');
    }
}

// ===================================
// REJECT WITHDRAWAL
// ===================================
async function rejectWithdrawal(withdrawalId) {
    const confirmed = await showConfirmModal(
        'Reject Withdrawal',
        'Are you sure you want to reject this withdrawal request?'
    );
    
    if (!confirmed) return;
    
    try {
        await db.collection('withdrawals').doc(withdrawalId).update({
            status: 'rejected',
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            rejectedBy: currentAdmin.email
        });
        
        showSuccessMessage('withdrawalsMessage', 'Withdrawal rejected.');
        
        // Reload data
        setTimeout(() => {
            loadAdminData();
        }, 1000);
        
    } catch (error) {
        console.error('Error rejecting withdrawal:', error);
        showErrorMessage('withdrawalsMessage', 'Error rejecting withdrawal. Please try again.');
    }
}

// ===================================
// HANDLE WALLET UPDATE
// ===================================
async function handleWalletUpdate(e) {
    e.preventDefault();
    
    const walletAddress = document.getElementById('platformWalletAddress').value.trim();
    const settingsMessage = document.getElementById('settingsMessage');
    const submitBtn = e.target.querySelector('.btn-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    settingsMessage.style.display = 'none';
    
    if (!walletAddress) {
        showErrorMessage('settingsMessage', 'Please enter a valid wallet address');
        return;
    }
    
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    
    try {
        await db.collection('settings').doc('platform').set({
            walletAddress: walletAddress,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentAdmin.email
        }, { merge: true });
        
        showSuccessMessage('settingsMessage', 'Wallet address updated successfully!');
        
        // Update display
        document.getElementById('currentWallet').textContent = walletAddress;
        document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
        
    } catch (error) {
        console.error('Error updating wallet:', error);
        showErrorMessage('settingsMessage', 'Error updating wallet address. Please try again.');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
    }
}

// ===================================
// VIEW USER DETAILS
// ===================================
function viewUserDetails(userId) {
    alert(`User ID: ${userId}\n\nThis feature would show detailed user information in a modal or separate page.`);
}

// ===================================
// SHOW CONFIRM MODAL
// ===================================
function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalConfirm = document.getElementById('modalConfirm');
        const modalCancel = document.getElementById('modalCancel');
        
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        
        modal.classList.add('active');
        
        function handleConfirm() {
            modal.classList.remove('active');
            cleanup();
            resolve(true);
        }
        
        function handleCancel() {
            modal.classList.remove('active');
            cleanup();
            resolve(false);
        }
        
        function cleanup() {
            modalConfirm.removeEventListener('click', handleConfirm);
            modalCancel.removeEventListener('click', handleCancel);
        }
        
        modalConfirm.addEventListener('click', handleConfirm);
        modalCancel.addEventListener('click', handleCancel);
    });
}

// ===================================
// HELPER FUNCTIONS
// ===================================
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function showSuccessMessage(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = 'message success-message';
    element.style.display = 'block';
    
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function showErrorMessage(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = 'message error-message';
    element.style.display = 'block';
    
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}
// ===================================
// LOAD INVESTMENTS TABLE
// ===================================
async function loadInvestmentsTable() {
    try {
        const investmentsSnapshot = await db.collection('investments')
            .orderBy('createdAt', 'desc')
            .get();
        
        const tableBody = document.getElementById('investmentsTableBody');
        
        if (investmentsSnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">No investments found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = '';
        
        investmentsSnapshot.forEach(doc => {
            const investment = doc.data();
            const investmentId = doc.id;
            
            // Apply filter
            if (currentFilter !== 'all' && investment.status !== currentFilter) {
                return;
            }
            
            const maturityDate = investment.maturityDate ? investment.maturityDate.toDate() : null;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${investment.createdAt ? investment.createdAt.toDate().toLocaleDateString() : 'N/A'}</td>
                <td>
                    <div class="user-cell">
                        <span class="user-name">${investment.userName || 'Unknown'}</span>
                        <span class="user-email">${investment.userEmail || ''}</span>
                    </div>
                </td>
                <td><strong>${investment.planName}</strong></td>
                <td class="amount-cell">${parseFloat(investment.amount).toFixed(2)} π</td>
                <td>${(investment.returnRate * 100).toFixed(0)}%</td>
                <td class="amount-cell">${parseFloat(investment.expectedPayout).toFixed(2)} π</td>
                <td>${maturityDate ? maturityDate.toLocaleString() : 'N/A'}</td>
                <td><span class="table-status ${investment.status}">${investment.status}</span></td>
            `;
            
            tableBody.appendChild(row);
        });
        
        if (tableBody.children.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">No investments match the filter</td></tr>';
        }
    } catch (error) {
        console.error('Error loading investments:', error);
    }
}

// Update loadAdminData to include investments
const originalLoadAdminData = loadAdminData;
loadAdminData = async function() {
    await originalLoadAdminData();
    await loadInvestmentsTable();
};