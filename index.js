/* ============================================================
   Supabase Config Credentials & Clients Initialization
   ============================================================ */
const SUPABASE_URL = "https://juouxgqrabirdjdiveht.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BV6eD7BhN8nNO8dSV6a3Lg_U2xsqNlu";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Pipeline Engine
let currentUser = null;
let currentTheme = localStorage.getItem('theme') || 'dark';
let activeTab = "dashboard";
let authMode = "login";
let isLandingView = true;
let isLoading = false;

let assets = [], issues = [], technicians = [], history = [];
let completingIssueId = null;
let historyAssetId = null;
let departmentChartInstance = null;
let workloadChartInstance = null;

// Sync Theme State Attributes
document.documentElement.setAttribute('data-theme', currentTheme);

/* ============================================================
   Dynamic Component Style Helpers (Tailwind Utility Mappers)
   ============================================================ */
function getPanelClass() {
    return currentTheme === 'dark'
        ? 'bg-slate-900/65 border-white/10 text-slate-100'
        : 'bg-white/70 border-black/5 text-slate-900';
}

function getInputClass() {
    return currentTheme === 'dark'
        ? 'w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-800/50 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition mb-4 text-sm'
        : 'w-full px-4 py-3 rounded-xl border border-black/10 bg-slate-100 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition mb-4 text-sm';
}

function getBtnPrimary() {
    return 'px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 active:scale-95 transition shadow-lg shadow-indigo-500/20 inline-flex items-center justify-center gap-2 text-sm';
}

function getBtnSecondary() {
    return currentTheme === 'dark'
        ? 'px-6 py-3 rounded-xl font-semibold bg-slate-800/80 border border-white/10 hover:bg-slate-800 text-white transition text-sm inline-flex items-center justify-center'
        : 'px-6 py-3 rounded-xl font-semibold bg-slate-200 border border-black/5 hover:bg-slate-300 text-slate-900 transition text-sm inline-flex items-center justify-center';
}

function getMutedText() {
    return currentTheme === 'dark' ? 'text-slate-400' : 'text-slate-500';
}

/* ============================================================
   Notification Toasts System (Tailwind Component)
   ============================================================ */
function showToast(message, type = 'success') {
    const existing = document.getElementById('miq-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'miq-toast';

    const bgColor = type === 'success' ? 'bg-emerald-500' : 'bg-rose-500';
    const icon = type === 'success' ? '🚀' : '⚠️';

    toast.className = `fixed top-6 right-6 px-6 py-4 rounded-2xl ${bgColor} text-white font-bold shadow-2xl z-[99999] flex items-center gap-3 transform -translate-y-4 opacity-0 transition-all duration-300 ease-out`;
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('-translate-y-4', 'opacity-0');
    }, 50);

    setTimeout(() => {
        toast.classList.add('-translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/* ============================================================
   Authentication Framework Operations
   ============================================================ */
async function handleSignUp(email, password) {
    const btn = document.getElementById("auth-submit-btn");
    btn.innerText = "Provisioning Core Matrix...";
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) { showToast(error.message, 'error'); btn.innerText = "Initialize Core System"; return; }
    showToast("Registration Complete! Verify email pipeline.", 'success');
    authMode = "login";
    renderMainView();
}

async function handleSignIn(email, password) {
    const btn = document.getElementById("auth-submit-btn");
    btn.innerText = "Verifying Credentials...";
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { showToast(error.message, 'error'); btn.innerText = "Secure Authentication"; return; }
    currentUser = data.user;
    isLandingView = false;
    showToast("Secure Handshake Established!", 'success');
    bootstrapApplication();
}

async function handleSignOut() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    isLandingView = true;
    showToast("Session Context Purged.", 'success');
    renderMainView();
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUser = session.user;
        isLandingView = false;
        bootstrapApplication();
    } else {
        renderMainView();
    }
});

/* ============================================================
   Data Pipeline & Synchronization Engines
   ============================================================ */
async function bootstrapApplication() {
    isLoading = true;
    renderMainView();

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

        isLoading = false;
        renderMainView();
        if (activeTab === "dashboard") renderCharts();
    } catch (err) {
        isLoading = false;
        showToast("Telemetry network synchronization failure.", 'error');
    }
}

// Mutations Logic (Assets, Technicians, Incident Tickets)
async function createAsset(e) {
    e.preventDefault();
    const id = document.getElementById('asset-id').value;
    const name = document.getElementById('asset-name').value;
    const location = document.getElementById('asset-location').value;
    const department = document.getElementById('asset-dept').value;

    const { error } = await supabaseClient.from('assets').insert([{ id, name, location, department }]);
    if (error) { showToast(error.message, 'error'); return; }
    showToast("Node config asset successfully cataloged!");
    bootstrapApplication();
}

async function createIssue(e) {
    e.preventDefault();
    const id = "TK-" + Math.floor(1000 + Math.random() * 9000);
    const asset_id = document.getElementById('issue-asset').value;
    const title = document.getElementById('issue-title').value;
    const priority = document.getElementById('issue-priority').value;
    const description = document.getElementById('issue-desc').value;

    const { error } = await supabaseClient.from('issues').insert([{ id, asset_id, title, priority, description, status: 'Open' }]);
    if (error) { showToast(error.message, 'error'); return; }

    const asset = assets.find(a => a.id === asset_id);
    if (asset) {
        await supabaseClient.from('assets').update({ total_issues: (asset.total_issues || 0) + 1 }).eq('id', asset_id);
    }

    showToast("Incident operational request broadcasted!");
    bootstrapApplication();
}

async function addTechnician(e) {
    e.preventDefault();
    const id = "TECH-" + Date.now().toString().slice(-6);
    const name = document.getElementById('tech-name').value;
    const department = document.getElementById('tech-dept').value;

    const { error } = await supabaseClient.from('technicians').insert([{ id, name, department, active_jobs: 0 }]);
    if (error) { showToast(error.message, 'error'); return; }
    showToast("Technician profile safely routed to operational array!");
    bootstrapApplication();
}

async function autoAssign(issueId) {
    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;
    const asset = assets.find(a => a.id === issue.asset_id);
    if (!asset) return;

    const available = technicians
        .filter(t => t.department === asset.department)
        .sort((a, b) => (a.active_jobs || 0) - (b.active_jobs || 0));

    if (available.length === 0) {
        showToast(`No technical handlers assigned to ${asset.department} vectors.`, 'error');
        return;
    }
    const chosen = available[0];

    const [r1, r2] = await Promise.all([
        supabaseClient.from('issues').update({ technician: chosen.name, status: 'Assigned' }).eq('id', issueId),
        supabaseClient.from('technicians').update({ active_jobs: (chosen.active_jobs || 0) + 1 }).eq('id', chosen.id),
    ]);
    if (r1.error || r2.error) { showToast('Pipeline automation failure.', 'error'); return; }
    showToast(`Work ticket automatically routed to handler: ${chosen.name}.`);
    bootstrapApplication();
}

async function acceptJob(issueId) {
    const { error } = await supabaseClient.from('issues').update({ status: 'In Progress' }).eq('id', issueId);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Work schedule pipeline set to Active.');
    bootstrapApplication();
}

function openCompleteForm(issueId) { completingIssueId = issueId; renderTabBody(); }
function cancelCompleteForm() { completingIssueId = null; renderTabBody(); }

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
    if (r1.error || r2.error) { showToast('Telemetry close error.', 'error'); return; }

    const tech = technicians.find(t => t.name === issue.technician);
    if (tech) {
        await supabaseClient.from('technicians').update({ active_jobs: Math.max(0, (tech.active_jobs || 0) - 1) }).eq('id', tech.id);
    }

    showToast('Incident safely archived as resolved.');
    completingIssueId = null;
    bootstrapApplication();
}

function preventiveMaintenance(assetId) {
    const repairs = history.filter(h => h.asset_id === assetId);
    if (repairs.length >= 5) return { label: 'Replace Framework Node', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
    if (repairs.length >= 3) return { label: 'Heavy Diagnostic Recommended', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
    return { label: 'Node Status Nominally Perfect', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
}

/* ============================================================
   Tailwind Visual Blueprint Compiler View Switchers
   ============================================================ */
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
    }
    renderMainView();
    if (!isLandingView && !isLoading && activeTab === "dashboard") renderCharts();
}

function renderMainView() {
    const root = document.getElementById("app");
    const themeTextClass = currentTheme === 'dark' ? 'text-white' : 'text-slate-900';

    // Route A: Render Enterprise SaaS Landing Page View
    if (isLandingView && !currentUser) {
        root.innerHTML = `
            <div class="w-full ${themeTextClass}">
                <header class="max-w-7xl mx-auto flex justify-between items-center px-6 py-6">
                    <div class="font-extrabold text-2xl text-gradient">🛠 MaintainIQ</div>
                    <button class="${getBtnSecondary()}" onclick="scrollToAuth()">Access Operations Station</button>
                </header>

                <!-- Hero Matrix Section -->
                <section class="max-w-4xl mx-auto text-center px-6 pt-24 pb-16">
                    <div class="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider mb-6">
                        ⚡ Enterprise Asset Automation Control Array
                    </div>
                    <h1 class="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
                        Next-Gen Asset Command Infrastructure <br><span class="text-gradient">Engineered For Scale</span>
                    </h1>
                    <p class="text-base md:text-xl ${getMutedText()} max-w-2xl mx-auto mb-10 leading-relaxed">
                        Control node layouts, manage live breakout arrays, auto-route tasks to optimized engineering pools, and maintain clean asset state maps using high fidelity Supabase integration.
                    </p>
                    <div class="flex gap-4 justify-center">
                        <button class="${getBtnPrimary()}" onclick="scrollToAuth()">Initialize Cluster Framework</button>
                        <a href="#features" class="${getBtnSecondary()}">System Layout Specifications</a>
                    </div>
                </section>

                <!-- Features Matrix Section -->
                <section id="features" class="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 px-6 py-16">
                    <div class="p-8 rounded-3xl border ${getPanelClass()}">
                        <div class="text-3xl mb-4">📊</div>
                        <h3 class="text-lg font-bold mb-2">High-Fidelity Telemetry</h3>
                        <p class="${getMutedText()} text-sm leading-relaxed">Visualize asset performance layout arrays and vector distribution dynamics instantly with integrated multi-layered models.</p>
                    </div>
                    <div class="p-8 rounded-3xl border ${getPanelClass()}">
                        <div class="text-3xl mb-4">⚡</div>
                        <h3 class="text-lg font-bold mb-2">Automated Optimization Pools</h3>
                        <p class="${getMutedText()} text-sm leading-relaxed">Dynamic balancing pipelines systematically push failure assignments directly to available specialists based on running workload ratios.</p>
                    </div>
                    <div class="p-8 rounded-3xl border ${getPanelClass()}">
                        <div class="text-3xl mb-4">🛡️</div>
                        <h3 class="text-lg font-bold mb-2">Unified Matrix Storage</h3>
                        <p class="${getMutedText()} text-sm leading-relaxed">Encrypted storage states with zero lifecycle delays allow precise infrastructure configurations mapping over relational tables.</p>
                    </div>
                </section>

                <!-- Authentication Workspace Core Interface -->
                <section id="auth-station" class="max-w-md mx-auto px-6 py-20">
                    <div class="p-8 rounded-3xl border shadow-2xl backdrop-blur-md ${getPanelClass()}">
                        <div class="text-center mb-8">
                            <h2 class="text-2xl font-extrabold tracking-tight text-gradient">MAINTAINIQ CENTER</h2>
                            <p class="text-xs ${getMutedText()} mt-1 uppercase tracking-wider font-semibold">Operational Security Matrix Gate</p>
                        </div>
                        
                        <div class="flex gap-1 p-1 bg-slate-800/40 border border-white/5 rounded-xl mb-6">
                            <button class="flex-1 py-2 text-xs font-bold rounded-lg transition ${authMode === 'login' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400'}" id="tab-login">Sign In Node</button>
                            <button class="flex-1 py-2 text-xs font-bold rounded-lg transition ${authMode === 'signup' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400'}" id="tab-signup">Provision Profile</button>
                        </div>
                        
                        <input type="email" placeholder="Workplace Token Mail" id="auth-email" class="${getInputClass()}">
                        <input type="password" placeholder="System Protection Access Key" id="auth-password" class="${getInputClass()}">
                        
                        <button class="${getBtnPrimary()} w-full mt-2" id="auth-submit-btn">
                            ${authMode === 'login' ? 'Validate Access Rights' : 'Initialize Root Deployment'}
                        </button>
                    </div>
                </section>
            </div>
        `;

        document.getElementById("tab-login").onclick = () => { authMode = "login"; renderMainView(); scrollToAuth(); };
        document.getElementById("tab-signup").onclick = () => { authMode = "signup"; renderMainView(); scrollToAuth(); };
        document.getElementById("auth-submit-btn").onclick = () => {
            const email = document.getElementById("auth-email").value;
            const pass = document.getElementById("auth-password").value;
            if (authMode === 'login') handleSignIn(email, pass);
            else handleSignUp(email, pass);
        };
        return;
    }

    // Route B: Render Full Operational Application Shell Dashboard
    const openCount = issues.filter(i => i.status !== 'Completed').length;
    root.innerHTML = `
        <div class="flex flex-col md:flex-row min-h-screen w-full ${themeTextClass}">
            <!-- Sidebar Navigation Array -->
            <aside class="w-full md:w-72 border-b md:border-b-0 md:border-r backdrop-blur-xl flex flex-col p-6 gap-2 ${getPanelClass()}">
                <div class="px-3 pb-6 mb-4 border-b border-white/10 flex flex-col gap-0.5">
                    <span class="text-xl font-black text-gradient">🛠 MaintainIQ</span>
                    <span class="text-[10px] font-bold uppercase tracking-widest ${getMutedText()}">Smart Asset Management</span>
                </div>
                
                <button class="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition text-left group ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}" onclick="switchTab('dashboard')">
                    <span>▦</span> Matrix Dashboard Overview
                </button>
                <button class="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition text-left group ${activeTab === 'assets' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}" onclick="switchTab('assets')">
                    <span>▤</span> Asset Configuration Array
                </button>
                <button class="w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition text-left group ${activeTab === 'issues' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}" onclick="switchTab('issues')">
                    <span class="flex items-center gap-3.5"><span>⚠</span> Failure Pipeline tickets</span>
                    ${openCount > 0 ? `<span class="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">${openCount}</span>` : ''}
                </button>
                <button class="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition text-left group ${activeTab === 'technicians' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}" onclick="switchTab('technicians')">
                    <span>◎</span> Systems Engineering Pool
                </button>
                <button class="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition text-left group ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}" onclick="switchTab('history')">
                    <span>↺</span> Resolved Telemetry Logs
                </button>
                
                <div class="mt-auto pt-6 border-t border-white/5">
                    <button class="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-bold text-sm text-rose-400 hover:bg-rose-500/10 transition text-left" id="logout-btn">
                        <span>➔</span> Exit Cluster Workspace
                    </button>
                </div>
            </aside>
            
            <!-- Context Interface Viewport Panel -->
            <main class="flex-1 p-6 md:p-12 min-w-0" id="view-port"></main>
        </div>
    `;

    document.getElementById("logout-btn").onclick = handleSignOut;
    renderTabBody();
}

function scrollToAuth() {
    const el = document.getElementById('auth-station');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function switchTab(tabName) {
    activeTab = tabName;
    completingIssueId = null;
    renderMainView();
    if (activeTab === "dashboard") renderCharts();
}

/* ============================================================
   Component State Blueprint Interface Assembler 
   ============================================================ */
function renderTabBody() {
    const viewport = document.getElementById("view-port");
    if (!viewport) return;

    // Loading Framework Injection (Skeleton Loader Layout State)
    if (isLoading) {
        viewport.innerHTML = `
            <div class="flex justify-between items-center mb-8 animate-pulse">
                <div class="h-8 w-48 bg-slate-800 rounded-lg"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="h-32 bg-slate-800 rounded-2xl border border-white/5 animate-pulse"></div>
                <div class="h-32 bg-slate-800 rounded-2xl border border-white/5 animate-pulse"></div>
                <div class="h-32 bg-slate-800 rounded-2xl border border-white/5 animate-pulse"></div>
                <div class="h-32 bg-slate-800 rounded-2xl border border-white/5 animate-pulse"></div>
            </div>
        `;
        return;
    }

    const titles = { dashboard: 'Operational Overview Dashboard', assets: 'Asset Configuration Nodes', issues: 'Failure Disruption Queue', technicians: 'Assigned Systems Engineers Pool', history: 'Archived Telemetry Logs' };

    const headerHTML = `
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-10">
            <div>
                <h1 class="text-2xl md:text-3xl font-extrabold tracking-tight">${titles[activeTab]}</h1>
                <p class="text-xs ${getMutedText()} mt-1 font-medium">Workspace Terminal Token ID: ${currentUser.email}</p>
            </div>
            <div>
                <button class="px-4 py-2 border rounded-xl text-xs font-bold transition shadow-sm ${currentTheme === 'dark' ? 'bg-slate-900 border-white/10 hover:bg-slate-800' : 'bg-white border-black/10 hover:bg-slate-50'}" onclick="toggleTheme()">
                    ${currentTheme === 'light' ? '🌙 Activation Grid: Dark' : '☀️ Activation Grid: Light'}
                </button>
            </div>
        </div>
    `;

    if (activeTab === "dashboard") {
        const openIssues = issues.filter(i => i.status !== 'Completed');
        const criticalIssues = issues.filter(i => i.priority === 'High' && i.status !== 'Completed').length;

        viewport.innerHTML = `
            ${headerHTML}
            
            <!-- Advanced KPIs Analytic Block Layer -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <div class="p-6 rounded-2xl border ${getPanelClass()} shadow-sm relative">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Total Asset Infrastructure</span>
                    <h2 class="text-3xl font-black mt-2">${assets.length}</h2>
                </div>
                <div class="p-6 rounded-2xl border ${getPanelClass()} shadow-sm relative">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-amber-500">Active Unresolved Breaches</span>
                    <h2 class="text-3xl font-black mt-2">${openIssues.length}</h2>
                </div>
                <div class="p-6 rounded-2xl border ${getPanelClass()} shadow-sm relative">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-rose-500">Critical Priority Failure Logs</span>
                    <h2 class="text-3xl font-black mt-2">${criticalIssues}</h2>
                </div>
                <div class="p-6 rounded-2xl border ${getPanelClass()} shadow-sm relative">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Successfully Cataloged Closures</span>
                    <h2 class="text-3xl font-black mt-2">${history.length}</h2>
                </div>
            </div>

            <!-- Visualization Dynamic Model Matrix (Chart.js Integration Graphs) -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
                <div class="p-6 rounded-2xl border ${getPanelClass()} shadow-sm">
                    <h3 class="font-bold text-sm mb-4 tracking-tight">Infrastructure Components Distribution Array</h3>
                    <div class="h-64 relative"><canvas id="deptChart"></canvas></div>
                </div>
                <div class="p-6 rounded-2xl border ${getPanelClass()} shadow-sm">
                    <h3 class="font-bold text-sm mb-4 tracking-tight">Active Human Resource Loading Capacity</h3>
                    <div class="h-64 relative"><canvas id="workloadChart"></canvas></div>
                </div>
            </div>

            <h3 class="font-extrabold text-base mb-4 tracking-tight">Urgent Remediation Triage Line</h3>
            <div class="flex flex-col gap-4">
                ${openIssues.length === 0
                ? `<div class="p-10 rounded-2xl border text-center ${getPanelClass()} border-dashed">
                         <div class="text-4xl mb-3">🏁</div>
                         <strong class="text-sm block">System Secured</strong>
                         <p class="${getMutedText()} text-xs mt-1">No anomalous core signals waiting in routing loops.</p>
                       </div>`
                : openIssues.map(issueRowHTML).join('')
            }
            </div>
        `;
    }
    else if (activeTab === "assets") {
        viewport.innerHTML = `
            ${headerHTML}
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <form class="lg:col-span-5 p-6 rounded-2xl border ${getPanelClass()}" id="asset-form">
                    <h3 class="font-bold text-base mb-6">Catalog New Architecture Node</h3>
                    <input type="text" id="asset-id" placeholder="Unique Asset Vector Key Code (e.g., AST-80)" class="${getInputClass()}" required>
                    <input type="text" id="asset-name" placeholder="Descriptive Naming Mapping" class="${getInputClass()}" required>
                    <input type="text" id="asset-location" placeholder="Deployment Coordination Base" class="${getInputClass()}" required>
                    <input type="text" id="asset-dept" placeholder="Assigned Logistics Center" class="${getInputClass()}" required>
                    <button type="submit" class="${getBtnPrimary()} w-full">Inject Configuration Entry</button>
                </form>
                
                <div class="lg:col-span-7 p-6 rounded-2xl border ${getPanelClass()}">
                    <h3 class="font-bold text-base mb-4">Functional Registry Logs</h3>
                    <div class="flex flex-col divide-y divide-white/5">
                        ${assets.length === 0
                ? `<div class="text-center py-12 px-4 ${getMutedText()}">
                                 <div class="text-4xl mb-4">📭</div>
                                 <p class="font-bold text-sm">No inventory assets found.</p>
                                 <p class="text-xs mt-1">Add a hardware/software array node mapping to populate the layout.</p>
                               </div>`
                : assets.map(a => {
                    const rec = preventiveMaintenance(a.id);
                    return `
                                    <div class="py-4 flex justify-between items-center gap-4">
                                        <div>
                                            <div class="font-bold text-sm">${a.name}</div>
                                            <div class="text-xs ${getMutedText()} mt-0.5">${a.location} · <span class="underline">${a.department}</span></div>
                                            <div class="mt-2"><span class="px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${rec.color}">${rec.label}</span></div>
                                        </div>
                                        <span class="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">${a.id}</span>
                                    </div>
                                `;
                }).join('')
            }
                    </div>
                </div>
            </div>
        `;
        document.getElementById('asset-form').onsubmit = createAsset;
    }
    else if (activeTab === "issues") {
        viewport.innerHTML = `
            ${headerHTML}
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <form class="lg:col-span-5 p-6 rounded-2xl border ${getPanelClass()}" id="issue-form">
                    <h3 class="font-bold text-base mb-6">Initialize Failure Incident</h3>
                    <select id="issue-asset" class="${getInputClass()} bg-slate-900" required>
                        <option value="" class="text-slate-400">Identify Defective Structural Target</option>
                        ${assets.map(a => `<option value="${a.id}" class="text-white">${a.id} - ${a.name}</option>`).join('')}
                    </select>
                    <input type="text" id="issue-title" placeholder="Anomalous Action Summary Title" class="${getInputClass()}" required>
                    <select id="issue-priority" class="${getInputClass()} bg-slate-900">
                        <option value="Low" class="text-white">Low System Severity Profile</option>
                        <option value="Medium" selected class="text-white">Standard Functional Threat Status</option>
                        <option value="High" class="text-white">High Critical Systems Threat Vector</option>
                    </select>
                    <textarea id="issue-desc" placeholder="Provide raw crash indicators or diagnostic metrics notes..." class="${getInputClass()} h-24 resize-none" required></textarea>
                    <button type="submit" class="${getBtnPrimary()} w-full">Broadcast Fault Metrics</button>
                </form>
                
                <div class="lg:col-span-7 flex flex-col gap-4">
                    ${issues.length === 0
                ? `<div class="p-8 rounded-2xl border border-dashed text-center ${getMutedText()} ${getPanelClass()}">No failure logs reported across clusters.</div>`
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
        viewport.innerHTML = `
            ${headerHTML}
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <form class="lg:col-span-5 p-6 rounded-2xl border ${getPanelClass()}" id="tech-form">
                    <h3 class="font-bold text-base mb-6">Commission Engineer To Array</h3>
                    <input type="text" id="tech-name" placeholder="Full Engineering Practitioner Name" class="${getInputClass()}" required>
                    <input type="text" id="tech-dept" placeholder="Core System Mastery Department" class="${getInputClass()}" required>
                    <button type="submit" class="${getBtnPrimary()} w-full">Register Operational Authorization</button>
                </form>
                
                <div class="lg:col-span-7 p-6 rounded-2xl border ${getPanelClass()}">
                    <h3 class="font-bold text-base mb-4">Active Core Field Engineers</h3>
                    <div class="flex flex-col divide-y divide-white/5">
                        ${technicians.length === 0
                ? `<p class="text-center py-8 text-sm ${getMutedText()}">No engineering telemetry tracking currently registered.</p>`
                : technicians.map(t => `
                                <div class="py-4 flex justify-between items-center gap-4">
                                    <div>
                                        <div class="font-bold text-sm">${t.name}</div>
                                        <div class="text-xs ${getMutedText()} mt-0.5">Assigned Target Range: <span class="text-indigo-400 font-semibold">${t.department}</span></div>
                                    </div>
                                    <span class="px-3 py-1 rounded-full text-xs font-bold font-mono ${t.active_jobs > 2 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-300'}">${t.active_jobs || 0} active nodes</span>
                                </div>
                            `).join('')
            }
                    </div>
                </div>
            </div>
        `;
        document.getElementById('tech-form').onsubmit = addTechnician;
    }
    else if (activeTab === "history") {
        const list = history.filter(h => h.asset_id === historyAssetId);
        viewport.innerHTML = `
            ${headerHTML}
            <div class="p-6 rounded-2xl border mb-6 ${getPanelClass()} max-w-md">
                <label class="block text-[10px] font-bold ${getMutedText()} uppercase tracking-widest mb-2">Select Diagnostic Telemetry Vector</label>
                <select id="history-asset-select" class="${getInputClass()} bg-slate-900 mb-0">
                    <option value="" class="text-slate-400">Filter Component Node Array...</option>
                    ${assets.map(a => `<option value="${a.id}" ${a.id === historyAssetId ? 'selected' : ''} class="text-white">${a.name} [ID Tag: ${a.id}]</option>`).join('')}
                </select>
            </div>
            
            <div class="flex flex-col gap-4">
                ${list.length === 0
                ? `<div class="p-8 border border-dashed rounded-2xl text-center text-sm ${getMutedText()} ${getPanelClass()}">No closed telemetry verification profiles logged for selected vector.</div>`
                : list.map(h => `
                        <div class="p-6 rounded-2xl border shadow-sm ${getPanelClass()}">
                            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                                <div>
                                    <span class="px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-slate-800 text-slate-400 border border-white/5">${h.issue_id}</span>
                                    <div class="mt-3 font-bold text-sm text-slate-100">${h.remarks}</div>
                                </div>
                                <div class="text-right text-xs ${getMutedText()} sm:border-l sm:border-white/5 sm:pl-4">
                                    <div>Sign-off Handler: <strong class="text-indigo-400 font-bold">${h.technician}</strong></div>
                                </div>
                            </div>
                        </div>
                    `).join('')
            }
            </div>
        `;
        const sel = document.getElementById('history-asset-select');
        if (sel) sel.onchange = (e) => { historyAssetId = e.target.value; renderTabBody(); };
    }
}

/* ============================================================
   Chart JS Analytical Configuration Multi Models
   ============================================================ */
function renderCharts() {
    const ctxDept = document.getElementById('deptChart');
    const ctxWorkload = document.getElementById('workloadChart');
    if (!ctxDept || !ctxWorkload) return;

    const labelColor = currentTheme === 'dark' ? '#F8FAFC' : '#0F172A';

    const depts = {};
    assets.forEach(a => { depts[a.department] = (depts[a.department] || 0) + 1; });

    if (departmentChartInstance) departmentChartInstance.destroy();
    departmentChartInstance = new Chart(ctxDept, {
        type: 'doughnut',
        data: {
            labels: Object.keys(depts),
            datasets: [{
                data: Object.values(depts),
                backgroundColor: ['#6366F1', '#a855f7', '#ec4899', '#10B981', '#F59E0B'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: labelColor, font: { family: 'Plus Jakarta Sans', weight: 'bold' } } } } }
    });

    const techNames = technicians.map(t => t.name);
    const techLoads = technicians.map(t => t.active_jobs || 0);

    if (workloadChartInstance) workloadChartInstance.destroy();
    workloadChartInstance = new Chart(ctxWorkload, {
        type: 'bar',
        data: {
            labels: techNames.length ? techNames : ["No Technicians Allocated"],
            datasets: [{
                data: techLoads.length ? techLoads : [0],
                backgroundColor: 'rgba(99, 102, 241, 0.85)',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: labelColor }, grid: { color: 'rgba(255,255,255,0.04)' } },
                x: { ticks: { color: labelColor }, grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function issueRowHTML(issue) {
    let actionHTML = '';
    if (issue.status === 'Open') actionHTML = `<button class="${getBtnSecondary()} !py-2 !px-4" onclick="autoAssign('${issue.id}')">Auto-assign Route</button>`;
    else if (issue.status === 'Assigned') actionHTML = `<button class="${getBtnSecondary()} !py-2 !px-4" onclick="acceptJob('${issue.id}')">Accept Task State</button>`;
    else if (issue.status === 'In Progress') actionHTML = `<button class="${getBtnPrimary()} !py-2 !px-4" onclick="openCompleteForm('${issue.id}')">Compile Sign-off</button>`;
    else actionHTML = `<span class="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">✔ Telemetry Closed</span>`;

    return `
        <div class="p-6 rounded-2xl border transition shadow-sm ${getPanelClass()}">
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <span class="font-mono text-xs ${getMutedText()}">${issue.id}</span>
                    <div class="font-black text-base mt-1">${issue.title}</div>
                    <div class="text-xs ${getMutedText()} mt-1">Lifecycle Matrix: <span class="text-indigo-400 font-bold">${issue.status}</span> · Operator Pool: <span class="text-slate-200 font-semibold">${issue.technician || 'Pending Routing'}</span></div>
                </div>
                <div class="flex sm:justify-end">${actionHTML}</div>
            </div>
            ${completingIssueId === issue.id ? `
                <form id="complete-form-${issue.id}" class="mt-6 pt-6 border-t border-white/5">
                    <h4 class="text-xs font-bold uppercase tracking-widest mb-3 text-indigo-400">Log Resolution Signature Parameters</h4>
                    <input type="text" id="complete-before" placeholder="Before Image Telemetry Link Source" class="${getInputClass()}">
                    <input type="text" id="complete-after" placeholder="After Image Telemetry Link Source" class="${getInputClass()}">
                    <textarea id="complete-remarks" placeholder="Provide descriptive technical deployment documentation logs..." class="${getInputClass()} h-20 resize-none" required></textarea>
                    <div class="flex gap-3">
                        <button type="submit" class="${getBtnPrimary()}">Commit Signature</button>
                        <button type="button" class="${getBtnSecondary()}" onclick="cancelCompleteForm()">Abort Action</button>
                    </div>
                </form>
            ` : ''}
        </div>
    `;
}

// Initial Bootstrap Process
renderMainView();