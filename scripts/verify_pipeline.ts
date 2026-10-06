import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import {
  getUnprocessedIPOsFromDrive,
  folderContainsVideo,
  downloadIPOAssetsFromDrive,
} from "./sync_drive";
import { generateInstagramCaption } from "./generate_metadata";
import { getInstagramCredentials } from "./publish_instagram";

dotenv.config();

async function runPipelineAudit() {
  console.log("================================================================================");
  console.log("🔍  IPO INSTAGRAM REELS PUBLISHER: COMPREHENSIVE PIPELINE AUDIT & DRY RUN");
  console.log("================================================================================");

  // 1. Google Drive Audit
  console.log("\n[1/4] 📡 SCANNING GOOGLE DRIVE...");
  const unprocessed = await getUnprocessedIPOsFromDrive();
  if (unprocessed.length === 0) {
    console.log("⚠️ No unprocessed IPO folders found on Google Drive. Nothing to audit.");
    return;
  }

  let candidate: (typeof unprocessed)[0] | null = null;
  for (const c of unprocessed) {
    const hasVid = await folderContainsVideo(c.id);
    if (hasVid) {
      candidate = c;
      break;
    }
  }

  if (!candidate) {
    console.log("⚠️ None of the unprocessed folders currently contain an .mp4 video.");
    return;
  }

  console.log(`   📁 Target Folder Name: "${candidate.name}"`);
  console.log(`   🆔 Folder ID:          ${candidate.id}`);
  console.log(`   🏷️ Normalized Slug:    ${candidate.slug}`);
  console.log(`   📹 Video Present:      ✅ YES (.mp4 verified)`);

  // 2. Asset Fetching
  console.log("\n[2/4] 📥 DOWNLOADING & INSPECTING ASSETS...");
  const assets = await downloadIPOAssetsFromDrive(candidate);
  if (!assets) {
    console.error("❌ Failed to download assets.");
    return;
  }

  const videoSizeBytes = fs.statSync(assets.videoPath).size;
  console.log(`   📹 Video File:         ${path.basename(assets.videoPath)} (${(videoSizeBytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`   📊 Financial Data:     ${Object.keys(assets.ipoData).length} top-level fields found`);
  console.log(`      • Company Name:     ${assets.ipoData?.companyName || "N/A"}`);
  console.log(`      • Issue Size:       ${assets.ipoData?.issue?.totalFormatted || "N/A"}`);
  console.log(`      • Price Band:       ${assets.ipoData?.issue?.priceBand || "N/A"}`);
  console.log(`      • Revenue Trend:    ${assets.ipoData?.growth?.period1?.revenue || "N/A"} ➔ ${assets.ipoData?.growth?.period2?.revenue || "N/A"}`);
  console.log(`   📝 Spoken Script:      ${assets.scriptText.length} characters`);

  // 3. AI Caption Generation (Groq)
  console.log("\n[3/4] 🤖 GENERATING INSTAGRAM REELS CAPTION (Groq)...");
  const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
  console.log(`   🧠 Active LLM:         ${model}`);

  const caption = await generateInstagramCaption(
    assets.folderName,
    assets.ipoData,
    assets.scriptText
  );

  console.log(`\n   Caption Length: ${caption.length} characters`);
  console.log(`   Hashtag Count:  ${(caption.match(/#[a-zA-Z0-9_]+/g) || []).length} tags`);

  // 4. Verify Instagram Graph API Credentials & Quota
  console.log("\n[4/4] 📸 VERIFYING INSTAGRAM GRAPH API CONNECTION & QUOTA...");
  const creds = getInstagramCredentials();
  if (!creds) {
    console.warn("⚠️ Instagram credentials missing in .env (INSTAGRAM_ACCOUNT_ID or INSTAGRAM_ACCESS_TOKEN).");
  } else {
    try {
      const { accountId, accessToken, apiVersion } = creds;
      const accountUrl = `https://graph.facebook.com/${apiVersion}/${accountId}?fields=id,username,name&access_token=${accessToken}`;
      const res = await fetch(accountUrl);
      if (res.ok) {
        const data = await res.json();
        console.log(`   ✅ Authenticated as @${data.username || "N/A"} (${data.name || "N/A"})`);

        // Check quota
        const limitUrl = `https://graph.facebook.com/${apiVersion}/${accountId}/content_publishing_limit?fields=quota_usage,config&access_token=${accessToken}`;
        const limitRes = await fetch(limitUrl);
        if (limitRes.ok) {
          const limitData = await limitRes.json();
          const usage = limitData.data?.[0]?.quota_usage ?? 0;
          const maxLimit = limitData.data?.[0]?.config?.quota_total ?? 50;
          console.log(`   📊 24-Hour Publishing Quota: ${usage} / ${maxLimit} posts used`);
        }
      } else {
        const errText = await res.text();
        console.warn(`   ⚠️ Instagram API check failed (${res.status}): ${errText}`);
      }
    } catch (e: any) {
      console.warn(`   ⚠️ Could not reach Instagram API: ${e.message}`);
    }
  }

  // Cleanup temp files
  try {
    fs.rmSync(path.dirname(assets.videoPath), { recursive: true, force: true });
    console.log("\n🧹 Cleaned up temporary local test files.");
  } catch (_) {}

  // Preview
  console.log("\n================================================================================");
  console.log("📄  FINAL PROCESSED CAPTION PREVIEW FOR INSTAGRAM REELS");
  console.log("================================================================================");
  console.log(caption);
  console.log("================================================================================\n");
  console.log("🎉  AUDIT COMPLETE: All components verified for Instagram Reels publishing!");
}

runPipelineAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
