# 🏆 NOVA CART — PromptWars Business Rescue Challenge
## Executive Submission & Product Strategy Dossier

---

### **Executive Summary**
* **The Core Diagnosis:** NOVA CART's growth is a "leaky bucket" driven by unsustainable acquisition spending (₹17L/month) while customer retention crashes (41% → 27%) and cancellation rates surge (6% → 11%). The #1 root cause is **inventory sync failure** (35% of all cancellations, 29% of customer churn signals), which destroys customer trust at the moment of highest intent.
* **The Solution Built:** **NOVA CART Smart Inventory Partner Portal** — an AI-powered, real-time inventory management, stockout prevention, and dynamic demand forecasting engine tailored specifically for the 620 independent local retail partners.
* **Capital & Implementation Fit:** Implementation cost is well within the ₹25 Lakh cap (est. ₹14.8 Lakh total investment), delivering a projected **₹8.4 Lakh/month net profit turnaround** within 4 months.

---

## 1. Problem Diagnosis & Evidence Breakdown

### The Surface Symptoms vs. Root Cause
| Symptom (Surface) | Management Assumption | Case Evidence / Reality (Root Cause) |
| :--- | :--- | :--- |
| **Repeat Purchase Collapse (41% → 27%)** | Marketing believes users just need bigger discounts | **61% of churned customers previously rated NOVA CART 4★+**. Trust was broken by phantom inventory & delayed fulfillment, not lack of interest. |
| **Cancellations Doubled (6% → 11%)** | Operations blames delivery fleet capacity | **35% of all cancellations are caused directly by product unavailability after order placement**. Store rejection adds another 18%. |
| **Partner Store Friction (18% leaving)** | Partner team assumes stores want lower commissions | **39% of stores find manual catalogue upkeep too exhausting**; stores update inventory only once every 1–3 days or abandon it during rush hours. |
| **Support Ticket Explosion (3,100 → 5,900)** | Support needs more agents / tooling | **29% of tickets are refund disputes and 19% missing products** — both directly downstream of out-of-stock cancellations. |

### The 3-Order Retention Threshold
* **Key Behavioral Discovery:** Customers who reach their **3rd order have a 72% probability of ordering again** the next month.
* However, when a customer experiences an out-of-stock cancellation on order 1 or 2, their probability of returning drops by **>80%**. Fixing inventory integrity directly pushes users past the 3-order threshold into long-term organic retention.

---

## 2. Prompt Journey (AI Reasoning Strategy)

1. **Prompt 1: Quantitative Bottleneck Dissection**
   > *"Analyze the 6-month operational metrics of NOVA CART. Where is the highest leverage point: acquisition, delivery logistics, catalog accuracy, or customer support?"*
   > **Insight Generated:** Acquisition spend increased 79% (₹9.5L → ₹17L) while revenue only grew 19.7% (₹21.8L → ₹26.1L). Marginal ROI on acquisition is negative. Inventory inaccuracies are causing a 35% cancellation leak that poisons customer lifetime value (LTV).

2. **Prompt 2: Partner Store Persona & Usability Friction**
   > *"Why do 39% of partner stores struggle with inventory updates, and what friction prevents them from updating stock in real time?"*
   > **Insight Generated:** Local merchants (kiranas, bakeries, pharmacies) are busy serving walk-in foot traffic. Multi-step catalogue software fails. They need single-click batch status toggles ("Mark Unavailable"), low-stock push triggers, and predictive restock recommendations before rush hours.

3. **Prompt 3: System Architecture & ROI Validation**
   > *"Design a zero-friction Partner Store Portal with automated safety buffers, demand forecasting, and real-time inventory alerts that respects the ₹25 Lakh budget constraint."*
   > **Insight Generated:** Lightweight Express + SQLite backend with reactive WebSockets/polling and heuristic demand forecasting eliminates expensive third-party LLM inference costs while solving 90% of the operational delay.

---

## 3. Solution Architecture & Features

### Core Modules Built & Operational:
1. **Real-time Inventory Health Score (0–100%)**
   - Live availability tracking across all catalog SKUs.
   - Dynamic health ring indicator warning store owners when catalog availability falls below safe thresholds.
2. **Instant 1-Click Stock Adjustments & Rapid Toggles**
   - Inline increment/decrement controls with instant API persistence.
   - "Mark Unavailable" fast-action dialog for quick out-of-stock reporting during in-store rush hours.
3. **Smart AI Alerts & Out-of-Stock Prevention Engine**
   - Proactive warnings on high-velocity items nearing stockout.
   - Demand surge flags (weekend spikes, local festive demand).
4. **Predictive 7-Day Demand Forecast**
   - Daily order forecasts based on historical category volume, day-of-week multipliers, and local search trends (19% unmet local search capture).
5. **Cancellation Root-Cause Analytics**
   - Visual breakdown of platform cancellation metrics (Unavailable vs. Delays vs. Fleet shortages) to align store partners with platform goals.

---

## 4. Business Impact & Financial ROI

```
                    ┌──────────────────────────────────────────────┐
                    │      NOVA CART BUSINESS TURNAROUND MODEL     │
                    └──────────────────────────────────────────────┘

  METRIC                     CURRENT BASELINE      WITH SMART INVENTORY PORTAL
  ─────────────────────────────────────────────────────────────────────────────
  Monthly Orders             38,500                44,200 (+14.8% organic)
  Order Cancellation Rate    11.0%                 4.2% (-6.8% reduction)
  Completed Monthly Orders   34,265                42,343 (+8,078 completed)
  Monthly Revenue            ₹26.1 Lakh            ₹32.4 Lakh (+₹6.3L/mo)
  Monthly Promo Waste Saved  ₹17.0 Lakh            ₹11.5 Lakh (-₹5.5L/mo savings)
  Support Ticket Volume      5,900 tickets         2,600 tickets (-56% drop)
  ─────────────────────────────────────────────────────────────────────────────
  NET MONTHLY PROFIT IMPACT  ───────────────────►  +₹8.4 LAKH / MONTH
  PAYBACK PERIOD ON ₹14.8L INVESTMENT ──────────►  1.76 MONTHS
```

---

## 5. Prototype Verification & How to Run

* **Local Dev Server:** `npm run dev`
* **URL:** [http://localhost:3000](http://localhost:3000)
* **Technology:** Node.js, Express, SQLite (better-sqlite3), Vanilla CSS Design System (Emerald Green & Gold Luxury Palette), HTML5 Canvas Charts.
