# 📸 Complete Step-by-Step Instagram Reels Setup Guide

This guide provides a comprehensive, beginner-friendly walkthrough to set up the **Meta Instagram Graph API** so that your IPO videos can be automatically published as **Instagram Reels** directly from Google Drive via GitHub Actions or your local machine.

---

## 📋 Overview of What You Will Get

At the end of this guide, you will have:
1. `INSTAGRAM_ACCOUNT_ID`: Your Instagram Professional account numeric ID.
2. `INSTAGRAM_ACCESS_TOKEN`: A **permanent, never-expiring** Meta System User Access Token.
3. Verification using `npm run test:instagram`.
4. Automated posting via GitHub Actions on your daily schedule!

---

## 🧭 Step 1: Switch Instagram Account to Professional & Link a Facebook Page

> [!IMPORTANT]
> The official Meta Graph API **only works with Instagram Creator or Business accounts**. Personal accounts are not supported by Meta's API.

### 1.1 Switch to Professional Account
1. Open the **Instagram app** on your phone.
2. Go to your **Profile** ➔ Tap the hamburger menu (**☰**) in the top right.
3. Go to **Settings and activity** (or **Settings**).
4. Scroll down to **For professionals** and tap **Account type and tools** (or **Switch to professional account**).
5. Choose **Creator** or **Business** (either works fine for financial & news content).
6. Complete the prompt questions (select Category e.g., *Financial Consultant*, *Education*, or *Media/News Company*).

### 1.2 Connect a Facebook Page
Meta's Graph API routes requests to Instagram through an associated Facebook Page.
1. In the Instagram App, go to **Profile** ➔ **Edit profile**.
2. Under **Public business information**, tap **Page**.
3. Select **Connect or create a Facebook Page**.
4. If you already have a Facebook page, select it. If not, tap **Create Facebook Page** and give it a quick name (e.g. *Alpha Verdict*).
5. Confirm and link the page.

---

## 🧭 Step 2: Create a Meta Developer App

1. In your desktop browser, visit the [Meta for Developers Portal](https://developers.facebook.com/).
2. Click **Log In** in the top right and sign in with the Facebook account that owns the Facebook Page created in Step 1.
3. Click **My Apps** (top right) ➔ Click the green **Create App** button.
4. When asked *"What do you want your app to do?"*:
   - Select **Other** ➔ Click **Next**.
5. When asked to *"Select an app type"*:
   - Select **Business** ➔ Click **Next**.
6. Enter App Details:
   - **App name**: `IPO Auto Publisher` (or any name you like)
   - **App contact email**: Your personal email
   - **Business Account**: Select your Meta Business Account if prompted (or choose *No Business account selected* if you don't have one yet; Meta will create one automatically).
7. Click **Create App** and enter your Facebook password to confirm.

---

## 🧭 Step 3: Add Instagram Products to Your App

1. Once inside your new App Dashboard, look for the **Add products to your app** section.
2. Scroll to find **Instagram** (or **Instagram Graph API**) and click **Set Up**.
3. You will see Instagram appear under the **Products** section in the left sidebar.

---

## 🧭 Step 4: Generate a Never-Expiring System User Access Token

Standard user tokens expire after 1 hour or 60 days. To ensure GitHub Actions runs 365 days a year without breaking, generate a **Permanent System User Token** through Meta Business Suite.

1. Open [Meta Business Settings](https://business.facebook.com/settings).
2. Ensure you have selected the Business account associated with your Facebook page.
3. In the left sidebar under **Users**, click **System Users**.
4. Click the blue **Add** button:
   - **System username**: `github-actions-publisher`
   - **System user role**: Select **Admin**
   - Click **Create system user**.
5. Once created, click on the system user, then click **Add Assets**:
   - Under **Pages**: Select your linked Facebook Page ➔ Turn on **Full control (Manage Page)** ➔ Save Changes.
   - Under **Apps**: Select your developer app (`IPO Auto Publisher`) ➔ Turn on **Full control (Manage App)** ➔ Save Changes.
6. Now click **Generate New Token**:
   - **Select App**: Choose your developer app (`IPO Auto Publisher`).
   - **Token Expiration**: Select **Never** *(Crucial!)*.
   - **Available Permissions**: Search and check the following **4 mandatory permissions**:
     1. `instagram_basic`
     2. `instagram_content_publish`
     3. `pages_show_list`
     4. `pages_read_engagement`
7. Click **Generate Token**.
8. **Copy the token immediately** and save it securely in a notepad! Meta will never display it again.
   - This is your `INSTAGRAM_ACCESS_TOKEN`.

---

## 🧭 Step 5: Find Your `INSTAGRAM_ACCOUNT_ID`

To get your Instagram Business/Creator Account ID:

1. Open a new tab in your browser and visit this URL (replace `YOUR_ACCESS_TOKEN` with the token copied in Step 4):
   ```text
   https://graph.facebook.com/v21.0/me/accounts?fields=name,instagram_business_account&access_token=YOUR_ACCESS_TOKEN
   ```
2. You will see a JSON response similar to this:
   ```json
   {
     "data": [
       {
         "name": "Alpha Verdict",
         "instagram_business_account": {
           "id": "17841405829102948"
         },
         "id": "104928192849102"
       }
     ]
   }
   ```
3. Copy the numeric ID inside `instagram_business_account.id` (e.g., `17841405829102948`).
   - This is your `INSTAGRAM_ACCOUNT_ID`.

*(Note: Do NOT copy the root `id` under `name` — that is the Facebook Page ID. You specifically want the ID nested inside `instagram_business_account`).*

---

## 🧭 Step 6: Test Locally with the CLI

Now that you have both credentials, test them on your machine:

1. Open your project [`.env`](.env) file.
2. Add your credentials:
   ```env
   # ─── Meta Instagram Graph API ──────────────────────────────────────────────
   INSTAGRAM_ACCOUNT_ID=17841405829102948
   INSTAGRAM_ACCESS_TOKEN=EAAG...your_never_expiring_token_here
   GRAPH_API_VERSION=v21.0
   ENABLE_INSTAGRAM=true
   ENABLE_YOUTUBE=true
   ```
3. Run the automated test in your terminal:
   ```bash
   npm run test:instagram
   ```
4. If configured correctly, you will see:
   ```text
   ==================================================
   📸  TESTING INSTAGRAM GRAPH API CREDENTIALS
   ==================================================

   🔍 Verifying Account ID: 17841405829102948
   🌐 Graph API Version:    v21.0
   🔑 Access Token:         EAAG7Q3m...fEwZAE

   ✅ Successfully authenticated with Meta Instagram Graph API!
      👤 Username:        @alphaverdict
      🏷️  Display Name:    Alpha Verdict
      👥 Followers:       1,420
      🎬 Media Posts:     18

   📊 24-Hour Publishing Quota: 0 / 50 posts used

   ==================================================
   🎉  INSTAGRAM CONNECTION IS 100% READY FOR AUTOMATION!
   ==================================================
   ```

---

## 🧭 Step 7: Configure GitHub Actions Secrets

To enable cloud automation:

1. Open your GitHub repository in your browser: `https://github.com/rajnishkumar13500/ipo-youtube-publisher`.
2. Click **Settings** (top navigation).
3. In the left sidebar, click **Secrets and variables** ➔ **Actions**.
4. Click the green **New repository secret** button:
   - Secret 1:
     - **Name**: `INSTAGRAM_ACCOUNT_ID`
     - **Secret**: Your Instagram account ID (e.g. `17841405829102948`)
   - Secret 2:
     - **Name**: `INSTAGRAM_ACCESS_TOKEN`
     - **Secret**: Your never-expiring token (`EAAG...`)
5. Click **Add secret**.

---

## 🧭 Step 8: Trigger a Test Run

You can now trigger an on-demand test run in GitHub Actions:

1. In your GitHub repository, click **Actions** (top navigation).
2. In the left sidebar, click **Scheduled Multi-Platform IPO Publisher (YouTube & Instagram)**.
3. Click the **Run workflow** dropdown on the right:
   - `Publish to YouTube`: `true`
   - `Publish to Instagram Reels`: `true`
   - `Auto schedule YouTube video`: `true`
4. Click **Run workflow**.

GitHub Actions will:
1. Scan Google Drive for your latest rendered video.
2. Generate optimized AI metadata for both YouTube Shorts and Instagram Reels.
3. Upload and schedule to YouTube.
4. Stream and publish the Reel to Instagram.
5. Record both publications in `data/uploaded_youtube.json` and `data/uploaded_instagram.json`.
6. Move the Google Drive folder to `Uploaded/`.

---

## 🛠️ Common Troubleshooting & FAQs

### Q1: `Error: "(#10) Application does not have capability for this action"` or `Permissions error`
- **Cause**: The access token lacks one of the required permissions.
- **Fix**: Re-generate the token in Meta Business Suite (`business.facebook.com/settings`) and ensure all 4 permissions are checked:
  - `instagram_basic`
  - `instagram_content_publish`
  - `pages_show_list`
  - `pages_read_engagement`

### Q2: `instagram_business_account` is null in Step 5
- **Cause**: The Instagram account is either a personal account or is not linked to the Facebook Page.
- **Fix**:
  1. Open the Instagram app ➔ Settings ➔ Account type ➔ Ensure it is set to **Creator** or **Business**.
  2. Open Facebook Page settings on desktop ➔ Linked Accounts ➔ Instagram ➔ Confirm connection.

### Q3: `Timed out waiting for Instagram Reel container to finish processing`
- **Cause**: Meta's video ingestion servers occasionally take 15–45 seconds to transcode high-bitrate video.
- **Fix**: The publisher automatically polls every 5 seconds for up to 3 minutes. If it ever exceeds 3 minutes, verify that the source video on Google Drive is a standard H.264/AAC `.mp4` file.

### Q4: Does Instagram charge any fee for API posting?
- **No.** The official Instagram Graph API is 100% free with a generous quota of **50 posts per 24 hours per account**, which is plenty for automated daily publishing.
