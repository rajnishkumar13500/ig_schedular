import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import {
  getUnprocessedIPOsFromDrive,
  folderContainsVideo,
  downloadIPOAssetsFromDrive,
} from "./sync_drive";
import {
  generateYouTubeMetadata,
  sanitizeYouTubeDescription,
  sanitizeYouTubeTitle,
  sanitizeYouTubeTags,
} from "./generate_metadata";
import { calculate24HourScheduleTime } from "./publish_youtube";

dotenv.config();

async function runPipelineAudit() {
  console.log("================================================================================");
  console.log("🔍  IPO YOUTUBE PUBLISHER: COMPREHENSIVE PIPELINE AUDIT & DRY RUN");
  console.log("================================================================================");

  // 1. Google Drive Audit
  console.log("\n[1/5] 📡 SCANNING GOOGLE DRIVE...");
  const unprocessed = await getUnprocessedIPOsFromDrive();
  if (unprocessed.length === 0) {
    console.log("⚠️ No unprocessed IPO folders found on Google Drive. Nothing to audit.");
    return;
  }

  const candidate = unprocessed[0];
  console.log(`   📁 Target Folder Name: "${candidate.name}"`);
  console.log(`   🆔 Folder ID:          ${candidate.id}`);
  console.log(`   🏷️ Normalized Slug:    ${candidate.slug}`);

  const hasVideo = await folderContainsVideo(candidate.id);
  console.log(`   📹 Video Present:      ${hasVideo ? "✅ YES (.mp4 verified)" : "❌ NO"}`);

  if (!hasVideo) {
    console.error("❌ Aborting audit: Candidate folder does not have an .mp4 file.");
    return;
  }

  // 2. Asset Fetching
  console.log("\n[2/5] 📥 DOWNLOADING & INSPECTING ASSETS...");
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

  // 3. AI Metadata Generation
  console.log("\n[3/5] 🤖 GENERATING & SANITIZING AI METADATA (Groq)...");
  const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
  console.log(`   🧠 Active LLM:         ${model}`);

  const metadata = await generateYouTubeMetadata(
    assets.folderName,
    assets.ipoData,
    assets.scriptText
  );

  // 4. Strict Validation Checks
  console.log("\n[4/5] 🛡️ PERFORMING STRICT YOUTUBE API COMPLIANCE CHECKS...");

  const cleanTitle = sanitizeYouTubeTitle(metadata.title);
  const cleanDescription = sanitizeYouTubeDescription(metadata.description);
  const cleanTags = sanitizeYouTubeTags(metadata.tags);
  const cleanComment = (metadata.pinnedComment || "").replace(/[<>]/g, "").trim();

  // Audit Checks
  const checks = [
    {
      name: "Title length <= 65 chars",
      passed: cleanTitle.length <= 65,
      detail: `Length: ${cleanTitle.length} chars`,
    },
    {
      name: "Title includes #Shorts",
      passed: cleanTitle.includes("#Shorts"),
      detail: cleanTitle.includes("#Shorts") ? "Includes #Shorts" : "Missing #Shorts",
    },
    {
      name: "Title contains NO '<' or '>'",
      passed: !cleanTitle.includes("<") && !cleanTitle.includes(">"),
      detail: "Clean of forbidden characters",
    },
    {
      name: "Description contains NO '<' or '>'",
      passed: !cleanDescription.includes("<") && !cleanDescription.includes(">"),
      detail: "Clean of forbidden characters",
    },
    {
      name: "Description length <= 4800 chars",
      passed: cleanDescription.length <= 4800,
      detail: `Length: ${cleanDescription.length} chars`,
    },
    {
      name: "Combined tags length <= 450 chars",
      passed: cleanTags.join(",").length <= 450,
      detail: `Total: ${cleanTags.join(",").length} chars across ${cleanTags.length} tags`,
    },
    {
      name: "No commas inside individual tags",
      passed: cleanTags.every((t) => !t.includes(",")),
      detail: "All tags comma-free",
    },
    {
      name: "Tags contain NO '<' or '>'",
      passed: cleanTags.every((t) => !t.includes("<") && !t.includes(">")),
      detail: "All tags clean of forbidden characters",
    },
    {
      name: "Pinned Comment contains NO '<' or '>'",
      passed: !cleanComment.includes("<") && !cleanComment.includes(">"),
      detail: "Clean of forbidden characters",
    },
  ];

  let allPassed = true;
  for (const c of checks) {
    const icon = c.passed ? "✅ PASS" : "❌ FAIL";
    if (!c.passed) allPassed = false;
    console.log(`   ${icon} - ${c.name} (${c.detail})`);
  }

  // 5. 24-Hour Forward Scheduling Check
  console.log("\n[5/5] ⏰ 24-HOUR FORWARD SCHEDULING CALCULATION...");
  const schedule = calculate24HourScheduleTime();
  const scheduleDateIST = new Date(schedule.publishAtIso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
  console.log(`   🎯 Target Window:     ${schedule.slotDescription}`);
  console.log(`   🌐 Scheduled (UTC):   ${schedule.publishAtIso}`);
  console.log(`   🇮🇳 Scheduled (IST):   ${scheduleDateIST}`);

  // Summary and Output Previews
  console.log("\n================================================================================");
  console.log("📄  FINAL PROCESSED OUTPUT PREVIEW FOR YOUTUBE");
  console.log("================================================================================");
  console.log(`\n📌 TITLE (${cleanTitle.length} chars):`);
  console.log(cleanTitle);

  console.log("\n📝 DESCRIPTION:");
  console.log("--------------------------------------------------------------------------------");
  console.log(cleanDescription);
  console.log("--------------------------------------------------------------------------------");

  console.log(`\n🏷️ TAGS (${cleanTags.length} tags, ${cleanTags.join(",").length} chars):`);
  console.log(cleanTags.map((t) => `"${t}"`).join(", "));

  console.log("\n💬 PINNED ENGAGEMENT COMMENT:");
  console.log(cleanComment);

  // Clean local temp files
  try {
    fs.rmSync(path.dirname(assets.videoPath), { recursive: true, force: true });
    console.log("\n🧹 Local temp test files cleaned up.");
  } catch (_) {}

  console.log("\n================================================================================");
  if (allPassed) {
    console.log("🎉  ALL VERIFICATION CHECKS PASSED! 100% READY FOR LIVE EXECUTION.");
  } else {
    console.log("⚠️  SOME CHECKS FAILED! REVIEW THE LOGS ABOVE.");
  }
  console.log("================================================================================");
}

runPipelineAudit().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
