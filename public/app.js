// WhatsApp API Platform JavaScript

// Application State
let currentUser = null;
let currentView = 'landing';
let currentDashboardSection = 'overview';

// Sample Data
const appData = {
  pricingTiers: [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      features: [
        "3 messages per month",
        "Basic API access",
        "Email support",
        "WhatsApp session management"
      ],
      limitations: [
        "No chatbot",
        "Limited analytics"
      ],
      popular: false
    },
    {
      name: "Basic",
      price: "$15",
      period: "per month",
      features: [
        "10,000 messages per month",
        "Full API access",
        "Priority support",
        "Advanced analytics",
        "Webhook support"
      ],
      limitations: [
        "No chatbot"
      ],
      popular: true
    },
    {
      name: "Premium",
      price: "$35",
      period: "per month",
      features: [
        "Unlimited messages",
        "WhatsApp Chatbot",
        "Advanced analytics",
        "24/7 priority support",
        "Custom integrations",
        "Team collaboration"
      ],
      limitations: [],
      popular: false
    }
  ],
  sampleUser: {
    name: "John Doe",
    email: "john@example.com",
    plan: "basic",
    messageCount: 1250,
    messageLimit: 10000,
    activeSessions: 2,
    apiKey: "wa_sk_live_51HyQZLJk8rBXfmQ2vX7YnM3pT9wGhI1cK4sL6mN8oP2qR5sT7uV9wX1yZ3aB5cD7eF9gH1iJ3kL5mN7oP9qR1sT3uV5wX7yZ9aB1cD3eF5gH7iJ9k"
  },
  sampleMessages: [
    {
      id: "msg_001",
      to: "+1234567890",
      message: "Hello! This is a test message.",
      status: "delivered",
      timestamp: "2025-09-02T14:30:00Z"
    },
    {
      id: "msg_002", 
      to: "+0987654321",
      message: "Welcome to our service!",
      status: "sent",
      timestamp: "2025-09-02T13:15:00Z"
    }
  ],
  chatbotRules: [
    {
      trigger: "hello",
      response: "Hi there! How can I help you today?",
      active: true
    },
    {
      trigger: "pricing",
      response: "Our plans start at $5/month for 10,000 messages. Would you like to know more?",
      active: true
    },
    {
      trigger: "support",
      response: "For support, please email us at support@whatsappapi.com or use our live chat.",
      active: true
    }
  ]
};

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
  setupEventListeners();
  checkAuthState();
  setCurrentYear();
  updateActiveNav();
  
  // Show landing page by default
  showView('landing');
});

function initializeApp() {
  // Check if user is logged in from sessionStorage
  const storedUser = sessionStorage.getItem('currentUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    updateAuthUI();
    if (window.location.hash === '#dashboard') {
      showView('dashboard');
    }
  } else {
    updateAuthUI();
  }
  
  // Ensure landing page is visible initially
  const landingView = document.getElementById('landing-view');
  if (landingView) {
    landingView.style.display = 'block';
    landingView.classList.add('active');
  }
}

function setupEventListeners() {
  // Event delegation for all clicks
  document.addEventListener('click', function(e) {
    // Handle view navigation
    if (e.target.hasAttribute('data-view') || e.target.closest('[data-view]')) {
      e.preventDefault();
      const element = e.target.hasAttribute('data-view') ? e.target : e.target.closest('[data-view]');
      const viewName = element.getAttribute('data-view');
      showView(viewName);
      updateActiveNav();
      collapseNavbarIfOpen();
      return;
    }
    
    // Handle dashboard section navigation
    if (e.target.hasAttribute('data-section') || e.target.closest('[data-section]')) {
      e.preventDefault();
      const element = e.target.hasAttribute('data-section') ? e.target : e.target.closest('[data-section]');
      const sectionName = element.getAttribute('data-section');
      showDashboardSection(sectionName);
      return;
    }
    
    // Handle specific actions
    if (e.target.hasAttribute('data-action') || e.target.closest('[data-action]')) {
      e.preventDefault();
      const element = e.target.hasAttribute('data-action') ? e.target : e.target.closest('[data-action]');
      const action = element.getAttribute('data-action');
      
      switch (action) {
        case 'disconnect-session':
          const sessionId = element.getAttribute('data-session');
          disconnectSession(sessionId);
          break;
        case 'upgrade':
          const plan = element.getAttribute('data-plan');
          showUpgradeModal(plan);
          break;
      }
      return;
    }
    
    // Handle logout
    if (e.target.id === 'logout-btn' || e.target.closest('#logout-btn')) {
      e.preventDefault();
      logout();
      return;
    }
    
    // Handle specific button clicks
    if (e.target.id === 'toggle-api-key' || e.target.closest('#toggle-api-key')) {
      e.preventDefault();
      toggleApiKey();
      return;
    }
    
    if (e.target.id === 'copy-api-key' || e.target.closest('#copy-api-key')) {
      e.preventDefault();
      copyApiKey();
      return;
    }
    
    if (e.target.id === 'create-session-btn' || e.target.closest('#create-session-btn')) {
      e.preventDefault();
      createSession();
      return;
    }
    
    if (e.target.id === 'add-chatbot-rule-btn' || e.target.closest('#add-chatbot-rule-btn')) {
      e.preventDefault();
      addChatbotRule();
      return;
    }
    
    if (e.target.id === 'test-chatbot-btn' || e.target.closest('#test-chatbot-btn')) {
      e.preventDefault();
      testChatbot();
      return;
    }
  });

  // Form submissions
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }

  const quickMessageForm = document.getElementById('quick-message-form');
  if (quickMessageForm) {
    quickMessageForm.addEventListener('submit', handleQuickMessage);
  }
}

function checkAuthState() {
  // Simulate checking authentication state
  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  if (isLoggedIn && !currentUser) {
    currentUser = appData.sampleUser;
    updateAuthUI();
  }
}

// Navigation Functions
function showView(viewName) {
  console.log('Showing view:', viewName);
  
  // Hide all views
  const views = document.querySelectorAll('.view');
  views.forEach(view => {
    view.style.display = 'none';
    view.classList.remove('active');
  });

  // Show target view
  const targetView = document.getElementById(viewName + '-view');
  if (targetView) {
    targetView.style.display = 'block';
    setTimeout(() => {
      targetView.classList.add('active');
    }, 50);
    currentView = viewName;
    // Smooth scroll to top on view change
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (_) {
      window.scrollTo(0, 0);
    }
    
    // Update URL hash
    window.history.pushState({}, '', `#${viewName}`);
  } else {
    console.error('View not found:', viewName + '-view');
  }

  // Special handling for dashboard
  if (viewName === 'dashboard' && currentUser) {
    initializeDashboard();
  }

  // Special handling for chatbot (premium only)
  if (viewName === 'dashboard' && currentUser && currentUser.plan === 'premium') {
    const chatbotNav = document.getElementById('chatbot-nav');
    if (chatbotNav) {
      chatbotNav.style.display = 'block';
    }
  }
}

function showDashboardSection(sectionName) {
  console.log('Showing dashboard section:', sectionName);
  
  // Hide all dashboard sections
  const sections = document.querySelectorAll('.dashboard-section');
  sections.forEach(section => {
    section.style.display = 'none';
  });

  // Show target section
  const targetSection = document.getElementById('dashboard-' + sectionName);
  if (targetSection) {
    targetSection.style.display = 'block';
    currentDashboardSection = sectionName;
  }

  // Update sidebar active state
  const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
  navLinks.forEach(link => {
    link.classList.remove('active');
  });
  
  const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }

  // Special handling for chatbot section
  if (sectionName === 'chatbot') {
    loadChatbotRules();
  }
}

// UI helpers
function updateActiveNav() {
  const links = document.querySelectorAll('.navbar .nav-link[data-view]');
  links.forEach(link => link.classList.remove('active'));
  const active = document.querySelector(`.navbar .nav-link[data-view="${currentView}"]`);
  if (active) {
    active.classList.add('active');
  }
}

function collapseNavbarIfOpen() {
  const navbarCollapse = document.getElementById('navbarNav');
  if (!navbarCollapse) return;
  if (navbarCollapse.classList.contains('show')) {
    try {
      const collapse = bootstrap.Collapse.getOrCreateInstance(navbarCollapse);
      collapse.hide();
    } catch (_) {
      navbarCollapse.classList.remove('show');
    }
  }
}

function setCurrentYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

// Authentication Functions
function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  // Basic validation
  if (!email || !password) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  // Show loading state
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Signing in...';
  submitBtn.disabled = true;
  
  // Simulate login validation
  setTimeout(() => {
    currentUser = {...appData.sampleUser};
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    updateAuthUI();
    showView('dashboard');
    showToast('Login successful!', 'success');
    
    // Reset button
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }, 1000);
}

function handleRegister(e) {
  e.preventDefault();
  
  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const plan = document.getElementById('register-plan').value;
  const termsAccepted = document.getElementById('terms').checked;

  if (!name || !email || !password || !termsAccepted) {
    showToast('Please fill in all fields and accept terms', 'error');
    return;
  }

  // Show loading state
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Creating account...';
  submitBtn.disabled = true;
  
  // Simulate registration
  setTimeout(() => {
    currentUser = {
      name: name,
      email: email,
      plan: plan,
      messageCount: 0,
      messageLimit: plan === 'free' ? 3 : plan === 'basic' ? 10000 : 999999,
      activeSessions: 0,
      apiKey: generateApiKey()
    };
    
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    updateAuthUI();
    showView('dashboard');
    showToast('Account created successfully!', 'success');
    
    // Reset button
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }, 1500);
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem('isLoggedIn');
  sessionStorage.removeItem('currentUser');
  updateAuthUI();
  showView('landing');
  showToast('Logged out successfully', 'info');
}

function updateAuthUI() {
  const loginNav = document.getElementById('login-nav');
  const registerNav = document.getElementById('register-nav');
  const userNav = document.getElementById('user-nav');
  const userName = document.getElementById('user-name');

  if (currentUser) {
    if (loginNav) loginNav.style.display = 'none';
    if (registerNav) registerNav.style.display = 'none';
    if (userNav) userNav.style.display = 'block';
    if (userName) userName.textContent = currentUser.name;
  } else {
    if (loginNav) loginNav.style.display = 'block';
    if (registerNav) registerNav.style.display = 'block';
    if (userNav) userNav.style.display = 'none';
  }
}

// Dashboard Functions
function initializeDashboard() {
  if (!currentUser) return;

  // Update stats
  const messagesSent = document.getElementById('messages-sent');
  const activeSessions = document.getElementById('active-sessions');
  
  if (messagesSent) messagesSent.textContent = currentUser.messageCount.toLocaleString();
  if (activeSessions) activeSessions.textContent = currentUser.activeSessions;
  
  // Update plan badge
  const planBadge = document.getElementById('plan-badge');
  if (planBadge) {
    planBadge.textContent = currentUser.plan.charAt(0).toUpperCase() + currentUser.plan.slice(1) + ' Plan';
  }
  
  // Update API key
  const apiKeyInput = document.getElementById('api-key');
  if (apiKeyInput) {
    apiKeyInput.value = currentUser.apiKey;
  }

  // Show chatbot nav for premium users
  const chatbotNav = document.getElementById('chatbot-nav');
  if (chatbotNav) {
    if (currentUser.plan === 'premium') {
      chatbotNav.style.display = 'block';
    } else {
      chatbotNav.style.display = 'none';
    }
  }

  // Load sessions and messages
  loadSessions();
  loadMessages();
  
  // Show overview section by default
  showDashboardSection('overview');
}

function loadSessions() {
  const container = document.getElementById('sessions-container');
  if (!container) return;

  // Clear existing sessions except the first one (sample)
  const existingSessions = container.children;
  
  // Add sample sessions based on user data
  if (currentUser.activeSessions > 1) {
    for (let i = 2; i <= currentUser.activeSessions; i++) {
      const sessionCard = createSessionCard(i);
      container.appendChild(sessionCard);
    }
  }
}

function createSessionCard(sessionNumber) {
  const col = document.createElement('div');
  col.className = 'col-md-6';
  
  col.innerHTML = `
    <div class="card session-card">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <h5>Session #${sessionNumber}</h5>
          <span class="badge bg-success">Connected</span>
        </div>
        <p><strong>Phone:</strong> +${Math.floor(Math.random() * 9000000000) + 1000000000}</p>
        <p><strong>Status:</strong> Active</p>
        <p><strong>Created:</strong> 2025-09-0${Math.floor(Math.random() * 2) + 1}</p>
        <button class="btn btn-outline-danger btn-sm" data-action="disconnect-session" data-session="session${sessionNumber}">
          <i class="fas fa-unlink me-1"></i>Disconnect
        </button>
      </div>
    </div>
  `;
  
  return col;
}

function loadMessages() {
  const tableBody = document.getElementById('messages-table');
  if (!tableBody) return;

  // Add more sample messages if user has sent messages
  if (currentUser.messageCount > 2) {
    const additionalMessages = Math.min(5, currentUser.messageCount - 2);
    for (let i = 0; i < additionalMessages; i++) {
      const row = createMessageRow(i + 3);
      tableBody.appendChild(row);
    }
  }
}

function createMessageRow(index) {
  const tr = document.createElement('tr');
  const statuses = ['delivered', 'sent', 'failed'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const statusClass = status === 'delivered' ? 'success' : status === 'sent' ? 'warning' : 'danger';
  
  tr.innerHTML = `
    <td><code>msg_${String(index).padStart(3, '0')}</code></td>
    <td>+${Math.floor(Math.random() * 9000000000) + 1000000000}</td>
    <td>Sample message ${index}</td>
    <td><span class="badge bg-${statusClass}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
    <td>${Math.floor(Math.random() * 12) + 1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')} ${Math.random() > 0.5 ? 'AM' : 'PM'}</td>
  `;
  
  return tr;
}

// API Functions
function handleQuickMessage(e) {
  e.preventDefault();
  
  if (!currentUser) {
    showToast('Please log in first', 'error');
    return;
  }

  const form = e.target;
  const phoneNumber = form.querySelector('input[type="tel"]').value;
  const message = form.querySelector('textarea').value;

  if (!phoneNumber || !message) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  // Check message limits
  if (currentUser.messageCount >= currentUser.messageLimit) {
    showToast('Message limit reached for your plan', 'error');
    return;
  }

  // Show loading state
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Sending...';
  submitBtn.disabled = true;
  
  // Simulate API call
  setTimeout(() => {
    // Update message count
    currentUser.messageCount++;
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Update UI
    const messagesSentEl = document.getElementById('messages-sent');
    if (messagesSentEl) {
      messagesSentEl.textContent = currentUser.messageCount.toLocaleString();
    }
    
    // Add message to table
    const messageRow = document.createElement('tr');
    messageRow.innerHTML = `
      <td><code>msg_${String(Date.now()).slice(-3)}</code></td>
      <td>${phoneNumber}</td>
      <td>${message}</td>
      <td><span class="badge bg-warning">Sending...</span></td>
      <td>Just now</td>
    `;
    
    const tableBody = document.getElementById('messages-table');
    if (tableBody) {
      tableBody.insertBefore(messageRow, tableBody.firstChild);
      
      // Update status after delay
      setTimeout(() => {
        const statusBadge = messageRow.querySelector('.badge');
        statusBadge.className = 'badge bg-success';
        statusBadge.textContent = 'Delivered';
      }, 2000);
    }
    
    // Clear form and reset button
    form.reset();
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    
    showToast('Message sent successfully!', 'success');
  }, 1000);
}

async function createSession() {
  if (!currentUser) return;

  try {
    // Show loading state
    const qrModal = document.getElementById('qrModal');
    if (!qrModal) return;

    const modal = new bootstrap.Modal(qrModal);
    modal.show();

    const qrPlaceholder = document.querySelector('.qr-code-placeholder');
    if (qrPlaceholder) {
      qrPlaceholder.innerHTML = `
        <div class="text-center">
          <div class="spinner-border text-primary mb-3" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="text-muted">Creating session...</p>
        </div>
      `;
    }

    // Create session via API
    const response = await fetch('/api/whatsapp/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.apiKey}`
      },
      body: JSON.stringify({
        name: `Session ${Date.now()}`,
        settings: {
          autoReply: false,
          allowGroups: true,
          allowUnknown: true
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const sessionData = await response.json();
    
    if (!sessionData.success) {
      throw new Error(sessionData.error || 'Failed to create session');
    }

    const sessionId = sessionData.sessionId;
    
    // Get QR code
    await getAndDisplayQRCode(sessionId, modal);
    
  } catch (error) {
    console.error('Error creating session:', error);
    showToast('Failed to create session: ' + error.message, 'error');
    
    const qrModal = document.getElementById('qrModal');
    if (qrModal) {
      const modal = bootstrap.Modal.getInstance(qrModal);
      if (modal) modal.hide();
    }
  }
}

async function getAndDisplayQRCode(sessionId, modal) {
  try {
    const qrPlaceholder = document.querySelector('.qr-code-placeholder');
    if (qrPlaceholder) {
      qrPlaceholder.innerHTML = `
        <div class="text-center">
          <div class="spinner-border text-primary mb-3" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="text-muted">Generating QR code...</p>
        </div>
      `;
    }

    const qrResponse = await fetch(`/api/whatsapp/sessions/${sessionId}/qr`, {
      headers: {
        'Authorization': `Bearer ${currentUser.apiKey}`
      }
    });

    if (!qrResponse.ok) {
      throw new Error(`Failed to get QR code: ${qrResponse.status}`);
    }

    const qrData = await qrResponse.json();
    
    if (!qrData.success) {
      throw new Error(qrData.error || 'Failed to get QR code');
    }

    // Display QR code
    if (qrPlaceholder) {
      qrPlaceholder.innerHTML = `
        <div class="qr-code text-center">
          <img src="${qrData.qrCode}" alt="QR Code" style="max-width: 250px; max-height: 250px; border: 2px solid #ddd; border-radius: 8px; background: white; padding: 10px;">
          <p class="mt-3 mb-2">Scan with WhatsApp to connect</p>
          <small class="text-muted">Session ID: ${sessionId}</small>
        </div>
      `;
    }

    // Poll for connection status
    pollSessionStatus(sessionId, modal);
    
  } catch (error) {
    console.error('Error getting QR code:', error);
    showToast('Failed to get QR code: ' + error.message, 'error');
    modal.hide();
  }
}

function pollSessionStatus(sessionId, modal) {
  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/whatsapp/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${currentUser.apiKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.session.isConnected) {
          clearInterval(pollInterval);
          
          // Update UI
          currentUser.activeSessions = (currentUser.activeSessions || 0) + 1;
          sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
          
          const activeSessionsEl = document.getElementById('active-sessions');
          if (activeSessionsEl) {
            activeSessionsEl.textContent = currentUser.activeSessions;
          }
          
          modal.hide();
          showToast('Session connected successfully!', 'success');
          
          // Refresh sessions display
          if (currentDashboardSection === 'sessions') {
            loadSessions();
          }
        }
      }
    } catch (error) {
      console.error('Error polling session status:', error);
    }
  }, 3000); // Poll every 3 seconds

  // Stop polling after 5 minutes
  setTimeout(() => {
    clearInterval(pollInterval);
  }, 300000);
}

function disconnectSession(sessionId) {
  if (confirm('Are you sure you want to disconnect this session?')) {
    currentUser.activeSessions = Math.max(0, currentUser.activeSessions - 1);
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    const activeSessionsEl = document.getElementById('active-sessions');
    if (activeSessionsEl) {
      activeSessionsEl.textContent = currentUser.activeSessions;
    }
    
    showToast('Session disconnected', 'info');
    
    // Remove session card
    const sessionCards = document.querySelectorAll('.session-card');
    sessionCards.forEach((card, index) => {
      const sessionTitle = card.querySelector('h5');
      if (sessionTitle && sessionTitle.textContent.includes(sessionId.slice(-1))) {
        card.closest('.col-md-6').remove();
      }
    });
  }
}

// Chatbot Functions
function loadChatbotRules() {
  const container = document.getElementById('chatbot-rules');
  if (!container) return;

  container.innerHTML = '';
  
  appData.chatbotRules.forEach((rule, index) => {
    const ruleCard = document.createElement('div');
    ruleCard.className = 'chatbot-rule mb-3 p-3 border rounded';
    ruleCard.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div class="flex-grow-1">
          <h6>Trigger: "${rule.trigger}"</h6>
          <p class="mb-2">Response: ${rule.response}</p>
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" ${rule.active ? 'checked' : ''} 
                   onchange="toggleChatbotRule(${index})">
            <label class="form-check-label">Active</label>
          </div>
        </div>
        <button class="btn btn-outline-danger btn-sm" onclick="deleteChatbotRule(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    
    container.appendChild(ruleCard);
  });
}

function addChatbotRule() {
  const trigger = prompt('Enter trigger word/phrase:');
  const response = prompt('Enter response message:');
  
  if (trigger && response) {
    appData.chatbotRules.push({
      trigger: trigger.toLowerCase(),
      response: response,
      active: true
    });
    
    loadChatbotRules();
    showToast('Chatbot rule added!', 'success');
  }
}

function toggleChatbotRule(index) {
  appData.chatbotRules[index].active = !appData.chatbotRules[index].active;
  showToast('Rule updated!', 'success');
}

function deleteChatbotRule(index) {
  if (confirm('Delete this chatbot rule?')) {
    appData.chatbotRules.splice(index, 1);
    loadChatbotRules();
    showToast('Rule deleted!', 'info');
  }
}

function testChatbot() {
  const testMessage = document.getElementById('test-message').value.toLowerCase();
  const responseDiv = document.getElementById('chatbot-response');
  
  if (!testMessage) {
    showToast('Enter a test message', 'error');
    return;
  }

  // Find matching rule
  const matchedRule = appData.chatbotRules.find(rule => 
    rule.active && testMessage.includes(rule.trigger)
  );

  if (responseDiv) {
    if (matchedRule) {
      responseDiv.innerHTML = `
        <div class="alert alert-success">
          <strong>Bot Response:</strong><br>
          ${matchedRule.response}
        </div>
      `;
    } else {
      responseDiv.innerHTML = `
        <div class="alert alert-warning">
          <strong>No matching rule found</strong><br>
          The bot would not respond to this message.
        </div>
      `;
    }
  }

  const testMessageInput = document.getElementById('test-message');
  if (testMessageInput) {
    testMessageInput.value = '';
  }
}

// Utility Functions
function toggleApiKey() {
  const apiKeyInput = document.getElementById('api-key');
  const icon = document.getElementById('api-key-icon');
  
  if (apiKeyInput && icon) {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      apiKeyInput.type = 'password';
      icon.className = 'fas fa-eye';
    }
  }
}

function copyApiKey() {
  const apiKeyInput = document.getElementById('api-key');
  if (apiKeyInput) {
    apiKeyInput.select();
    document.execCommand('copy');
    showToast('API key copied to clipboard!', 'success');
  }
}

function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'wa_sk_live_';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function showToast(message, type = 'success') {
  const toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'alert');
  
  const iconClass = type === 'success' ? 'fa-check-circle text-success' : 
                   type === 'error' ? 'fa-exclamation-circle text-danger' : 
                   type === 'warning' ? 'fa-exclamation-triangle text-warning' : 
                   'fa-info-circle text-info';
  
  const titleText = type.charAt(0).toUpperCase() + type.slice(1);
  
  toast.innerHTML = `
    <div class="toast-header">
      <i class="fas ${iconClass} me-2"></i>
      <strong class="me-auto">${titleText}</strong>
      <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
    </div>
    <div class="toast-body">
      ${message}
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();
  
  // Remove toast element after it's hidden
  toast.addEventListener('hidden.bs.toast', () => {
    toast.remove();
  });
}

function showUpgradeModal(plan) {
  const planNames = { basic: 'Basic', premium: 'Premium' };
  const planPrices = { basic: '$5', premium: '$20' };
  
  const modalHtml = `
    <div class="modal fade" id="upgradeModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Upgrade to ${planNames[plan]}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>Upgrade your account to the ${planNames[plan]} plan for ${planPrices[plan]}/month.</p>
            <div class="alert alert-info">
              <i class="fas fa-info-circle me-2"></i>
              This is a demo. No actual payment will be processed.
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="processPlanUpgrade('${plan}')">
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal
  const existingModal = document.getElementById('upgradeModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Add new modal
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  const modal = new bootstrap.Modal(document.getElementById('upgradeModal'));
  modal.show();
}

function processPlanUpgrade(plan) {
  if (!currentUser) return;
  
  currentUser.plan = plan;
  currentUser.messageLimit = plan === 'basic' ? 10000 : 999999;
  sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
  
  // Update UI
  const planBadge = document.getElementById('plan-badge');
  if (planBadge) {
    planBadge.textContent = plan.charAt(0).toUpperCase() + plan.slice(1) + ' Plan';
  }
  
  // Show chatbot nav for premium
  if (plan === 'premium') {
    const chatbotNav = document.getElementById('chatbot-nav');
    if (chatbotNav) {
      chatbotNav.style.display = 'block';
    }
  }
  
  // Close modal
  const modal = bootstrap.Modal.getInstance(document.getElementById('upgradeModal'));
  if (modal) {
    modal.hide();
  }
  
  showToast(`Successfully upgraded to ${plan} plan!`, 'success');
}

// Handle browser back/forward buttons
window.addEventListener('popstate', function(e) {
  const hash = window.location.hash.substring(1);
  if (hash && document.getElementById(hash + '-view')) {
    showView(hash);
  } else {
    showView('landing');
  }
});

// Handle initial hash on page load
window.addEventListener('load', function() {
  const hash = window.location.hash.substring(1);
  if (hash && document.getElementById(hash + '-view')) {
    showView(hash);
  }
});

// Global function exports for modal usage
window.toggleChatbotRule = toggleChatbotRule;
window.deleteChatbotRule = deleteChatbotRule;
window.processPlanUpgrade = processPlanUpgrade;