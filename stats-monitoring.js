/*──────────────────────────────────────────────────────────────
  TypingMind – Token Usage Stats & Cost Tracker V1.1
──────────────────────────────────────────────────────────────*/
if (window.typingMindStatsExtension) {
  console.log("Stats Extension already loaded");
} else {
  window.typingMindStatsExtension = true;

  /* ============================================================
     BUDGET MANAGER
  ============================================================ */
  class BudgetManager {
    constructor(statsManager) {
      this.statsManager = statsManager;
      this.config = this.loadConfig();
      this.alertsShown = this.loadAlertsShown();
      this.sendButtonBlocked = false;
      this.enterKeyBlocked = false;
    }

    loadConfig() {
      try {
        const stored = localStorage.getItem('TM_budgetConfig');
        const defaults = {
          enabled: false,
          daily: { enabled: false, amount: 0 },
          weekly: { enabled: false, amount: 0 },
          monthly: { enabled: false, amount: 0 },
          blockOnExceed: true,
          lastReset: {
            daily: new Date().toISOString().split('T')[0],
            weekly: this.getWeekKey(),
            monthly: this.getMonthKey()
          }
        };
        return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
      } catch {
        return {
          enabled: false,
          daily: { enabled: false, amount: 0 },
          weekly: { enabled: false, amount: 0 },
          monthly: { enabled: false, amount: 0 },
          blockOnExceed: true,
          lastReset: {
            daily: new Date().toISOString().split('T')[0],
            weekly: this.getWeekKey(),
            monthly: this.getMonthKey()
          }
        };
      }
    }

    loadAlertsShown() {
      try {
        const stored = localStorage.getItem('TM_budgetAlertsShown');
        return stored ? JSON.parse(stored) : { daily: [], weekly: [], monthly: [] };
      } catch {
        return { daily: [], weekly: [], monthly: [] };
      }
    }

    saveConfig() {
      localStorage.setItem('TM_budgetConfig', JSON.stringify(this.config));
    }

    saveAlertsShown() {
      localStorage.setItem('TM_budgetAlertsShown', JSON.stringify(this.alertsShown));
    }

    getWeekKey() {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const weekNumber = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      return `${now.getFullYear()}-W${weekNumber}`;
    }

    getMonthKey() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    checkAndResetPeriods() {
      const today = new Date().toISOString().split('T')[0];
      const thisWeek = this.getWeekKey();
      const thisMonth = this.getMonthKey();

      let needsSave = false;

      if (this.config.lastReset.daily !== today) {
        this.config.lastReset.daily = today;
        this.alertsShown.daily = [];
        needsSave = true;
      }

      if (this.config.lastReset.weekly !== thisWeek) {
        this.config.lastReset.weekly = thisWeek;
        this.alertsShown.weekly = [];
        needsSave = true;
      }

      if (this.config.lastReset.monthly !== thisMonth) {
        this.config.lastReset.monthly = thisMonth;
        this.alertsShown.monthly = [];
        needsSave = true;
      }

      if (needsSave) {
        this.saveConfig();
        this.saveAlertsShown();
      }
    }

    getCurrentSpending() {
      this.checkAndResetPeriods();

      const todayStats = this.statsManager.getTodayStats();
      const weekStats = this.getWeekStats();
      const monthStats = this.statsManager.getMonthStats();

      return {
        daily: todayStats.totalCost,
        weekly: weekStats.totalCost,
        monthly: monthStats.totalCost
      };
    }

    getWeekStats() {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);

      let totalCost = 0;
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        const dayStats = this.statsManager.statsData.daily[dateKey];
        if (dayStats) {
          totalCost += dayStats.totalCost;
        }
      }

      return { totalCost };
    }

    getBudgetStatus() {
      if (!this.config.enabled) return null;

      const spending = this.getCurrentSpending();
      const statuses = [];

      if (this.config.daily.enabled && this.config.daily.amount > 0) {
        const percentage = (spending.daily / this.config.daily.amount) * 100;
        statuses.push({
          period: 'daily',
          label: 'Daily',
          spent: spending.daily,
          budget: this.config.daily.amount,
          percentage: percentage,
          exceeded: percentage >= 100
        });
      }

      if (this.config.weekly.enabled && this.config.weekly.amount > 0) {
        const percentage = (spending.weekly / this.config.weekly.amount) * 100;
        statuses.push({
          period: 'weekly',
          label: 'Weekly',
          spent: spending.weekly,
          budget: this.config.weekly.amount,
          percentage: percentage,
          exceeded: percentage >= 100
        });
      }

      if (this.config.monthly.enabled && this.config.monthly.amount > 0) {
        const percentage = (spending.monthly / this.config.monthly.amount) * 100;
        statuses.push({
          period: 'monthly',
          label: 'Monthly',
          spent: spending.monthly,
          budget: this.config.monthly.amount,
          percentage: percentage,
          exceeded: percentage >= 100
        });
      }

      return statuses.length > 0 ? statuses : null;
    }

    shouldBlockSending() {
      const statuses = this.getBudgetStatus();
      if (!statuses) return { blocked: false };

      const exceeded = statuses.find(s => s.exceeded);
      if (!exceeded) return { blocked: false };

      return {
        blocked: this.config.blockOnExceed,
        status: exceeded,
        warn: !this.config.blockOnExceed
      };
    }

    checkAlerts() {
      const statuses = this.getBudgetStatus();
      if (!statuses) return;

      statuses.forEach(status => {
        const { period, percentage } = status;
        const key75 = `${period}-75`;
        const key100 = `${period}-100`;

        if (percentage >= 75 && percentage < 100 && !this.alertsShown[period].includes(key75)) {
          this.showAlert(status, 75);
          this.alertsShown[period].push(key75);
          this.saveAlertsShown();
        }

        if (percentage >= 100 && !this.alertsShown[period].includes(key100)) {
          this.showAlert(status, 100);
          this.alertsShown[period].push(key100);
          this.saveAlertsShown();
        }
      });
    }

    showAlert(status, threshold) {
        const existing = document.querySelector('.tm-budget-alert');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.className = 'tm-budget-alert';
        banner.style.cssText = `
            position: relative;
            width: 100%;
            background: ${threshold === 100 ? '#ef4444' : '#f59e0b'};
            color: white;
            padding: 0.75rem 1rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 0.875rem;
            font-weight: 500;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            animation: slideDown 0.3s ease-out;
        `;

        banner.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                <div style="flex: 1; font-size: 0.8125rem;">
                    ${threshold === 100 ? '⚠️' : '⚡'} 
                    <strong>${status.label} budget ${threshold === 100 ? 'exceeded' : 'warning'}:</strong> 
                    $${status.spent.toFixed(2)} / $${status.budget.toFixed(2)} (${Math.round(status.percentage)}%)
                </div>
                <button style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    padding: 0.375rem 0.75rem;
                    border-radius: 0.25rem;
                    cursor: pointer;
                    font-size: 0.75rem;
                    white-space: nowrap;
                    flex-shrink: 0;
                ">✕</button>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideDown {
                from { opacity: 0; max-height: 0; }
                to { opacity: 1; max-height: 100px; }
            }
            @media (max-width: 640px) {
                .tm-budget-alert {
                    font-size: 0.75rem !important;
                    padding: 0.625rem 0.75rem !important;
                }
            }
        `;
        if (!document.querySelector('style[data-tm-budget-alert]')) {
            style.setAttribute('data-tm-budget-alert', 'true');
            document.head.appendChild(style);
        }

        document.body.insertBefore(banner, document.body.firstChild);

        const dismissBtn = banner.querySelector('button');
        const dismiss = () => {
            banner.style.animation = 'slideDown 0.3s ease-out reverse';
            setTimeout(() => banner.remove(), 300);
        };

        dismissBtn.addEventListener('click', dismiss);
        setTimeout(() => {
            if (banner.parentNode) dismiss();
        }, 15000);
    }

    injectChatProgressBar() {
        const existing = document.querySelector('.tm-budget-progress-bar');
        if (existing) existing.remove();

        const statuses = this.getBudgetStatus();
        if (!statuses || statuses.length === 0) return;

        const worstStatus = statuses.reduce((worst, current) => {
            return current.percentage > (worst?.percentage || 0) ? current : worst;
        }, null);

        if (!worstStatus) return;

        const chatTitle = document.querySelector('[data-element-id="current-chat-title"]');
        if (!chatTitle) return;

        const percentage = Math.min(worstStatus.percentage, 100);
        let color = '#10b981';
        if (percentage >= 100) color = '#ef4444';
        else if (percentage >= 75) color = '#f59e0b';

        const progressBar = document.createElement('div');
        progressBar.className = 'tm-budget-progress-bar';
        progressBar.style.cssText = `
            display: flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.25rem 0.625rem;
            background: rgba(0, 0, 0, 0.05);
            border-radius: 9999px;
            font-size: 0.6875rem;
            font-weight: 500;
            margin-right: 0.5rem;
        `;

        progressBar.innerHTML = `
            <div style="
                position: relative;
                width: 50px;
                height: 6px;
                background: rgba(0, 0, 0, 0.1);
                border-radius: 9999px;
                overflow: hidden;
            ">
                <div style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    width: ${percentage}%;
                    background: ${color};
                    border-radius: 9999px;
                    transition: width 0.3s ease, background 0.3s ease;
                "></div>
            </div>
            <span style="color: ${color}; white-space: nowrap;">
                $${worstStatus.spent.toFixed(2)}/$${worstStatus.budget.toFixed(2)}
            </span>
        `;

        const buttonsContainer = chatTitle.querySelector('div.flex.items-center');
        
        if (buttonsContainer) {
            buttonsContainer.insertBefore(progressBar, buttonsContainer.firstChild);
        } else {
            chatTitle.insertBefore(progressBar, chatTitle.firstChild);
        }
    }

    injectChatBanner() {
      const existing = document.querySelector('.tm-budget-chat-banner');
      if (existing) existing.remove();

      const statuses = this.getBudgetStatus();
      if (!statuses || statuses.length === 0) return;

      const worstStatus = statuses.reduce((worst, current) => {
        return current.percentage > (worst?.percentage || 0) ? current : worst;
      }, null);

      if (!worstStatus || worstStatus.percentage < 75) return;

      const chatTitle = document.querySelector('[data-element-id="current-chat-title"]');
      if (!chatTitle) return;

      const banner = document.createElement('div');
      banner.className = 'tm-budget-chat-banner';
      const color = worstStatus.percentage >= 100 ? '#ef4444' : '#f59e0b';
      
      banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: ${color};
        color: white;
        padding: 0.5rem 1rem;
        text-align: center;
        font-size: 0.875rem;
        font-weight: 500;
        z-index: 1000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;

      banner.innerHTML = `
        ${worstStatus.percentage >= 100 ? '⚠️' : '⚡'} 
        ${worstStatus.label} budget: $${worstStatus.spent.toFixed(2)} / $${worstStatus.budget.toFixed(2)} 
        (${Math.round(worstStatus.percentage)}%)
      `;

      document.body.appendChild(banner);
      document.body.style.paddingTop = banner.offsetHeight + 'px';
    }

    blockSendButton() {
        const sendButton = document.querySelector('button[data-element-id="send-button"]');
        
        if (!sendButton) return;
        
        const blockStatus = this.shouldBlockSending();
        
        if (blockStatus.blocked) {
            sendButton.disabled = true;
            sendButton.style.opacity = '0.5';
            sendButton.style.cursor = 'not-allowed';
            sendButton.setAttribute('data-tooltip-content', `Budget exceeded! ${blockStatus.status.label} limit: $${blockStatus.status.budget.toFixed(2)}`);
            
            if (!this.enterKeyBlocked) {
                this.blockEnterKey();
                this.enterKeyBlocked = true;
            }
            
            if (!sendButton._budgetClickHandler) {
                const clickHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleBlockedClick();
                };
                sendButton.addEventListener('click', clickHandler, true);
                sendButton._budgetClickHandler = clickHandler;
            }
            
        } else {
            sendButton.disabled = false;
            sendButton.style.opacity = '1';
            sendButton.style.cursor = 'pointer';
            sendButton.removeAttribute('data-tooltip-content');
            
            if (this.enterKeyBlocked) {
                this.unblockEnterKey();
                this.enterKeyBlocked = false;
            }
            
            if (sendButton._budgetClickHandler) {
                sendButton.removeEventListener('click', sendButton._budgetClickHandler, true);
                delete sendButton._budgetClickHandler;
            }
        }
    }

    blockEnterKey() {
      if (this.enterKeyHandler) return;
      
      this.enterKeyHandler = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          const blockStatus = this.shouldBlockSending();
          if (blockStatus.blocked) {
            e.preventDefault();
            e.stopPropagation();
            this.handleBlockedClick();
          }
        }
      };
      
      document.addEventListener('keydown', this.enterKeyHandler, true);
    }

    unblockEnterKey() {
      if (this.enterKeyHandler) {
        document.removeEventListener('keydown', this.enterKeyHandler, true);
        this.enterKeyHandler = null;
      }
    }

    handleBlockedClick() {
      const blockStatus = this.shouldBlockSending();
      if (!blockStatus.blocked) return;

      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        padding: 1rem;
      `;

      modal.innerHTML = `
        <div style="
          background: #27272a;
          color: white;
          padding: 1.5rem;
          border-radius: 1rem;
          max-width: 400px;
          width: 100%;
          text-align: center;
        ">
          <div style="font-size: 2.5rem; margin-bottom: 1rem;">⚠️</div>
                    <h3 style="font-size: 1.25rem; font-weight: bold; margin-bottom: 0.75rem;">Budget Exceeded</h3>
          <p style="color: #a1a1aa; margin-bottom: 1.25rem; font-size: 0.9375rem;">
            Your ${blockStatus.status.label.toLowerCase()} budget limit has been reached.<br>
            <strong style="color: white;">$${blockStatus.status.spent.toFixed(2)} / $${blockStatus.status.budget.toFixed(2)}</strong>
          </p>
          <button style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            width: 100%;
          ">OK</button>
        </div>
      `;

      document.body.appendChild(modal);

      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.tagName === 'BUTTON') {
          modal.remove();
        }
      });
    }

    startMonitoring() {
      this.checkAlerts();
      this.injectChatBanner();
      this.injectChatProgressBar();
      this.blockSendButton();
      
      this.uiInterval = setInterval(() => {
        this.checkAlerts();
        this.injectChatBanner();
        this.injectChatProgressBar();
        this.blockSendButton();
      }, 2000);

      this.statsRefreshInterval = setInterval(async () => {
        if (this.config.enabled && document.hasFocus()) {
          await this.statsManager.refreshStats();
          this.injectChatProgressBar();
        }
      }, 5 * 60 * 1000); 
    }

    setupSendButtonObserver() {
        const observer = new MutationObserver(() => {
            this.blockSendButton();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'class', 'style']
        });

        this.sendButtonObserver = observer;
        
        this.blockInterval = setInterval(() => {
            this.blockSendButton();
        }, 100);
    }
  }
  
  /* ============================================================
     STATS MANAGER - OPTIMISÉ
  ============================================================ */
  class StatsManager {
    constructor() {
      this.customModels = this.loadCustomModels();
      this.statsData = this.loadStatsData();
      this.debugMode = this.isDebugMode();
      this.lastFullRefresh = 0;
      this.isAnalyzing = false;
    }

    async refreshStats() {
      if (this.isAnalyzing) {
        console.log('⏳ Analysis already in progress, skipping...');
        return;
      }

      const now = Date.now();
      const timeSinceLastRefresh = now - this.lastFullRefresh;
      
      if (timeSinceLastRefresh > 10 * 60 * 1000) {
        console.log('🔄 Full refresh (10+ minutes since last)...');
        await this.analyzeAllChats();
        this.lastFullRefresh = now;
      } else {
        console.log('🔄 Quick refresh (recent chats only)...');
        await this.analyzeRecentChats();
      }
    }

    async analyzeRecentChats() {
      if (this.isAnalyzing) return;
      this.isAnalyzing = true;

      try {
        const idb = await this.getIndexedDB();
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const recentChats = await this.getRecentChats(idb, fiveMinutesAgo);
        
        console.log(`📊 Quick analyzing ${recentChats.length} recent chats...`);
        
        for (const chat of recentChats) {
          this.processChat(chat);
        }

        this.saveStatsData();
        console.log('✅ Quick refresh complete');
      } catch (error) {
        console.error('❌ Quick refresh failed:', error);
      } finally {
        this.isAnalyzing = false;
      }
    }

    async getRecentChats(idb, sinceTimestamp) {
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(['keyval'], 'readonly');
        const store = tx.objectStore('keyval');
        const recentChats = [];

        store.openCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) {
            resolve(recentChats);
            return;
          }

          const key = cursor.key;
          if (typeof key === 'string' && key.startsWith('CHAT_')) {
            const chat = cursor.value;
            const chatTimestamp = new Date(chat.updatedAt || chat.createdAt).getTime();
            
            if (chatTimestamp > sinceTimestamp) {
              recentChats.push(chat);
            }
          }
          cursor.continue();
        };

        store.openCursor().onerror = reject;
      });
    }

    isDebugMode() {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.has('statsdebug') || urlParams.get('statsdebug') === 'true';
    }

    loadCustomModels() {
      try {
        const stored = localStorage.getItem('TM_useCustomModels');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }

    loadStatsData() {
      try {
        const stored = localStorage.getItem('TM_tokenUsageStats');
        const defaults = { 
          daily: {}, 
          models: {},
          lastAnalyzed: {}, 
          version: 2 
        };
        const data = stored ? JSON.parse(stored) : defaults;
        
        if (!data.version || data.version < 2) {
          console.log('📦 Migrating stats data to v2...');
          data.lastAnalyzed = {};
          data.version = 2;
        }
        
        return data;
      } catch {
        return { daily: {}, models: {}, lastAnalyzed: {}, version: 2 };
      }
    }

    saveStatsData() {
      try {
        localStorage.setItem('TM_tokenUsageStats', JSON.stringify(this.statsData));
      } catch (e) {
        console.error('Failed to save stats:', e);
      }
    }

    normalizeModelId(modelId) {
      if (!modelId) return 'unknown';
      return modelId.split(':')[0];
    }

    getModelPricing(modelId, modelTitle) {
      const normalizedId = this.normalizeModelId(modelId);
      
      const customModel = this.customModels.find(m => {
        const mId = this.normalizeModelId(m.modelID || m.id);
        return mId === normalizedId || m.title?.trim() === modelTitle;
      });
      
      if (customModel?.pricePerMillionTokens) {
        return customModel.pricePerMillionTokens;
      }

      const defaultPrices = {
        'gpt-4o': { prompt: 2.5, completion: 10 },
        'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
        'gpt-4-turbo': { prompt: 10, completion: 30 },
        'gpt-4': { prompt: 30, completion: 60 },
        'gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
        'claude-3-opus': { prompt: 15, completion: 75 },
        'claude-3-sonnet': { prompt: 3, completion: 15 },
        'claude-3-haiku': { prompt: 0.25, completion: 1.25 },
        'claude-3-5-sonnet': { prompt: 3, completion: 15 },
        'claude-3-5-haiku': { prompt: 0.8, completion: 4 },
        'claude-3-7-sonnet': { prompt: 3, completion: 15 },
        'claude-sonnet-3.7': { prompt: 3, completion: 15 },
        'claude-sonnet-4.5': { prompt: 3, completion: 15 },
        'claude-haiku-4.5': { prompt: 0.25, completion: 1.25 },
        'gemini-1.5-pro': { prompt: 1.25, completion: 5 },
        'gemini-1.5-flash': { prompt: 0.075, completion: 0.3 },
        'gemini-2.0-flash': { prompt: 0.15, completion: 0.6 },
        'gemini-2.5-flash': { prompt: 0.3, completion: 2.5 },
        'gemini-2.5-pro': { prompt: 1.25, completion: 10 },
        'deepseek-v3.2': { prompt: 0.14, completion: 0.28 },
        'o3': { prompt: 15, completion: 60 },
      };

      for (const [key, price] of Object.entries(defaultPrices)) {
        if (normalizedId?.toLowerCase().includes(key) || modelTitle?.toLowerCase().includes(key)) {
          return price;
        }
      }

      return null;
    }

    async analyzeAllChats() {
      if (this.isAnalyzing) {
        console.log('⏳ Analysis already in progress...');
        return this.statsData;
      }

      this.isAnalyzing = true;
      
      try {
        const idb = await this.getIndexedDB();
        const chats = await this.getAllChats(idb);
        
        console.log(`📊 Analyzing ${chats.length} chats with smart caching...`);
        
        let analyzed = 0;
        let skipped = 0;
        
        for (let i = 0; i < chats.length; i += 20) {
          const batch = chats.slice(i, i + 20);
          
          for (const chat of batch) {
            const chatLastModified = new Date(chat.updatedAt || chat.createdAt).getTime();
            const lastAnalyzed = this.statsData.lastAnalyzed[chat.id] || 0;
            
            if (chatLastModified <= lastAnalyzed && this.statsData.version === 2) {
              skipped++;
              continue;
            }
            
            this.processChat(chat);
            this.statsData.lastAnalyzed[chat.id] = Date.now();
            analyzed++;
          }
          
          if (i % 100 === 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
            console.log(`📊 Progress: ${i}/${chats.length} chats processed...`);
          }
          
          if (i % 200 === 0 && i > 0) {
            this.saveStatsData();
          }
        }

        this.saveStatsData();
        console.log(`✅ Analysis complete: ${analyzed} analyzed, ${skipped} skipped (cached)`);
        
        if (this.debugMode) {
          console.log('🐛 DEBUG: Model stats:', this.statsData.models);
        }
        
        return this.statsData;
      } catch (error) {
        console.error('❌ Analysis failed:', error);
        return this.statsData;
      } finally {
        this.isAnalyzing = false;
      }
    }

    processChat(chat) {
      const messages = chat.messages || [];
      
      for (const msg of messages) {
        if (!msg.usage) continue;

        const msgModelId = msg.model || chat.model || 'unknown';
        
        const customModel = this.customModels.find(m => m.id === msgModelId);
        let actualModelId = msgModelId;
        let modelTitle = chat.modelInfo?.title || msgModelId;
        
        if (customModel) {
          actualModelId = customModel.modelID || msgModelId;
          modelTitle = customModel.title || modelTitle;
        }
        
        const normalizedId = this.normalizeModelId(actualModelId);
        const uniqueKey = `${modelTitle.toLowerCase()}|||${normalizedId}`;

        const promptTokens = msg.usage.prompt_tokens || 0;
        const completionTokens = msg.usage.completion_tokens || 0;
        const totalTokens = msg.usage.total_tokens || (promptTokens + completionTokens);

        const pricing = this.getModelPricing(normalizedId, modelTitle);
        let cost = 0;
        
        if (pricing) {
          cost = (promptTokens / 1000000 * pricing.prompt) + 
                 (completionTokens / 1000000 * pricing.completion);
        }

        const date = msg.createdAt ? new Date(msg.createdAt) : new Date(chat.createdAt);
        const dateKey = date.toISOString().split('T')[0];

        if (!this.statsData.daily[dateKey]) {
          this.statsData.daily[dateKey] = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            totalCost: 0,
            messages: 0
          };
        }

        this.statsData.daily[dateKey].promptTokens += promptTokens;
        this.statsData.daily[dateKey].completionTokens += completionTokens;
        this.statsData.daily[dateKey].totalTokens += totalTokens;
        this.statsData.daily[dateKey].totalCost += cost;
        this.statsData.daily[dateKey].messages += 1;

        if (!this.statsData.models[uniqueKey]) {
          this.statsData.models[uniqueKey] = {
            title: modelTitle,
            customModelIds: [msgModelId],
            modelId: normalizedId,
            actualModelId: actualModelId,
            rawModelIds: [msgModelId],
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            totalCost: 0,
            messages: 0,
            pricing: pricing
          };
        } else {
          if (!this.statsData.models[uniqueKey].customModelIds.includes(msgModelId)) {
            this.statsData.models[uniqueKey].customModelIds.push(msgModelId);
          }
          if (!this.statsData.models[uniqueKey].rawModelIds.includes(msgModelId)) {
            this.statsData.models[uniqueKey].rawModelIds.push(msgModelId);
          }
          
          if (!this.statsData.models[uniqueKey].pricing && pricing) {
            this.statsData.models[uniqueKey].pricing = pricing;
          }
        }

        this.statsData.models[uniqueKey].promptTokens += promptTokens;
        this.statsData.models[uniqueKey].completionTokens += completionTokens;
        this.statsData.models[uniqueKey].totalTokens += totalTokens;
        this.statsData.models[uniqueKey].totalCost += cost;
        this.statsData.models[uniqueKey].messages += 1;
      }
    }

    async getAllChats(idb) {
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(['keyval'], 'readonly');
        const store = tx.objectStore('keyval');
        const chats = [];

        store.openCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) {
            resolve(chats);
            return;
          }

          const key = cursor.key;
          if (typeof key === 'string' && key.startsWith('CHAT_')) {
            chats.push(cursor.value);
          }
          cursor.continue();
        };

        store.openCursor().onerror = reject;
      });
    }

    async getIndexedDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('keyval-store', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      });
    }

    getTodayStats() {
      const today = new Date().toISOString().split('T')[0];
      return this.statsData.daily[today] || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        messages: 0
      };
    }

    getMonthStats() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const monthPrefix = `${year}-${month}`;

      const stats = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        messages: 0,
        days: 0
      };

      Object.keys(this.statsData.daily).forEach(dateKey => {
        if (dateKey.startsWith(monthPrefix)) {
          const dayStats = this.statsData.daily[dateKey];
          stats.promptTokens += dayStats.promptTokens;
          stats.completionTokens += dayStats.completionTokens;
          stats.totalTokens += dayStats.totalTokens;
          stats.totalCost += dayStats.totalCost;
          stats.messages += dayStats.messages;
          stats.days += 1;
        }
      });

      return stats;
    }

    getMonthPrediction() {
      const monthStats = this.getMonthStats();
      const now = new Date();
      const currentDay = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      if (monthStats.days === 0) {
        return {
          predictedTokens: 0,
          predictedCost: 0,
          predictedMessages: 0,
          confidence: 0
        };
      }

      const avgPerDay = {
        tokens: monthStats.totalTokens / monthStats.days,
        cost: monthStats.totalCost / monthStats.days,
        messages: monthStats.messages / monthStats.days
      };

      const remainingDays = daysInMonth - currentDay;

      return {
        predictedTokens: Math.round(monthStats.totalTokens + (avgPerDay.tokens * remainingDays)),
        predictedCost: monthStats.totalCost + (avgPerDay.cost * remainingDays),
        predictedMessages: Math.round(monthStats.messages + (avgPerDay.messages * remainingDays)),
        confidence: Math.min(100, (monthStats.days / daysInMonth) * 100)
      };
    }

    getLast30DaysData() {
      const data = [];
      const today = new Date();
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        
        const dayStats = this.statsData.daily[dateKey] || {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          totalCost: 0,
          messages: 0
        };

        data.push({
          date: dateKey,
          ...dayStats
        });
      }

      return data;
    }

    getAllDailyData() {
      return Object.keys(this.statsData.daily)
        .sort((a, b) => b.localeCompare(a))
        .map(dateKey => ({
          date: dateKey,
          ...this.statsData.daily[dateKey]
        }));
    }

    getModelStats(sortBy = 'cost', sortOrder = 'desc') {
      const stats = Object.entries(this.statsData.models)
        .map(([key, stats]) => ({
          uniqueKey: key,
          ...stats,
          avgCostPer1M: stats.totalTokens > 0 ? (stats.totalCost / stats.totalTokens * 1000000) : 0
        }));

      const compare = (a, b, field) => {
        let valA, valB;
        
        if (field === 'name') {
          valA = a.title.toLowerCase();
          valB = b.title.toLowerCase();
          return sortOrder === 'asc' 
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        
        const fieldMap = {
          'messages': 'messages',
          'tokens': 'totalTokens',
          'cost': 'totalCost',
          'avgCost': 'avgCostPer1M'
        };
        
        valA = a[fieldMap[field]] || 0;
        valB = b[fieldMap[field]] || 0;
        
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      };

      return stats.sort((a, b) => compare(a, b, sortBy));
    }
  }

  /* ============================================================
     INTERACTIVE CHART
  ============================================================ */
  class InteractiveChart {
    constructor(canvas, data, type = 'cost') {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.data = data;
      this.type = type;
      this.hoveredIndex = -1;
      this.tooltip = null;
      
      this.setupCanvas();
      this.setupTooltip();
      this.setupEvents();
      this.draw();
    }

    setupCanvas() {
      const dpr = window.devicePixelRatio || 1;
      
      const rect = this.canvas.getBoundingClientRect();
      const displayWidth = rect.width || this.canvas.clientWidth || 400;
      const displayHeight = rect.height || this.canvas.clientHeight || 200;
      
      this.canvas.width = displayWidth * dpr;
      this.canvas.height = displayHeight * dpr;
      
      this.canvas.style.width = displayWidth + 'px';
      this.canvas.style.height = displayHeight + 'px';
      
      this.ctx.scale(dpr, dpr);
      
      this.displayWidth = displayWidth;
      this.displayHeight = displayHeight;
    }

    setupTooltip() {
      this.tooltip = document.createElement('div');
      this.tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 0.5rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        pointer-events: none;
        display: none;
        z-index: 10000;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(this.tooltip);
    }

    setupEvents() {
      const handleMove = (e) => {
        const touch = e.touches ? e.touches[0] : e;
        this.handleInteraction(touch.clientX, touch.clientY);
      };

      const handleEnd = () => {
        this.hoveredIndex = -1;
        this.hideTooltip();
        this.draw();
      };

      this.canvas.addEventListener('mousemove', (e) => this.handleInteraction(e.clientX, e.clientY));
      this.canvas.addEventListener('mouseleave', handleEnd);
      this.canvas.addEventListener('touchstart', handleMove);
      this.canvas.addEventListener('touchmove', handleMove);
      this.canvas.addEventListener('touchend', handleEnd);
    }

    handleInteraction(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const padding = 40;
      const chartWidth = this.displayWidth - padding * 2;
      const barWidth = chartWidth / this.data.length;

      const index = Math.floor((x - padding) / barWidth);

      if (index >= 0 && index < this.data.length && x >= padding) {
        this.hoveredIndex = index;
        this.showTooltip(clientX, clientY, this.data[index]);
        this.draw();
      } else {
        this.hoveredIndex = -1;
        this.hideTooltip();
        this.draw();
      }
    }

    showTooltip(x, y, dayData) {
      const date = new Date(dayData.date);
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });

      let content = `<strong>${dateStr}</strong><br>`;
      
      if (this.type === 'cost') {
        content += `Cost: $${dayData.totalCost.toFixed(4)}<br>`;
        content += `Tokens: ${dayData.totalTokens.toLocaleString()}<br>`;
      } else {
        content += `Tokens: ${dayData.totalTokens.toLocaleString()}<br>`;
        content += `Cost: $${dayData.totalCost.toFixed(4)}<br>`;
      }
      
      content += `Messages: ${dayData.messages}`;

      this.tooltip.innerHTML = content;
      this.tooltip.style.display = 'block';
      
      const tooltipRect = this.tooltip.getBoundingClientRect();
      let left = x + 15;
      let top = y - 10;
      
      if (left + tooltipRect.width > window.innerWidth) {
        left = x - tooltipRect.width - 15;
      }
      
      if (top + tooltipRect.height > window.innerHeight) {
        top = y - tooltipRect.height + 10;
      }
      
      this.tooltip.style.left = `${left}px`;
      this.tooltip.style.top = `${top}px`;
    }

    hideTooltip() {
      this.tooltip.style.display = 'none';
    }

    draw() {
      const width = this.displayWidth;
      const height = this.displayHeight;

      this.ctx.fillStyle = '#27272a';
      this.ctx.fillRect(0, 0, width, height);

      if (this.data.length === 0) return;

      const maxValue = this.type === 'cost'
        ? Math.max(...this.data.map(d => d.totalCost), 0.01)
        : Math.max(...this.data.map(d => d.totalTokens), 1);

      const padding = 40;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;

      const barWidth = chartWidth / this.data.length;
      
      this.data.forEach((day, i) => {
        const value = this.type === 'cost' ? day.totalCost : day.totalTokens;
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding + i * barWidth;
        const y = height - padding - barHeight;

        const isHovered = i === this.hoveredIndex;
        const baseColor = this.type === 'cost' ? '#3b82f6' : '#10b981';
        const hoverColor = this.type === 'cost' ? '#60a5fa' : '#34d399';
        
        this.ctx.fillStyle = isHovered ? hoverColor : baseColor;
        this.ctx.fillRect(x + 2, y, barWidth - 4, barHeight);

        if (isHovered) {
          this.ctx.shadowBlur = 10;
          this.ctx.shadowColor = baseColor;
          this.ctx.fillRect(x + 2, y, barWidth - 4, barHeight);
          this.ctx.shadowBlur = 0;
        }
      });

      this.ctx.strokeStyle = '#52525b';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(padding, height - padding);
      this.ctx.lineTo(width - padding, height - padding);
      this.ctx.moveTo(padding, padding);
      this.ctx.lineTo(padding, height - padding);
      this.ctx.stroke();

      this.ctx.fillStyle = '#a1a1aa';
      this.ctx.font = '11px sans-serif';
      this.ctx.textAlign = 'right';
      
      if (this.type === 'cost') {
        this.ctx.fillText(`$${maxValue.toFixed(2)}`, padding - 5, padding + 5);
        this.ctx.fillText('$0', padding - 5, height - padding + 5);
      } else {
        this.ctx.fillText(`${(maxValue / 1000).toFixed(0)}K`, padding - 5, padding + 5);
        this.ctx.fillText('0', padding - 5, height - padding + 5);
      }
    }

    destroy() {
      if (this.tooltip) {
        this.tooltip.remove();
      }
    }
  }

  /* ============================================================
     UI MANAGER 
  ============================================================ */
  class StatsUI {
    constructor(statsManager, budgetManager) {
      this.statsManager = statsManager;
      this.budgetManager = budgetManager;
      this.charts = [];
      this.currentHistoryPage = 1;
      this.itemsPerPage = 7;
      this.currentModelSort = 'cost';
      this.currentSortOrder = 'desc';
    }

    isMobile() {
      return window.innerWidth < 768;
    }

    showChartModal(data, type) {
      const existing = document.querySelector('.tm-chart-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.className = 'tm-chart-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 1rem;
      `;

      const title = type === 'cost' ? 'Last 30 Days - Cost' : 'Last 30 Days - Tokens';

      modal.innerHTML = `
        <div style="
          background: #27272a;
          border-radius: 1rem;
          padding: 1.5rem;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.125rem; font-weight: 600; color: white; margin: 0;">${title}</h3>
            <button id="close-chart-modal" style="
              background: #3f3f46;
              border: none;
              color: white;
              width: 2rem;
              height: 2rem;
              border-radius: 0.375rem;
              cursor: pointer;
              font-size: 1.25rem;
              display: flex;
              align-items: center;
              justify-content: center;
            ">✕</button>
          </div>
          <div style="position: relative; width: 100%; height: 300px; background: #18181b; border-radius: 0.5rem; padding: 0.5rem;">
            <canvas id="modal-chart" style="width: 100%; height: 100%; touch-action: none;"></canvas>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const canvas = modal.querySelector('#modal-chart');
      const chart = new InteractiveChart(canvas, data, type);

      const close = () => {
        chart.destroy();
        modal.remove();
      };

      modal.querySelector('#close-chart-modal').addEventListener('click', close);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
      });
    }

    async show() {
      if (document.querySelector('.tm-stats-page')) {
        return;
      }

      const page = document.createElement('div');
      page.className = 'tm-stats-page';
      page.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #18181b;
        color: #fff;
        z-index: 9999;
        overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;

      const isMobile = this.isMobile();

      page.innerHTML = `
        <style>
          .tm-stats-page * {
            box-sizing: border-box;
          }
          
          @media (max-width: 768px) {
            .tm-stats-grid {
              grid-template-columns: 1fr !important;
            }
            
            .tm-stats-charts {
              grid-template-columns: 1fr !important;
            }
            
            .tm-stats-table {
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
            }
            
            .tm-stats-table table {
              min-width: 600px;
            }
            
            .tm-stats-header {
              flex-direction: column;
              align-items: stretch !important;
              gap: 1rem;
            }
            
            .tm-stats-header-actions {
              flex-direction: column;
              width: 100%;
            }
            
            .tm-stats-header-actions button {
              width: 100%;
            }
          }
        </style>
        
        <div style="max-width: 1400px; margin: 0 auto; padding: 1rem;">
          <div class="tm-stats-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div>
              <h1 style="font-size: 1.5rem; font-weight: bold; margin: 0;">📊 Token Usage Stats</h1>
              ${this.statsManager.debugMode ? '<p style="color: #f59e0b; font-size: 0.875rem; margin-top: 0.5rem;">🐛 Debug Mode Active</p>' : ''}
            </div>
            <div class="tm-stats-header-actions" style="display: flex; gap: 0.75rem;">
              <button id="reset-stats-btn" style="
                    background:#ef4444;
                    border:none;
                    color:white;
                    padding:0.75rem 1.25rem;
                    border-radius:0.5rem;
                    cursor:pointer;
                    font-size:0.9375rem;
                    transition:background 0.2s;">
                🔄 Reset stats
              </button>
              <button id="budget-settings-btn" style="
                background: #10b981;
                border: none;
                color: white;
                padding: 0.75rem 1.25rem;
                border-radius: 0.5rem;
                cursor: pointer;
                font-size: 0.9375rem;
                transition: background 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
              ">
                <span>⚙️</span> <span>Budget</span>
              </button>
              <button id="close-stats" style="
                background: #3f3f46;
                border: none;
                color: white;
                padding: 0.75rem 1.25rem;
                border-radius: 0.5rem;
                cursor: pointer;
                font-size: 0.9375rem;
                transition: background 0.2s;
              ">Close</button>
            </div>
          </div>

          <div id="stats-loading" style="text-align: center; padding: 3rem 1rem; font-size: 1.125rem; color: #a1a1aa;">
            ⏳ Loading stats...
          </div>

          <div id="stats-content" style="display: none;">
            <!-- Budget Progress Bars -->
            <div id="budget-progress-container"></div>

            <!-- Overview Cards -->
            <div class="tm-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
              <div class="stat-card" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 1.25rem; border-radius: 0.75rem;">
                <div style="font-size: 0.8125rem; opacity: 0.9; margin-bottom: 0.375rem;">Today</div>
                <div id="today-cost" style="font-size: 1.75rem; font-weight: bold; margin-bottom: 0.375rem;">$0.00</div>
                <div id="today-tokens" style="font-size: 0.8125rem; opacity: 0.8;">0 tokens</div>
              </div>

              <div class="stat-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 1.25rem; border-radius: 0.75rem;">
                <div style="font-size: 0.8125rem; opacity: 0.9; margin-bottom: 0.375rem;">This Month</div>
                <div id="month-cost" style="font-size: 1.75rem; font-weight: bold; margin-bottom: 0.375rem;">$0.00</div>
                <div id="month-tokens" style="font-size: 0.8125rem; opacity: 0.8;">0 tokens</div>
              </div>

              <div class="stat-card" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 1.25rem; border-radius: 0.75rem;">
                <div style="font-size: 0.8125rem; opacity: 0.9; margin-bottom: 0.375rem;">Prediction</div>
                <div id="prediction-cost" style="font-size: 1.75rem; font-weight: bold; margin-bottom: 0.375rem;">$0.00</div>
                <div id="prediction-confidence" style="font-size: 0.8125rem; opacity: 0.8;">0% elapsed</div>
              </div>
            </div>

            <!-- Charts -->
            ${isMobile ? `
              <div class="tm-stats-charts" style="display: grid; grid-template-columns: 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div style="background: #27272a; border-radius: 0.75rem; padding: 1.25rem; border: 1px solid #3f3f46;">
                  <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem;">Last 30 Days - Cost</h3>
                  <button id="show-cost-chart" style="
                    width: 100%;
                    background: #3b82f6;
                    border: none;
                    color: white;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    font-size: 0.9375rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                  ">
                    📊 View Cost Chart
                  </button>
                </div>

                <div style="background: #27272a; border-radius: 0.75rem; padding: 1.25rem; border: 1px solid #3f3f46;">
                  <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem;">Last 30 Days - Tokens</h3>
                  <button id="show-tokens-chart" style="
                    width: 100%;
                    background: #10b981;
                    border: none;
                    color: white;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    font-size: 0.9375rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                  ">
                    📊 View Tokens Chart
                  </button>
                </div>
              </div>
            ` : `
              <div class="tm-stats-charts" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div style="background: #27272a; border-radius: 0.75rem; padding: 1.25rem; border: 1px solid #3f3f46;">
                  <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem;">Last 30 Days - Cost</h3>
                  <div style="position: relative; width: 100%; height: 200px;">
                    <canvas id="cost-chart" style="width: 100%; height: 100%; touch-action: none;"></canvas>
                  </div>
                </div>

                <div style="background: #27272a; border-radius: 0.75rem; padding: 1.25rem; border: 1px solid #3f3f46;">
                  <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem;">Last 30 Days - Tokens</h3>
                  <div style="position: relative; width: 100%; height: 200px;">
                    <canvas id="tokens-chart" style="width: 100%; height: 100%; touch-action: none;"></canvas>
                  </div>
                </div>
              </div>
            `}

            <!-- Models Table -->
            <div style="background: #27272a; border-radius: 0.75rem; padding: 1.25rem; border: 1px solid #3f3f46; margin-bottom: 1.5rem;">
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem;">Usage by Model</h3>
              <div class="tm-stats-table" id="models-table"></div>
            </div>

            <!-- Daily History -->
            <div style="background: #27272a; border-radius: 0.75rem; padding: 1.25rem; border: 1px solid #3f3f46;">
              <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; gap: 0.75rem;">
                <h3 style="font-size: 1.125rem; font-weight: 600; margin: 0;">Daily History</h3>
                <div id="history-pagination" style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;"></div>
              </div>
              <div class="tm-stats-table" id="daily-history"></div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(page);

      page.querySelector('#reset-stats-btn').addEventListener('click', async () => {
        if (!confirm('Reset all stats ?')) return;

        localStorage.removeItem('TM_tokenUsageStats');

        statsApp.statsManager.statsData = {
          daily: {}, models: {}, lastAnalyzed:{}, lastProcessed:{}, version:2
        };
        statsApp.statsManager.lastFullRefresh = 0;

        await statsApp.statsManager.analyzeAllChats();

        alert('✅ Stats reset.');
        page.remove();
        statsApp.ui.show();           
      });

      page.querySelector('#close-stats').addEventListener('click', () => {
        this.cleanup();
        page.remove();
      });

      page.querySelector('#budget-settings-btn').addEventListener('click', () => {
        this.showBudgetModal();
      });

      this.loadStats(page);
    }

    showBudgetModal() {
      const existing = document.querySelector('.tm-budget-modal');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.className = 'tm-budget-modal';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        padding: 1rem;
        overflow-y: auto;
      `;

      const config = this.budgetManager.config;

      overlay.innerHTML = `
        <div style="
          background: #27272a;
          color: white;
          border-radius: 1rem;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          padding: 1.5rem;
          margin: auto;
        ">
          <h2 style="font-size: 1.375rem; font-weight: bold; margin-bottom: 1.25rem;">💰 Budget Settings</h2>

          <!-- Enable Budget -->
          <div style="margin-bottom: 1.5rem; padding: 1rem; background: #3f3f46; border-radius: 0.5rem;">
            <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
              <input type="checkbox" id="budget-enabled" ${config.enabled ? 'checked' : ''} style="
                width: 1.125rem;
                height: 1.125rem;
                cursor: pointer;
              ">
              <div>
                <div style="font-weight: 600; font-size: 0.9375rem;">Enable Budget Tracking</div>
                <div style="font-size: 0.8125rem; color: #a1a1aa; margin-top: 0.25rem;">Monitor and control your API spending</div>
              </div>
            </label>
          </div>

          <!-- Budget Periods -->
          <div style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.0625rem; font-weight: 600; margin-bottom: 0.75rem;">Budget Limits</h3>

            <!-- Daily Budget -->
            <div style="margin-bottom: 1rem; padding: 1rem; background: #3f3f46; border-radius: 0.5rem;">
              <label style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; cursor: pointer;">
                <input type="checkbox" id="daily-enabled" ${config.daily.enabled ? 'checked' : ''} style="
                  width: 1rem;
                  height: 1rem;
                  cursor: pointer;
                ">
                <span style="font-weight: 600;">Daily Budget</span>
              </label>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.125rem;">$</span>
                <input type="number" id="daily-amount" value="${config.daily.amount}" min="0" step="0.01" style="
                  flex: 1;
                  padding: 0.625rem;
                  background: #27272a;
                  border: 1px solid #52525b;
                  border-radius: 0.375rem;
                  color: white;
                  font-size: 0.9375rem;
                " placeholder="0.00">
              </div>
            </div>

            <!-- Weekly Budget -->
            <div style="margin-bottom: 1rem; padding: 1rem; background: #3f3f46; border-radius: 0.5rem;">
              <label style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; cursor: pointer;">
                <input type="checkbox" id="weekly-enabled" ${config.weekly.enabled ? 'checked' : ''} style="
                  width: 1rem;
                  height: 1rem;
                  cursor: pointer;
                ">
                <span style="font-weight: 600;">Weekly Budget</span>
              </label>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.125rem;">$</span>
                <input type="number" id="weekly-amount" value="${config.weekly.amount}" min="0" step="0.01" style="
                  flex: 1;
                  padding: 0.625rem;
                  background: #27272a;
                  border: 1px solid #52525b;
                  border-radius: 0.375rem;
                  color: white;
                  font-size: 0.9375rem;
                " placeholder="0.00">
              </div>
            </div>

            <!-- Monthly Budget -->
            <div style="margin-bottom: 1rem; padding: 1rem; background: #3f3f46; border-radius: 0.5rem;">
              <label style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; cursor: pointer;">
                <input type="checkbox" id="monthly-enabled" ${config.monthly.enabled ? 'checked' : ''} style="
                  width: 1rem;
                  height: 1rem;
                  cursor: pointer;
                ">
                <span style="font-weight: 600;">Monthly Budget</span>
              </label>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.125rem;">$</span>
                <input type="number" id="monthly-amount" value="${config.monthly.amount}" min="0" step="0.01" style="
                  flex: 1;
                  padding: 0.625rem;
                  background: #27272a;
                  border: 1px solid #52525b;
                  border-radius: 0.375rem;
                  color: white;
                  font-size: 0.9375rem;
                " placeholder="0.00">
              </div>
            </div>
          </div>

          <!-- Behavior -->
          <div style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.0625rem; font-weight: 600; margin-bottom: 0.75rem;">When Budget is Exceeded</h3>
            
            <label style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.875rem; background: #3f3f46; border-radius: 0.5rem; margin-bottom: 0.5rem; cursor: pointer;">
              <input type="radio" name="budget-behavior" value="block" ${config.blockOnExceed ? 'checked' : ''} style="
                width: 1rem;
                height: 1rem;
                cursor: pointer;
                margin-top: 0.125rem;
                flex-shrink: 0;
              ">
              <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 0.9375rem;">🚫 Block Messages</div>
                <div style="font-size: 0.8125rem; color: #a1a1aa; margin-top: 0.25rem;">Prevent sending messages when budget is exceeded</div>
              </div>
            </label>

            <label style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.875rem; background: #3f3f46; border-radius: 0.5rem; cursor: pointer;">
              <input type="radio" name="budget-behavior" value="warn" ${!config.blockOnExceed ? 'checked' : ''} style="
                width: 1rem;
                height: 1rem;
                cursor: pointer;
                margin-top: 0.125rem;
                flex-shrink: 0;
              ">
              <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 0.9375rem;">⚠️ Show Warning</div>
                <div style="font-size: 0.8125rem; color: #a1a1aa; margin-top: 0.25rem;">Show a warning but allow sending messages</div>
              </div>
            </label>
          </div>

          <!-- Actions -->
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button id="save-budget" style="
              flex: 1;
              background: #10b981;
              border: none;
              color: white;
              padding: 0.875rem;
              border-radius: 0.5rem;
              cursor: pointer;
              font-size: 0.9375rem;
              font-weight: 600;
            ">Save Settings</button>
            <button id="cancel-budget" style="
              background: #3f3f46;
              border: none;
              color: white;
              padding: 0.875rem;
              border-radius: 0.5rem;
              cursor: pointer;
              font-size: 0.9375rem;
            ">Cancel</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.querySelector('#cancel-budget').addEventListener('click', () => {
        overlay.remove();
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
        }
      });

      overlay.querySelector('#save-budget').addEventListener('click', () => {
        this.saveBudgetSettings(overlay);
      });
    }

    saveBudgetSettings(modal) {
      const config = this.budgetManager.config;

      config.enabled = modal.querySelector('#budget-enabled').checked;
      
      config.daily.enabled = modal.querySelector('#daily-enabled').checked;
      config.daily.amount = parseFloat(modal.querySelector('#daily-amount').value) || 0;
      
      config.weekly.enabled = modal.querySelector('#weekly-enabled').checked;
      config.weekly.amount = parseFloat(modal.querySelector('#weekly-amount').value) || 0;
      
      config.monthly.enabled = modal.querySelector('#monthly-enabled').checked;
      config.monthly.amount = parseFloat(modal.querySelector('#monthly-amount').value) || 0;
      
      const behavior = modal.querySelector('input[name="budget-behavior"]:checked').value;
      config.blockOnExceed = behavior === 'block';

      this.budgetManager.saveConfig();
      modal.remove();

      const success = document.createElement('div');
      success.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #10b981;
        color: white;
        padding: 0.875rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10001;
        font-weight: 600;
        font-size: 0.9375rem;
      `;
      success.textContent = '✅ Budget settings saved!';
      document.body.appendChild(success);

      setTimeout(() => success.remove(), 3000);

      this.renderBudgetProgress();
      this.budgetManager.injectChatBanner();
      this.budgetManager.blockSendButton();
    }

    renderBudgetProgress() {
      const container = document.querySelector('#budget-progress-container');
      if (!container) return;

      const statuses = this.budgetManager.getBudgetStatus();
      
      if (!statuses || statuses.length === 0) {
        container.innerHTML = '';
        return;
      }

      let html = '<div style="margin-bottom: 1.5rem;">';
      
      statuses.forEach(status => {
        const percentage = Math.min(status.percentage, 100);
        let color = '#10b981';
        if (percentage >= 100) color = '#ef4444';
        else if (percentage >= 75) color = '#f59e0b';

        html += `
          <div style="background: #27272a; border-radius: 0.75rem; padding: 1.25rem; border: 1px solid #3f3f46; margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.625rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="font-weight: 600; font-size: 0.9375rem;">${status.label} Budget</div>
              <div style="font-weight: 600; color: ${color}; font-size: 0.9375rem;">
                $${status.spent.toFixed(2)} / $${status.budget.toFixed(2)}
              </div>
            </div>
            <div style="background: #3f3f46; height: 0.625rem; border-radius: 9999px; overflow: hidden;">
              <div style="
                background: ${color};
                height: 100%;
                width: ${percentage}%;
                transition: width 0.3s ease;
              "></div>
            </div>
            <div style="font-size: 0.8125rem; color: #a1a1aa; margin-top: 0.5rem;">
              ${Math.round(percentage)}% used
              ${percentage >= 100 ? ' • ⚠️ Budget exceeded!' : percentage >= 75 ? ' • ⚡ Approaching limit' : ''}
            </div>
          </div>
        `;
      });

      html += '</div>';
      container.innerHTML = html;
    }

    handleSort(sortBy, page) {
      if (this.currentModelSort === sortBy) {
        this.currentSortOrder = this.currentSortOrder === 'desc' ? 'asc' : 'desc';
      } else {
        this.currentModelSort = sortBy;
        this.currentSortOrder = 'desc';
      }

      const modelStats = this.statsManager.getModelStats(this.currentModelSort, this.currentSortOrder);
      this.populateModelsTable(page.querySelector('#models-table'), modelStats);
    }

    async loadStats(page) {
      const loadingEl = page.querySelector('#stats-loading');
      const contentEl = page.querySelector('#stats-content');
      
      loadingEl.textContent = '⏳ Loading cached data...';
      
      const todayStats = this.statsManager.getTodayStats();
      const monthStats = this.statsManager.getMonthStats();
      const prediction = this.statsManager.getMonthPrediction();
      const last30Days = this.statsManager.getLast30DaysData();
      const modelStats = this.statsManager.getModelStats(this.currentModelSort, this.currentSortOrder);
      const allDailyData = this.statsManager.getAllDailyData();

      page.querySelector('#today-cost').textContent = `$${todayStats.totalCost.toFixed(4)}`;
      page.querySelector('#today-tokens').textContent = `${todayStats.totalTokens.toLocaleString()} tokens • ${todayStats.messages} msg`;

      page.querySelector('#month-cost').textContent = `$${monthStats.totalCost.toFixed(2)}`;
      page.querySelector('#month-tokens').textContent = `${monthStats.totalTokens.toLocaleString()} tokens • ${monthStats.messages} msg`;

      page.querySelector('#prediction-cost').textContent = `$${prediction.predictedCost.toFixed(2)}`;
      page.querySelector('#prediction-confidence').textContent = `${Math.round(prediction.confidence)}% elapsed • ${prediction.predictedMessages.toLocaleString()} msg`;

      this.renderBudgetProgress();

      const isMobile = this.isMobile();

      if (isMobile) {
        const costBtn = page.querySelector('#show-cost-chart');
        const tokensBtn = page.querySelector('#show-tokens-chart');

        if (costBtn) {
          costBtn.addEventListener('click', () => {
            this.showChartModal(last30Days, 'cost');
          });
        }

        if (tokensBtn) {
          tokensBtn.addEventListener('click', () => {
            this.showChartModal(last30Days, 'tokens');
          });
        }
      } else {
        const costCanvas = page.querySelector('#cost-chart');
        const tokensCanvas = page.querySelector('#tokens-chart');
        
        if (costCanvas && tokensCanvas) {
          this.charts.push(new InteractiveChart(costCanvas, last30Days, 'cost'));
          this.charts.push(new InteractiveChart(tokensCanvas, last30Days, 'tokens'));
        }
      }

      this.populateModelsTable(page.querySelector('#models-table'), modelStats);

      this.allDailyData = allDailyData;
      this.dailyHistoryContainer = page.querySelector('#daily-history');
      this.paginationContainer = page.querySelector('#history-pagination');
      this.renderDailyHistory();

      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';

      const timeSinceLastRefresh = Date.now() - this.statsManager.lastFullRefresh;
      if (timeSinceLastRefresh > 10 * 60 * 1000) {
        loadingEl.textContent = '🔄 Updating stats in background...';
        loadingEl.style.display = 'block';
        loadingEl.style.fontSize = '0.875rem';
        loadingEl.style.padding = '1rem';
        loadingEl.style.background = '#27272a';
        loadingEl.style.borderRadius = '0.5rem';
        loadingEl.style.marginBottom = '1rem';

        await this.statsManager.analyzeAllChats();

        const updatedTodayStats = this.statsManager.getTodayStats();
        const updatedMonthStats = this.statsManager.getMonthStats();
        const updatedPrediction = this.statsManager.getMonthPrediction();
        const updatedLast30Days = this.statsManager.getLast30DaysData();
        const updatedModelStats = this.statsManager.getModelStats(this.currentModelSort, this.currentSortOrder);
        const updatedAllDailyData = this.statsManager.getAllDailyData();

        page.querySelector('#today-cost').textContent = `$${updatedTodayStats.totalCost.toFixed(4)}`;
        page.querySelector('#today-tokens').textContent = `${updatedTodayStats.totalTokens.toLocaleString()} tokens • ${updatedTodayStats.messages} msg`;

        page.querySelector('#month-cost').textContent = `$${updatedMonthStats.totalCost.toFixed(2)}`;
        page.querySelector('#month-tokens').textContent = `${updatedMonthStats.totalTokens.toLocaleString()} tokens • ${updatedMonthStats.messages} msg`;

        page.querySelector('#prediction-cost').textContent = `$${updatedPrediction.predictedCost.toFixed(2)}`;
        page.querySelector('#prediction-confidence').textContent = `${Math.round(updatedPrediction.confidence)}% elapsed • ${updatedPrediction.predictedMessages.toLocaleString()} msg`;

        this.renderBudgetProgress();

        if (!isMobile) {
          this.charts.forEach(chart => chart.destroy());
          this.charts = [];
          
          const costCanvas = page.querySelector('#cost-chart');
          const tokensCanvas = page.querySelector('#tokens-chart');
          
          if (costCanvas && tokensCanvas) {
            this.charts.push(new InteractiveChart(costCanvas, updatedLast30Days, 'cost'));
            this.charts.push(new InteractiveChart(tokensCanvas, updatedLast30Days, 'tokens'));
          }
        }

        this.populateModelsTable(page.querySelector('#models-table'), updatedModelStats);

        this.allDailyData = updatedAllDailyData;
        this.renderDailyHistory();

        loadingEl.style.display = 'none';
      }
    }

    renderDailyHistory() {
      const totalPages = Math.ceil(this.allDailyData.length / this.itemsPerPage);
      const startIndex = (this.currentHistoryPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      const pageData = this.allDailyData.slice(startIndex, endIndex);

      this.populateDailyHistory(this.dailyHistoryContainer, pageData);
      this.renderPagination(totalPages);
    }

    renderPagination(totalPages) {
      if (totalPages <= 1) {
        this.paginationContainer.innerHTML = `
          <span style="color: #a1a1aa; font-size: 0.8125rem;">
            ${this.allDailyData.length} day${this.allDailyData.length !== 1 ? 's' : ''}
          </span>
        `;
        return;
      }

      const prevDisabled = this.currentHistoryPage === 1;
      const nextDisabled = this.currentHistoryPage === totalPages;

      let html = `
        <button id="prev-page" ${prevDisabled ? 'disabled' : ''} style="
          background: ${prevDisabled ? '#3f3f46' : '#52525b'};
          border: none;
          color: ${prevDisabled ? '#71717a' : 'white'};
          padding: 0.5rem 0.875rem;
          border-radius: 0.375rem;
          cursor: ${prevDisabled ? 'not-allowed' : 'pointer'};
          font-size: 0.8125rem;
          transition: background 0.2s;
        " ${!prevDisabled ? 'onmouseover="this.style.background=\'#71717a\'" onmouseout="this.style.background=\'#52525b\'"' : ''}>
          ←
        </button>
        
        <span style="color: #a1a1aa; font-size: 0.8125rem; white-space: nowrap;">
          Week ${this.currentHistoryPage}/${totalPages}
        </span>
        
        <button id="next-page" ${nextDisabled ? 'disabled' : ''} style="
          background: ${nextDisabled ? '#3f3f46' : '#52525b'};
          border: none;
          color: ${nextDisabled ? '#71717a' : 'white'};
          padding: 0.5rem 0.875rem;
          border-radius: 0.375rem;
          cursor: ${nextDisabled ? 'not-allowed' : 'pointer'};
          font-size: 0.8125rem;
          transition: background 0.2s;
        " ${!nextDisabled ? 'onmouseover="this.style.background=\'#71717a\'" onmouseout="this.style.background=\'#52525b\'"' : ''}>
          →
        </button>
      `;

      this.paginationContainer.innerHTML = html;

      const prevBtn = this.paginationContainer.querySelector('#prev-page');
      const nextBtn = this.paginationContainer.querySelector('#next-page');

      if (prevBtn && !prevDisabled) {
        prevBtn.addEventListener('click', () => {
          this.currentHistoryPage--;
          this.renderDailyHistory();
        });
      }

      if (nextBtn && !nextDisabled) {
        nextBtn.addEventListener('click', () => {
          this.currentHistoryPage++;
          this.renderDailyHistory();
        });
      }
    }

    populateModelsTable(container, modelStats) {
      if (modelStats.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #a1a1aa; padding: 1.5rem; font-size: 0.9375rem;">No data available</p>';
        return;
      }

      const debugMode = this.statsManager.debugMode;
      const getSortIcon = (field) => {
        if (this.currentModelSort !== field) return '';
        return this.currentSortOrder === 'desc' ? ' ↓' : ' ↑';
      };

      let html = `
        <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
          <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
            <thead>
              <tr style="border-bottom: 1px solid #3f3f46;">
                <th data-sort="name" style="text-align: left; padding: 0.625rem; color: #a1a1aa; font-weight: 600; cursor: pointer; user-select: none; transition: color 0.2s; font-size: 0.8125rem;">
                  <span style="display: inline-flex; align-items: center; gap: 0.25rem;">
                    Model${getSortIcon('name')}
                  </span>
                </th>
                <th data-sort="messages" style="text-align: right; padding: 0.625rem; color: #a1a1aa; font-weight: 600; cursor: pointer; user-select: none; transition: color 0.2s; font-size: 0.8125rem;">
                  <span style="display: inline-flex; align-items: center; gap: 0.25rem; justify-content: flex-end;">
                    Msg${getSortIcon('messages')}
                  </span>
                </th>
                <th data-sort="tokens" style="text-align: right; padding: 0.625rem; color: #a1a1aa; font-weight: 600; cursor: pointer; user-select: none; transition: color 0.2s; font-size: 0.8125rem;">
                  <span style="display: inline-flex; align-items: center; gap: 0.25rem; justify-content: flex-end;">
                    Tokens${getSortIcon('tokens')}
                  </span>
                </th>
                <th data-sort="cost" style="text-align: right; padding: 0.625rem; color: #a1a1aa; font-weight: 600; cursor: pointer; user-select: none; transition: color 0.2s; font-size: 0.8125rem;">
                  <span style="display: inline-flex; align-items: center; gap: 0.25rem; justify-content: flex-end;">
                    Cost${getSortIcon('cost')}
                  </span>
                </th>
                <th data-sort="avgCost" style="text-align: right; padding: 0.625rem; color: #a1a1aa; font-weight: 600; cursor: pointer; user-select: none; transition: color 0.2s; font-size: 0.8125rem;">
                  <span style="display: inline-flex; align-items: center; gap: 0.25rem; justify-content: flex-end;">
                    $/1M${getSortIcon('avgCost')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
      `;

      modelStats.forEach(model => {
        const avgCostPer1M = model.avgCostPer1M > 0 ? model.avgCostPer1M.toFixed(2) : '—';

        const pricingInfo = model.pricing 
          ? `In: $${model.pricing.prompt} / Out: $${model.pricing.completion}`
          : 'Unknown pricing';

        const debugInfo = debugMode 
          ? `<div style="font-size: 0.6875rem; color: #f59e0b; margin-top: 0.375rem; font-family: monospace;">
              ID: ${model.modelId}<br>
              Actual: ${model.actualModelId}<br>
              Custom: ${model.customModelIds?.join(', ') || 'N/A'}
            </div>`
          : '';

        html += `
          <tr style="border-bottom: 1px solid #3f3f46;">
            <td style="padding: 0.625rem;">
              <div style="font-weight: 500; font-size: 0.875rem;">${model.title}</div>
              <div style="font-size: 0.6875rem; color: #a1a1aa; margin-top: 0.25rem;">${pricingInfo}</div>
              ${debugInfo}
            </td>
            <td style="text-align: right; padding: 0.625rem; font-size: 0.875rem;">${model.messages.toLocaleString()}</td>
            <td style="text-align: right; padding: 0.625rem;">
              <div style="font-size: 0.875rem;">${model.totalTokens.toLocaleString()}</div>
              <div style="font-size: 0.6875rem; color: #a1a1aa;">
                ${model.promptTokens.toLocaleString()} / ${model.completionTokens.toLocaleString()}
              </div>
            </td>
            <td style="text-align: right; padding: 0.625rem; font-weight: 600; color: #10b981; font-size: 0.875rem;">
              $${model.totalCost.toFixed(4)}
            </td>
            <td style="text-align: right; padding: 0.625rem; color: #a1a1aa; font-size: 0.875rem;">
              $${avgCostPer1M}
            </td>
          </tr>
        `;
      });

      html += '</tbody></table></div>';
      container.innerHTML = html;

      const currentPage = document.querySelector('.tm-stats-page');
      container.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
          th.style.color = '#fff';
          setTimeout(() => th.style.color = '#a1a1aa', 200);
          this.handleSort(th.dataset.sort, currentPage);
        });
        
        th.addEventListener('mouseenter', () => {
          th.style.color = '#fff';
        });
        
        th.addEventListener('mouseleave', () => {
          th.style.color = '#a1a1aa';
        });
      });
    }

    populateDailyHistory(container, data) {
      if (data.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #a1a1aa; padding: 1.5rem; font-size: 0.9375rem;">No data available</p>';
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      let html = `
        <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
          <table style="width: 100%; border-collapse: collapse; min-width: 500px;">
            <thead>
              <tr style="border-bottom: 1px solid #3f3f46;">
                <th style="text-align: left; padding: 0.625rem; color: #a1a1aa; font-weight: 600; font-size: 0.8125rem;">Date</th>
                <th style="text-align: right; padding: 0.625rem; color: #a1a1aa; font-weight: 600; font-size: 0.8125rem;">Msg</th>
                <th style="text-align: right; padding: 0.625rem; color: #a1a1aa; font-weight: 600; font-size: 0.8125rem;">Tokens</th>
                <th style="text-align: right; padding: 0.625rem; color: #a1a1aa; font-weight: 600; font-size: 0.8125rem;">Cost</th>
              </tr>
            </thead>
            <tbody>
      `;

      data.forEach(day => {
        const date = new Date(day.date);
        const isToday = day.date === today;
        const dateStr = isToday ? '🔵 Today' : date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        });

        html += `
          <tr style="border-bottom: 1px solid #3f3f46; ${isToday ? 'background: #1e3a8a1a;' : ''}">
            <td style="padding: 0.625rem; ${isToday ? 'font-weight: 600;' : ''} font-size: 0.875rem;">${dateStr}</td>
            <td style="text-align: right; padding: 0.625rem; font-size: 0.875rem;">${day.messages.toLocaleString()}</td>
            <td style="text-align: right; padding: 0.625rem;">
              <div style="font-size: 0.875rem;">${day.totalTokens.toLocaleString()}</div>
              <div style="font-size: 0.6875rem; color: #a1a1aa;">
                ${day.promptTokens.toLocaleString()} / ${day.completionTokens.toLocaleString()}
              </div>
            </td>
            <td style="text-align: right; padding: 0.625rem; font-weight: 600; color: #10b981; font-size: 0.875rem;">
              $${day.totalCost.toFixed(4)}
            </td>
          </tr>
        `;
      });

      html += '</tbody></table></div>';
      container.innerHTML = html;
    }

    cleanup() {
      this.charts.forEach(chart => chart.destroy());
      this.charts = [];
    }
  }

  /* ============================================================
     APP
  ============================================================ */
  class StatsApp {
    constructor() {
      this.statsManager = new StatsManager();
      this.budgetManager = new BudgetManager(this.statsManager);
      this.ui = new StatsUI(this.statsManager, this.budgetManager);
    }

    async initialize() {
      console.log('📊 Token Usage Stats Extension V1.1 loaded');
      if (this.statsManager.debugMode) {
        console.log('🐛 Debug mode enabled - add ?statsdebug to URL');
      }
      await this.waitForDOM();
      this.insertStatsButton();
      
      this.budgetManager.startMonitoring();
    }

    async waitForDOM() {
      if (document.readyState === 'loading') {
        return new Promise(r => document.addEventListener('DOMContentLoaded', r));
      }
    }

    insertStatsButton() {
      if (document.querySelector('[data-element-id="workspace-tab-stats"]')) return;

      const button = document.createElement('button');
      button.setAttribute('data-element-id', 'workspace-tab-stats');
      button.className = 'min-w-[58px] sm:min-w-0 cursor-default h-12 md:min-h-[50px] md:h-fit flex-col justify-start items-start inline-flex focus:outline-0 focus:text-white w-fit sm:w-full';
      
      button.innerHTML = `
        <span class="text-white/70 sm:hover:bg-white/20 sm:flex-1 w-full min-w-0 sm:self-stretch px-0.5 py-1.5 rounded-xl flex-col justify-start items-center gap-1.5 flex transition-colors">
          <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 14L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M6 14L6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M10 14L10 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M14 14L14 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span class="font-normal mx-auto self-stretch text-center text-xs leading-4 md:leading-none w-full md:w-[51px]">Stats</span>
        </span>
      `;

      button.addEventListener('click', () => this.ui.show());

      const syncButton = document.querySelector('button[data-element-id="workspace-tab-cloudsync"]');
      const chatButton = document.querySelector('button[data-element-id="workspace-tab-chat"]');
      
      if (syncButton?.parentNode) {
        syncButton.parentNode.insertBefore(button, syncButton.nextSibling);
      } else if (chatButton?.parentNode) {
        chatButton.parentNode.insertBefore(button, chatButton.nextSibling);
      }
    }
  }

  const app = new StatsApp();
  app.initialize();
  window.statsApp = app;
}
