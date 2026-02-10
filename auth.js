// ===================================
// AUTH.JS - Authentication Script
// ===================================

// Check if user is already logged in
auth.onAuthStateChanged(user => {
    if (user) {
        // Check if admin
        if (user.email === ADMIN_EMAIL) {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    }
});

// ===================================
// REGISTRATION
// ===================================
const registerForm = document.getElementById('registerForm');

if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const agreeTerms = document.getElementById('agreeTerms').checked;
        
        const errorMessage = document.getElementById('errorMessage');
        const successMessage = document.getElementById('successMessage');
        const submitBtn = document.getElementById('submitBtn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');
        
        // Hide messages
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
        
        // Validation
        if (!fullName) {
            showError('Please enter your full name');
            return;
        }
        
        if (password.length < 6) {
            showError('Password must be at least 6 characters');
            return;
        }
        
        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }
        
        if (!agreeTerms) {
            showError('Please agree to the Terms of Service and Privacy Policy');
            return;
        }
        
        // Show loading state
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
        
        try {
            // Create user account
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Create user document in Firestore
            await db.collection('users').doc(user.uid).set({
                fullName: fullName,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                totalInvested: 0,
                totalWithdrawals: 0,
                availableBalance: 0
            });
            
            showSuccess('Account created successfully! Redirecting...');
            
            // Redirect after 2 seconds
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
            
        } catch (error) {
            console.error('Registration error:', error);
            showError(getErrorMessage(error.code));
            
            // Reset button
            submitBtn.disabled = false;
            btnText.style.display = 'inline-block';
            btnLoader.style.display = 'none';
        }
        
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
        
        function showSuccess(message) {
            successMessage.textContent = message;
            successMessage.style.display = 'block';
        }
    });
}

// ===================================
// LOGIN
// ===================================
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        const errorMessage = document.getElementById('errorMessage');
        const submitBtn = document.getElementById('submitBtn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');
        
        // Hide error message
        errorMessage.style.display = 'none';
        
        // Show loading state
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
        
        try {
            // Sign in user
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Check if admin
            if (user.email === ADMIN_EMAIL) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }
            
        } catch (error) {
            console.error('Login error:', error);
            showError(getErrorMessage(error.code));
            
            // Reset button
            submitBtn.disabled = false;
            btnText.style.display = 'inline-block';
            btnLoader.style.display = 'none';
        }
        
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
    });
}

// ===================================
// HELPER FUNCTIONS
// ===================================
function getErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'This email is already registered. Please login instead.';
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/weak-password':
            return 'Password is too weak. Please use a stronger password.';
        case 'auth/user-not-found':
            return 'No account found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection.';
        default:
            return 'An error occurred. Please try again.';
    }
}