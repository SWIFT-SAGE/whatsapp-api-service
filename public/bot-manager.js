// ============================================================================
// BOT MANAGER - Production Ready Bot Service Integration
// ============================================================================

// Global variables
let currentBot = null;
let currentFlows = [];
let responseCounter = 0;

// ============================================================================
// MODAL OPERATIONS
// ============================================================================

/**
 * Open Bot Modal for creating or editing a bot
 */
async function openBotModal(bot = null) {
    const modal = new bootstrap.Modal(document.getElementById('botModal'));
    const title = document.getElementById('bot-modal-title');
    
    // Load sessions first
    await loadSessionsForBotModal();
    
    if (bot) {
        // Edit mode
        console.log('Opening bot in edit mode:', bot);
        title.textContent = 'Edit Bot';
        
        // Handle both _id and id
        const botId = bot._id || bot.id;
        document.getElementById('bot-id').value = botId || '';
        
        // Handle sessionId (could be object or string)
        const sessionId = typeof bot.sessionId === 'object' ? 
            (bot.sessionId._id || bot.sessionId.id) : bot.sessionId;
        document.getElementById('bot-session-id').value = sessionId || '';
        
        document.getElementById('bot-name-input').value = bot.name || '';
        document.getElementById('bot-description-input').value = bot.description || '';
        document.getElementById('bot-enable-groups').checked = bot.settings?.enableInGroups || false;
        document.getElementById('bot-enable-unknown').checked = bot.settings?.enableForUnknown !== false;
        document.getElementById('bot-fallback-message').value = bot.settings?.fallbackMessage || '';
        
        // Working hours
        if (bot.settings?.workingHours) {
            document.getElementById('bot-working-hours-enabled').checked = bot.settings.workingHours.enabled || false;
            document.getElementById('bot-working-start').value = bot.settings.workingHours.start || '09:00';
            document.getElementById('bot-working-end').value = bot.settings.workingHours.end || '18:00';
            
            // Set working days
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
        document.getElementById('working-hours-config').style.display = 'none';
    }
    
    modal.show();
}

/**
 * Load sessions for bot modal
 */
async function loadSessionsForBotModal() {
    try {
        const response = await makeApiCall('/api/whatsapp/sessions');
        let sessions = [];
        
        console.log('Raw API response for sessions:', response);
        
        // Handle various response formats
        if (response) {
            if (Array.isArray(response)) {
                // Direct array response
                sessions = response;
            } else if (response.sessions && Array.isArray(response.sessions)) {
                // Direct sessions property (WhatsApp API format)
                sessions = response.sessions;
            } else if (response.success && response.sessions && Array.isArray(response.sessions)) {
                // Success wrapper with sessions property
                sessions = response.sessions;
            } else if (response.success && response.data) {
                // Success wrapper with data
                if (Array.isArray(response.data)) {
                    sessions = response.data;
                } else if (response.data.sessions && Array.isArray(response.data.sessions)) {
                    sessions = response.data.sessions;
                }
            } else if (response.data && Array.isArray(response.data)) {
                // Data property with array
                sessions = response.data;
            }
        }
        
        console.log('Parsed sessions for bot:', sessions);
        console.log('Number of sessions:', sessions.length);
        
        const sessionSelect = document.getElementById('bot-session-id');
        if (!sessionSelect) {
            console.error('Session select element not found!');
            return;
        }
        
        if (sessions.length === 0) {
            sessionSelect.innerHTML = '<option value="">No sessions available</option>';
            showToast('No WhatsApp sessions found. Please create a session first.', 'warning');
        } else {
            // Filter for connected sessions
            const connectedSessions = sessions.filter(s => {
                console.log('Session:', s.sessionId, 'Status:', s.status);
                return s.status === 'connected' || s.status === 'ready';
            });
            
            console.log('Connected sessions:', connectedSessions.length);
            
            if (connectedSessions.length === 0) {
                sessionSelect.innerHTML = '<option value="">No connected sessions</option>';
                showToast('No connected sessions found. Please connect a session first.', 'warning');
            } else {
                sessionSelect.innerHTML = '<option value="">Select a session...</option>' +
                    connectedSessions.map(session => `
                        <option value="${session._id || session.id}">${session.sessionId} - ${session.phoneNumber || 'No phone'}</option>
                    `).join('');
                console.log('✓ Session dropdown populated with', connectedSessions.length, 'sessions');
            }
        }
    } catch (error) {
        console.error('Error loading sessions for bot:', error);
        const sessionSelect = document.getElementById('bot-session-id');
        if (sessionSelect) {
            sessionSelect.innerHTML = '<option value="">Error loading sessions</option>';
        }
        showToast('Failed to load sessions: ' + error.message, 'error');
    }
}

/**
 * Open Flow Modal for creating or editing a conversation flow
 */
function openFlowModal(flow = null) {
    const modal = new bootstrap.Modal(document.getElementById('flowModal'));
    const title = document.getElementById('flow-modal-title');
    
    responseCounter = 0;
    
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
 * Save Bot (Create or Update)
 */
async function saveBot() {
    try {
        const botId = document.getElementById('bot-id').value;
        const sessionId = document.getElementById('bot-session-id').value;
        const name = document.getElementById('bot-name-input').value;
        const description = document.getElementById('bot-description-input').value;
        
        if (!sessionId || !name) {
            showToast('Please fill in all required fields', 'warning');
            return;
        }
        
        // Get working days
        const workingDays = Array.from(document.querySelectorAll('.working-day:checked'))
            .map(cb => parseInt(cb.value));
        
        const botData = {
            sessionId,
            name,
            description,
            flows: currentFlows || [],
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
            isActive: currentBot?.isActive !== false
        };
        
        const response = await makeApiCall('/api/bot', {
            method: 'POST',
            body: JSON.stringify(botData)
        });
        
        if (response.success) {
            showToast(`Bot ${botId ? 'updated' : 'created'} successfully!`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('botModal')).hide();
            await loadBotConfiguration();
        } else {
            showToast(response.error || 'Failed to save bot', 'error');
        }
    } catch (error) {
        console.error('Error saving bot:', error);
        showToast('Failed to save bot: ' + error.message, 'error');
    }
}

/**
 * Toggle Bot Active Status
 */
async function toggleBot() {
    if (!currentBot) return;
    
    try {
        const newStatus = !currentBot.isActive;
        const response = await makeApiCall(`/api/bot/${currentBot._id}/toggle`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive: newStatus })
        });
        
        if (response.success) {
            showToast(`Bot ${newStatus ? 'activated' : 'deactivated'} successfully!`, 'success');
            await loadBotConfiguration();
        } else {
            showToast(response.error || 'Failed to toggle bot', 'error');
        }
    } catch (error) {
        console.error('Error toggling bot:', error);
        showToast('Failed to toggle bot: ' + error.message, 'error');
    }
}

// ============================================================================
// FLOW OPERATIONS
// ============================================================================

/**
 * Save Flow (Create or Update)
 */
async function saveFlow() {
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
        if (flowId) {
            const index = currentFlows.findIndex(f => f.id === flowId);
            if (index !== -1) {
                currentFlows[index] = flow;
            }
        } else {
            currentFlows.push(flow);
        }
        
        // Save bot with updated flows
        const botData = {
            sessionId: currentBot.sessionId,
            name: currentBot.name,
            description: currentBot.description,
            flows: currentFlows,
            settings: currentBot.settings,
            isActive: currentBot.isActive
        };
        
        const response = await makeApiCall('/api/bot', {
            method: 'POST',
            body: JSON.stringify(botData)
        });
        
        if (response.success) {
            showToast(`Flow ${flowId ? 'updated' : 'added'} successfully!`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('flowModal')).hide();
            await loadBotConfiguration();
        } else {
            showToast(response.error || 'Failed to save flow', 'error');
        }
    } catch (error) {
        console.error('Error saving flow:', error);
        showToast('Failed to save flow: ' + error.message, 'error');
    }
}

/**
 * Edit Flow
 */
function editFlow(flowId) {
    const flow = currentFlows.find(f => f.id === flowId);
    if (flow) {
        openFlowModal(flow);
    }
}

/**
 * Delete Flow
 */
async function deleteFlow(flowId) {
    if (!confirm('Are you sure you want to delete this flow?')) return;
    
    try {
        currentFlows = currentFlows.filter(f => f.id !== flowId);
        
        // Save bot with updated flows
        const botData = {
            sessionId: currentBot.sessionId,
            name: currentBot.name,
            description: currentBot.description,
            flows: currentFlows,
            settings: currentBot.settings,
            isActive: currentBot.isActive
        };
        
        const response = await makeApiCall('/api/bot', {
            method: 'POST',
            body: JSON.stringify(botData)
        });
        
        if (response.success) {
            showToast('Flow deleted successfully!', 'success');
            await loadBotConfiguration();
        } else {
            showToast(response.error || 'Failed to delete flow', 'error');
        }
    } catch (error) {
        console.error('Error deleting flow:', error);
        showToast('Failed to delete flow: ' + error.message, 'error');
    }
}

// ============================================================================
// RESPONSE MANAGEMENT
// ============================================================================

/**
 * Add Response to Flow
 */
function addResponse(responseData = null) {
    responseCounter++;
    const container = document.getElementById('responses-container');
    const responseId = `response-${responseCounter}`;
    
    const responseHtml = `
        <div class="card mb-3" id="${responseId}">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span><i class="fas fa-reply me-2"></i>Response #${responseCounter}</span>
                <button type="button" class="btn btn-sm btn-danger" onclick="removeResponse('${responseId}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="card-body">
                <div class="row mb-3">
                    <div class="col-md-6">
                        <label class="form-label">Response Type</label>
                        <select class="form-select response-type" data-response-id="${responseId}" onchange="updateResponseFields('${responseId}', this.value)">
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
                        <input type="number" class="form-control response-delay" value="${responseData?.delay || 1000}" min="0" step="100" placeholder="1000">
                        <small class="text-muted">Wait time before sending this response</small>
                    </div>
                </div>
                <div class="response-content-area">
                    <div class="mb-3">
                        <label class="form-label">Message Content</label>
                        <textarea class="form-control response-content" rows="3" 
                                  placeholder="Enter your message... Use variables: {name}, {time}, {date}, {day}">${responseData?.content || ''}</textarea>
                        <small class="text-muted">
                            <i class="fas fa-info-circle me-1"></i>
                            Available variables: <code>{name}</code>, <code>{time}</code>, <code>{date}</code>, <code>{day}</code>
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
 * Remove Response from Flow
 */
function removeResponse(responseId) {
    const element = document.getElementById(responseId);
    if (element) {
        element.remove();
    }
}

/**
 * Update Response Fields based on type
 */
function updateResponseFields(responseId, type) {
    const card = document.getElementById(responseId);
    if (!card) return;
    
    const contentArea = card.querySelector('.response-content-area');
    const needsMedia = ['image', 'video', 'audio', 'document'].includes(type);
    
    // Check if media field exists
    let mediaField = card.querySelector('.media-url-field');
    
    if (needsMedia && !mediaField) {
        // Add media field
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
        // Remove media field
        mediaField.remove();
    }
}

// ============================================================================
// TEST BOT
// ============================================================================

/**
 * Test Bot with a sample message
 */
async function testBot() {
    const message = document.getElementById('test-message-input').value;
    if (!message) {
        showToast('Please enter a test message', 'warning');
        return;
    }
    
    if (!currentBot) {
        showToast('No bot configured', 'warning');
        return;
    }
    
    try {
        // Extract the actual sessionId string from the populated object
        const sessionId = typeof currentBot.sessionId === 'object' ? 
            currentBot.sessionId.sessionId : currentBot.sessionId;
        
        const response = await makeApiCall('/api/bot/test', {
            method: 'POST',
            body: JSON.stringify({
                sessionId: sessionId,
                message: message,
                chatId: 'test@c.us'
            })
        });
        
        const container = document.getElementById('test-response-container');
        if (response.success) {
            container.innerHTML = `
                <div class="test-response success">
                    <div class="d-flex align-items-start">
                        <i class="fas fa-check-circle fa-2x text-success me-3"></i>
                        <div>
                            <strong>Bot Response:</strong>
                            <p class="mb-0 mt-2">${response.processed ? 
                                'Bot processed the message successfully! ✓' : 
                                'No matching flow found. AI fallback would be used.'}</p>
                            ${response.matchedFlow ? `
                                <small class="text-muted d-block mt-2">
                                    <i class="fas fa-stream me-1"></i>Matched Flow: <strong>${response.matchedFlow}</strong>
                                </small>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="test-response error">
                    <div class="d-flex align-items-start">
                        <i class="fas fa-exclamation-circle fa-2x text-danger me-3"></i>
                        <div>
                            <strong>Error:</strong>
                            <p class="mb-0 mt-2">${response.error || 'Test failed'}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error testing bot:', error);
        const container = document.getElementById('test-response-container');
        container.innerHTML = `
            <div class="test-response error">
                <div class="d-flex align-items-start">
                    <i class="fas fa-exclamation-circle fa-2x text-danger me-3"></i>
                    <div>
                        <strong>Error:</strong>
                        <p class="mb-0 mt-2">${error.message}</p>
                    </div>
                </div>
            </div>
        `;
    }
}

// ============================================================================
// EXPORT FUNCTIONS TO GLOBAL SCOPE
// ============================================================================

// Make functions globally available
window.openBotModal = openBotModal;
window.loadSessionsForBotModal = loadSessionsForBotModal;
window.saveBot = saveBot;
window.toggleBot = toggleBot;
window.openFlowModal = openFlowModal;
window.addResponse = addResponse;
window.removeResponse = removeResponse;
window.updateResponseFields = updateResponseFields;
window.saveFlow = saveFlow;
window.editFlow = editFlow;
window.deleteFlow = deleteFlow;
window.testBot = testBot;

// Export variables for dashboard.ejs to access
window.botManager = {
    currentBot: () => currentBot,
    setCurrentBot: (bot) => { currentBot = bot; },
    currentFlows: () => currentFlows,
    setCurrentFlows: (flows) => { currentFlows = flows; }
};

console.log('✓ Bot Manager loaded successfully');

