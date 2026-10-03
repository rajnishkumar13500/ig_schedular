# 📺 Alpha Verdict: Multi-Platform Auto-Publisher (YouTube & Instagram)

[![Channel](https://img.shields.io/badge/YouTube-Alpha_Verdict-red?logo=youtube)](https://youtube.com)
[![YouTube Data API](https://img.shields.io/badge/YouTube_API-v3_Resumable_Upload-red)](https://developers.google.com/youtube/v3)
[![Instagram Reels](https://img.shields.io/badge/Instagram_Graph_API-v21.0_Reels_Resumable-E4405F?logo=instagram)](https://developers.facebook.com/docs/instagram-api/guides/content-publishing)
[![Metadata AI](https://img.shields.io/badge/Groq%20Cloud-Qwen_3.8_%2F_Llama_3.3-orange)](https://groq.com)
[![Storage](https://img.shields.io/badge/Google_Drive-API_v3_Archival-green?logo=googledrive)](https://developers.google.com/drive)
[![Automation](https://img.shields.io/badge/GitHub_Actions-Twice_Daily_(14x%2Fweek)-brightgreen?logo=githubactions)](https://github.com/features/actions)

An automated cloud microservice that syncs rendered IPO vertical videos from **Google Drive**, validates asset integrity, generates platform-tailored viral metadata using **Groq Cloud (Qwen 3.8 / Llama 3.3)**, publishes concurrently to **YouTube Shorts** (with 24-hour forward scheduling) and **Instagram Reels** (via official Meta Graph API direct resumable upload), auto-posts pinned engagement comments, and archives processed Drive folders into a dedicated `Uploaded/` directory.

---

## 🏗️ 1. System Architecture

```mermaid
flowchart TD
    A["Google Drive: 'IPO Automation' Folder"] -->|1. List Folders| B["Scan for Candidate Folders\n(scripts/sync_drive.ts)"]
    
    B --> C{"Check Trackers\nAlready Processed on\nYouTube & Instagram?"}
    C -- Both Done --> D["Move to 'Uploaded/' Archive"]
    C -- Pending --> E{"Verify .mp4 Video Exists\nin Drive Folder?"}
    
    E -- Missing Video --> F["⚠️ Graceful Exit (Code 0)\nNo Pipeline Failure"]
    E -- Valid Video --> G["Download Bundle to temp/slug/\n• video.mp4\n• assets/ipo_data.json\n• assets/script.txt"]
    
    G --> H["Company Name Sanitizer\nStrip 'Limited', 'Pvt Ltd', 'Technologies'\nEnforce Base Brand Name ≤ 22 chars"]
    
    H --> I["AI Viral Engine (Groq Cloud)\n(scripts/generate_metadata.ts)"]
    
    subgraph Multi_Platform_AI ["AI Content Generation"]
        I --> J1["YouTube Shorts Metadata\n• Clamped Title ≤ 65 chars (#Shorts)\n• SEO Description & Tags\n• Pinned Question Comment"]
        I --> J2["Instagram Reels Metadata\n• First-Line Visual Hook\n• Financial Breakdown with Emojis\n• Viral CTA & Disclaimer\n• 20-25 Targeted IPO Hashtags"]
    end
    
    subgraph Dual_Publishing ["Dual Publishing Engine"]
        J1 --> K1["YouTube Data API v3\n• Resumable Video Upload\n• 24-Hour Forward Scheduling\n• Auto-Pinned Comment"]
        J2 --> K2["Meta Instagram Graph API\n• Resumable Container Init\n• Direct rupload.facebook.com Binary Stream\n• Readiness Polling & Reel Publish"]
    end
    
    K1 --> L1["Save data/uploaded_youtube.json"]
    K2 --> L2["Save data/uploaded_instagram.json"]
    
    L1 & L2 --> M{"Both Platforms\nSucceeded?"}
    M -- Yes --> N["Google Drive Archival\nMove Company Folder into 'Uploaded/'"]
    M -- Partial --> O["Keep in Root for Next Retry"]
    
    N & O --> P["Purge Local temp/ Cache\n(Zero Runner Disk Footprint)"]
    P --> Q["Git Auto-Commit [skip ci]\nPush Updated Trackers to GitHub"]
```

---

## ⏱️ 2. Execution Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant GHA as GitHub Actions Runner
    participant Drive as Google Drive API
    participant Groq as Groq Cloud AI (Qwen/Llama)
    participant YouTube as YouTube Data API v3
    participant Meta as Meta Instagram Graph API
    participant Trackers as Upload Trackers (JSON)
    participant Git as GitHub Repository

    GHA->>Drive: Scan 'IPO Automation' for candidate folders
    Drive-->>GHA: Return folders (e.g. POOJA LOGISTICS)
    
    GHA->>Trackers: Check if slug already published on YouTube & Instagram
    Trackers-->>GHA: Status: Pending publication
    
    GHA->>Drive: Check if .mp4 exists in folder
    Drive-->>GHA: Video verified (8.7 MB)
    
    GHA->>Drive: Download video.mp4, ipo_data.json, script.txt
    Drive-->>GHA: Assets downloaded to temp/slug/
    
    %% AI Metadata
    GHA->>Groq: Generate YouTube title, description, tags & pinned comment
    Groq-->>GHA: YouTube viral metadata
    GHA->>Groq: Generate Instagram Reels caption with emojis & hashtags
    Groq-->>GHA: Instagram caption
    
    %% YouTube Upload
    rect rgb(255, 240, 240)
    Note over GHA,YouTube: YouTube Shorts Publishing
    GHA->>YouTube: Resumable upload (private + 24-hr schedule)
    YouTube-->>GHA: Video created with Video ID
    GHA->>YouTube: Insert top-level pinned engagement comment
    YouTube-->>GHA: Comment posted successfully
    GHA->>Trackers: Record in data/uploaded_youtube.json
    end
    
    %% Instagram Upload
    rect rgb(255, 240, 255)
    Note over GHA,Meta: Instagram Reels Publishing
    GHA->>Meta: POST /{IG_ID}/media (upload_type=resumable, media_type=REELS)
    Meta-->>GHA: Container ID created
    GHA->>Meta: POST rupload.facebook.com/ig-api-upload (Stream binary MP4)
    Meta-->>GHA: Binary received
    loop Poll Readiness
        GHA->>Meta: GET /{container_id}?fields=status_code
        Meta-->>GHA: status_code: FINISHED
    end
    GHA->>Meta: POST /{IG_ID}/media_publish
    Meta-->>GHA: Published Reel Media ID & Permalink
    GHA->>Trackers: Record in data/uploaded_instagram.json
    end
    
    %% Cleanup & Archive
    GHA->>Drive: Move company folder from 'IPO Automation' to 'Uploaded/'
    Drive-->>GHA: Folder moved (addParents/removeParents)
    GHA->>Git: Commit updated trackers with [skip ci]
```

---

## 💎 3. Key Production Features

### 1. 🛡️ Strict Title Length Clamping & Name Sanitization (YouTube)
* **Problem**: Mobile YouTube Shorts feeds truncate any title over **60–65 characters** with an ellipsis (`...`), hiding the hook and `#Shorts` tag.
* **Solution**:
  * Strips corporate legal noise words (`Private Limited`, `Pvt Ltd`, `Limited`, `Technologies`, `Industries`, `Holdings`, `India`, etc.).
  * Formula: `[Short Brand] IPO: [Hook] 🚨 #Shorts`
  * Strict code-level double-lock clamps titles $\le 65$ characters.

### 2. 📸 Official Meta Instagram Reels Resumable Upload
* **Zero Third-Party Storage**: Uses Meta's `rupload.facebook.com` binary endpoint to stream videos directly from GitHub Actions without needing AWS S3 or external hosting.
* **100% Ban-Safe**: Official Meta Graph API (no headless browsers or unofficial private APIs that get banned on datacenter IPs).
* **AI Caption Optimization**: Generates hook lines, emoji-bulleted financial breakdowns, regulatory disclaimers, engagement CTAs (*"Comment APPLY or SKIP"*), and 20–25 high-traffic hashtags.

### 3. ⏰ 24-Hour Forward Scheduling Buffer (YouTube)
* **Morning Run (~09:30 AM IST)**: Schedules for **Tomorrow Morning at 09:00 AM IST** (~23.5 hours ahead).
* **Evening Run (~07:30 PM IST)**: Schedules for **Tomorrow Evening at 06:30 PM IST** (~23.0 hours ahead).
* 100% immune to GitHub Actions runner queue latency + gives YouTube 24 hours to process high-definition VP9/AV1 codecs.

### 4. 🗂️ Independent Platform Trackers & Google Drive Archival
* Maintains separate state files:
  * `data/uploaded_youtube.json`
  * `data/uploaded_instagram.json`
* If one platform encounters a temporary API issue, the other platform's success is preserved.
* The company folder on Google Drive is moved into **`Uploaded/`** only when all active platforms succeed.

---

## ⚙️ 4. Setup Guide

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/rajnishkumar13500/ipo-youtube-publisher.git
cd ipo-youtube-publisher
npm install
```

### 2. Configure Local Environment (`.env`)
Create a `.env` file based on `.env.example`:
```env
# ─── Google Drive Ingestion (Read Videos & Assets) ─────────────────────────
GDRIVE_REFRESH_TOKEN=your_gdrive_refresh_token
GDRIVE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GDRIVE_CLIENT_SECRET=your_client_secret
GDRIVE_PARENT_FOLDER_ID=your_parent_folder_id

# ─── YouTube Data API v3 (Upload & Schedule Videos) ────────────────────────
YOUTUBE_CLIENT_ID=your_client_id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REFRESH_TOKEN=your_youtube_refresh_token
YOUTUBE_AUTO_SCHEDULE=true

# ─── Meta Instagram Graph API (Publish Instagram Reels) ────────────────────
INSTAGRAM_ACCOUNT_ID=your_instagram_business_account_id
INSTAGRAM_ACCESS_TOKEN=your_never_expiring_system_user_token
GRAPH_API_VERSION=v21.0

# ─── Multi-Platform Toggles ───────────────────────────────────────────────
ENABLE_YOUTUBE=true
ENABLE_INSTAGRAM=true

# ─── Groq AI Metadata Generation (Viral Titles & Descriptions) ─────────────
GROQ_API_KEY=gsk_your_groq_api_key
GROQ_MODEL=qwen/qwen3.8-27b
```

### 3. Instagram Setup (In-Depth Walkthrough)
👉 Follow the comprehensive, step-by-step setup guide in [**`INSTAGRAM_SETUP.md`**](INSTAGRAM_SETUP.md) to generate your permanent token and connect your account in under 10 minutes.

### 4. Verify Credentials
```bash
# Verify YouTube connection
npm run test:youtube

# Verify Instagram connection & 24-hr quota
npm run test:instagram

# Run complete dry-run compliance audit
npm run verify
```

---

## 🛠️ 5. CLI Commands Reference

| Command | Action |
| :--- | :--- |
| `npm run auth:youtube` | Launches local OAuth server for 1-click YouTube channel authorization |
| `npm run test:youtube` | Tests connection with YouTube API and verifies channel metadata |
| `npm run test:instagram` | Tests Meta Graph API connection, prints Instagram handle & 24-hr publishing quota |
| `npm run sync:drive` | Scans Google Drive for unworked folders and verifies `.mp4` video presence |
| `npm run verify` | Performs a complete non-destructive dry-run audit of metadata & compliance |
| `npm run publish` | Executes live end-to-end multi-platform publishing (YouTube + Instagram) |

---

## 🤖 6. GitHub Actions Cloud Automation

The publisher workflow in [`.github/workflows/youtube_publisher.yml`](.github/workflows/youtube_publisher.yml) runs **twice daily, 7 days a week**:

* **Morning Run**: `04:00 UTC` (**09:30 AM IST**)
* **Evening Run**: `14:00 UTC` (**07:30 PM IST**)
* **Manual Dispatch**: Triggerable anytime via the GitHub Actions tab with toggles for individual platforms.

### Required GitHub Repository Secrets
Under **Settings ➔ Secrets and variables ➔ Actions**, configure:
1. `YOUTUBE_REFRESH_TOKEN`
2. `YOUTUBE_CLIENT_ID`
3. `YOUTUBE_CLIENT_SECRET`
4. `INSTAGRAM_ACCOUNT_ID`
5. `INSTAGRAM_ACCESS_TOKEN`
6. `GDRIVE_REFRESH_TOKEN`
7. `GDRIVE_CLIENT_ID`
8. `GDRIVE_CLIENT_SECRET`
9. `GDRIVE_PARENT_FOLDER_ID`
10. `GROQ_API_KEY`
