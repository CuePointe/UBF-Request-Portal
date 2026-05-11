# UBF Logistics & Procurement Portal

Welcome to the Uganda Biodiversity Fund (UBF) Procurement Management System. This portal runs 100% securely on GitHub Pages and writes logs directly to the repository database.

## 👥 Staff Access Instructions

To submit or approve procurement requisitions, every staff member needs a secure access connection. Follow these steps to generate your login credentials:

### Step 1: Generate your Access Token
1. Log into your **GitHub Account**.
2. Click your profile picture in the top-right corner and choose **Settings**.
3. Scroll down on the left sidebar and click **Developer settings**.
4. Click **Personal access tokens** -> Choose **Tokens (classic)**.
5. Click **Generate new token** -> Choose **Generate new token (classic)**.
6. In the **Note** box, type: `UBF Procurement Portal Portal Login`.
7. Under **Select scopes**, check the box for **`repo`** (this allows the portal to securely read and write requisitions).
8. Scroll to the bottom and click the green **Generate token** button.
9. **Copy the token immediately.** (GitHub will never show it to you again).

### Step 2: Logging into the Portal
1. Open the live deployment web link for this repository portal.
2. The browser will prompt you for credentials.
3. Enter your official **UBF Corporate Email**.
4. Paste the **GitHub Personal Access Token (PAT)** you copied in Step 1.
5. Click OK. The browser will securely remember your login cache so you only have to do this once.

## 📂 System File Architecture
* `index.html` - Primary application viewport container frame.
* `dashboard.html` - Metrics grid interface table module layout.
* `form.html` - Official service and goods requisition request logging interface.
* `data.js` - Dynamic data transformation and base64 upload controller.
* `script.js` - Routing operations and validation state manager.
* `style.css` - Custom styling definitions and UBF corporate color mapping.
* `data/requisitions.json` - Active portal secure flat-file database array.
* .
