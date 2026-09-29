import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getYouTubeClient } from "./test_youtube";
import { YouTubeAIMetadata } from "./generate_metadata";

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
 * Calculates next prime publishing window in ISO 8601 UTC
 */
export function calculateScheduleTime(targetHourIST: number = 18): string {
  const now = new Date();
  // Target IST is UTC + 5:30. So UTC hour = targetHourIST - 5, min = 30
  const utcTargetHour = (targetHourIST - 5 + 24) % 24;
  const targetDate = new Date();

  targetDate.setUTCHours(utcTargetHour, 30, 0, 0);

  // If already past target today, schedule for tomorrow
  if (targetDate.getTime() <= now.getTime() + 15 * 60 * 1000) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  }

  return targetDate.toISOString();
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
    const hourIST = parseInt(process.env.YOUTUBE_SCHEDULE_HOUR_IST || "18", 10);
    publishAt = calculateScheduleTime(hourIST);
    privacyStatus = "private";
    console.log(`   ⏰ Video will be scheduled for: ${publishAt} (IST hour: ${hourIST}:30)`);
  } else {
    console.log(`   🔒 Privacy Status: ${privacyStatus}`);
  }

  const requestBody: any = {
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
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
