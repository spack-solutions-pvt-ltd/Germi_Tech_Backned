## Loading Module

The Loading module manages loading requests from creation to verification, approval, and payment creation.

### L3 – Loading Requests

L3 users can create and manage loading requests.

**Tabs:** Labour | Expenses | Bags | Vehicle | Loading

**Summary:** Pending | Verified | Approved | Canceled

**Filters:** Village, Status, Search

**Request Table:**
**Request ID | Date & Time | Village | Crop & Variety | Status | View**

L3 can edit a request only while it is **Pending**.

### Add / Edit Loading Request

The request includes:

* From Location – Village
* To Location – Warehouse
* Start Photo
* End Photo
* Allotment – Allotment ID → Village → Crop → Variety
* No. of Bags
* DK Quantity (Charged Weight)
* DK Photo
* Transporter Name
* Hamali Gange Name
* Note

Multiple loading rows can be added. Additional rows include **Village** and **Supervisor** selection, with **Self** available as a supervisor option.

---

### L2 – Loading Verification

L2 verifies loading requests raised by L3.

**Table:**
**Request ID | Requested By | Crop & Variety | Request Type | Village | Status | View**

The View drawer shows the request and verification details.

L2 can enter/edit:

* Transport Name
* Rate
* Markets Amount
* Hamali Amount
* Kantta Bill
* Total Amount

**Total = Rate × DK Quantity + Markets + Hamali + Kantta Bill**

The total is recalculated automatically when values change.

**Actions:** Verify | Cancel

Verification is allowed even if the rate has not been entered.

---

### L1 – Loading Approval

L1 can view loading requests immediately after L3 creates them, even before L2 verification.

The approval drawer contains the same request and amount details, with all amount fields editable.

L1 can select:

* **Verified**
* **Approved**
* **Create Hamali Payment**
* **Create Transport Payment**
* **Create Both Payments**
* **Canceled**

### Payment Creation & Partial Approval

Transport and Hamali payments are treated as **separate payments**.

* If L1 selects **Create Transport Payment**, only the Transport payment is created and the request status becomes **Partially Approved**.
* If L1 selects **Create Hamali Payment**, only the Hamali payment is created and the request status becomes **Partially Approved**.
* If both Transport and Hamali payments are created, the request status becomes **Approved**.
* The system must record which payment(s) have already been created to prevent duplicate payment creation.
* If a request is **Partially Approved**, L1 can create the remaining payment later.
* Once both required payments have been created, the request automatically changes from **Partially Approved** to **Approved**.

### Status Flow

**L3:**
Pending → Verified → Partially Approved → Approved / Canceled

**L2:**
Pending → Verified / Canceled

**L1:**
Can review, update amounts, approve, and create Transport and/or Hamali payments.

### API / Endpoint Behaviour

Payment creation should be handled separately so that each payment can be created independently:

* **Create Transport Payment** → creates only the Transport payment and marks the request as **Partially Approved**.
* **Create Hamali Payment** → creates only the Hamali payment and marks the request as **Partially Approved**.
* **Create Both Payments** → creates both payments and marks the request as **Approved**.
* The endpoints must check existing payment records before creating a payment to prevent duplicates.
* If one payment already exists, the API should create only the remaining payment.
* When both payments exist, the request should be marked **Approved**.

L3 users should continue to see only:

**Pending | Verified | Approved | Canceled**

The **Partially Approved** status is an internal approval/payment state and should not be exposed as a separate status to L3 users.
