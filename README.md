# 🚀 IPO YouTube Auto-Publisher & Viral SEO Scheduler

Automated microservice that continuously syncs finished IPO videos from **Google Drive**, generates high-retention viral YouTube Shorts metadata using **Groq Qwen / Llama**, and schedules or publishes them directly to **YouTube** with zero human intervention.

---

## ⚡ How It Works

1. **Drive Polling**: Connects to your Google Drive `IPO Automation` folder and detects newly generated IPO videos.
2. **AI Viral SEO Generation**: Analyzes the financial data (`ipo_data.json`) and narration transcript (`script.txt`) using Groq Cloud AI to generate:
   - High-CTR Title (under 70 characters with `#Shorts`)
   - High-retention Description (formatted quick stats, financial overview, SEBI compliance disclaimer, and trending hashtags)
   - 15–20 High-Volume Search Tags
   - High-Engagement Pinned Comment
3. **Resumable YouTube Upload**: Uploads the 1080×1920 video with thumbnail, language tags, and category.
4. **Publish or Schedule**: Publishes immediately or schedules for prime viewing windows in India.
5. **Engagement Automation**: Automatically posts and pins the interactive comment.
6. **State Tracking**: Saves uploaded video IDs and URLs to `data/uploaded_youtube.json` (50-item sliding window) to prevent duplicate uploads.

---

## 🛠️ One-Time Setup Instructions

### 1. Enable YouTube Data API v3 in Google Cloud
1. Go to your [Google Cloud Console](https://console.cloud.google.com/).
2. In the search bar at the top, search for **YouTube Data API v3** and click **Enable**.
3. (You can reuse the exact same OAuth Client ID and Secret you already created for Google Drive!).

### 2. Authorize Your YouTube Channel (Takes 30 seconds)
Run this command on your machine:
```bash
npm run auth:youtube
```
- A browser window will open asking to connect your YouTube channel.
- Click **Allow**.
- The script automatically writes `YOUTUBE_REFRESH_TOKEN` into your `.env` file!

### 3. Verify Connection
```bash
npm run test:youtube
```
It will display your YouTube channel name, subscriber count, and confirm you are 100% ready to upload.

---

## 🚀 Running the Pipeline

### Manual Run (Upload Next Video from Drive)
```bash
npm run publish
```

### Automatic Scheduling (GitHub Actions)
The included GitHub Actions workflow runs **twice daily at 09:30 AM & 07:30 PM IST** (1 hour after the video generator).

Configure these repository secrets in GitHub Actions:
- `GDRIVE_REFRESH_TOKEN`
- `GDRIVE_CLIENT_ID`
- `GDRIVE_CLIENT_SECRET`
- `GDRIVE_PARENT_FOLDER_ID`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `GROQ_API_KEY`
