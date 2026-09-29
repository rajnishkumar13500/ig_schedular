import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getUnprocessedIPOsFromDrive, downloadIPOAssetsFromDrive } from "./sync_drive";
import { generateYouTubeMetadata } from "./generate_metadata";
import { uploadToYouTube } from "./publish_youtube";
import { recordYouTubeUpload } from "./tracker";

dotenv.config();

async function runPublisherPipeline() {
  console.log("==================================================");
  console.log("🚀  IPO YOUTUBE AUTO-PUBLISHER PIPELINE");
  console.log("==================================================");

  // 1. Scan Google Drive for unprocessed IPOs
  console.log("\n📡 Step 1: Checking Google Drive for new IPO videos...");
  const unprocessed = await getUnprocessedIPOsFromDrive();

  if (unprocessed.length === 0) {
    console.log("\n✨ All videos on Google Drive have already been uploaded to YouTube! Nothing to do.");
    return;
  }

  const selected = unprocessed[0];
  console.log(`\n👉 Selected for YouTube Upload: "${selected.name}" (${selected.slug})`);

  // 2. Download Video & Assets from Google Drive
  console.log("\n📥 Step 2: Downloading video and metadata from Google Drive...");
  const assets = await downloadIPOAssetsFromDrive(selected);

  if (!assets) {
    console.error(`❌ Failed to download assets for ${selected.name}`);
    process.exit(1);
  }

  // 3. Generate Viral YouTube Metadata via Groq Qwen/Llama
  console.log("\n🤖 Step 3: Generating viral metadata with AI (Groq)...");
  const metadata = await generateYouTubeMetadata(
    assets.folderName,
    assets.ipoData,
    assets.scriptText
  );

  // 4. Upload and Publish to YouTube
  console.log("\n📺 Step 4: Uploading video and publishing to YouTube...");
  const uploadResult = await uploadToYouTube(assets.videoPath, metadata);

  // 5. Update Tracker
  console.log("\n💾 Step 5: Updating YouTube upload tracker store...");
  recordYouTubeUpload({
    ipoSlug: assets.slug,
    companyName: assets.folderName,
    youtubeVideoId: uploadResult.videoId,
    youtubeUrl: uploadResult.videoUrl,
    publishedAt: new Date().toISOString(),
    scheduledFor: uploadResult.scheduledFor,
    privacyStatus: uploadResult.privacyStatus,
    title: uploadResult.title,
    pinnedCommentId: uploadResult.pinnedCommentId,
  });

  // 6. Cleanup local temp files
  try {
    fs.rmSync(path.dirname(assets.videoPath), { recursive: true, force: true });
    console.log("🧹 Cleaned up temporary video cache.");
  } catch (_) {}

  console.log("\n==================================================");
  console.log("🎉  YOUTUBE PUBLICATION COMPLETE!");
  console.log(`📺  Video Title: ${uploadResult.title}`);
  console.log(`🔗  YouTube URL: ${uploadResult.videoUrl}`);
  console.log(`🔒  Status:      ${uploadResult.privacyStatus}`);
  if (uploadResult.scheduledFor) {
    console.log(`⏰  Scheduled:   ${uploadResult.scheduledFor}`);
  }
  console.log("==================================================");
}

runPublisherPipeline().catch((err) => {
  console.error("Fatal pipeline error:", err);
  process.exit(1);
});
