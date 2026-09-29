import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import {
  getUnprocessedIPOsFromDrive,
  folderContainsVideo,
  downloadIPOAssetsFromDrive,
  moveFolderToArchive,
} from "./sync_drive";
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
    console.log("\n✨ All videos on Google Drive have already been processed/uploaded! Exiting cleanly.");
    return;
  }

  const selected = unprocessed[0];
  console.log(`\n👉 Selected candidate for publishing: "${selected.name}" (${selected.slug})`);

  // 1.5 Verify that the folder contains a valid .mp4 video
  const hasVideo = await folderContainsVideo(selected.id);
  if (!hasVideo) {
    console.log(`\n⚠️ No .mp4 video found in folder "${selected.name}".`);
    console.log(`   Stopping automation gracefully (no video ready to publish yet).`);
    return;
  }

  // 2. Download Video & Assets from Google Drive
  console.log("\n📥 Step 2: Downloading video and metadata from Google Drive...");
  const assets = await downloadIPOAssetsFromDrive(selected);

  if (!assets) {
    console.warn(`⚠️ Could not retrieve assets for "${selected.name}". Gracefully exiting.`);
    return;
  }

  // 3. Generate Viral YouTube Metadata via Groq (Qwen/Llama)
  console.log("\n🤖 Step 3: Generating viral metadata with AI (Groq)...");
  const metadata = await generateYouTubeMetadata(
    assets.folderName,
    assets.ipoData,
    assets.scriptText
  );

  // 4. Upload and Schedule to YouTube (24-Hour Forward Buffer)
  console.log("\n📺 Step 4: Uploading video and scheduling on YouTube...");
  const uploadResult = await uploadToYouTube(assets.videoPath, metadata);

  // 5. Move Processed Folder on Google Drive to 'Uploaded/'
  console.log("\n📁 Step 5: Moving company folder to 'Uploaded/' on Google Drive...");
  try {
    await moveFolderToArchive(selected.id, selected.name, "Uploaded");
  } catch (driveErr: any) {
    console.warn("⚠️ Warning: Failed to move folder to 'Uploaded/' on Google Drive:", driveErr.message || driveErr);
  }

  // 6. Update Local Tracker Store
  console.log("\n💾 Step 6: Updating YouTube upload tracker store...");
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

  // 7. Cleanup local temp files
  try {
    fs.rmSync(path.dirname(assets.videoPath), { recursive: true, force: true });
    console.log("🧹 Cleaned up temporary local video cache.");
  } catch (_) {}

  console.log("\n==================================================");
  console.log("🎉  YOUTUBE PUBLICATION & SCHEDULING COMPLETE!");
  console.log(`📺  Video Title:  ${uploadResult.title}`);
  console.log(`🔗  YouTube URL:  ${uploadResult.videoUrl}`);
  console.log(`🔒  Status:       ${uploadResult.privacyStatus}`);
  if (uploadResult.scheduledFor) {
    console.log(`⏰  Scheduled:    ${uploadResult.scheduledFor}`);
  }
  console.log(`📁  Drive Status: Moved to 'Uploaded/' folder`);
  console.log("==================================================");
}

runPublisherPipeline().catch((err) => {
  console.error("Fatal pipeline error:", err);
  process.exit(1);
});
