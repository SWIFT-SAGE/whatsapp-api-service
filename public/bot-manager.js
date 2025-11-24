// ============================================================================
// BOT MANAGER - Fully Integrated with Backend API
// ============================================================================

// Global state management
const BotManager = {
    currentBot: null,
    currentFlows: [],
    responseCounter: 0,

    // Getters
    getCurrentBot() {
        return this.currentBot;
    },

    getCurrentFlows() {
        return this.currentFlows;
    },

    // Setters
    setCurrentBot(bot) {
        this.currentBot = bot;
        this.currentFlows = bot ? (bot.flows || []) : [];
    },

    setCurrentFlows(flows) {
        this.currentFlows = flows || [];
    }
};

// ============================================================================
// API INTEGRATION LAYER
// ============================================================================

/**
 * Fetch all bots for the current user
 */
async function fetchBots() {
    try {
        const response = await makeApiCall('/api/bot');

        if (response.success && response.data) {
            return Array.isArray(response.data) ? response.data : [response.data];
        }

        return [];
    } catch (error) {
        console.error('Error fetching bots:', error);
        throw error;
    }
}

/**
 * Save bot (create or update)
 */
async function saveBotToBackend(botData) {
    try {
        console.log('saveBotToBackend called with:', JSON.stringify(botData, null, 2));

        const response = await makeApiCall('/api/bot', {
            method: 'POST',
            body: JSON.stringify(botData)
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to save bot');
        }

        return response.data;
    } catch (error) {
        console.error('Error saving bot:', error);
        console.error('Bot data that failed:', botData);
        throw error;
    }
}

/**
 * Delete bot
 */
async function deleteBotFromBackend(botId) {
    try {
        const response = await makeApiCall(`/api/bot/${botId}`, {
            method: 'DELETE'
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to delete bot');
        }

        return true;
    } catch (error) {
        console.error('Error deleting bot:', error);
        throw error;
    }
}

/**
 * Toggle bot status
 */
async function toggleBotStatusBackend(botId, isActive) {
    try {
        const response = await makeApiCall(`/api/bot/${botId}/toggle`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive })
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to toggle bot status');
        }

        return true;
    } catch (error) {
        console.error('Error toggling bot status:', error);
        throw error;
    }
}

/**
 * Test bot with message
 */
async function testBotBackend(sessionId, message) {
    try {
        const response = await makeApiCall('/api/bot/test', {
            method: 'POST',
            body: JSON.stringify({
                sessionId,
                message,
                chatId: 'test@c.us'
            })
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to test bot');
        }

        return response;
    } catch (error) {
        console.error('Error testing bot:', error);
        throw error;
    }
}

/**
 * Clean up orphaned bots (bots with deleted sessions)
 */
async function cleanupOrphanedBots() {
    try {
        const response = await makeApiCall('/api/bot/cleanup', {
            method: 'POST'
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to cleanup orphaned bots');
        }

        return response;
    } catch (error) {
        console.error('Error cleaning up orphaned bots:', error);
        throw error;
    }
}

/**
 * Fetch WhatsApp sessions
 */
async function fetchWhatsAppSessions() {
    try {
        const response = await makeApiCall('/api/whatsapp/sessions');

        let sessions = [];

        if (response) {
            if (Array.isArray(response)) {
                sessions = response;
            } else if (response.sessions && Array.isArray(response.sessions)) {
                sessions = response.sessions;
            } else if (response.success && response.data) {
                sessions = Array.isArray(response.data) ? response.data :
                    (response.data.sessions || []);
            } else if (response.data && Array.isArray(response.data)) {
                sessions = response.data;
            }
        }

        return sessions;
    } catch (error) {
        console.error('Error fetching sessions:', error);
        throw error;
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract sessionId ObjectId from populated or direct value
 */
function extractSessionId(sessionIdField) {
    console.log('extractSessionId called with:', sessionIdField);
    console.log('Type:', typeof sessionIdField);

    if (!sessionIdField) {
        console.log('sessionIdField is null/undefined');
        return null;
    }

    if (typeof sessionIdField === 'object' && sessionIdField !== null) {
        const extracted = sessionIdField._id || sessionIdField.id;
        console.log('Extracted from object:', extracted);
        return extracted;
    }

    console.log('Returning as-is:', sessionIdField);
    return sessionIdField;
}

/**
 * Extract session identifier string from populated object
 */
function extractSessionIdentifier(sessionIdField) {
    if (!sessionIdField) return null;

    if (typeof sessionIdField === 'object' && sessionIdField !== null) {
        return sessionIdField.sessionId;
    }

    return sessionIdField;
}

// ============================================================================
// UI OPERATIONS
// ============================================================================

/**
 * Load bot configuration from backend
 */
async function loadBotConfiguration() {
    try {
        const bots = await fetchBots();

        if (bots && bots.length > 0) {
            BotManager.setCurrentBot(bots[0]);
            updateBotUI();
        } else {
            BotManager.setCurrentBot(null);
            updateBotUI();
        }
    } catch (error) {
        console.error('Error loading bot configuration:', error);
        BotManager.setCurrentBot(null);
        updateBotUI();
        showToast('Failed to load bot configuration', 'error');
    }
}

/**
 * Update bot UI elements
 */
function updateBotUI() {
    const bot = BotManager.getCurrentBot();
    const flows = BotManager.getCurrentFlows();

    // Update bot info card
    const botNameEl = document.getElementById('bot-name');
    const botDescEl = document.getElementById('bot-description');
    const botStatusEl = document.getElementById('bot-status-badge');
    const botFlowsCountEl = document.getElementById('bot-flows-count');

    // Get button elements
    const editBotBtn = document.getElementById('edit-bot-btn');
    const toggleBotBtn = document.getElementById('toggle-bot-btn');
    const addFlowBtn = document.getElementById('add-flow-btn');
    const testBotBtn = document.getElementById('test-bot-btn');
    const testMessageInput = document.getElementById('test-message-input');

    if (bot) {
        if (botNameEl) botNameEl.textContent = bot.name || 'Unnamed Bot';
        if (botDescEl) botDescEl.textContent = bot.description || 'No description';
        if (botStatusEl) {
            botStatusEl.textContent = bot.isActive ? 'Active' : 'Inactive';
            botStatusEl.className = `badge ${bot.isActive ? 'bg-success' : 'bg-secondary'}`;
        }
        if (botFlowsCountEl) botFlowsCountEl.textContent = `${flows.length} Flow${flows.length !== 1 ? 's' : ''}`;

        const botAiStatusEl = document.getElementById('bot-ai-status');
        if (botAiStatusEl) {
            if (bot.aiConfig?.enabled) {
                botAiStatusEl.textContent = 'AI Active';
                botAiStatusEl.className = 'badge bg-success ms-2';
            } else {
                botAiStatusEl.textContent = 'AI Disabled';
                botAiStatusEl.className = 'badge bg-secondary ms-2';
            }
        }

        // Update analytics if available
        const totalConvEl = document.getElementById('bot-total-conversations');
        const totalMsgEl = document.getElementById('bot-total-messages');

        if (totalConvEl && bot.analytics) {
            totalConvEl.textContent = bot.analytics.totalConversations || 0;
        }
        if (totalMsgEl && bot.analytics) {
            totalMsgEl.textContent = bot.analytics.totalMessages || 0;
        }

        // Enable buttons when bot exists
        if (editBotBtn) {
            editBotBtn.disabled = false;
            console.log('✓ Edit Bot button enabled');
        }
        if (toggleBotBtn) {
            toggleBotBtn.disabled = false;
            toggleBotBtn.innerHTML = bot.isActive ?
                '<i class="fas fa-power-off me-2"></i>Deactivate Bot' :
                '<i class="fas fa-power-off me-2"></i>Activate Bot';
            toggleBotBtn.className = bot.isActive ?
                'btn btn-sm btn-outline-danger' :
                'btn btn-sm btn-outline-success';
            console.log('✓ Toggle Bot button enabled');
        }
        if (addFlowBtn) {
            addFlowBtn.disabled = false;
            console.log('✓ Add Flow button enabled');
        }
        if (testBotBtn) {
            testBotBtn.disabled = false;
            console.log('✓ Test Bot button enabled');
        }
        if (testMessageInput) {
            testMessageInput.disabled = false;
            console.log('✓ Test Message input enabled');
        }

        // Show bot controls
        const botControlsEl = document.getElementById('bot-controls');
        if (botControlsEl) botControlsEl.style.display = 'block';

        // Show "no bot" message
        const noBotEl = document.getElementById('no-bot-message');
        if (noBotEl) noBotEl.style.display = 'none';
    } else {
        // Disable buttons when no bot
        if (editBotBtn) {
            editBotBtn.disabled = true;
            console.log('✗ Edit Bot button disabled (no bot)');
        }
        if (toggleBotBtn) {
            toggleBotBtn.disabled = true;
            console.log('✗ Toggle Bot button disabled (no bot)');
        }
        if (addFlowBtn) {
            addFlowBtn.disabled = true;
            console.log('✗ Add Flow button disabled (no bot)');
        }
        if (testBotBtn) {
            testBotBtn.disabled = true;
            console.log('✗ Test Bot button disabled (no bot)');
        }
        if (testMessageInput) {
            testMessageInput.disabled = true;
            testMessageInput.value = '';
            console.log('✗ Test Message input disabled (no bot)');
        }

        // Hide bot controls
        const botControlsEl = document.getElementById('bot-controls');
        if (botControlsEl) botControlsEl.style.display = 'none';

        // Show "no bot" message
        const noBotEl = document.getElementById('no-bot-message');
        if (noBotEl) noBotEl.style.display = 'block';
    }

    // Render flows
    renderFlows();
}

/**
 * Render conversation flows
 */
function renderFlows() {
    const flows = BotManager.getCurrentFlows();
    const container = document.getElementById('bot-flows-container');

    if (!container) return;

    if (!flows || flows.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-stream fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">No Flows Yet</h5>
                <p class="text-muted">Add your first conversation flow to get started</p>
                <button class="btn btn-primary" onclick="openFlowModal()">
                    <i class="fas fa-plus me-2"></i>Add First Flow
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = flows.map(flow => `
        <div class="card flow-card mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">
                            <i class="fas fa-stream me-2 text-primary"></i>${escapeHtml(flow.name)}
                        </h6>
                        <small class="text-muted">
                            <i class="fas fa-bolt me-1"></i>
                            Trigger: <strong>${escapeHtml(flow.trigger?.value || 'N/A')}</strong>
                            ${flow.trigger?.caseSensitive ? '<span class="badge bg-info ms-1">Case Sensitive</span>' : ''}
                        </small>
                    </div>
                    <div class="d-flex gap-2 align-items-center">
                        <span class="badge ${flow.isActive ? 'bg-success' : 'bg-secondary'}">
                            ${flow.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li>
                                    <a class="dropdown-item" href="#" onclick="editFlow('${flow.id}'); return false;">
                                        <i class="fas fa-edit me-2"></i>Edit
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item text-danger" href="#" onclick="deleteFlow('${flow.id}'); return false;">
                                        <i class="fas fa-trash me-2"></i>Delete
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="responses-preview">
                    <small class="text-muted d-block mb-2">
                        <i class="fas fa-reply me-1"></i>Responses (${flow.responses?.length || 0}):
                    </small>
                    ${(flow.responses || []).slice(0, 3).map((resp, idx) => `
                        <div class="response-preview-item p-2 mb-1 bg-light rounded">
                            <small>
                                <strong>${idx + 1}.</strong>
                                <span class="badge bg-primary">${resp.type}</span>
                                ${resp.content ? escapeHtml(resp.content.substring(0, 60)) + (resp.content.length > 60 ? '...' : '') : 'No content'}
                                ${resp.delay ? `<span class="badge bg-info ms-1">${resp.delay}ms</span>` : ''}
                            </small>
                        </div>
                    `).join('')}
                    ${flow.responses && flow.responses.length > 3 ? `
                        <small class="text-muted">+ ${flow.responses.length - 3} more response(s)</small>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// MODAL OPERATIONS
// ============================================================================

/**
 * Open bot modal for create/edit
 */
async function openBotModal(bot = null) {
    const modal = new bootstrap.Modal(document.getElementById('botModal'));
    const title = document.getElementById('bot-modal-title');

    // Load sessions
    await loadSessionsForModal();

    if (bot) {
        // Edit mode
        title.textContent = 'Edit Bot';
        document.getElementById('bot-id').value = bot._id || '';
        document.getElementById('bot-session-id').value = extractSessionId(bot.sessionId) || '';
        document.getElementById('bot-name-input').value = bot.name || '';
        document.getElementById('bot-description-input').value = bot.description || '';
        document.getElementById('bot-purpose-input').value = bot.purpose || '';

        // AI Configuration
        const aiConfig = bot.aiConfig || {};
        document.getElementById('bot-ai-enabled').checked = aiConfig.enabled || false;
        document.getElementById('bot-ai-mode').value = aiConfig.mode || 'hybrid';
        document.getElementById('bot-ai-provider').value = aiConfig.provider || 'gemini';
        document.getElementById('bot-ai-prompt').value = aiConfig.systemPrompt || '';
        document.getElementById('bot-ai-model').value = aiConfig.model || '';
        document.getElementById('bot-ai-api-key').value = aiConfig.apiKey || '';
        document.getElementById('bot-ai-temperature').value = aiConfig.temperature !== undefined ? aiConfig.temperature : 0.7;
        document.getElementById('bot-ai-tokens').value = aiConfig.maxTokens || 500;

        document.getElementById('ai-config-section').style.display = aiConfig.enabled ? 'block' : 'none';

        document.getElementById('bot-enable-groups').checked = bot.settings?.enableInGroups || false;
        document.getElementById('bot-enable-unknown').checked = bot.settings?.enableForUnknown !== false;
        document.getElementById('bot-fallback-message').value = bot.settings?.fallbackMessage || '';

        // Working hours
        if (bot.settings?.workingHours) {
            document.getElementById('bot-working-hours-enabled').checked = bot.settings.workingHours.enabled || false;
            document.getElementById('bot-working-start').value = bot.settings.workingHours.start || '09:00';
            document.getElementById('bot-working-end').value = bot.settings.workingHours.end || '18:00';

            document.querySelectorAll('.working-day').forEach(cb => {
                cb.checked = bot.settings.workingHours.days?.includes(parseInt(cb.value)) || false;
            });

            document.getElementById('working-hours-config').style.display =
                bot.settings.workingHours.enabled ? 'block' : 'none';
        }
    } else {
        // Create mode
        title.textContent = 'Create Bot';
        document.getElementById('bot-form').reset();
        document.getElementById('bot-id').value = '';
        document.getElementById('ai-config-section').style.display = 'none';
        document.getElementById('working-hours-config').style.display = 'none';
    }

    modal.show();
}

/**
 * Load sessions for modal dropdown
 */
async function loadSessionsForModal() {
    try {
        const sessions = await fetchWhatsAppSessions();
        const sessionSelect = document.getElementById('bot-session-id');

        if (!sessionSelect) {
            console.error('Session select element not found');
            return;
        }

        const connectedSessions = sessions.filter(s =>
            s.status === 'connected' || s.status === 'ready'
        );

        if (connectedSessions.length === 0) {
            sessionSelect.innerHTML = '<option value="">No connected sessions</option>';
            showToast('No connected sessions found. Please connect a session first.', 'warning');
        } else {
            sessionSelect.innerHTML = '<option value="">Select a session...</option>' +
                connectedSessions.map(session => `
                    <option value="${session._id || session.id}">
                        ${session.sessionId} - ${session.phoneNumber || 'No phone'}
                    </option>
                `).join('');
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        showToast('Failed to load sessions', 'error');
    }
}

/**
 * Open flow modal for create/edit
 */
function openFlowModal(flow = null) {
    const bot = BotManager.getCurrentBot();

    // Check if bot exists and has a session assigned
    if (!bot) {
        showToast('No bot configured. Please create a bot first.', 'error');
        return;
    }

    if (!extractSessionId(bot.sessionId)) {
        const shouldEdit = confirm(
            'This bot has no WhatsApp session assigned.\n\n' +
            'You need to edit the bot and select a session before you can add/edit flows.\n\n' +
            'Would you like to edit the bot now?'
        );

        if (shouldEdit) {
            openBotModal(bot);
        }
        return;
    }

    const modal = new bootstrap.Modal(document.getElementById('flowModal'));
    const title = document.getElementById('flow-modal-title');

    BotManager.responseCounter = 0;

    if (flow) {
        // Edit mode
        title.textContent = 'Edit Flow';
        document.getElementById('flow-id').value = flow.id;
        document.getElementById('flow-name').value = flow.name;
        document.getElementById('flow-trigger-type').value = flow.trigger?.type || 'keyword';
        document.getElementById('flow-trigger-value').value = flow.trigger?.value || '';
        document.getElementById('flow-case-sensitive').checked = flow.trigger?.caseSensitive || false;
        document.getElementById('flow-active').checked = flow.isActive !== false;

        // Load responses
        const responsesContainer = document.getElementById('responses-container');
        responsesContainer.innerHTML = '';
        (flow.responses || []).forEach(response => {
            addResponse(response);
        });
    } else {
        // Create mode
        title.textContent = 'Add Flow';
        document.getElementById('flow-form').reset();
        document.getElementById('flow-id').value = '';
        document.getElementById('responses-container').innerHTML = '';
        addResponse(); // Add one empty response
    }

    modal.show();
}

// ============================================================================
// BOT CRUD OPERATIONS
// ============================================================================

/**
 * Save bot (create or update)
 */
async function saveBot() {
    try {
        const sessionId = document.getElementById('bot-session-id').value;
        const name = document.getElementById('bot-name-input').value;
        const description = document.getElementById('bot-description-input').value;
        const purpose = document.getElementById('bot-purpose-input').value;

        if (!sessionId || !name) {
            showToast('Please fill in all required fields', 'warning');
            return;
        }

        const workingDays = Array.from(document.querySelectorAll('.working-day:checked'))
            .map(cb => parseInt(cb.value));

        const bot = BotManager.getCurrentBot();

        const botData = {
            sessionId,
            name,
            description,
            purpose,
            aiConfig: {
                enabled: document.getElementById('bot-ai-enabled').checked,
                mode: document.getElementById('bot-ai-mode').value,
                provider: document.getElementById('bot-ai-provider').value,
                systemPrompt: document.getElementById('bot-ai-prompt').value,
                model: document.getElementById('bot-ai-model').value,
                apiKey: document.getElementById('bot-ai-api-key').value,
                temperature: parseFloat(document.getElementById('bot-ai-temperature').value),
                maxTokens: parseInt(document.getElementById('bot-ai-tokens').value)
            },
            flows: BotManager.getCurrentFlows(),
            settings: {
                enableInGroups: document.getElementById('bot-enable-groups').checked,
                enableForUnknown: document.getElementById('bot-enable-unknown').checked,
                fallbackMessage: document.getElementById('bot-fallback-message').value ||
                    "Sorry, I didn't understand that. Type 'help' for options.",
                workingHours: {
                    enabled: document.getElementById('bot-working-hours-enabled').checked,
                    timezone: 'UTC',
                    start: document.getElementById('bot-working-start').value,
                    end: document.getElementById('bot-working-end').value,
                    days: workingDays
                }
            },
            isActive: bot?.isActive !== false
        };

        await saveBotToBackend(botData);

        showToast('Bot saved successfully!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('botModal')).hide();
        await loadBotConfiguration();
    } catch (error) {
        console.error('Error saving bot:', error);
        showToast(error.message || 'Failed to save bot', 'error');
    }
}

/**
 * Toggle bot active status
 */
async function toggleBot() {
    const bot = BotManager.getCurrentBot();

    if (!bot) {
        showToast('No bot configured', 'warning');
        return;
    }

    try {
        const newStatus = !bot.isActive;
        await toggleBotStatusBackend(bot._id, newStatus);

        showToast(`Bot ${newStatus ? 'activated' : 'deactivated'} successfully!`, 'success');
        await loadBotConfiguration();
    } catch (error) {
        console.error('Error toggling bot:', error);
        showToast(error.message || 'Failed to toggle bot', 'error');
    }
}

/**
 * Delete bot
 */
async function deleteBot() {
    const bot = BotManager.getCurrentBot();

    if (!bot) {
        showToast('No bot configured', 'warning');
        return;
    }

    if (!confirm('Are you sure you want to delete this bot? This action cannot be undone.')) {
        return;
    }

    try {
        await deleteBotFromBackend(bot._id);

        showToast('Bot deleted successfully!', 'success');
        await loadBotConfiguration();
    } catch (error) {
        console.error('Error deleting bot:', error);
        showToast(error.message || 'Failed to delete bot', 'error');
    }
}

// ============================================================================
// FLOW OPERATIONS
// ============================================================================

/**
 * Save flow (create or update)
 */
async function saveFlow() {
    const bot = BotManager.getCurrentBot();

    if (!bot) {
        showToast('No bot configured. Please create a bot first.', 'error');
        return;
    }

    try {
        const flowId = document.getElementById('flow-id').value;
        const flowName = document.getElementById('flow-name').value;
        const triggerType = document.getElementById('flow-trigger-type').value;
        const triggerValue = document.getElementById('flow-trigger-value').value;
        const caseSensitive = document.getElementById('flow-case-sensitive').checked;
        const isActive = document.getElementById('flow-active').checked;

        if (!flowName || !triggerValue) {
            showToast('Please fill in all required fields', 'warning');
            return;
        }

        // Collect responses
        const responses = [];
        document.querySelectorAll('#responses-container .card').forEach(card => {
            const type = card.querySelector('.response-type').value;
            const content = card.querySelector('.response-content').value;
            const delay = parseInt(card.querySelector('.response-delay').value) || 0;
            const mediaUrl = card.querySelector('.response-media-url')?.value || '';

            responses.push({
                type,
                content,
                delay,
                ...(mediaUrl && { mediaUrl })
            });
        });

        const flow = {
            id: flowId || `flow_${Date.now()}`,
            name: flowName,
            trigger: {
                type: triggerType,
                value: triggerValue,
                caseSensitive
            },
            responses,
            isActive
        };

        // Update or add flow
        let flows = [...BotManager.getCurrentFlows()];

        if (flowId) {
            const index = flows.findIndex(f => f.id === flowId);
            if (index !== -1) {
                flows[index] = flow;
            }
        } else {
            flows.push(flow);
        }

        // Save bot with updated flows
        const sessionId = extractSessionId(bot.sessionId);

        console.log('Saving flow - Bot:', bot);
        console.log('Extracted sessionId:', sessionId);

        if (!sessionId) {
            const shouldEdit = confirm(
                'This bot has no WhatsApp session assigned.\n\n' +
                'You need to edit the bot and select a session before you can add/edit flows.\n\n' +
                'Would you like to edit the bot now?'
            );

            if (shouldEdit) {
                // Close the flow modal first
                const flowModal = bootstrap.Modal.getInstance(document.getElementById('flowModal'));
                if (flowModal) flowModal.hide();

                // Open bot modal
                setTimeout(() => openBotModal(bot), 300);
            }
            return;
        }

        if (!bot.name) {
            showToast('Bot name is missing. Please edit the bot and set a name.', 'error');
            return;
        }

        const botData = {
            sessionId,
            name: bot.name,
            description: bot.description || '',
            flows,
            settings: bot.settings || {
                enableInGroups: false,
                enableForUnknown: true,
                fallbackMessage: "Sorry, I didn't understand that. Type 'help' for options."
            },
            isActive: bot.isActive !== false
        };

        console.log('Sending botData:', botData);

        await saveBotToBackend(botData);

        showToast(`Flow ${flowId ? 'updated' : 'added'} successfully!`, 'success');
        bootstrap.Modal.getInstance(document.getElementById('flowModal')).hide();
        await loadBotConfiguration();
    } catch (error) {
        console.error('Error saving flow:', error);
        showToast(error.message || 'Failed to save flow', 'error');
    }
}

/**
 * Edit flow
 */
function editFlow(flowId) {
    const bot = BotManager.getCurrentBot();

    // Check if bot has a session assigned
    if (bot && !extractSessionId(bot.sessionId)) {
        const shouldEdit = confirm(
            'This bot has no WhatsApp session assigned.\n\n' +
            'You need to edit the bot and select a session before you can edit flows.\n\n' +
            'Would you like to edit the bot now?'
        );

        if (shouldEdit) {
            openBotModal(bot);
        }
        return;
    }

    const flows = BotManager.getCurrentFlows();
    const flow = flows.find(f => f.id === flowId);

    if (flow) {
        openFlowModal(flow);
    } else {
        showToast('Flow not found', 'error');
    }
}

/**
 * Delete flow
 */
async function deleteFlow(flowId) {
    const bot = BotManager.getCurrentBot();

    if (!bot) {
        showToast('No bot configured', 'error');
        return;
    }

    if (!confirm('Are you sure you want to delete this flow?')) {
        return;
    }

    try {
        const flows = BotManager.getCurrentFlows().filter(f => f.id !== flowId);
        const sessionId = extractSessionId(bot.sessionId);

        console.log('Deleting flow - Bot:', bot);
        console.log('Extracted sessionId:', sessionId);

        if (!sessionId) {
            const shouldEdit = confirm(
                'This bot has no WhatsApp session assigned.\n\n' +
                'You need to edit the bot and select a session before you can modify flows.\n\n' +
                'Would you like to edit the bot now?'
            );

            if (shouldEdit) {
                openBotModal(bot);
            }
            return;
        }

        if (!bot.name) {
            showToast('Bot name is missing. Please edit the bot and set a name.', 'error');
            return;
        }

        const botData = {
            sessionId,
            name: bot.name,
            description: bot.description || '',
            flows,
            settings: bot.settings || {
                enableInGroups: false,
                enableForUnknown: true,
                fallbackMessage: "Sorry, I didn't understand that. Type 'help' for options."
            },
            isActive: bot.isActive !== false
        };

        console.log('Sending botData:', botData);

        await saveBotToBackend(botData);

        showToast('Flow deleted successfully!', 'success');
        await loadBotConfiguration();
    } catch (error) {
        console.error('Error deleting flow:', error);
        showToast(error.message || 'Failed to delete flow', 'error');
    }
}

// ============================================================================
// RESPONSE MANAGEMENT
// ============================================================================

/**
 * Add response to flow
 */
function addResponse(responseData = null) {
    BotManager.responseCounter++;
    const container = document.getElementById('responses-container');
    const responseId = `response-${BotManager.responseCounter}`;

    const responseHtml = `
        <div class="card mb-3" id="${responseId}">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span><i class="fas fa-reply me-2"></i>Response #${BotManager.responseCounter}</span>
                <button type="button" class="btn btn-sm btn-danger" onclick="removeResponse('${responseId}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="card-body">
                <div class="row mb-3">
                    <div class="col-md-6">
                        <label class="form-label">Response Type</label>
                        <select class="form-select response-type" onchange="updateResponseFields('${responseId}', this.value)">
                            <option value="text" ${responseData?.type === 'text' ? 'selected' : ''}>Text Message</option>
                            <option value="image" ${responseData?.type === 'image' ? 'selected' : ''}>Image</option>
                            <option value="video" ${responseData?.type === 'video' ? 'selected' : ''}>Video</option>
                            <option value="audio" ${responseData?.type === 'audio' ? 'selected' : ''}>Audio</option>
                            <option value="document" ${responseData?.type === 'document' ? 'selected' : ''}>Document</option>
                            <option value="menu" ${responseData?.type === 'menu' ? 'selected' : ''}>Menu/List</option>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Delay (milliseconds)</label>
                        <input type="number" class="form-control response-delay" value="${responseData?.delay || 1000}" min="0" step="100">
                        <small class="text-muted">Wait time before sending</small>
                    </div>
                </div>
                <div class="response-content-area">
                    <div class="mb-3">
                        <label class="form-label">Message Content</label>
                        <textarea class="form-control response-content" rows="3" 
                                  placeholder="Enter your message... Use variables: {name}, {time}, {date}, {day}">${responseData?.content || ''}</textarea>
                        <small class="text-muted">
                            <i class="fas fa-info-circle me-1"></i>
                            Variables: <code>{name}</code>, <code>{time}</code>, <code>{date}</code>, <code>{day}</code>
                        </small>
                    </div>
                    ${(responseData?.type && ['image', 'video', 'audio', 'document'].includes(responseData.type)) ? `
                        <div class="mb-3 media-url-field">
                            <label class="form-label">
                                <i class="fas fa-link me-1"></i>Media URL
                            </label>
                            <input type="url" class="form-control response-media-url" 
                                   value="${responseData?.mediaUrl || ''}"
                                   placeholder="https://example.com/media.${responseData.type === 'image' ? 'jpg' : responseData.type === 'video' ? 'mp4' : responseData.type === 'audio' ? 'mp3' : 'pdf'}">
                            <small class="text-muted">Direct URL to the media file</small>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', responseHtml);
}

/**
 * Remove response from flow
 */
function removeResponse(responseId) {
    const element = document.getElementById(responseId);
    if (element) {
        element.remove();
    }
}

/**
 * Update response fields based on type
 */
function updateResponseFields(responseId, type) {
    const card = document.getElementById(responseId);
    if (!card) return;

    const contentArea = card.querySelector('.response-content-area');
    const needsMedia = ['image', 'video', 'audio', 'document'].includes(type);
    let mediaField = card.querySelector('.media-url-field');

    if (needsMedia && !mediaField) {
        const mediaHtml = `
            <div class="mb-3 media-url-field">
                <label class="form-label">
                    <i class="fas fa-link me-1"></i>Media URL
                </label>
                <input type="url" class="form-control response-media-url" 
                       placeholder="https://example.com/media.${type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'pdf'}">
                <small class="text-muted">Direct URL to the media file</small>
            </div>
        `;
        contentArea.insertAdjacentHTML('beforeend', mediaHtml);
    } else if (!needsMedia && mediaField) {
        mediaField.remove();
    }
}

// ============================================================================
// TEST BOT
// ============================================================================

/**
 * Test bot with sample message
 */
async function testBot() {
    const message = document.getElementById('test-message-input').value;

    if (!message) {
        showToast('Please enter a test message', 'warning');
        return;
    }

    const bot = BotManager.getCurrentBot();

    if (!bot) {
        showToast('No bot configured. Please create a bot first.', 'error');
        return;
    }

    // Check if bot has a session assigned
    if (!extractSessionId(bot.sessionId)) {
        const shouldEdit = confirm(
            'This bot has no WhatsApp session assigned.\n\n' +
            'You need to edit the bot and select a session before you can test it.\n\n' +
            'Would you like to edit the bot now?'
        );

        if (shouldEdit) {
            openBotModal(bot);
        }
        return;
    }

    const container = document.getElementById('test-response-container');

    try {
        // Extract session identifier
        const sessionId = extractSessionIdentifier(bot.sessionId);

        if (!sessionId) {
            showToast('Bot session identifier not found. Please edit the bot and select a session.', 'error');
            return;
        }

        // Show loading
        container.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Testing...</span>
                </div>
                <p class="mt-2 text-muted">Testing bot...</p>
            </div>
        `;

        const response = await testBotBackend(sessionId, message);

        if (response.success) {
            container.innerHTML = `
                <div class="alert alert-success">
                    <div class="d-flex align-items-start">
                        <i class="fas fa-check-circle fa-2x me-3"></i>
                        <div>
                            <strong>Test Successful!</strong>
                            <p class="mb-0 mt-2">${response.processed ?
                    'Bot processed the message successfully! ✓' :
                    'No matching flow found. Fallback message would be used.'}</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            throw new Error(response.message || 'Test failed');
        }
    } catch (error) {
        console.error('Error testing bot:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <div class="d-flex align-items-start">
                    <i class="fas fa-exclamation-circle fa-2x me-3"></i>
                    <div>
                        <strong>Test Failed</strong>
                        <p class="mb-0 mt-2">${error.message || 'An error occurred while testing the bot'}</p>
                    </div>
                </div>
            </div>
        `;
    }
}

// ============================================================================
// EXPORT TO GLOBAL SCOPE
// ============================================================================

// Export functions
window.openBotModal = openBotModal;
window.openFlowModal = openFlowModal;
window.saveBot = saveBot;
window.toggleBot = toggleBot;
window.deleteBot = deleteBot;
window.saveFlow = saveFlow;
window.editFlow = editFlow;
window.deleteFlow = deleteFlow;
window.addResponse = addResponse;
window.removeResponse = removeResponse;
window.updateResponseFields = updateResponseFields;
window.testBot = testBot;
window.loadBotConfiguration = loadBotConfiguration;

// Export bot manager
window.botManager = {
    currentBot: () => BotManager.getCurrentBot(),
    setCurrentBot: (bot) => BotManager.setCurrentBot(bot),
    currentFlows: () => BotManager.getCurrentFlows(),
    setCurrentFlows: (flows) => BotManager.setCurrentFlows(flows)
};

console.log('✓ Bot Manager loaded successfully (Backend Integrated)');
