# DSLM Inventory System - Preliminary Design Review (PDR) Presentation
**Time:** 12 Minutes
**Presenter:** [Your Name/Team]

---

## 1. Introduction & Mission Context (0:00 - 2:00)

**Slide 1: Title Slide**
*   **Project:** Deep Space Logistics Module (DSLM) Inventory System
*   **Objective:** Preliminary Design Review (PDR)
*   **Context:** Artemis Gateway & Moon-to-Mars Supply Chain

**Slide 2: The Challenge**
*   **"Russian Nesting Dolls":** Inventory is deeply nested (Items $\rightarrow$ Packages $\rightarrow$ Inner CTBs $\rightarrow$ Outer CTBs).
*   **Constraint:** 4M Cylinder Module with specific Stacks (S1-S3, C1-C2).
*   **Waste Management:** Waste expands 1.3-1.5x in volume; critical to track for return logistics.
*   **Latency:** Earth-Moon comms delay requires **local-first, autonomous software**.

---

## 2. System Architecture (2:00 - 4:00)

**Slide 3: Technical Approach**
*   **Platform:** React Native (Expo) - Deploys to tablets (iPad/Android) for astronaut mobility.
*   **Language:** TypeScript - Ensures strict type safety for complex, nested inventory data structures.
*   **Data Model:** 
    *   **Hierarchical:** Recursive `CTB` and `InventoryItem` types to handle infinite nesting.
    *   **Location-Aware:** Precise tracking (Stack > Position > Layer).
*   **UI Design:** High-contrast, dark mode aesthetic (Space-grade UI) for readability in low-light module environments.

---

## 3. Live Demonstration (4:00 - 9:00)

*Transition to App Demo*

**Flow A: Earth-to-Gateway Receiving (The "Incoming" Tab)**
1.  **Navigate to `Incoming`:** Show the dashboard of en-route cargo.
2.  **Action - Create Shipment:** Use the **new FAB (+)** to simulate a last-minute Earth load.
    *   *Input:* CTB ID: `CTB-FOOD-099`, Stack: `S1`, Position: `1`.
    *   *Add Items:* "Dehydrated Meals" (Qty: 10).
3.  **Action - Inspect & Receive:**
    *   Tap the new CTB card.
    *   Show the **CTB Inspector Modal** (Drill down into contents).
    *   Click **"Receive Entire CTB"**.
    *   *Result:* Status updates from `Incoming` $\rightarrow$ `Stock`.

**Flow B: Module Management (The "Module" Tab)**
1.  **Navigate to `Module`:** Show the visual representation of Stacks S1, S2, S3.
2.  **Action - Stack Inspection:**
    *   Tap **Stack S1**.
    *   Locate `CTB-FOOD-099` (the one just received).
    *   Highlight key metadata: Mass, Volume, RFID Tag.

**Flow C: Operational Use (The "Home" Tab)**
1.  **Navigate to `Home`:** Show the "At a Glance" dashboard (Critical items, Expiry warnings).
2.  **Action - Search & Consume:**
    *   Search for "Meal".
    *   Select an item.
    *   **Mark as Consumed** or **Mark as Waste**.
    *   Explain how this triggers the "Waste Volume" calculation in the background.

---

## 4. Risk Mitigation & Roadmap (9:00 - 11:00)

**Slide 4: Risks & Mitigations**
*   **Risk:** RFID Read Failures / Ghost Tags.
    *   *Mitigation:* Manual override capabilities in the UI (demonstrated in Inspector).
*   **Risk:** Data Sync Conflicts (Earth vs. Gateway).
    *   *Mitigation:* Local-first database with conflict resolution logs.

**Slide 5: Future Roadmap**
*   **Phase 2:** Physical RFID Hardware Integration (Bluetooth/Serial).
*   **Phase 3:** Backend Sync with NASA/Gateway Servers (CCSDS Protocol).
*   **Phase 4:** Advanced Waste Packing Algorithms (Optimizing return storage).

---

## 5. Conclusion & Q&A (11:00 - 12:00)

**Slide 6: Summary**
*   The DSLM Inventory System provides a **robust, user-centric interface** for managing deep-space logistics.
*   It addresses the core challenges of **nesting, waste, and autonomy**.
*   Ready for Phase 2 development.

**Open for Questions.**
