import React, { useCallback, useEffect, useRef, useState } from 'react';
import ERPSettings from './ERPSettings';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
// Note: io is loaded via a script tag in useEffect for reliability in this setup.
import './ERPDashboard.css';
import fullrobot from '../../../assets/fullrobot.svg';
import ERPOverview from '../components/ERPOverview';

const erpJsLogic = `
    // --- STATE, CONFIGURATION, AND CACHING ---
    let erpConfig = null;
    let currentDomainId = null;
    let allRecords = {};
    let listenersAttached = false;

    const spinnerSvg = \`<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>\`;

    if (!window.__ERP_FETCH_PATCHED__) {
        const originalFetch = window.fetch.bind(window);
        window.__ERP_FETCH_PATCHED__ = true;
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            if ((response.status === 401 || response.status === 403) && !window.__ERP_AUTH_ALERTED__) {
                window.__ERP_AUTH_ALERTED__ = true;
                document.cookie = 'versatileErpUserId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                alert('Please reconfigure your workspace credentials.');
                window.location.href = '/';
            }
            return response;
        };
    }

    const getCookie = (name) => {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    };

    const getApiHeaders = () => ({
        'Content-Type': 'application/json',
        'X-User-ID': getCookie('versatileErpUserId') || ''
    });
    
    // --- DOM ELEMENT SELECTORS ---
    const getElements = () => ({
        panelTitle: document.getElementById("panel-title"),
        panelBody: document.getElementById("panel-body"),
        domainTabsContainer: document.getElementById("domain-tabs"),
        customizeBtn: document.getElementById("customize-btn"),
        modal: document.getElementById('main-modal'),
        modalTitle: document.getElementById('modal-title'),
        modalBody: document.getElementById('modal-body'),
        modalCloseBtn: document.getElementById('modal-close'),
        confirmModal: document.getElementById('confirmation-modal'),
        confirmModalTitle: document.getElementById('confirmation-modal-title'),
        confirmModalMessage: document.getElementById('confirmation-modal-message'),
        confirmModalConfirmBtn: document.getElementById('confirmation-modal-confirm-btn'),
        confirmModalCancelBtn: document.getElementById('confirmation-modal-cancel-btn'),
        mainQueryInput: document.getElementById('main-query-input'),
        mainQueryButton: document.getElementById('main-query-button'),
        aiReportContainer: document.getElementById('ai-report-container'),
        chatBubbleBtn: document.getElementById('chat-bubble-btn'),
        chatWindow: document.getElementById('chat-window'),
        chatCloseBtn: document.getElementById('chat-close-btn'),
        chatMessages: document.getElementById('chat-messages'),
        chatInput: document.getElementById('chat-input'),
        chatSendBtn: document.getElementById('chat-send-btn'),
        aiGuideBtn: document.getElementById('ai-guide-btn')
    });
    
    // --- MODALS & UI HELPERS ---
    function showConfirmationModal(title, message, confirmText = 'Confirm', onConfirm) {
        const dom = getElements();
        dom.confirmModalTitle.textContent = title;
        dom.confirmModalMessage.textContent = message;
        
        const newConfirmBtn = dom.confirmModalConfirmBtn.cloneNode(true);
        dom.confirmModalConfirmBtn.parentNode.replaceChild(newConfirmBtn, dom.confirmModalConfirmBtn);
        
        newConfirmBtn.onclick = () => {
            onConfirm();
            dom.confirmModal.classList.add('hidden');
        };

        dom.confirmModalCancelBtn.style.display = 'inline-flex';
        newConfirmBtn.style.display = 'inline-flex';
        dom.confirmModalCancelBtn.textContent = 'Cancel';
        newConfirmBtn.textContent = confirmText;
        newConfirmBtn.className = 'px-4 py-2 rounded-md text-sm font-medium text-white btn-primary-sm bg-red-600 hover:bg-red-700';

        dom.confirmModal.classList.remove('hidden');
    }

    function showInfoModal(title, message) {
        showConfirmationModal(title, message, '', () => {});
        const dom = getElements();
        dom.confirmModalConfirmBtn.style.display = 'none';
        dom.confirmModalCancelBtn.textContent = 'Close';
    }

    // --- INITIALIZATION & CORE FLOW ---
    async function initializeApp() {
        const dom = getElements();
        try {
            console.log('[ERP LOG] Fetching new config from server.');
            const response = await fetch('/api/erp/config', { headers: getApiHeaders() });
            if (!response.ok) throw new Error('Config fetch failed: ' + response.statusText);
            const data = await response.json();
            erpConfig = data.erp_config;

            renderDomainTabs();
            if (!listenersAttached) {
                setupEventListeners();
            }

            if (erpConfig.domains && erpConfig.domains.length > 0) {
                const domainToLoad = currentDomainId || erpConfig.domains[0].id;
                loadDomain(domainToLoad);
            } else {
                dom.panelTitle.textContent = 'Welcome!';
                dom.panelBody.innerHTML = '<p class="text-gray-600">No domains defined. Click "+ New Domain" to start.</p>';
            }
        } catch (error) {
            console.error("[ERP LOG] Initialization Error:", error);
            if (dom.panelBody) dom.panelBody.innerHTML = '<p class="text-red-500">Could not initialize the application. Please ensure the backend server is running and your workspace is configured.</p>';
        }
    }

    function setupEventListeners() {
        if (listenersAttached) return;
        const dom = getElements();

        dom.modalCloseBtn.addEventListener('click', () => dom.modal.classList.add('hidden'));
        dom.confirmModalCancelBtn.addEventListener('click', () => dom.confirmModal.classList.add('hidden'));
        dom.customizeBtn.addEventListener('click', () => openAddDomainModal());
        
        dom.mainQueryButton.addEventListener('click', handleReportQuery);
        dom.mainQueryInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleReportQuery(); });
        
        dom.chatBubbleBtn.addEventListener('click', () => {
            dom.chatWindow.classList.toggle('hidden');
            dom.chatBubbleBtn.classList.toggle('hidden');
        });
        dom.chatCloseBtn.addEventListener('click', () => {
            dom.chatWindow.classList.add('hidden');
            dom.chatBubbleBtn.classList.remove('hidden');
        });
        dom.chatSendBtn.addEventListener('click', handleSendMessage);
        dom.chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } });
        dom.aiGuideBtn.addEventListener('click', openAiGuide);
        
        // Socket.IO is initialized in the main React component's useEffect
        if (window.socket) {
            window.socket.on('connect', () => console.log('[ERP LOG] Socket connected successfully.'));
            window.socket.on('disconnect', () => console.log('[ERP LOG] Socket disconnected.'));
            window.socket.on('connect_error', (err) => console.error('[ERP LOG] Socket connection error:', err));
            window.socket.on('ai_reply', (data) => receiveAiMessage(data.text));
            window.socket.on('config_changed', initializeApp);
            // UPDATED: More robust data change handling
            window.socket.on('data_changed', (data) => {
                console.log(\`[ERP LOG] Data changed for entity: \${data.entity_id}. Reloading current domain.\`);
                if (currentDomainId) {
                    loadDomain(currentDomainId);
                }
            });
        }

        document.addEventListener('click', (e) => {
             document.querySelectorAll('.dropdown-content').forEach(d => {
                const menuButton = d.previousElementSibling;
                if (menuButton && !menuButton.contains(e.target)) {
                    d.style.display = 'none';
                }
            });
        });

        listenersAttached = true;
    }

    // --- AI REPORT FUNCTIONS ---
    async function handleReportQuery() {
        const dom = getElements();
        const query = dom.mainQueryInput.value.trim();
        if (!query) return;

        dom.aiReportContainer.style.display = 'block';
        dom.aiReportContainer.innerHTML =
          '<div class="py-10 text-center flex flex-col items-center justify-center min-h-[250px]">' +
            '<div class="loader"><div></div><div></div></div>' +
            '<p class="text-gray-600 mt-8 font-semibold">Generating your report...</p>' +
          '</div>';
        dom.mainQueryButton.disabled = true;

        try {
            const response = await fetch('/api/erp/ai/report', {
                method: 'POST',
                headers: getApiHeaders(),
                body: JSON.stringify({ query: query })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to generate report.');
            }
            const data = await response.json();
            const closeButtonHtml = '<button id="ai-report-close-btn" class="absolute top-3 right-4 text-gray-400 hover:text-gray-700 transition"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>';
            dom.aiReportContainer.innerHTML = closeButtonHtml + marked.parse(data.report);
            document.getElementById('ai-report-close-btn').addEventListener('click', () => {
                dom.aiReportContainer.style.display = 'none';
                dom.aiReportContainer.innerHTML = '';
            });
        } catch (error) {
            dom.aiReportContainer.innerHTML = \`<div class="p-4 bg-red-50 border border-red-200 rounded-md text-red-700"><strong>Error:</strong> \${error.message}</div>\`;
        } finally {
            dom.mainQueryButton.disabled = false;
        }
    }

    // --- AI CHATBOT FUNCTIONS (UPDATED LOGIC) ---
    function handleSendMessage() {
        const dom = getElements();
        const messageText = dom.chatInput.value.trim();
        if (!messageText) return;

        appendMessage(messageText, 'user');
        dom.chatInput.value = '';
        showChatLoader();

        // The backend now knows the user ID from the socket connection context
        window.socket.emit('chat_message', {
            message: messageText,
            userId: getCookie('versatileErpUserId')
        });
    }
    
    // UPDATED: This now handles action-based responses from the backend
    function receiveAiMessage(text) {
        hideChatLoader();
        // The backend now sends a simple text confirmation of the action taken.
        // We just display it. The 'data_changed' event handles the actual UI refresh.
        appendMessage(marked.parse(text), 'assistant');
    }

    function appendMessage(content, type) {
        const dom = getElements();
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message ' + type;
        messageDiv.innerHTML = content;
        dom.chatMessages.appendChild(messageDiv);
        dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    }

    function showChatLoader() {
      const dom = getElements();
      const loaderDiv = document.createElement('div');
      loaderDiv.id = 'chat-loader-element';

      // ❌ don't use: 'chat-message assistant ...'
      // ✅ neutral wrapper: centered, no bubble background
      loaderDiv.className = 'flex justify-center items-center py-2';

      loaderDiv.innerHTML = '<div class="loader"><div></div><div></div></div>';
      dom.chatMessages.appendChild(loaderDiv);
      dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    }

    function hideChatLoader() {
        const loader = document.getElementById('chat-loader-element');
        if (loader) loader.remove();
    }

    function openAiGuide() {
        const dom = getElements();
        dom.modalTitle.textContent = 'AI Assistant Guide';
        dom.modalBody.innerHTML = \`
            <div class="space-y-4 text-sm text-gray-600">
                <p>The AI Chat Assistant acts as a natural language interface for your ERP. It translates plain English commands into database actions, allowing you to manage records without forms.</p>
                <h4 class="font-semibold text-gray-800">Key Capabilities:</h4>
                <ul class="list-disc list-inside space-y-2">
                    <li><strong>Create Records:</strong> "New job card for WO-005, operation is Painting, status is Pending." The AI will ask for missing required fields.</li>
                    <li><strong>Update Records:</strong> "Update work order WO-2025-001 status to In Progress." The AI uses existing data to find the correct record ID.</li>
                    <li><strong>Delete Records:</strong> "Delete the job card for the Final Assembly of WO-2025-002."</li>
                    <li><strong>List Data:</strong> "Show me the first 5 work orders."</li>
                    <li><strong>Describe Entities:</strong> "What are the fields for a Bill of Materials?"</li>
                    <li><strong>Schema Management Guidance:</strong> Ask "How do I add a new Domain?" and it will guide you on using the UI.</li>
                </ul>
                <p>The AI is context-aware and uses your ERP's schema and data to understand your requests. After a successful action (create, update, delete), the UI will automatically refresh.</p>
            </div>
        \`;
        dom.modal.classList.remove('hidden');
    }

    function renderDomainTabs() {
        const dom = getElements();
        dom.domainTabsContainer.innerHTML = '';
        if (!erpConfig || !erpConfig.domains) return;

        erpConfig.domains.forEach(domain => {
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between group relative';
            li.innerHTML = \`
                <button data-domain-id="\${domain.id}" class="domain-tab-btn w-full text-left block py-2 px-4 rounded-md flex-grow">
                    <span class="domain-tab__bullet"></span>
                    <span class="domain-tab__label">\${domain.name}</span>
                </button>
                <div class="relative">
                    <button class="domain-menu-btn p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                    </button>
                    <div class="dropdown-content right-0 mt-1">
                        <button class="rename-domain-btn">Rename</button>
                        <button class="delete-domain-btn text-danger">Delete</button>
                    </div>
                </div>
            \`;
            li.querySelector('button[data-domain-id]').addEventListener('click', () => loadDomain(domain.id));
            const menuBtn = li.querySelector('.domain-menu-btn');
            const dropdown = li.querySelector('.dropdown-content');
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            });
            li.querySelector('.rename-domain-btn').addEventListener('click', () => window.openRenameDomainModal(domain.id, domain.name));
            li.querySelector('.delete-domain-btn').addEventListener('click', () => window.confirmDeleteDomain(domain.id));

            dom.domainTabsContainer.appendChild(li);
        });
    }

    async function loadDomain(domainId) {
        currentDomainId = domainId;
        const dom = getElements();
        const domainConfig = erpConfig.domains.find(d => d.id === domainId);
        document.querySelectorAll('#domain-tabs button[data-domain-id]').forEach(btn => {
            btn.classList.toggle('domain-active', btn.dataset.domainId === domainId);
        });
        dom.panelTitle.textContent = domainConfig.name;
        dom.panelBody.innerHTML = '<div class="text-center p-8"><div class="loader mx-auto"></div></div>';
        
        const entitySectionsPromises = Object.entries(domainConfig.entities).map(async ([entityId, entityConfig]) => {
            const response = await fetch('/api/erp/data/' + entityId, { headers: getApiHeaders() });
            const records = await response.json();
            allRecords[entityId] = records.error ? [] : records;
            return renderEntitySection(domainId, entityId, entityConfig, allRecords[entityId]);
        });

        const entitySections = await Promise.all(entitySectionsPromises);
        
        const addEntityButton = document.createElement('button');
        addEntityButton.className = 'btn-dashed mb-8';
        addEntityButton.textContent = '+ Add New Entity';
        addEntityButton.onclick = () => window.openAddEntityModal(domainId);
        
        dom.panelBody.innerHTML = '';
        dom.panelBody.appendChild(addEntityButton);
        dom.panelBody.insertAdjacentHTML('beforeend', entitySections.join(''));

        document.querySelectorAll('.entity-menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = btn.nextElementSibling;
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            });
        });
        document.querySelectorAll('.edit-entity-btn').forEach(btn => {
            const entityId = btn.closest('.mb-8').querySelector('.entity-menu-btn').dataset.entityId;
            btn.addEventListener('click', () => window.openEditEntityModal(entityId));
        });
        document.querySelectorAll('.delete-entity-btn').forEach(btn => {
            const entityId = btn.closest('.mb-8').querySelector('.entity-menu-btn').dataset.entityId;
            btn.addEventListener('click', () => window.confirmDeleteEntity(entityId));
        });
    }
    
    function renderEntitySection(domainId, entityId, entityConfig, records) {
        const tableHtml = records.length > 0 ? createRecordsTable(entityId, entityConfig, records) : \`<p class="erp-empty">No records found for \${entityConfig.label}.</p>\`;
        return \`<div class="erp-entity-card mb-8" data-entity-id="\${entityId}">
            <div class="erp-entity-card__header">
                <h3 class="erp-entity-card__title">\${entityConfig.label}</h3>
                <div class="erp-entity-card__actions">
                    <button class="btn-primary-sm" onclick="window.openAddRecordModal('\${entityId}')">+ Add New</button>
                    
                    <button data-entity-id="\${entityId}" class="entity-menu-btn">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                    </button>
                    <div class="dropdown-content right-0 mt-1">
                        
                        <button class="edit-entity-btn dropdown-item">Edit Entity</button>
                        <button class="delete-entity-btn dropdown-item text-danger">Delete Entity</button>
                    </div>
                </div>
            </div>
            <div class="erp-entity-card__body">\${tableHtml}</div>
        </div>\`;
    }

    function createRecordsTable(entityId, entityConfig, records) {
        const headers = entityConfig.fields.filter(f => !f.read_only);
        const tableContent = records.map(record => {
            const cells = headers.map(h => \`<td class="erp-table__cell">\${record[h.name] === null || record[h.name] === undefined ? 'N/A' : String(record[h.name])}</td>\`).join('');
            const actions = \`<td class="erp-table__cell erp-table__cell--actions"><button class="erp-link-btn" onclick="window.openEditRecordModal('\${entityId}', '\${record.id}')">Edit</button><button class="erp-link-btn erp-link-btn--danger" onclick="window.deleteRecord('\${entityId}', '\${record.id}')">Delete</button></td>\`;
            return \`<tr class="erp-table__row">\${cells}\${actions}</tr>\`;
        }).join('');
        const headerRow = \`<tr>\${headers.map(h => \`<th scope="col" class="erp-table__head">\${h.label}</th>\`).join('')}<th scope="col" class="erp-table__head erp-table__head--actions">Actions</th></tr>\`;
        return \`<table class="erp-table"><thead>\${headerRow}</thead><tbody>\${tableContent}</tbody></table>\`;
    }

    window.openAddRecordModal = (entityId) => {
        const dom = getElements();
        const domain = erpConfig.domains.find(d => d.id === currentDomainId);
        const entityConfig = domain.entities[entityId];
        dom.modalTitle.textContent = 'Add New ' + entityConfig.label;
        dom.modalBody.innerHTML = createRecordForm(entityId, entityConfig);
        dom.modal.classList.remove('hidden');
        document.getElementById('form-' + entityId).addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = spinnerSvg + 'Saving...';
            try {
                const payload = Object.fromEntries(new FormData(e.target).entries());
                const response = await fetch('/api/erp/data/' + entityId, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify(payload) });
                if (!response.ok) {
                    let errorMessage = 'Failed to save record.';
                    try {
                        const errorBody = await response.json();
                        if (errorBody && errorBody.error) {
                            errorMessage = errorBody.error;
                        }
                    } catch (parseErr) {
                        // ignore JSON parsing errors and use default message
                    }
                    showInfoModal('Error', errorMessage);
                    return;
                }
                dom.modal.classList.add('hidden');
                if (typeof initializeApp === 'function') {
                    initializeApp();
                }
            } catch (err) {
                console.error("Failed to save record:", err);
                showInfoModal('Error', err.message || 'Failed to save record.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    };

    window.openEditRecordModal = (entityId, recordId) => {
        const dom = getElements();
        const domain = erpConfig.domains.find(d => d.id === currentDomainId);
        const entityConfig = domain.entities[entityId];
        const record = allRecords[entityId].find(r => r.id === recordId);
        dom.modalTitle.textContent = 'Edit ' + entityConfig.label;
        dom.modalBody.innerHTML = createRecordForm(entityId, entityConfig, record);
        dom.modal.classList.remove('hidden');
        document.getElementById('form-' + entityId).addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = spinnerSvg + 'Saving...';
            try {
                const payload = Object.fromEntries(new FormData(e.target).entries());
                const response = await fetch('/api/erp/data/' + entityId + '/' + recordId, { method: 'PUT', headers: getApiHeaders(), body: JSON.stringify(payload) });
                if (!response.ok) {
                    let errorMessage = 'Failed to save changes.';
                    try {
                        const errorBody = await response.json();
                        if (errorBody && errorBody.error) {
                            errorMessage = errorBody.error;
                        }
                    } catch (parseErr) {
                        // ignore
                    }
                    showInfoModal('Error', errorMessage);
                    return;
                }
                dom.modal.classList.add('hidden');
                if (typeof initializeApp === 'function') {
                    initializeApp();
                }
            } catch(err) {
                console.error("Failed to update record:", err);
                showInfoModal('Error', err.message || 'Failed to update record.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    };

    window.deleteRecord = async (entityId, recordId) => {
        showConfirmationModal('Delete Record', 'Are you sure you want to delete this record?', 'Delete', async () => {
            await fetch('/api/erp/data/' + entityId + '/' + recordId, { method: 'DELETE', headers: getApiHeaders() });
        });
    };
    
    function createRecordForm(entityId, entityConfig, record = {}) {
        const fieldsHtml = entityConfig.fields.filter(field => !field.read_only).map(field => {
            const value = record[field.name] || '';
            const requiredAttr = field.required ? 'required' : '';
            let inputHtml;
            if (field.type === 'select' && field.options) {
                const optionsHtml = field.options.map(opt => \`<option value="\${opt}" \${opt == value ? 'selected' : ''}>\${opt}</option>\`).join('');
                inputHtml = \`<select name="\${field.name}" \${requiredAttr} class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">\${optionsHtml}</select>\`;
            } else if (field.type === 'foreign_key' && field.references) {
                const relatedEntityId = field.references;
                const relatedRecords = allRecords[relatedEntityId] || [];
                const optionsHtml = relatedRecords.map(rec => \`<option value="\${rec.id}" \${rec.id == value ? 'selected' : ''}>\${rec.name || rec.id}</option>\`).join('');
                inputHtml = \`<select name="\${field.name}" \${requiredAttr} class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value="">-- Select --</option>\${optionsHtml}</select>\`;
            } else if (field.type === 'textarea') {
                inputHtml = \`<textarea name="\${field.name}" \${requiredAttr} rows="3" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">\${value}</textarea>\`;
            } else if (field.type === 'boolean' || field.name === 'is_active' || field.type === 'checkbox') {
                const currentValue = String(value).toLowerCase() === 'true';
                inputHtml = \`<select name="\${field.name}" \${requiredAttr} class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value="true" \${currentValue ? 'selected' : ''}>True</option><option value="false" \${!currentValue ? 'selected' : ''}>False</option></select>\`;
            } else {
                const inputType = field.type || 'text';
                inputHtml = \`<input type="\${inputType}" name="\${field.name}" value="\${value}" \${requiredAttr} class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">\`;
            }
            const labelText = field.label + (field.required ? ' *' : '');
            return \`<div class="mb-4"><label class="block text-sm font-medium text-gray-700">\${labelText}</label>\${inputHtml}</div>\`;
        }).join('');
        const buttonText = record.id ? 'Save Changes' : 'Save Record';
        return \`<form id="form-\${entityId}">\${fieldsHtml}<div class="flex justify-end pt-4 border-t mt-4"><button type="submit" class="btn-primary-sm">\${buttonText}</button></div></form>\`;
    }
    
    window.openAddDomainModal = () => {
        const dom = getElements();
        dom.modalTitle.textContent = 'Add New Domain';
        dom.modalBody.innerHTML = \`<form id="add-domain-form"><div class="mb-4"><label class="block text-sm font-medium text-gray-700">Domain Name</label><input type="text" name="name" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" autofocus></div><div class="flex justify-end pt-4 border-t mt-4"><button type="submit" class="btn-primary-sm">Create Domain</button></div></form>\`;
        dom.modal.classList.remove('hidden');
        document.getElementById('add-domain-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = spinnerSvg + 'Creating...';
            try {
                const name = e.target.name.value;
                await fetch('/api/erp/domains', { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ name }) });
                dom.modal.classList.add('hidden');
            } catch(err) {
                showInfoModal('Error', 'Failed to create domain.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    };

    window.openRenameDomainModal = (domainId, currentName) => {
        const dom = getElements();
        dom.modalTitle.textContent = 'Rename Domain';
        dom.modalBody.innerHTML = \`<form id="rename-domain-form"><div class="mb-4"><label class="block text-sm font-medium text-gray-700">Domain Name</label><input type="text" name="name" value="\${currentName}" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" autofocus></div><div class="flex justify-end pt-4 border-t mt-4"><button type="submit" class="btn-primary-sm">Save Changes</button></div></form>\`;
        dom.modal.classList.remove('hidden');
        document.getElementById('rename-domain-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = spinnerSvg + 'Saving...';
            try {
                const name = e.target.name.value;
                await fetch('/api/erp/domains/' + domainId, { method: 'PUT', headers: getApiHeaders(), body: JSON.stringify({ name }) });
                dom.modal.classList.add('hidden');
            } catch(err) {
                showInfoModal('Error', 'Failed to rename domain.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    };

    window.confirmDeleteDomain = async (domainId) => {
        showConfirmationModal('Delete Domain', 'Are you sure you want to delete this domain and all its data? This cannot be undone.', 'Delete', async () => {
            await fetch('/api/erp/domains/' + domainId, { method: 'DELETE', headers: getApiHeaders() });
            currentDomainId = null; // Reset current domain
            initializeApp();
        });
    };
    
    function createFieldRowHtml(field = {}, isEditMode = false) {
        const types = ['text', 'number', 'date', 'textarea', 'boolean'];
        const optionsHtml = types.map(t => \`<option value="\${t}" \${field.type === t ? 'selected' : ''}>\${t.charAt(0).toUpperCase() + t.slice(1)}</option>\`).join('');

        const defaultValueInput = isEditMode ? \`<div><input type="text" class="form-input field-default-value" placeholder="Default Value" value="\${field.defaultValue || ''}" style="display: none;"></div>\` : '';

        return \`<div class="field-row \${isEditMode ? 'edit-mode' : ''}" data-is-new="\${!field.name}">
                <div><input type="text" class="form-input field-label" placeholder="e.g., Customer Name" value="\${field.label || ''}" required></div>
                \${defaultValueInput}
                <div><select class="form-input field-type">\${optionsHtml}</select></div>
                <label class="required-group">
                    <input type="checkbox" class="field-required" \${field.required ? 'checked' : ''}>
                    <span>Required</span>
                </label>
                <div class="flex justify-center">
                    <button type="button" class="remove-btn" title="Remove field">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            </div>\`;
    }
    
    function handleDefaultValueInputVisibility(row) {
        const isNew = row.dataset.isNew === 'true';
        const isRequired = row.querySelector('.field-required').checked;
        const defaultValueInput = row.querySelector('.field-default-value');
        if (defaultValueInput) {
            const shouldShow = isNew && isRequired;
            defaultValueInput.style.display = shouldShow ? 'block' : 'none';
            defaultValueInput.required = shouldShow;
        }
    }

    window.openAddEntityModal = (domainId) => {
        const dom = getElements();
        dom.modalTitle.textContent = 'Add New Entity';
        dom.modalBody.innerHTML = \`<form id="add-entity-form" class="space-y-4">
            <div><label class="block text-sm font-medium text-gray-700">Entity Name</label><input type="text" name="label" required class="mt-1 block w-full form-input" placeholder="e.g., Purchase Orders" autofocus></div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Fields</label>
                <div id="fields-wrapper">
                    <div class="field-row-header add-entity-header">
                        <span>Field Label *</span>
                        <span>Type</span>
                        <span>Required</span>
                        <span></span>
                    </div>
                    <div id="fields-container"></div>
                </div>
                <button type="button" id="add-field-btn" class="text-sm btn-primary-sm mt-4">+ Add Field</button>
            </div>
            <div class="flex justify-end pt-4 border-t mt-4"><button type="submit" class="btn-primary-sm">Save Entity</button></div>
        </form>\`;
        dom.modal.classList.remove('hidden');

        const fieldsContainer = dom.modalBody.querySelector('#fields-container');
        fieldsContainer.innerHTML = createFieldRowHtml();
        
        dom.modalBody.querySelector('#add-field-btn').addEventListener('click', () => { fieldsContainer.insertAdjacentHTML('beforeend', createFieldRowHtml()); });
        fieldsContainer.addEventListener('click', (e) => { if (e.target.closest('.remove-btn')) { e.target.closest('.field-row').remove(); } });
        
        document.getElementById('add-entity-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = spinnerSvg + 'Saving...';

            try {
                const label = e.target.label.value;
                const fieldRows = fieldsContainer.querySelectorAll('.field-row');
                if (fieldRows.length === 0) { throw new Error("You must add at least one field."); }
                const fields = Array.from(fieldRows).map(row => {
                    const fieldLabel = row.querySelector('.field-label').value;
                    return {
                        label: fieldLabel,
                        name: fieldLabel.toLowerCase().replace(/\\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
                        type: row.querySelector('.field-type').value,
                        required: row.querySelector('.field-required').checked,
                    }
                });
                const response = await fetch('/api/erp/domains/' + domainId + '/entities', {
                    method: 'POST',
                    headers: getApiHeaders(),
                    body: JSON.stringify({ label, fields })
                });

                if (!response.ok) {
                    let errorMessage = 'Failed to create entity.';
                    try {
                        const errorPayload = await response.json();
                        if (errorPayload && errorPayload.error) {
                            errorMessage = errorPayload.error;
                        }
                    } catch (parseError) {
                        // ignore JSON parse errors, stick with default message
                    }
                    throw new Error(errorMessage);
                }

                dom.modal.classList.add('hidden');
                if (typeof initializeApp === 'function') {
                    initializeApp();
                }
            } catch(err) {
                showInfoModal("Error", err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    };

    window.openEditEntityModal = (entityId) => {
        const dom = getElements();
        const domain = erpConfig.domains.find(d => d.id === currentDomainId);
        const entity = domain.entities[entityId];
        dom.modalTitle.textContent = 'Edit ' + entity.label;
        const existingFieldsHtml = entity.fields.filter(f => !f.read_only).map(field => createFieldRowHtml(field, true)).join('');
        
        dom.modalBody.innerHTML = \`<form id="edit-entity-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Fields</label>
                <div id="fields-wrapper">
                    <div class="field-row-header edit-entity-header">
                        <span>Field Label *</span>
                        <span>Default Value</span>
                        <span>Type</span>
                        <span>Required</span>
                        <span></span>
                    </div>
                    <div id="fields-container">\${existingFieldsHtml}</div>
                </div>
                <button type="button" id="add-field-btn" class="text-sm btn-primary-sm mt-4">+ Add Field</button>
            </div>
            <div class="flex justify-end pt-4 border-t mt-4"><button type="submit" class="btn-primary-sm">Save Changes</button></div>
        </form>\`;
        dom.modal.classList.remove('hidden');
        

        const fieldsContainer = dom.modalBody.querySelector('#fields-container');
        dom.modalBody.querySelector('#add-field-btn').addEventListener('click', () => {
            fieldsContainer.insertAdjacentHTML('beforeend', createFieldRowHtml({}, true));
        });
        
        fieldsContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('field-required')) {
                handleDefaultValueInputVisibility(e.target.closest('.field-row'));
            }
        });
        
        fieldsContainer.querySelectorAll('.field-row').forEach(handleDefaultValueInputVisibility);
        fieldsContainer.addEventListener('click', (e) => { if (e.target.closest('.remove-btn')) { e.target.closest('.field-row').remove(); } });
        
        document.getElementById('edit-entity-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = spinnerSvg + 'Saving...';

            try {
                const fieldRows = fieldsContainer.querySelectorAll('.field-row');
                const fields = Array.from(fieldRows).map(row => {
                    const fieldLabel = row.querySelector('.field-label').value;
                    const defaultValueEl = row.querySelector('.field-default-value');
                    return {
                        label: fieldLabel,
                        name: fieldLabel.toLowerCase().replace(/\\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
                        type: row.querySelector('.field-type').value,
                        required: row.querySelector('.field-required').checked,
                        defaultValue: defaultValueEl ? defaultValueEl.value : null
                    }
                });
                const readOnlyFields = entity.fields.filter(f => f.read_only);
                const payload = { ...entity, fields: [...readOnlyFields, ...fields] };
                await fetch('/api/erp/domains/' + currentDomainId + '/entities/' + entityId, { method: 'PUT', headers: getApiHeaders(), body: JSON.stringify(payload) });
                dom.modal.classList.add('hidden');
            } catch(err) {
                showInfoModal("Error", "Failed to save entity changes.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    };

    window.confirmDeleteEntity = async (entityId) => {
        showConfirmationModal('Delete Entity', 'Are you sure you want to delete this entity and all its data? This cannot be undone.', 'Delete', async () => {
            await fetch('/api/erp/domains/' + currentDomainId + '/entities/' + entityId, { method: 'DELETE', headers: getApiHeaders() });
        });
    };

    window.__erpLoadDomain = (domainId) => {
        if (!domainId) return;
        loadDomain(domainId);
    };

    window.__erpFocusEntity = (entityId) => {
        if (!entityId) return;
        const focus = () => {
            const existingHighlights = document.querySelectorAll('.erp-entity-card.is-focused');
            existingHighlights.forEach(card => card.classList.remove('is-focused'));
            const selector = '.erp-entity-card[data-entity-id="' + entityId + '"]';
            const card = document.querySelector(selector);
            if (card) {
                card.classList.add('is-focused');
                card.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                setTimeout(() => card.classList.remove('is-focused'), 2400);
            } else {
                setTimeout(focus, 220);
            }
        };
        focus();
    };
    
    initializeApp();
`;

const ERPDashboard = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState('overview');
  const setupRan = useRef(false);
  const navigate = useNavigate();

  const handleNavigateWorkspace = useCallback(() => {
    setActiveView('workspace');
  }, []);

  const handleInspectEntity = useCallback((entityId, domainId) => {
    setActiveView('workspace');
    const focus = () => {
      if (domainId && window.__erpLoadDomain) {
        window.__erpLoadDomain(domainId);
      }
      setTimeout(() => {
        if (window.__erpFocusEntity) {
          window.__erpFocusEntity(entityId);
        }
      }, 400);
    };
    setTimeout(focus, 150);
  }, []);

  const getCookie = (name) => {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  };

  // Compute the socket URL once (prefers explicit global/env, falls back to :8000)
  const SOCKET_URL =
    window.__SOCKET_URL__ ||
    (import.meta?.env?.VITE_SOCKET_URL) ||
    `${location.protocol}//${location.hostname}:8000`;

  const initializeDashboard = useCallback(() => {
    const resources = [
      { type: 'script', src: 'https://cdn.socket.io/4.7.5/socket.io.min.js' },
      { type: 'script', src: 'https://cdn.jsdelivr.net/npm/marked/marked.min.js' },
    ];

    const addedElements = [];
    let scriptsLoaded = 0;
    const totalScripts = resources.length;

    const runLogic = () => {
      try {
        if (typeof window.io !== 'function') {
          console.error('[ERP LOG] Socket.IO library not available on window.io');
        } else {
          window.socket = window.io({
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 500,
          });
        }
        new Function(erpJsLogic)();
      } catch (e) {
        console.error('Error executing ERP logic:', e);
      }
    };

    resources.forEach((res) => {
      const el = document.createElement(res.type);
      el.src = res.src;
      el.async = false;
      el.onload = () => {
        scriptsLoaded += 1;
        if (scriptsLoaded === totalScripts) {
          runLogic();
        }
      };
      document.head.appendChild(el);
      addedElements.push(el);
    });

    setupRan.current = true;

    return () => {
      addedElements.forEach((el) => {
        if (document.head.contains(el)) {
          document.head.removeChild(el);
        }
      });
      if (window.socket && typeof window.socket.disconnect === 'function') {
        window.socket.disconnect();
        delete window.socket;
      }
    };
  }, []);

  useEffect(() => {
    if (setupRan.current) return undefined;

    const userId = getCookie('versatileErpUserId');
    if (!userId) {
      navigate('/erp', { replace: true });
      return undefined;
    }

    let cancelled = false;
    let teardown = null;

    const verifyAndLoad = async () => {
      try {
        const response = await fetch('/api/erp/config', {
          headers: {
            'X-User-ID': userId,
          },
        });

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          navigate('/erp', { replace: true });
          return;
        }

        teardown = initializeDashboard();
      } catch (error) {
        console.error('Failed to verify ERP workspace configuration.', error);
        if (!cancelled) {
          navigate('/erp', { replace: true });
        }
      }
    };

    verifyAndLoad();

    return () => {
      cancelled = true;
      if (typeof teardown === 'function') {
        teardown();
      }
    };
  }, [navigate, initializeDashboard]);

  return (
    <div className="erp-dashboard flex flex-col md:flex-row h-screen overflow-x-hidden">
      <header className="md:hidden flex items-center justify-between bg-white p-4 border-b z-20">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={20} />
          </Link>
          <span className="text-lg font-bold text-gray-800">
            ERP
          </span>
        </div>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
      </header>
      
      <aside
        className={`
          w-72 p-6 flex flex-col shadow-lg flex-shrink-0 sidebar-light erp-sidebar space-y-4
          transform transition-transform duration-300 ease-in-out
          fixed md:relative md:translate-x-0 inset-y-0 left-0 z-30 bg-white
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="border-b pb-4 border-gray-200">
          <a href="/" className="text-xl md:text-2xl font-bold text-gray-800 hover:text-blue-600">
            ERP
          </a>
          <p className="text-xs md:text-sm text-gray-500">Your customizable workspace</p>
        </div>
        <div className="hidden md:block">
          <Link to="/" className="erp-sidebar__back-link">
            <ArrowLeft size={16} />
            <span>Back to Discover AI</span>
          </Link>
        </div>
        <div className="space-y-3">
          <div className="view-toggle">
            <button
              type="button"
              onClick={() => setActiveView('overview')}
              className={`view-toggle__button ${activeView === 'overview' ? 'is-active' : ''}`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveView('workspace')}
              className={`view-toggle__button ${activeView === 'workspace' ? 'is-active' : ''}`}
            >
              Workspace
            </button>
          </div>
          <button id="customize-btn" className="w-full btn-primary">
            + New Domain
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto border-t pt-4 border-gray-200">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Domains</h2>
          <ul id="domain-tabs" className="space-y-1"></ul>
        </nav>
        <ERPSettings />
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className={activeView === 'overview' ? 'block' : 'hidden'}>
          <ERPOverview
            onNavigateWorkspace={handleNavigateWorkspace}
            onInspectEntity={handleInspectEntity}
          />
        </div>
        <div className={activeView === 'workspace' ? 'block' : 'hidden'}>
        <section className="mb-6">
          <div className="neumo-search flex items-center p-1 rounded-2xl">
            <input
              type="text"
              id="main-query-input"
              placeholder="Generate a report or ask..."
              className="neumo-search__input flex-1 p-3 text-base md:text-lg outline-none border-none w-full bg-transparent"
            />
            <button id="main-query-button" className="btn-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </button>
          </div>
          <div className="mt-2 text-xs md:text-sm text-gray-500">
            <p>e.g., "Summarize all employees by department"</p>
          </div>
        </section>
        <section id="ai-report-container" style={{ display: 'none' }}></section>
        <section id="dynamic-content-panel" className="mt-6">
          <h2 id="panel-title" className="text-2xl md:text-3xl font-bold mb-4">
            Welcome!
          </h2>
          <div id="panel-body" className="space-y-6"></div>
        </section>
        </div>
      </main>

      <div id="main-modal" className="hidden fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div
          className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative transform transition-all"
          role="dialog"
        >
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h3 id="modal-title" className="text-xl font-semibold">Modal Title</h3>
            <button id="modal-close" className="text-2xl text-gray-500 hover:text-gray-800">&times;</button>
          </div>
          <div id="modal-body"></div>
        </div>
      </div>

      <div id="confirmation-modal" className="hidden fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 confirm-modal-backdrop">
        <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl relative transform confirm-modal-content">
          <h3 id="confirmation-modal-title" className="text-lg font-semibold text-gray-800 mb-2">Confirmation</h3>
          <p id="confirmation-modal-message" className="text-sm text-gray-600 mb-6">Are you sure?</p>
          <div className="flex justify-end gap-3">
            <button id="confirmation-modal-cancel-btn" className="px-4 py-2 bg-gray-200 rounded-md text-sm font-medium hover:bg-gray-300">Cancel</button>
            <button id="confirmation-modal-confirm-btn" className="px-4 py-2 rounded-md text-sm font-medium text-white">Confirm</button>
          </div>
        </div>
      </div>

      <div id="ai-chat-container">
        <button id="chat-bubble-btn" className="fixed bottom-8 right-8 z-40">
          <img src={fullrobot} alt="AI Assistant Icon" className="w-16 h-16 object-contain" />
        </button>
        <div id="chat-window" className="hidden fixed bottom-28 right-8 w-[360px] h-[500px] bg-white rounded-xl shadow-2xl flex flex-col z-40">
          <div className="chat-header">
            <div className="flex items-center gap-2">
              <h3 className="font-bold">AI Assistant</h3>
              <button id="ai-guide-btn" title="Open Quick Guide" className="p-1 rounded-full hover:bg-white/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </button>
              <a href="/ai_guide.html" target="_blank" rel="noopener noreferrer" title="Open Full User Guide" className="p-1 rounded-full hover:bg-white/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </a>
            </div>
            <button id="chat-close-btn">&times;</button>
          </div>
          <div id="chat-messages" className="flex-1 p-4 overflow-y-auto">
            <div className="chat-message assistant">
              <span>Hi! How can I help you today?</span>
            </div>
          </div>
          <div className="p-4 border-t border-gray-200 bg-white rounded-b-xl">
            <div className="flex items-center bg-gray-100 rounded-lg">
              <input type="text" id="chat-input" placeholder="Ask anything..." className="flex-1 bg-transparent p-3 outline-none border-none" />
              <button id="chat-send-btn" className="p-3 text-gray-500 hover:text-blue-600">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ERPDashboard;
