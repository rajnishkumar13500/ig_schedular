import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getYouTubeClient } from "./test_youtube";
import {
  YouTubeAIMetadata,
  sanitizeYouTubeDescription,
  sanitizeYouTubeTitle,
  sanitizeYouTubeTags,
} from "./generate_metadata";

dotenv.config();

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
  title: string;
  privacyStatus: string;
  scheduledFor?: string;
  pinnedCommentId?: string;
}

/**
 * Calculates a 24-hour forward schedule time in ISO 8601 UTC.
 * - Morning runs (before 14:00 IST) schedule for Tomorrow Morning at 09:00 AM IST (03:30 UTC)
 * - Evening runs (at or after 14:00 IST) schedule for Tomorrow Evening at 06:30 PM IST (13:00 UTC)
 *
 * This provides a ~23-24 hour forward gap that is 100% immune to GitHub Actions runner queue delays.
 */
export function calculate24HourScheduleTime(): { publishAtIso: string; slotDescription: string } {
  const now = new Date();

  // Convert current time to IST (UTC + 5:30)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(now.getTime() + istOffsetMs);
  const currentHourIST = nowIST.getUTCHours(); // Hour in IST

  const isMorningRun = currentHourIST < 14;

  // Target IST time tomorrow:
  // Morning slot: 09:00 AM IST -> 03:30 UTC
  // Evening slot: 06:30 PM IST (18:30) -> 13:00 UTC
  const targetUtcHour = isMorningRun ? 3 : 13;
  const targetUtcMinute = isMorningRun ? 30 : 0;
  const slotDescription = isMorningRun
    ? "Tomorrow Morning (09:00 AM IST)"
    : "Tomorrow Evening (06:30 PM IST)";

  // Tomorrow's date in UTC
  const targetDate = new Date(now.getTime());
  targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  targetDate.setUTCHours(targetUtcHour, targetUtcMinute, 0, 0);

  // Safety buffer: ensure targetDate is at least 12 hours in the future
  if (targetDate.getTime() - now.getTime() < 12 * 60 * 60 * 1000) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  }

  return {
    publishAtIso: targetDate.toISOString(),
    slotDescription,
  };
}

/**
 * Uploads video and attaches metadata to YouTube
 */
export async function uploadToYouTube(
  videoPath: string,
  metadata: YouTubeAIMetadata
): Promise<YouTubeUploadResult> {
  const youtube = getYouTubeClient();
  if (!youtube) {
    throw new Error("YouTube credentials not configured! Run: npm run auth:youtube");
  }

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found at: ${videoPath}`);
  }

  const fileSize = fs.statSync(videoPath).size;
  console.log(`\n🚀 Uploading video to YouTube (${(fileSize / 1024 / 1024).toFixed(1)} MB)...`);
  console.log(`   📌 Title: "${metadata.title}"`);

  let privacyStatus = process.env.YOUTUBE_PRIVACY_STATUS || "public";
  let publishAt: string | undefined = undefined;

  const autoSchedule = process.env.YOUTUBE_AUTO_SCHEDULE === "true";
  if (autoSchedule) {
    const { publishAtIso, slotDescription } = calculate24HourScheduleTime();
    publishAt = publishAtIso;
    privacyStatus = "private";
    console.log(`   ⏰ 24-Hour Forward Scheduling Activated!`);
    console.log(`      Target Slot:     ${slotDescription}`);
    console.log(`      Scheduled (UTC): ${publishAt}`);
  } else {
    console.log(`   🔒 Privacy Status: ${privacyStatus}`);
  }

  const cleanTitle = sanitizeYouTubeTitle(metadata.title);
  const cleanDescription = sanitizeYouTubeDescription(metadata.description);
  const cleanTags = sanitizeYouTubeTags(metadata.tags);

  const requestBody: any = {
    snippet: {
      title: cleanTitle,
      description: cleanDescription,
      tags: cleanTags,
      categoryId: process.env.YOUTUBE_CATEGORY_ID || "27", // 27 = Education
      defaultLanguage: process.env.YOUTUBE_DEFAULT_LANGUAGE || "en",
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  };

  if (publishAt) {
    requestBody.status.publishAt = publishAt;
  }

  // 1. Resumable Upload
  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody,
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  const videoId = res.data.id!;
  const videoUrl = `https://youtu.be/${videoId}`;
  console.log(`\n🎉 Upload successful!`);
  console.log(`🆔 Video ID:  ${videoId}`);
  console.log(`🔗 Video URL: ${videoUrl}`);

  // 2. Post Top-level Engagement Comment
  let commentId: string | undefined = undefined;
  if (metadata.pinnedComment && metadata.pinnedComment.trim()) {
    try {
      console.log(`\n💬 Posting engagement comment...`);
      const commentRes = await youtube.commentThreads.insert({
        part: ["snippet"],
        requestBody: {
          snippet: {
            videoId,
            topLevelComment: {
              snippet: {
                textOriginal: metadata.pinnedComment,
              },
            },
          },
        },
      });
      commentId = commentRes.data.id!;
      console.log(`✅ Comment posted (ID: ${commentId})`);
    } catch (commentErr: any) {
      console.warn(`⚠️ Could not post comment:`, commentErr.message || commentErr);
    }
  }

  return {
    videoId,
    videoUrl,
    title: metadata.title,
    privacyStatus,
    scheduledFor: publishAt,
    pinnedCommentId: commentId,
  };
}
