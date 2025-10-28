# TypingMind Stats & Budget Manager v1.0

An advanced extension for TypingMind that provides detailed token usage statistics, cost tracking, and a powerful budget management system to help you control your AI API expenses.

> **Note:** This is an unofficial, community-made extension for TypingMind.

![Version](https://img.shields.io/badge/version-1.0-blue.svg)
![License](https://camo.githubusercontent.com/18a59883b89ed6ee32c4afc2c93f81e65ec844d96f708b1499eb234a796889b6/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f4c6963656e73652d434325323042592d2d4e432d2d5341253230342e302d677265656e)

---

## ✨ Key Features

This extension reads your local TypingMind chat data (nothing is sent anywhere) to provide a comprehensive overview of your usage and costs.

### 📊 Statistics & Analytics

*   **Comprehensive Dashboard:** Get an at-a-glance view of your spending for today, this month, and a prediction for the end of the month.
*   **Interactive Charts:** Visualize your usage over the last 30 days with interactive charts for both cost and token count. Hover over a bar to see daily details.
*   **Detailed Model Breakdown:** See exactly which models you're using the most, with detailed stats for messages, tokens (prompt/completion), total cost, and average cost per million tokens.
*   **Complete Usage History:** A paginated table showing your usage stats for every single day, sortable and easy to navigate.
*   **Smart Model Recognition:** Automatically detects pricing for models using your model list. It also correctly identifies your custom models.

### 💰 Powerful Budget Management

*   **Set Custom Budgets:** Define daily, weekly, and/or monthly spending limits to stay on track.
*   **Automatic Alerts:** Receive non-intrusive banner notifications when you reach 75% and 100% of your budget.
*   **Usage Blocking:** Optionally configure the extension to **block the send button** when a budget is exceeded, preventing accidental overspending.
*   **Live Progress Bars:** See a progress bar for your most-used budget directly in the chat header, giving you instant feedback as you work.
*   **Warn-Only Mode:** If you prefer not to block sending, you can set the extension to only show warnings.

### 🔧 Seamless Integration

*   **Easy Access:** The extension adds a "Stats" button directly into the TypingMind sidebar for quick access.
*   **Clean UI:** The statistics page and settings modals are designed to feel clean and intuitive.
*   **Local & Private:** All calculations are done client-side in your browser. Your chat data or API keys are never read or transmitted.

---

## 🚀 Installation

Installing the extension is simple and only takes a minute.

1.  In TypingMind, go to **Settings** > **Extensions**.
2.  In the "Enter extension URL" field, paste the following URL:
    ```
    https://raw.githack.com/solv4ss/typingmind-stats-monitoring/refs/heads/main/stats-monitoring.js
    ```
3.  Click **Install**.
4.  **Refresh the TypingMind page**.
5.  That's it! You're ready to go.

---

## 💡 How to Use

1.  After installing, a new **"Stats"** will appear in the left sidebar of TypingMind.
2.  Click the icon to open the main dashboard. The first time, it may take a few seconds to analyze all your past chats.
3.  On the dashboard, click the **"⚙️ Budget Settings"** button to configure your spending limits, enable/disable tracking, and choose your preferred behavior when a budget is exceeded.

---

## 🗺️ Roadmap

Here are some of the features and improvements planned for future versions:

### Short-Term
*   [ ] **Export Data:** Add functionality to export usage data as CSV or JSON.
*   [ ] **Date Range Picker:** Allow users to select custom date ranges for the charts and stats.

### Mid-Term
*   [ ] **Per-Model Budgeting:** Set specific budgets for individual models (e.g., "Max $10/month on GPT-4o").
*   [ ] **Tag-Based Filtering:** Filter statistics based on the tags you've assigned to your chats in TypingMind.
*   [ ] **Advanced Charting Options:** More ways to visualize and compare data.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/solv4ss/typingmind-stats-monitoring/issues) if you want to contribute.

---

## 📄 License

This project is licensed under the [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) License. See the [LICENSE](LICENSE) file for details.
