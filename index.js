/* ============================================================
   Supabase Config Credentials & Clients Initialization
   ============================================================ */
const SUPABASE_URL = "https://juouxgqrabirdjdiveht.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BV6eD7BhN8nNO8dSV6a3Lg_U2xsqNlu";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Configurations
let currentUser = null;
let currentTheme = localStorage.getItem('theme') || 'dark';
let activeTab = "dashboard";
let authMode = "login";

let assets = [], issues = [], technicians = [], history = [];
let completingIssueId = null;   // issue currently showing the "complete job" evidence form
let historyAssetId = null;      // asset currently selected in the History tab

// Apply Initial Theme Node State
document.documentElement.setAttribute('data-theme', currentTheme);

/* ============================================================
   Premium Notification System (Anti-Shock Custom Banners)
   ============================================================ */
function showToast(message, type = 'success') {
    const existing = document.getElementById('miq-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'miq-toast';
    toast.style.cssText = `
        position: fixed; bottom: 30px; right: 30px;
        padding: 16px 24px; border-radius: 16px;
        background: ${type === 'success' ? 'rgba(99, 102, 241, 0.95)' : 'rgba(239, 68, 68, 0.95)'};
        color: white; backdrop-filter: blur(12px); font-weight: 700;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3); z-index: 99999;
        transform: translateY(100px); opacity: 0;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    toast.innerText = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    }, 50);

    setTimeout(() => {
        toast.style.transform = 'translateY(30px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

/* ============================================================
   Auth Controllers with Live Layout Transitions
   ============================================================ */
async function handleSignUp(email, password) {
    const btn = document.getElementById("auth-submit-btn");
    btn.innerText = "Creating Account...";
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
        showToast("Registration Error: " + error.message, 'error');
        btn.innerText = "Create Account";
        return;
    }
    showToast("Success! Check your email for verification link.", 'success');
    authMode = "login";
    renderAuthView();
}

async function handleSignIn(email, password) {
    const btn = document.getElementById("auth-submit-btn");
    btn.innerText = "Authenticating...";
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        showToast("Access Denied: " + error.message, 'error');
        btn.innerText = "Access Account Panel";
        return;
    }
    currentUser = data.user;
    showToast("Welcome Back Commander!", 'success');
    bootstrapApplication();
}

async function handleSignOut() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    showToast("Session terminated securely.", 'success');
    renderAuthView();
}

// Global Auth State Tracking Subscriptions
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUser = session.user;
        bootstrapApplication();
    } else {
        renderAuthView();
    }
});

/* ============================================================
   Realtime Core Sync Infrastructure & Mutation Methods
   ============================================================ */
async function bootstrapApplication() {
    try {
        const [aRes, tRes, iRes, hRes] = await Promise.all([
            supabaseClient.from("assets").select("*").order("created_at"),
            supabaseClient.from("technicians").select("*").order("created_at"),
            supabaseClient.from("issues").select("*").order("created_at"),
            supabaseClient.from("history").select("*").order("completed_at", { ascending: false }),
        ]);

        assets = aRes.data || [];
        technicians = tRes.data || [];
        issues = iRes.data || [];
        history = hRes.data || [];

        if (!historyAssetId || !assets.find(a => a.id === historyAssetId)) {
            historyAssetId = assets.length ? assets[0].id : null;
        }

        renderAppStructure();
    } catch (err) {
        showToast("Database connection failure.", 'error');
    }
}

// Create Asset Mutation
async function createAsset(e) {
    e.preventDefault();
    const id = document.getElementById('asset-id').value;
    const name = document.getElementById('asset-name').value;
    const location = document.getElementById('asset-location').value;
    const department = document.getElementById('asset-dept').value;

    const { error } = await supabaseClient.from('assets').insert([{ id, name, location, department }]);
    if (error) { showToast(error.message, 'error'); return; }
    showToast("Asset registered successfully!");
    bootstrapApplication();
}

// Create Ticket Fault Mutation
async function createIssue(e) {
    e.preventDefault();
    const id = "TK-" + Math.floor(1000 + Math.random() * 9000);
    const asset_id = document.getElementById('issue-asset').value;
    const title = document.getElementById('issue-title').value;
    const priority = document.getElementById('issue-priority').value;
    const description = document.getElementById('issue-desc').value;

    const { error } = await supabaseClient.from('issues').insert([{ id, asset_id, title, priority, description, status: 'Open' }]);
    if (error) { showToast(error.message, 'error'); return; }

    // keep the asset's running issue counter accurate
    const asset = assets.find(a => a.id === asset_id);
    if (asset) {
        await supabaseClient.from('assets').update({ total_issues: (asset.total_issues || 0) + 1 }).eq('id', asset_id);
    }

    showToast("Ticket generated successfully!");
    bootstrapApplication();
}

// Onboard Technician Mutation
async function addTechnician(e) {
    e.preventDefault();
    const id = "TECH-" + Date.now().toString().slice(-6);
    const name = document.getElementById('tech-name').value;
    const department = document.getElementById('tech-dept').value;

    const { error } = await supabaseClient.from('technicians').insert([{ id, name, department, active_jobs: 0 }]);
    if (error) { showToast(error.message, 'error'); return; }
    showToast("Technician onboarded!");
    bootstrapApplication();
}

// Triage: auto-assign least-loaded technician in the matching department
async function autoAssign(issueId) {
    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;
    const asset = assets.find(a => a.id === issue.asset_id);
    if (!asset) return;

    const available = technicians
        .filter(t => t.department === asset.department)
        .sort((a, b) => (a.active_jobs || 0) - (b.active_jobs || 0));

    if (available.length === 0) {
        showToast(`No technician available in ${asset.department}.`, 'error');
        return;
    }
    const chosen = available[0];

    const [r1, r2] = await Promise.all([
        supabaseClient.from('issues').update({ technician: chosen.name, status: 'Assigned' }).eq('id', issueId),
        supabaseClient.from('technicians').update({ active_jobs: (chosen.active_jobs || 0) + 1 }).eq('id', chosen.id),
    ]);
    if (r1.error || r2.error) { showToast('Could not assign technician.', 'error'); return; }
    showToast(`Assigned to ${chosen.name}.`);
    bootstrapApplication();
}

// Workflow: technician accepts the assigned job
async function acceptJob(issueId) {
    const { error } = await supabaseClient.from('issues').update({ status: 'In Progress' }).eq('id', issueId);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Job accepted — work started.');
    bootstrapApplication();
}

function openCompleteForm(issueId) {
    completingIssueId = issueId;
    renderTabBody();
}
function cancelCompleteForm() {
    completingIssueId = null;
    renderTabBody();
}

// Workflow: complete job with evidence (before/after) + remarks, logs to history, frees up technician
async function completeJob(e, issueId) {
    e.preventDefault();
    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;

    const beforePhoto = document.getElementById('complete-before').value;
    const afterPhoto = document.getElementById('complete-after').value;
    const remarks = document.getElementById('complete-remarks').value;

    const [r1, r2] = await Promise.all([
        supabaseClient.from('issues').update({ status: 'Completed' }).eq('id', issueId),
        supabaseClient.from('history').insert([{
            asset_id: issue.asset_id, issue_id: issue.id, technician: issue.technician,
            remarks, before_photo: beforePhoto, after_photo: afterPhoto
        }]),
    ]);
    if (r1.error || r2.error) { showToast('Could not complete job.', 'error'); return; }

    const tech = technicians.find(t => t.name === issue.technician);
    if (tech) {
        await supabaseClient.from('technicians').update({ active_jobs: Math.max(0, (tech.active_jobs || 0) - 1) }).eq('id', tech.id);
    }

    showToast('Job marked complete — history logged.');
    completingIssueId = null;
    bootstrapApplication();
}

// Preventive maintenance signal, derived from real repair history — no dummy thresholds shown until data exists
function preventiveMaintenance(assetId) {
    const repairs = history.filter(h => h.asset_id === assetId);
    if (repairs.length >= 5) return { label: 'Replace Asset', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', count: repairs.length };
    if (repairs.length >= 3) return { label: 'Schedule Maintenance', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', count: repairs.length };
    return { label: 'Asset Healthy', color: '#10B981', bg: 'rgba(16,185,129,0.12)', count: repairs.length };
}

/* ============================================================
   Visual Compiler Engine & Interface Injectors
   ============================================================ */
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
    document.documentElement.setAttribute('data-theme', currentTheme);
    renderAppStructure();
}

function renderAuthView() {
    const root = document.getElementById("app");
    root.innerHTML = `
        <div class="auth-container">
            <div class="auth-title">MAINTAINIQ</div>
            <div class="auth-subtitle">Operational Core Management Framework</div>
            
            <div class="auth-tabs">
                <button class="auth-tab-btn ${authMode === 'login' ? 'active' : ''}" id="tab-login">Sign In</button>
                <button class="auth-tab-btn ${authMode === 'signup' ? 'active' : ''}" id="tab-signup">Register</button>
            </div>
            
            <input type="email" placeholder="Work Identity Email" id="auth-email" class="input-box">
            <input type="password" placeholder="Account Password" id="auth-password" class="input-box">
            
            <button class="action-btn" id="auth-submit-btn" style="width: 100%; justify-content: center; margin-top: 10px;">
                ${authMode === 'login' ? 'Access Account Panel' : 'Initialize Account'}
            </button>
        </div>
    `;

    document.getElementById("tab-login").onclick = () => { authMode = "login"; renderAuthView(); };
    document.getElementById("tab-signup").onclick = () => { authMode = "signup"; renderAuthView(); };
    document.getElementById("auth-submit-btn").onclick = () => {
        const email = document.getElementById("auth-email").value;
        const pass = document.getElementById("auth-password").value;
        if (authMode === 'login') handleSignIn(email, pass);
        else handleSignUp(email, pass);
    };
}

function renderAppStructure() {
    const root = document.getElementById("app");
    const openCount = issues.filter(i => i.status === 'Open').length;
    root.innerHTML = `
        <aside class="sidebar">
            <div class="brand-logo">⚡ MaintainIQ Pro</div>
            <button class="nav-link ${activeTab === 'dashboard' ? 'active' : ''}" onclick="switchTab('dashboard')">▦ Overview Matrix</button>
            <button class="nav-link ${activeTab === 'assets' ? 'active' : ''}" onclick="switchTab('assets')">▤ Asset Inventory</button>
            <button class="nav-link ${activeTab === 'issues' ? 'active' : ''}" onclick="switchTab('issues')">⚠ Fault Tickets ${openCount > 0 ? `<span style="margin-left:auto; font-size:11px; opacity:.8;">${openCount} open</span>` : ''}</button>
            <button class="nav-link ${activeTab === 'technicians' ? 'active' : ''}" onclick="switchTab('technicians')">◎ Technicians</button>
            <button class="nav-link ${activeTab === 'history' ? 'active' : ''}" onclick="switchTab('history')">↺ Maintenance History</button>
            <div style="margin-top: auto; padding-top: 24px; border-top: 1px solid var(--border)">
                <button class="nav-link" id="logout-btn" style="color: #F87171;">➔ Terminate Session</button>
            </div>
        </aside>
        <main class="main-content" id="view-port"></main>
    `;

    document.getElementById("logout-btn").onclick = handleSignOut;
    renderTabBody();
}

function switchTab(tabName) {
    activeTab = tabName;
    completingIssueId = null;
    renderAppStructure();
    const vp = document.getElementById("view-port");
    if (vp) {
        vp.style.opacity = "0";
        vp.style.transform = "translateY(12px)";
        setTimeout(() => {
            vp.style.transition = "all 0.35s cubic-bezier(0.165, 0.84, 0.44, 1)";
            vp.style.opacity = "1";
            vp.style.transform = "translateY(0)";
        }, 30);
    }
}

/* ---- shared status/priority pill helpers ---- */
function statusPillHTML(status) {
    const map = {
        'Open': { c: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
        'Assigned': { c: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
        'In Progress': { c: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
        'Completed': { c: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    };
    const s = map[status] || map['Open'];
    return `<span class="status-pill" style="background:${s.bg}; color:${s.c};">${status}</span>`;
}
function priorityPillHTML(p) {
    const map = {
        High: { c: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
        Medium: { c: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
        Low: { c: 'var(--primary)', bg: 'rgba(99,102,241,0.1)' },
    };
    const s = map[p] || map.Low;
    return `<span class="status-pill" style="background:${s.bg}; color:${s.c};">${p}</span>`;
}

/* ---- one issue ticket row, with contextual triage / workflow action ---- */
function issueRowHTML(issue) {
    const asset = assets.find(a => a.id === issue.asset_id);
    let actionHTML = '';
    if (issue.status === 'Open') {
        actionHTML = `<button class="action-btn secondary" style="padding:8px 16px; font-size:12px;" onclick="autoAssign('${issue.id}')">Auto-assign</button>`;
    } else if (issue.status === 'Assigned') {
        actionHTML = `<button class="action-btn secondary" style="padding:8px 16px; font-size:12px;" onclick="acceptJob('${issue.id}')">Accept job</button>`;
    } else if (issue.status === 'In Progress') {
        actionHTML = `<button class="action-btn" style="padding:8px 16px; font-size:12px;" onclick="openCompleteForm('${issue.id}')">Complete job</button>`;
    } else {
        actionHTML = `<span style="color:#10B981; font-weight:700; font-size:18px;">✔</span>`;
    }

    let body = `
        <div class="glass-card" style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                <div style="flex:1; min-width:220px;">
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:6px;">
                        <span style="font-family:'JetBrains Mono'; font-size:11px; color:var(--text-muted);">${issue.id}</span>
                        ${priorityPillHTML(issue.priority)}
                        ${statusPillHTML(issue.status)}
                    </div>
                    <div style="font-weight:700; font-size:15px;">${issue.title}</div>
                    <div style="color:var(--text-muted); font-size:13px; margin-top:4px;">${issue.description || ''}</div>
                    <div style="color:var(--text-muted); font-size:12px; margin-top:8px;">
                        ${asset ? asset.name : issue.asset_id} · ${issue.technician ? `Tech: <strong style="color:var(--text)">${issue.technician}</strong>` : 'Unassigned'}
                    </div>
                </div>
                <div>${actionHTML}</div>
            </div>
    `;

    if (completingIssueId === issue.id) {
        body += `
            <form id="complete-form-${issue.id}" style="margin-top:18px; padding-top:18px; border-top:1px solid var(--border);">
                <h4 style="margin:0 0 14px 0; font-size:14px;">Log Evidence & Close Job</h4>
                <input type="text" id="complete-before" placeholder="Before photo (filename or URL)" class="input-box">
                <input type="text" id="complete-after" placeholder="After photo (filename or URL)" class="input-box">
                <textarea id="complete-remarks" placeholder="What was actually done to resolve this?" class="input-box" style="height:80px; font-family:inherit; resize:none;" required></textarea>
                <div style="display:flex; gap:10px;">
                    <button type="submit" class="action-btn" style="flex:1; justify-content:center;">Mark Completed</button>
                    <button type="button" class="action-btn secondary" onclick="cancelCompleteForm()">Cancel</button>
                </div>
            </form>
        `;
    }

    body += `</div>`;
    return body;
}

function renderTabBody() {
    const viewport = document.getElementById("view-port");

    const titles = {
        dashboard: 'System Overview', assets: 'Asset Control', issues: 'Fault Operations',
        technicians: 'Technician Roster', history: 'Maintenance History'
    };
    const headerHTML = `
        <div class="header-section">
            <div>
                <h1 style="margin: 0; font-weight: 800; font-size: 32px; letter-spacing: -0.5px;">
                    ${titles[activeTab]}
                </h1>
                <p style="margin: 6px 0 0 0; color: var(--text-muted); font-size: 14px;">Identity Pool: ${currentUser.email}</p>
            </div>
            <div class="top-utils">
                <button class="theme-toggle" onclick="toggleTheme()">${currentTheme === 'light' ? '🌙 Dark Grid' : '☀️ Light Grid'}</button>
            </div>
        </div>
    `;

    if (activeTab === "dashboard") {
        const openIssues = issues.filter(i => i.status !== 'Completed');
        viewport.innerHTML = `
            ${headerHTML}
            <div class="stat-card-grid">
                <div class="glass-card">
                    <span class="status-pill">Operational</span>
                    <h2 style="font-size: 36px; margin: 16px 0 8px 0; font-weight: 800;">${assets.length}</h2>
                    <p style="color:var(--text-muted); margin:0; font-size: 14px;">Total Inventory Records</p>
                </div>
                <div class="glass-card">
                    <span class="status-pill" style="background:rgba(239,68,68,0.1); color:#EF4444;">Active Breaches</span>
                    <h2 style="font-size: 36px; margin: 16px 0 8px 0; font-weight: 800;">${openIssues.length}</h2>
                    <p style="color:var(--text-muted); margin:0; font-size: 14px;">Unresolved Incidents</p>
                </div>
                <div class="glass-card">
                    <span class="status-pill" style="background:rgba(16,185,129,0.1); color:#10B981;">Nodes Online</span>
                    <h2 style="font-size: 36px; margin: 16px 0 8px 0; font-weight: 800;">${technicians.length}</h2>
                    <p style="color:var(--text-muted); margin:0; font-size: 14px;">Active Handlers</p>
                </div>
                <div class="glass-card">
                    <span class="status-pill" style="background:rgba(99,102,241,0.1); color:var(--primary);">Logged</span>
                    <h2 style="font-size: 36px; margin: 16px 0 8px 0; font-weight: 800;">${history.length}</h2>
                    <p style="color:var(--text-muted); margin:0; font-size: 14px;">Completed Work Orders</p>
                </div>
            </div>

            <h3 style="font-weight:700; font-size:16px; margin-bottom:14px;">Needs Triage</h3>
            ${openIssues.length === 0
                ? `<div class="glass-card" style="text-align:center; color:var(--text-muted);">Nothing open — every ticket is resolved.</div>`
                : openIssues.map(issueRowHTML).join('')
            }
        `;
    }
    else if (activeTab === "assets") {
        viewport.innerHTML = `
            ${headerHTML}
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:32px; align-items:start;">
                <form class="glass-card" id="asset-form">
                    <h3 style="margin-top:0; margin-bottom:20px;">Onboard New Node Asset</h3>
                    <input type="text" id="asset-id" placeholder="Unique Serial Identifier (e.g. AST-99)" class="input-box" required>
                    <input type="text" id="asset-name" placeholder="Asset Nomenclature / Description" class="input-box" required>
                    <input type="text" id="asset-location" placeholder="Deployment Location (Room / Zone)" class="input-box" required>
                    <input type="text" id="asset-dept" placeholder="Assigned Control Department" class="input-box" required>
                    <button type="submit" class="action-btn" style="width:100%; justify-content:center;">Commit Entry</button>
                </form>
                <div class="glass-card">
                    <h3 style="margin-top:0; margin-bottom:16px;">Registered Assets (${assets.length})</h3>
                    ${assets.length === 0
                ? `<p style="color:var(--text-muted); font-size:14px;">No assets yet — add one on the left.</p>`
                : assets.map(a => {
                    const rec = preventiveMaintenance(a.id);
                    const openCount = issues.filter(i => i.asset_id === a.id && i.status !== 'Completed').length;
                    return `
                            <div style="padding:12px 0; border-bottom:1px solid var(--border);">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <div style="font-weight:700; font-size:14px;">${a.name}</div>
                                        <div style="color:var(--text-muted); font-size:12px;">${a.location} · ${a.department}${openCount > 0 ? ` · ${openCount} open` : ''}</div>
                                    </div>
                                    <span class="status-pill" style="font-family:'JetBrains Mono';">${a.id}</span>
                                </div>
                                <div style="margin-top:8px;">
                                    <span class="status-pill" style="background:${rec.bg}; color:${rec.color};">${rec.label}</span>
                                </div>
                            </div>
                        `;
                }).join('')
            }
                </div>
            </div>
        `;
        document.getElementById('asset-form').onsubmit = createAsset;
    }
    else if (activeTab === "issues") {
        viewport.innerHTML = `
            ${headerHTML}
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:32px; align-items:start;">
                <form class="glass-card" id="issue-form" style="position:sticky; top:24px;">
                    <h3 style="margin-top:0; margin-bottom:20px;">Initialize Breakdown Ticket</h3>
                    <select id="issue-asset" class="input-box" style="background-color: var(--panel-solid);" required>
                        <option value="">Select Defective Asset</option>
                        ${assets.map(a => `<option value="${a.id}">${a.id} - ${a.name}</option>`).join('')}
                    </select>
                    <input type="text" id="issue-title" placeholder="Incident Title/Anomalies" class="input-box" required>
                    <select id="issue-priority" class="input-box" style="background-color: var(--panel-solid);">
                        <option value="Low">Low Priority Tier</option>
                        <option value="Medium" selected>Medium Priority Tier</option>
                        <option value="High">High Priority Critical Tier</option>
                    </select>
                    <textarea id="issue-desc" placeholder="Incident detailed error signatures or diagnostics context..." class="input-box" style="height:100px; font-family:inherit; resize:none;" required></textarea>
                    <button type="submit" class="action-btn" style="width:100%; justify-content:center;">Broadcast Alert</button>
                </form>
                <div>
                    ${issues.length === 0
                ? `<div class="glass-card" style="color:var(--text-muted); text-align:center;">No tickets yet — raise one on the left.</div>`
                : issues.slice().reverse().map(issueRowHTML).join('')
            }
                </div>
            </div>
        `;
        document.getElementById('issue-form').onsubmit = createIssue;
        if (completingIssueId) {
            const f = document.getElementById(`complete-form-${completingIssueId}`);
            if (f) f.onsubmit = (e) => completeJob(e, completingIssueId);
        }
    }
    else if (activeTab === "technicians") {
        const maxJobs = Math.max(3, ...technicians.map(t => t.active_jobs || 0));
        viewport.innerHTML = `
            ${headerHTML}
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:32px; align-items:start;">
                <form class="glass-card" id="tech-form">
                    <h3 style="margin-top:0; margin-bottom:20px;">Onboard Technician</h3>
                    <input type="text" id="tech-name" placeholder="Technician full name" class="input-box" required>
                    <input type="text" id="tech-dept" placeholder="Department (must match asset department)" class="input-box" required>
                    <button type="submit" class="action-btn" style="width:100%; justify-content:center;">Add to Roster</button>
                </form>
                <div class="glass-card">
                    <h3 style="margin-top:0; margin-bottom:16px;">Roster (${technicians.length})</h3>
                    ${technicians.length === 0
                ? `<p style="color:var(--text-muted); font-size:14px;">No technicians yet — add one on the left.</p>`
                : technicians.map(t => `
                            <div style="padding:12px 0; border-bottom:1px solid var(--border);">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <div style="font-weight:700; font-size:14px;">${t.name}</div>
                                        <div style="color:var(--text-muted); font-size:12px;">${t.department}</div>
                                    </div>
                                    <span style="font-family:'JetBrains Mono'; font-size:12px; color:var(--text-muted);">${t.active_jobs || 0} active</span>
                                </div>
                                <div style="background:var(--panel-hover); border-radius:20px; height:6px; margin-top:8px; overflow:hidden;">
                                    <div style="height:100%; background:var(--primary-gradient); width:${Math.min(100, ((t.active_jobs || 0) / maxJobs) * 100)}%;"></div>
                                </div>
                            </div>
                        `).join('')
            }
                </div>
            </div>
        `;
        document.getElementById('tech-form').onsubmit = addTechnician;
    }
    else if (activeTab === "history") {
        const list = history.filter(h => h.asset_id === historyAssetId)
            .slice()
            .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
        const rec = historyAssetId ? preventiveMaintenance(historyAssetId) : null;

        viewport.innerHTML = `
            ${headerHTML}
            ${assets.length === 0 ? `<div class="glass-card" style="color:var(--text-muted); text-align:center;">Add an asset first to see its maintenance history.</div>` : `
            <div class="glass-card" style="max-width:360px; margin-bottom:24px;">
                <label style="display:block; font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">SELECT ASSET</label>
                <select id="history-asset-select" class="input-box" style="margin-bottom:0; background-color:var(--panel-solid);">
                    ${assets.map(a => `<option value="${a.id}" ${a.id === historyAssetId ? 'selected' : ''}>${a.name} — ${a.location}</option>`).join('')}
                </select>
            </div>

            ${rec ? `
            <div class="glass-card" style="border-left:4px solid ${rec.color}; margin-bottom:24px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:800; font-size:18px; color:${rec.color};">${rec.label}</div>
                        <div style="color:var(--text-muted); font-size:13px; margin-top:4px;">${rec.count} recorded repair${rec.count === 1 ? '' : 's'} on file for this asset</div>
                    </div>
                    <span class="status-pill" style="background:${rec.bg}; color:${rec.color}; font-size:13px;">Preventive Signal</span>
                </div>
            </div>
            ` : ''}

            ${list.length === 0
                    ? `<div class="glass-card" style="color:var(--text-muted); text-align:center;">No completed work orders logged for this asset yet.</div>`
                    : list.map(h => `
                    <div class="glass-card" style="margin-bottom:14px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                            <div>
                                <span style="font-family:'JetBrains Mono'; font-size:11px; color:var(--text-muted);">${h.issue_id}</span>
                                <div style="font-size:14px; margin-top:6px;">${h.remarks || ''}</div>
                            </div>
                            <div style="text-align:right; color:var(--text-muted); font-size:12px;">
                                <div><strong style="color:var(--text)">${h.technician || 'Unassigned'}</strong></div>
                                <div>${h.completed_at ? new Date(h.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</div>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; margin-top:12px;">
                            <span class="status-pill" style="font-family:'JetBrains Mono'; font-size:11px;">📷 ${h.before_photo || 'no before evidence'}</span>
                            <span class="status-pill" style="font-family:'JetBrains Mono'; font-size:11px;">📷 ${h.after_photo || 'no after evidence'}</span>
                        </div>
                    </div>
                `).join('')
                }
            `}
        `;
        const sel = document.getElementById('history-asset-select');
        if (sel) sel.onchange = (e) => { historyAssetId = e.target.value; renderTabBody(); };
    }
}