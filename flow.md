# 🎬 IPO YouTube Auto-Publisher: End-to-End Architectural Flow

This document details the complete end-to-end lifecycle of how finished IPO videos stored on **Google Drive** are automatically discovered, enhanced with **viral AI metadata (Groq Qwen/Llama)**, uploaded via the **YouTube Data API v3**, and scheduled for maximum viewer retention.

---

## 1. High-Level Flowchart

```mermaid
flowchart TD
    A[Google Drive Folder\n'IPO Automation'] -->|1. List Folders| B[scripts/sync_drive.ts\nScan for Company Folders]
    B --> C{Check data/uploaded_youtube.json\nAlready on YouTube?}
    C -- Yes --> D[Skip: Already Processed]
    C -- No --> E[Download Assets to temp/slug/\n• [slug].mp4\n• assets/ipo_data.json\n• assets/script.txt]
    
    E --> F[scripts/generate_metadata.ts\nGroq Cloud LPU: Qwen 3.8 / Llama 3.3]
    
    subgraph AI Viral Metadata Engine
        F --> G1["📌 Viral Title\n(<70 chars + #Shorts)"]
        F --> G2["📝 SEO Description\n(Specs, Disclaimers, Hashtags)"]
        F --> G3["🏷️ Search Tags\n(15-20 High-Volume Keywords)"]
        F --> G4["💬 Pinned Comment\n(High-Engagement Question)"]
    end
    
    G1 & G2 & G3 & G4 --> H[scripts/publish_youtube.ts\nYouTube Data API v3 Resumable Upload]
    
    H --> I{Scheduling Mode}
    I -->|Immediate| J[Publish Public / Unlisted]
    I -->|Auto-Schedule| K[Schedule for Peak IST Windows\n10:00 AM or 06:30 PM]
    
    H --> L[Auto-Post Engagement Comment\nvia commentThreads.insert]
    L --> M[scripts/tracker.ts\nUpdate data/uploaded_youtube.json]
    M --> N[Clean up temp/slug/ directory\nZero local disk footprint]
    N --> O[Git Auto-Commit [skip ci]\nPush updated tracker to GitHub]
```

---

## 2. Step-by-Step Execution Breakdown

### Step 1: Google Drive Sync & Ingestion (`scripts/sync_drive.ts`)

1. **Authentication**: Uses Google OAuth2 refresh token (`GDRIVE_REFRESH_TOKEN`) with `GDRIVE_CLIENT_ID` and `GDRIVE_CLIENT_SECRET`.
2. **Folder Discovery**:
   - Queries `GDRIVE_PARENT_FOLDER_ID` (the `IPO Automation` root folder).
   - Fetches all company subfolders (e.g., `POOJA LOGISTICS`, `MONEY VIEW`).
3. **Deduplication Check**:
   - Cross-checks folder names and normalized slugs against `data/uploaded_youtube.json`.
   - If a video has already been published to YouTube, it is skipped immediately.
4. **Asset Streaming & Download**:
   - Downloads the high-definition vertical video: `[slug].mp4` ➔ `temp/[slug]/[slug].mp4`.
   - Downloads the financial dataset: `assets/ipo_data.json` ➔ `temp/[slug]/ipo_data.json`.
   - Downloads the spoken voiceover transcript: `assets/script.txt` ➔ `temp/[slug]/script.txt`.

---

### Step 2: Viral AI Metadata & SEO Generation (`scripts/generate_metadata.ts`)

The raw financial dataset and spoken script are passed to **Groq Cloud** running `llama-3.3-70b-versatile` / `qwen/qwen3.8-27b` with a specialized financial prompt.

#### 1. Viral Title Strategy (`title`)
- **Formula**: `[Company Name] IPO: [Hook / Curiosity Angle] [Urgency/Warning Emoji] #Shorts`
- **Rules**:
  - Strictly under **70 characters** so it doesn't get truncated on mobile YouTube feeds.
  - Must include the `#Shorts` hashtag so YouTube indexes it into the Shorts shelf.
  - Uses high-CTR psychological triggers: *"Apply or Avoid?"*, *"Hidden Trap?"*, *"Truth Revealed!"*.
  - *Example*: `POOJA LOGISTICS IPO Review: Apply or Avoid? 🚨 #Shorts`

#### 2. Rich SEO Description (`description`)
The description is structured into 5 strategic zones:
1. **Above-the-Fold Hook**: The first 2 lines summarize the core verdict before the user clicks *"more"*.
2. **📌 IPO Quick Snapshot**:
   - Issue Size (e.g. ₹214.48 Cr)
   - Price Band & Lot Size
   - Open, Close & Listing Dates
3. **📊 Financial Health Highlights**:
   - Topline revenue growth rate
   - Profit after tax (PAT) and operating margin trends
4. **⚠️ SEBI Compliance Disclaimer**:
   - *"Disclaimer: Strictly for educational purposes only. Not investment or financial advice. Consult a SEBI-registered advisor before investing."*
5. **🏷️ Trending Hashtags**:
   - 5–8 targeted hashtags (e.g. `#PoojaLogisticsIPO #IPONews #StockMarketIndia #Shorts #IPOReview`).

#### 3. Search Optimization Tags (`tags`)
YouTube allows up to 500 characters of tags. The engine builds 15–20 high-intent keywords combining:
- **Brand Keywords**: `pooja logistics`, `pooja logistics ipo`, `pooja logistics limited`
- **Transaction Intent**: `pooja logistics ipo apply or avoid`, `pooja logistics ipo gmp`, `pooja logistics ipo review`
- **Broad Market Queries**: `upcoming ipos 2026`, `latest ipo review`, `stock market india`, `share market shorts`
- **Listing Queries**: `pooja logistics allotment status`, `pooja logistics listing date`

#### 4. High-Engagement Pinned Comment (`pinnedComment`)
The YouTube algorithm heavily promotes videos that have active comment threads. The AI automatically generates an interactive question:
- *Example*: `"Will you be applying for POOJA LOGISTICS IPO or skipping this one? Share your strategy in the comments below! 👇"`

---

### Step 3: YouTube Data API v3 Upload & Scheduling (`scripts/publish_youtube.ts`)

1. **Authentication**: Uses `YOUTUBE_REFRESH_TOKEN` with scopes:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube.force-ssl`
2. **Resumable Upload**:
   - Uses `youtube.videos.insert` with a read stream of `temp/[slug]/[slug].mp4`.
   - Sets category to **`27` (Education)** and language to **`en`**.
   - Marks `selfDeclaredMadeForKids: false`.
3. **Publishing vs. Auto-Scheduling**:
   - **Immediate Mode**: Sets `privacyStatus: "public"` (or `"unlisted"` for testing).
   - **Auto-Schedule Mode**: If `YOUTUBE_AUTO_SCHEDULE=true`, calculates the next peak Indian viewing window (**10:00 AM IST** or **06:30 PM IST**) and sets `publishAt` ISO timestamp with `privacyStatus: "private"`.
4. **Automated Comment Posting**:
   - Immediately calls `youtube.commentThreads.insert` with the AI-generated question so the video launches with an active discussion prompt.

---

### Step 4: Tracking & Ephemeral Storage Cleanup (`scripts/tracker.ts`)

1. **Tracker Store Update**:
   - Appends the completed upload to [`data/uploaded_youtube.json`](file:///d:/Remotion/Automation/ipo-youtube-publisher/data/uploaded_youtube.json):
     ```json
     {
       "ipoSlug": "pooja-logistics",
       "companyName": "POOJA LOGISTICS",
       "youtubeVideoId": "abc123xyz",
       "youtubeUrl": "https://youtu.be/abc123xyz",
       "publishedAt": "2026-09-29T16:00:00.000Z",
       "privacyStatus": "public",
       "title": "POOJA LOGISTICS IPO: Apply or Avoid? 🚨 #Shorts"
     }
     ```
   - Enforces a **rolling cap of 50 items FIFO** to keep the tracking file lightweight.
2. **Zero-Disk Cleanup**:
   - Executes `fs.rmSync("temp/[slug]", { recursive: true })` to delete the downloaded MP4 and assets immediately after upload, keeping runner disk usage near zero.

---

### Step 5: Automated Cloud Trigger (`.github/workflows/youtube_publisher.yml`)

1. **Schedule**:
   - **09:30 AM IST (04:00 UTC)**: 1 hour after the morning video render.
   - **07:30 PM IST (14:00 UTC)**: 1 hour after the evening video render.
   - Active **7 days a week** (14 automated checks per week).
2. **Manual On-Demand Dispatch**:
   - You can trigger a publication run anytime from the GitHub Actions dashboard.
3. **Git Auto-Commit**:
   - Commits the updated `data/uploaded_youtube.json` back to `main` with `[skip ci]`.
