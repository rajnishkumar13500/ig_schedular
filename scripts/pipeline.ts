import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import {
  getUnprocessedIPOsFromDrive,
  folderContainsVideo,
  downloadIPOAssetsFromDrive,
  moveFolderToArchive,
} from "./sync_drive";
import { generateInstagramCaption } from "./generate_metadata";
import { uploadToInstagramReels, InstagramUploadResult } from "./publish_instagram";
import {
  recordInstagramUpload,
  isIPOAlreadyOnInstagram,
} from "./tracker";

dotenv.config();

async function runInstagramPublisherPipeline() {
  console.log("==================================================");
  console.log("📸  IPO INSTAGRAM REELS AUTO-PUBLISHER PIPELINE");
  console.log("==================================================");

  // 1. Scan Google Drive for unprocessed IPO candidates
  console.log("\n📡 Step 1: Checking Google Drive for IPO video folders...");
  const unprocessed = await getUnprocessedIPOsFromDrive();

  if (unprocessed.length === 0) {
    console.log("\n✨ No candidate IPO folders found in Google Drive! Exiting cleanly.");
    return;
  }

  // 1.1 Find the first candidate that still needs publishing on Instagram
  let selected: (typeof unprocessed)[0] | null = null;

  for (const candidate of unprocessed) {
    const alreadyDone = isIPOAlreadyOnInstagram(candidate.slug);

    if (alreadyDone) {
      console.log(`ℹ️ "${candidate.name}" already published on Instagram. Moving to 'Uploaded/'...`);
      try {
        await moveFolderToArchive(candidate.id, candidate.name, "Uploaded");
      } catch (_) {}
      continue;
    }

    // Check if folder has a completed .mp4 video
    const hasVideo = await folderContainsVideo(candidate.id);
    if (!hasVideo) {
      console.log(`⏳ "${candidate.name}" has no .mp4 video yet (render in progress). Skipping to next candidate...`);
      continue;
    }

    selected = candidate;
    break;
  }

  if (!selected) {
    console.log("\n✨ No ready-to-publish video candidates found (either already uploaded or pending render). Exiting cleanly.");
    return;
  }

  console.log(`\n👉 Selected candidate for publishing: "${selected.name}" (${selected.slug})`);

  // 2. Download Video & Assets from Google Drive
  console.log("\n📥 Step 2: Downloading video and metadata from Google Drive...");
  const assets = await downloadIPOAssetsFromDrive(selected);

  if (!assets) {
    console.warn(`⚠️ Could not retrieve assets for "${selected.name}". Gracefully exiting.`);
    return;
  }

  let igResult: InstagramUploadResult | null = null;

  try {
    // 3. Generate Instagram Reels Caption via Groq
    console.log("\n🤖 Step 3: Generating viral Instagram Reels caption via Groq...");
    const igCaption = await generateInstagramCaption(
      assets.folderName,
      assets.ipoData,
      assets.scriptText
    );

    // 4. Upload and Publish Reel to Instagram
    console.log("\n📸 Step 4: Uploading and publishing Reel to Instagram...");
    igResult = await uploadToInstagramReels(assets.videoPath, igCaption);

    // 5. Record Upload in Tracker
    recordInstagramUpload({
      ipoSlug: assets.slug,
      companyName: assets.folderName,
      instagramMediaId: igResult.mediaId,
      permalink: igResult.permalink,
      publishedAt: igResult.publishedAt,
      captionPreview: igResult.captionPreview,
    });
    console.log("💾 Instagram upload recorded in data/uploaded_instagram.json");

    // 6. Move Folder to Archive on Google Drive
    console.log("\n📁 Step 5: Archiving folder to 'Uploaded/' on Google Drive...");
    try {
      await moveFolderToArchive(selected.id, selected.name, "Uploaded");
      console.log("   ✅ Folder moved to 'Uploaded/' successfully.");
    } catch (driveErr: any) {
      console.warn("   ⚠️ Warning: Failed to move folder to 'Uploaded/':", driveErr.message || driveErr);
    }
  } catch (err: any) {
    console.error("\n❌ Instagram Reels publication failed:", err.message || err);
    console.warn("   Folder remains in incoming root for next retry.");
    throw err;
  } finally {
    // 7. Cleanup local temp files
    try {
      fs.rmSync(path.dirname(assets.videoPath), { recursive: true, force: true });
      console.log("\n🧹 Cleaned up temporary local video cache.");
    } catch (_) {}
  }

  // 8. Execution Summary
  console.log("\n==================================================");
  console.log("🎉  INSTAGRAM REELS PUBLICATION COMPLETED");
  console.log("==================================================");
  console.log(`📁 Candidate:     ${selected.name}`);
  console.log(`📸 Instagram:     ✅ SUCCESS -> ${igResult.permalink}`);
  console.log(`🆔 Media ID:      ${igResult.mediaId}`);
  console.log(`⏰ Published At:  ${igResult.publishedAt}`);
  console.log("==================================================\n");
}

runInstagramPublisherPipeline().catch((err) => {
  console.error("Fatal pipeline error:", err);
  process.exit(1);
});
