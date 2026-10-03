import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import {
  getUnprocessedIPOsFromDrive,
  folderContainsVideo,
  downloadIPOAssetsFromDrive,
  moveFolderToArchive,
} from "./sync_drive";
import {
  generateYouTubeMetadata,
  generateInstagramCaption,
} from "./generate_metadata";
import { uploadToYouTube, YouTubeUploadResult } from "./publish_youtube";
import { uploadToInstagramReels, InstagramUploadResult } from "./publish_instagram";
import {
  recordYouTubeUpload,
  isIPOAlreadyOnYouTube,
  recordInstagramUpload,
  isIPOAlreadyOnInstagram,
} from "./tracker";

dotenv.config();

async function runPublisherPipeline() {
  console.log("==================================================");
  console.log("🚀  IPO MULTI-PLATFORM AUTO-PUBLISHER PIPELINE");
  console.log("==================================================");

  const enableYouTube = process.env.ENABLE_YOUTUBE !== "false";
  const enableInstagram = process.env.ENABLE_INSTAGRAM !== "false";

  console.log(`📋 Active Platform Configuration:`);
  console.log(`   • YouTube Shorts:  ${enableYouTube ? "🟢 ENABLED" : "⚪ DISABLED"}`);
  console.log(`   • Instagram Reels: ${enableInstagram ? "🟢 ENABLED" : "⚪ DISABLED"}`);

  if (!enableYouTube && !enableInstagram) {
    console.warn("\n⚠️ Both YouTube and Instagram are disabled! Set ENABLE_YOUTUBE=true or ENABLE_INSTAGRAM=true.");
    return;
  }

  // 1. Scan Google Drive for unprocessed IPO candidates
  console.log("\n📡 Step 1: Checking Google Drive for IPO video folders...");
  const unprocessed = await getUnprocessedIPOsFromDrive();

  if (unprocessed.length === 0) {
    console.log("\n✨ No incoming IPO folders found in Google Drive! Exiting cleanly.");
    return;
  }

  // 1.1 Find the first candidate that still needs publishing on at least one enabled platform
  let selected: (typeof unprocessed)[0] | null = null;
  let needsYouTube = false;
  let needsInstagram = false;

  for (const candidate of unprocessed) {
    const ytDone = isIPOAlreadyOnYouTube(candidate.slug);
    const igDone = isIPOAlreadyOnInstagram(candidate.slug);

    const pendingYt = enableYouTube && !ytDone;
    const pendingIg = enableInstagram && !igDone;

    if (pendingYt || pendingIg) {
      selected = candidate;
      needsYouTube = pendingYt;
      needsInstagram = pendingIg;
      break;
    } else {
      // Both platforms already completed; archive to clean root if left over
      console.log(`ℹ️ "${candidate.name}" already published on all enabled platforms. Moving to 'Uploaded/'...`);
      try {
        await moveFolderToArchive(candidate.id, candidate.name, "Uploaded");
      } catch (_) {}
    }
  }

  if (!selected) {
    console.log("\n✨ All video folders on Google Drive have already been published! Exiting cleanly.");
    return;
  }

  console.log(`\n👉 Selected candidate for publishing: "${selected.name}" (${selected.slug})`);
  console.log(`   • Needs YouTube:   ${needsYouTube ? "YES" : "NO (Already uploaded or disabled)"}`);
  console.log(`   • Needs Instagram: ${needsInstagram ? "YES" : "NO (Already uploaded or disabled)"}`);

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

  let ytResult: YouTubeUploadResult | null = null;
  let ytError: any = null;
  let igResult: InstagramUploadResult | null = null;
  let igError: any = null;

  // 3. YouTube Publishing
  if (needsYouTube) {
    try {
      console.log("\n🤖 Step 3A: Generating viral YouTube metadata via Groq...");
      const ytMetadata = await generateYouTubeMetadata(
        assets.folderName,
        assets.ipoData,
        assets.scriptText
      );

      console.log("\n📺 Step 3B: Uploading and scheduling on YouTube...");
      ytResult = await uploadToYouTube(assets.videoPath, ytMetadata);

      recordYouTubeUpload({
        ipoSlug: assets.slug,
        companyName: assets.folderName,
        youtubeVideoId: ytResult.videoId,
        youtubeUrl: ytResult.videoUrl,
        publishedAt: new Date().toISOString(),
        scheduledFor: ytResult.scheduledFor,
        privacyStatus: ytResult.privacyStatus,
        title: ytResult.title,
        pinnedCommentId: ytResult.pinnedCommentId,
      });
      console.log("💾 YouTube upload recorded in data/uploaded_youtube.json");
    } catch (err: any) {
      ytError = err;
      console.error("❌ YouTube upload failed:", err.message || err);
    }
  }

  // 4. Instagram Reels Publishing
  if (needsInstagram) {
    try {
      console.log("\n🤖 Step 4A: Generating viral Instagram caption via Groq...");
      const igCaption = await generateInstagramCaption(
        assets.folderName,
        assets.ipoData,
        assets.scriptText
      );

      console.log("\n📸 Step 4B: Uploading and publishing Reel on Instagram...");
      igResult = await uploadToInstagramReels(assets.videoPath, igCaption);

      recordInstagramUpload({
        ipoSlug: assets.slug,
        companyName: assets.folderName,
        instagramMediaId: igResult.mediaId,
        permalink: igResult.permalink,
        publishedAt: igResult.publishedAt,
        captionPreview: igResult.captionPreview,
      });
      console.log("💾 Instagram upload recorded in data/uploaded_instagram.json");
    } catch (err: any) {
      igError = err;
      console.error("❌ Instagram upload failed:", err.message || err);
    }
  }

  // 5. Check if all required tasks for this candidate completed successfully
  const ytSuccessOrSkipped = !needsYouTube || ytResult !== null;
  const igSuccessOrSkipped = !needsInstagram || igResult !== null;

  if (ytSuccessOrSkipped && igSuccessOrSkipped) {
    console.log("\n📁 Step 5: Both platforms completed successfully! Moving folder to 'Uploaded/' on Google Drive...");
    try {
      await moveFolderToArchive(selected.id, selected.name, "Uploaded");
      console.log("   ✅ Folder archived cleanly.");
    } catch (driveErr: any) {
      console.warn("   ⚠️ Warning: Failed to move folder to 'Uploaded/':", driveErr.message || driveErr);
    }
  } else {
    console.warn("\n⚠️ Notice: One or more platforms failed. Folder will remain in incoming root for next retry.");
  }

  // 6. Cleanup local temp files
  try {
    fs.rmSync(path.dirname(assets.videoPath), { recursive: true, force: true });
    console.log("\n🧹 Cleaned up temporary local video cache.");
  } catch (_) {}

  // 7. Execution Summary
  console.log("\n==================================================");
  console.log("🎉  MULTI-PLATFORM PUBLICATION RUN SUMMARY");
  console.log("==================================================");
  console.log(`📁 Candidate:     ${selected.name}`);

  if (enableYouTube) {
    if (ytResult) {
      console.log(`📺 YouTube:       ✅ SUCCESS -> ${ytResult.videoUrl}`);
      if (ytResult.scheduledFor) console.log(`   Scheduled:     ${ytResult.scheduledFor}`);
    } else if (!needsYouTube) {
      console.log(`📺 YouTube:       ⚪ SKIPPED (Already published earlier)`);
    } else {
      console.log(`📺 YouTube:       ❌ FAILED (${ytError?.message || "Unknown error"})`);
    }
  }

  if (enableInstagram) {
    if (igResult) {
      console.log(`📸 Instagram:     ✅ SUCCESS -> ${igResult.permalink}`);
    } else if (!needsInstagram) {
      console.log(`📸 Instagram:     ⚪ SKIPPED (Already published earlier)`);
    } else {
      console.log(`📸 Instagram:     ❌ FAILED (${igError?.message || "Unknown error"})`);
    }
  }

  console.log("==================================================\n");

  // If both failed when both were required, exit with code 1 for alerting
  if ((needsYouTube && !ytResult) && (needsInstagram && !igResult)) {
    throw new Error("Both YouTube and Instagram uploads failed for this candidate.");
  }
}

runPublisherPipeline().catch((err) => {
  console.error("Fatal pipeline error:", err);
  process.exit(1);
});
