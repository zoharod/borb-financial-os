# AI Financial OS: Product Strategy & Experience Architecture

## 1. Product Information Architecture
The system is built on a hierarchy of **Intelligence > Action > Audit**.
*   **Intelligence Layer (The Brief):** AI-synthesized summaries of what matters now.
*   **Action Layer (The Workspace):** Active management of budgets, goals, and credit card optimization.
*   **Audit Layer (The Ledger):** The source of truth—automated transaction logging and categorization.

## 2. Navigation Model: "The Command & Control"
Inspired by Linear and Raycast, the navigation is designed for speed and intent.
*   **The Command Bar (Global):** A persistent entry point for natural language queries and quick actions.
*   **The Tab Bar (Primary):**
    *   **Brief:** Daily AI summary and urgent priorities.
    *   **Wealth:** Accounts, Savings, and Net Worth.
    *   **Flow:** Transactions, Budgets, and Cash Flow.
    *   **Vault:** Goals, Annual Funds, and Subscriptions.
*   **Keyboard/Gesture Shortcuts:** Pull down for Command Bar, Swipe for quick categorization.

## 3. User Journey Map: The Daily Pulse
*   **T+0s (Open):** Financial Brief appears. User sees "Safe to spend" and "Urgent actions."
*   **T+15s (Process):** User swipes through 2-3 insight cards (e.g., "Use Amex for 5% cashback today").
*   **T+45s (Action):** User approves a categorized transaction or pays a bill via Command Bar.
*   **T+90s (Close):** Cognitive load resolved. Confidence high.

## 4. Feature Hierarchy
1.  **Critical Intelligence:** Over-budget alerts, due dates, anomaly detection.
2.  **Strategic Management:** Credit card optimization (which card to use), goal tracking.
3.  **Automated Maintenance:** Transaction scrubbing, recurring payment detection.

## 5. Screen Inventory
*   **Home (The Brief):** Modular AI-driven summary feed.
*   **The Command Center:** Search, actions, and natural language AI interface.
*   **Wealth Dashboard:** Aggregate view of all liquidity and debt.
*   **Cash Flow & Budget:** Visualized trajectory vs. actuals.
*   **Transaction Ledger:** Detail-rich list with AI categorization logic.
*   **Optimization Engine:** Recommendations for cashback and interest.

## 6. Interaction Model
*   **Progressive Disclosure:** Start with a headline (e.g., "Spent L500 more on Groceries"), tap to see "Why" and "Comparison."
*   **Direct Manipulation:** Drag and drop transactions to goals or budgets.
*   **AI Ambient Presence:** Insights appear inline (e.g., small badge next to a transaction: "Typical for a Friday").

## 7. Motion & Animation Principles
*   **Fluidity:** Transitions should feel like an extension of the finger (Arc-inspired).
*   **Meaningful Motion:** Numbers "roll" when updating to reflect growth.
*   **Contextual Morphing:** Tapping a Brief card morphs it into a full-detail view to maintain spatial awareness.
