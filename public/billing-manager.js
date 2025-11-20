// ============================================================================
// BILLING MANAGER - Complete Billing & Subscription Management
// ============================================================================

// Global state
let currentSubscription = null;
let paymentHistory = [];
let usageStats = null;

// Plan configurations
const PLAN_CONFIGS = {
    free: {
        name: 'Free Plan',
        price: { monthly: 0, yearly: 0 },
        features: [
            '5 messages total',
            'Basic support',
            'No chatbot access',
            'Limited features'
        ],
        limits: {
            messages: 5,
            botMessages: 0,
            chatbots: 0
        }
    },
    basic: {
        name: 'Basic Plan',
        price: { monthly: 25, yearly: 270 },
        features: [
            '100,000 API messages/month',
            'Priority support',
            'Advanced analytics',
            'Webhook support',
            '1 chatbot'
        ],
        limits: {
            messages: 100000,
            botMessages: 0,
            chatbots: 1
        }
    },
    premium: {
        name: 'Premium Plan',
        price: { monthly: 40, yearly: 432 },
        features: [
            'Unlimited API messages',
            '10,000 bot messages/month',
            '24/7 priority support',
            'Advanced analytics & reports',
            'Custom webhooks',
            'API rate limit boost',
            '2 chatbots',
            'White-label options'
        ],
        limits: {
            messages: -1, // unlimited
            botMessages: 10000,
            chatbots: 2
        }
    }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize billing section
 */
async function initializeBilling() {
    try {
        await loadBillingData();
        initializeBillingEventListeners();
        console.log('✓ Billing manager initialized');
    } catch (error) {
        console.error('Error initializing billing:', error);
        showToast('Failed to initialize billing', 'error');
    }
}

/**
 * Initialize event listeners
 */
function initializeBillingEventListeners() {
    // Upgrade plan button
    const upgradePlanBtn = document.getElementById('upgrade-plan-btn');
    if (upgradePlanBtn) {
        upgradePlanBtn.addEventListener('click', () => openPricingModal());
    }

    // Download invoice button
    const downloadInvoiceBtn = document.getElementById('download-invoice-btn');
    if (downloadInvoiceBtn) {
        downloadInvoiceBtn.addEventListener('click', () => downloadLatestInvoice());
    }

    // Cancel subscription button
    const cancelSubBtn = document.getElementById('cancel-subscription-btn');
    if (cancelSubBtn) {
        cancelSubBtn.addEventListener('click', () => cancelSubscription());
    }

    // Plan selection buttons in modal
    const planButtons = document.querySelectorAll('[data-plan]');
    planButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const plan = e.target.dataset.plan;
            const cycle = e.target.dataset.cycle;
            selectPlan(plan, cycle);
        });
    });
}

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Load all billing data
 */
async function loadBillingData() {
    try {
        // Load user profile with subscription info
        const profileResponse = await makeApiCall('/api/auth/profile');
        const user = profileResponse.data?.user || profileResponse.user || profileResponse;
        currentSubscription = user.subscription || {};

        // Load payment history
        await loadPaymentHistory();

        // Load usage statistics
        await loadUsageStats();

        // Update UI
        updateBillingUI();

    } catch (error) {
        console.error('Error loading billing data:', error);
        throw error;
    }
}

/**
 * Load payment history
 */
async function loadPaymentHistory() {
    try {
        const response = await makeApiCall('/api/payments/history?limit=10');

        if (response.success && response.data) {
            paymentHistory = response.data.payments || [];
        } else {
            paymentHistory = [];
        }

        renderPaymentHistory();
    } catch (error) {
        console.error('Error loading payment history:', error);
        paymentHistory = [];
        renderPaymentHistory();
    }
}

/**
 * Load usage statistics
 */
async function loadUsageStats() {
    try {
        const response = await makeApiCall('/api/billing/usage');

        if (response.success && response.data) {
            usageStats = response.data;
        } else {
            usageStats = null;
        }

        renderUsageStats();
    } catch (error) {
        console.error('Error loading usage stats:', error);
        usageStats = null;
        renderUsageStats();
    }
}

// ============================================================================
// UI RENDERING
// ============================================================================

/**
 * Update billing UI
 */
function updateBillingUI() {
    if (!currentSubscription) return;

    const plan = currentSubscription.plan || 'free';
    const planConfig = PLAN_CONFIGS[plan] || PLAN_CONFIGS.free;
    const isActive = currentSubscription.isActive !== false;
    const cancelAtPeriodEnd = currentSubscription.cancelAtPeriodEnd || false;

    // Update plan name
    const planNameEl = document.getElementById('plan-loading');
    if (planNameEl) {
        planNameEl.textContent = planConfig.name;
    }

    // Update status badge
    const statusBadge = document.getElementById('plan-status-badge');
    if (statusBadge) {
        if (cancelAtPeriodEnd) {
            statusBadge.textContent = 'Cancelling';
            statusBadge.className = 'badge bg-warning fs-6';
        } else if (isActive) {
            statusBadge.textContent = 'Active';
            statusBadge.className = 'badge bg-success fs-6';
        } else {
            statusBadge.textContent = 'Inactive';
            statusBadge.className = 'badge bg-danger fs-6';
        }
    }

    // Update plan features
    renderPlanFeatures(planConfig);

    // Update billing information
    renderBillingInfo();

    // Show/hide cancel button
    const cancelBtn = document.getElementById('cancel-subscription-btn');
    if (cancelBtn) {
        cancelBtn.style.display = (plan !== 'free' && !cancelAtPeriodEnd) ? 'inline-block' : 'none';
    }
}

/**
 * Render plan features
 */
function renderPlanFeatures(planConfig) {
    const featuresEl = document.getElementById('plan-features');
    if (!featuresEl) return;

    featuresEl.innerHTML = planConfig.features.map(feature => `
        <li class="mb-2">
            <i class="fas fa-check text-success me-2"></i>${feature}
        </li>
    `).join('');
}

/**
 * Render billing information
 */
function renderBillingInfo() {
    const billingInfoEl = document.getElementById('billing-info');
    if (!billingInfoEl) return;

    const plan = currentSubscription.plan || 'free';
    const billingCycle = currentSubscription.billingCycle || 'monthly';
    const nextBillingDate = currentSubscription.nextBillingDate;
    const cancelAtPeriodEnd = currentSubscription.cancelAtPeriodEnd || false;

    let html = '';

    if (plan === 'free') {
        html = `
            <p class="mb-2"><strong>Plan:</strong> Free</p>
            <p class="mb-2"><strong>Cost:</strong> $0.00</p>
            <p class="mb-0 text-muted">
                <i class="fas fa-info-circle me-1"></i>
                Upgrade to unlock more features
            </p>
        `;
    } else {
        const planConfig = PLAN_CONFIGS[plan] || PLAN_CONFIGS.basic;
        const price = planConfig.price[billingCycle];

        html = `
            <p class="mb-2">
                <strong>Billing Cycle:</strong> 
                ${billingCycle.charAt(0).toUpperCase() + billingCycle.slice(1)}
            </p>
            <p class="mb-2">
                <strong>Amount:</strong> 
                $${price.toFixed(2)}/${billingCycle === 'monthly' ? 'month' : 'year'}
            </p>
        `;

        if (nextBillingDate) {
            const date = new Date(nextBillingDate);
            html += `
                <p class="mb-2">
                    <strong>Next Billing:</strong> 
                    ${date.toLocaleDateString()}
                </p>
            `;
        }

        if (cancelAtPeriodEnd) {
            html += `
                <div class="alert alert-warning mt-3 mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Your subscription will be cancelled on ${nextBillingDate ? new Date(nextBillingDate).toLocaleDateString() : 'the next billing date'}.
                    <button class="btn btn-sm btn-warning mt-2" onclick="reactivateSubscription()">
                        Reactivate Subscription
                    </button>
                </div>
            `;
        }
    }

    billingInfoEl.innerHTML = html;
}

/**
 * Render usage statistics
 */
function renderUsageStats() {
    const usageStatsEl = document.getElementById('usage-stats');
    if (!usageStatsEl) return;

    if (!usageStats || !currentSubscription) {
        usageStatsEl.innerHTML = `
            <div class="text-center">
                <i class="fas fa-chart-bar fa-3x text-muted mb-3"></i>
                <p class="text-muted">No usage data available</p>
            </div>
        `;
        return;
    }

    const plan = currentSubscription.plan || 'free';
    const planConfig = PLAN_CONFIGS[plan] || PLAN_CONFIGS.free;

    const messageCount = usageStats.messageCount || 0;
    const messageLimit = planConfig.limits.messages;
    const messagePercent = messageLimit === -1 ? 0 : Math.min((messageCount / messageLimit) * 100, 100);

    const botMessageCount = usageStats.botMessageCount || 0;
    const botMessageLimit = planConfig.limits.botMessages;
    const botMessagePercent = botMessageLimit === 0 ? 0 : Math.min((botMessageCount / botMessageLimit) * 100, 100);

    usageStatsEl.innerHTML = `
        <div class="mb-4">
            <div class="d-flex justify-content-between mb-2">
                <span><i class="fas fa-paper-plane me-2"></i>API Messages</span>
                <strong>${messageCount.toLocaleString()} / ${messageLimit === -1 ? '∞' : messageLimit.toLocaleString()}</strong>
            </div>
            ${messageLimit !== -1 ? `
                <div class="progress" style="height: 8px;">
                    <div class="progress-bar ${messagePercent > 80 ? 'bg-danger' : messagePercent > 50 ? 'bg-warning' : 'bg-success'}" 
                         role="progressbar" 
                         style="width: ${messagePercent}%">
                    </div>
                </div>
            ` : '<div class="text-muted small">Unlimited</div>'}
        </div>

        ${botMessageLimit > 0 ? `
            <div class="mb-4">
                <div class="d-flex justify-content-between mb-2">
                    <span><i class="fas fa-robot me-2"></i>Bot Messages</span>
                    <strong>${botMessageCount.toLocaleString()} / ${botMessageLimit.toLocaleString()}</strong>
                </div>
                <div class="progress" style="height: 8px;">
                    <div class="progress-bar ${botMessagePercent > 80 ? 'bg-danger' : botMessagePercent > 50 ? 'bg-warning' : 'bg-success'}" 
                         role="progressbar" 
                         style="width: ${botMessagePercent}%">
                    </div>
                </div>
            </div>
        ` : ''}

        <div class="mb-3">
            <div class="d-flex justify-content-between mb-2">
                <span><i class="fas fa-robot me-2"></i>Active Chatbots</span>
                <strong>${usageStats.chatbotCount || 0} / ${planConfig.limits.chatbots}</strong>
            </div>
        </div>

        ${messagePercent > 80 || botMessagePercent > 80 ? `
            <div class="alert alert-warning py-2 px-3 mb-0">
                <small>
                    <i class="fas fa-exclamation-triangle me-1"></i>
                    You're approaching your usage limit. Consider upgrading your plan.
                </small>
            </div>
        ` : ''}
    `;
}

/**
 * Render payment history
 */
function renderPaymentHistory() {
    const historyEl = document.getElementById('payment-history');
    if (!historyEl) return;

    if (!paymentHistory || paymentHistory.length === 0) {
        historyEl.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <i class="fas fa-receipt fa-2x text-muted mb-2"></i>
                    <p class="text-muted mb-0">No payment history available</p>
                </td>
            </tr>
        `;
        return;
    }

    historyEl.innerHTML = paymentHistory.map(payment => {
        const date = new Date(payment.createdAt);
        const statusClass = {
            'completed': 'success',
            'pending': 'warning',
            'failed': 'danger',
            'cancelled': 'secondary',
            'refunded': 'info'
        }[payment.status] || 'secondary';

        return `
            <tr>
                <td>${date.toLocaleDateString()}</td>
                <td>${payment.description || `${payment.plan} - ${payment.billingCycle}`}</td>
                <td>$${payment.amount.toFixed(2)} ${payment.currency}</td>
                <td>
                    <span class="badge bg-${statusClass}">
                        ${payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                    </span>
                </td>
                <td>${payment.razorpayPaymentId ? 'Razorpay' : 'N/A'}</td>
                <td>
                    ${payment.status === 'completed' ? `
                        <button class="btn btn-sm btn-outline-primary" onclick="downloadInvoice('${payment._id}')">
                            <i class="fas fa-download me-1"></i>Invoice
                        </button>
                    ` : '-'}
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================================================
// PLAN MANAGEMENT
// ============================================================================

/**
 * Open pricing modal
 */
function openPricingModal() {
    const modal = new bootstrap.Modal(document.getElementById('pricingModal'));
    modal.show();
}

/**
 * Select a plan
 */
async function selectPlan(plan, cycle) {
    try {
        if (!plan || !cycle) {
            showToast('Invalid plan selection', 'error');
            return;
        }

        // Show loading
        showToast('Creating payment order...', 'info');

        // Create payment order
        const response = await makeApiCall('/api/payments/create', {
            method: 'POST',
            body: JSON.stringify({
                plan: plan,
                billingCycle: cycle,
                type: 'subscription'
            })
        });

        if (!response.success) {
            showToast(response.message || 'Failed to create payment order', 'error');
            return;
        }

        // Close pricing modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('pricingModal'));
        if (modal) modal.hide();

        // Initialize Razorpay checkout
        const options = {
            key: response.data.razorpayKeyId,
            amount: response.data.amount * 100, // Razorpay expects amount in paise
            currency: response.data.currency,
            name: 'WhatsApp API Service',
            description: `${response.data.plan.name} - ${cycle}`,
            order_id: response.data.orderId,
            handler: async function (razorpayResponse) {
                await verifyPayment(razorpayResponse);
            },
            prefill: {
                email: window.currentUser?.email || '',
                name: window.currentUser?.name || ''
            },
            theme: {
                color: '#0d6efd'
            },
            modal: {
                ondismiss: function () {
                    showToast('Payment cancelled', 'warning');
                }
            }
        };

        const razorpay = new Razorpay(options);
        razorpay.open();

    } catch (error) {
        console.error('Error selecting plan:', error);
        showToast('Failed to initiate payment: ' + error.message, 'error');
    }
}

/**
 * Verify payment after Razorpay checkout
 */
async function verifyPayment(razorpayResponse) {
    try {
        showToast('Verifying payment...', 'info');

        const response = await makeApiCall('/api/payments/verify', {
            method: 'POST',
            body: JSON.stringify({
                razorpay_order_id: razorpayResponse.razorpay_order_id,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_signature: razorpayResponse.razorpay_signature
            })
        });

        if (response.success) {
            showToast('Payment successful! Your subscription has been activated.', 'success');

            // Reload billing data
            await loadBillingData();

            // Reload user profile
            if (typeof loadUserProfile === 'function') {
                await loadUserProfile();
            }
        } else {
            showToast('Payment verification failed: ' + (response.message || 'Unknown error'), 'error');
        }

    } catch (error) {
        console.error('Error verifying payment:', error);
        showToast('Failed to verify payment: ' + error.message, 'error');
    }
}

/**
 * Cancel subscription
 */
async function cancelSubscription() {
    if (!confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) {
        return;
    }

    try {
        const reason = prompt('Please tell us why you\'re cancelling (optional):');

        const response = await makeApiCall('/api/payments/subscription/cancel', {
            method: 'POST',
            body: JSON.stringify({ reason: reason || 'No reason provided' })
        });

        if (response.success) {
            showToast('Subscription cancelled. You will retain access until ' +
                new Date(response.data.nextBillingDate).toLocaleDateString(), 'success');
            await loadBillingData();
        } else {
            showToast(response.message || 'Failed to cancel subscription', 'error');
        }

    } catch (error) {
        console.error('Error cancelling subscription:', error);
        showToast('Failed to cancel subscription: ' + error.message, 'error');
    }
}

/**
 * Reactivate subscription
 */
async function reactivateSubscription() {
    try {
        const response = await makeApiCall('/api/payments/subscription/reactivate', {
            method: 'POST'
        });

        if (response.success) {
            showToast('Subscription reactivated successfully!', 'success');
            await loadBillingData();
        } else {
            showToast(response.message || 'Failed to reactivate subscription', 'error');
        }

    } catch (error) {
        console.error('Error reactivating subscription:', error);
        showToast('Failed to reactivate subscription: ' + error.message, 'error');
    }
}

// ============================================================================
// INVOICE MANAGEMENT
// ============================================================================

/**
 * Download latest invoice
 */
async function downloadLatestInvoice() {
    if (!paymentHistory || paymentHistory.length === 0) {
        showToast('No invoices available', 'warning');
        return;
    }

    const latestPayment = paymentHistory.find(p => p.status === 'completed');
    if (!latestPayment) {
        showToast('No completed payments found', 'warning');
        return;
    }

    await downloadInvoice(latestPayment._id);
}

/**
 * Download invoice by payment ID
 */
async function downloadInvoice(paymentId) {
    try {
        showToast('Generating invoice...', 'info');

        const response = await fetch(`/api/billing/invoice/${paymentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to download invoice');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${paymentId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showToast('Invoice downloaded successfully', 'success');

    } catch (error) {
        console.error('Error downloading invoice:', error);
        showToast('Failed to download invoice: ' + error.message, 'error');
    }
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

// Make functions globally available
window.initializeBilling = initializeBilling;
window.loadBillingData = loadBillingData;
window.openPricingModal = openPricingModal;
window.selectPlan = selectPlan;
window.cancelSubscription = cancelSubscription;
window.reactivateSubscription = reactivateSubscription;
window.downloadInvoice = downloadInvoice;
window.downloadLatestInvoice = downloadLatestInvoice;

// Export billing manager
window.billingManager = {
    initialize: initializeBilling,
    loadData: loadBillingData,
    getCurrentSubscription: () => currentSubscription,
    getPaymentHistory: () => paymentHistory,
    getUsageStats: () => usageStats
};

console.log('✓ Billing Manager loaded successfully');

