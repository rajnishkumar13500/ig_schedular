import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export interface InstagramUploadResult {
  mediaId: string;
  permalink?: string;
  publishedAt: string;
  captionPreview: string;
}

export function getInstagramCredentials() {
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID?.trim();
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const apiVersion = process.env.GRAPH_API_VERSION?.trim() || "v21.0";

  if (!accountId || !accessToken) {
    return null;
  }

  return { accountId, accessToken, apiVersion };
}

/**
 * Step 1: Initialize Resumable Reels Media Container on Meta Graph API
 */
async function createReelsContainer(
  accountId: string,
  accessToken: string,
  caption: string,
  apiVersion: string
): Promise<string> {
  const url = `https://graph.facebook.com/${apiVersion}/${accountId}/media`;

  const params = new URLSearchParams({
    upload_type: "resumable",
    media_type: "REELS",
    caption,
    share_to_feed: "true",
    access_token: accessToken,
  });

  const res = await fetch(`${url}?${params.toString()}`, {
    method: "POST",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Meta Graph API media container creation failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error(`Invalid response from Meta API: container id missing.`);
  }

  return data.id;
}

/**
 * Step 2: Stream Raw Video Binary to Meta's Resumable Upload Server (rupload.facebook.com)
 */
async function uploadVideoBinary(
  containerId: string,
  videoPath: string,
  accessToken: string,
  apiVersion: string
): Promise<void> {
  const fileSize = fs.statSync(videoPath).size;
  const uploadUrl = `https://rupload.facebook.com/ig-api-upload/${apiVersion}/${containerId}`;

  console.log(`   📤 Streaming binary video (${(fileSize / 1024 / 1024).toFixed(1)} MB) to rupload.facebook.com...`);

  const fileBuffer = fs.readFileSync(videoPath);

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${accessToken}`,
      offset: "0",
      file_size: fileSize.toString(),
      "Content-Type": "application/octet-stream",
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`rupload binary upload failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { success?: boolean };
  if (data.success === false) {
    throw new Error(`rupload server reported failure: ${JSON.stringify(data)}`);
  }

  console.log(`   ✅ Binary upload acknowledged by Meta servers.`);
}

/**
 * Step 3: Poll Container Processing Status until 'FINISHED'
 */
async function pollContainerStatus(
  containerId: string,
  accessToken: string,
  apiVersion: string,
  maxWaitMs: number = 180000 // 3 minutes max
): Promise<void> {
  const statusUrl = `https://graph.facebook.com/${apiVersion}/${containerId}?fields=status_code,status&access_token=${accessToken}`;
  const startTime = Date.now();
  const pollIntervalMs = 5000;

  console.log(`   ⏳ Polling Instagram Reels processing status...`);

  while (Date.now() - startTime < maxWaitMs) {
    const res = await fetch(statusUrl);
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`   ⚠️ Status check warning (${res.status}): ${errText}. Retrying...`);
    } else {
      const data = (await res.json()) as { status_code?: string; status?: string };
      const statusCode = data.status_code?.toUpperCase();

      if (statusCode === "FINISHED") {
        console.log(`   ✅ Video processing completed! Status: FINISHED`);
        return;
      }

      if (statusCode === "ERROR") {
        throw new Error(`Instagram video processing failed: ${JSON.stringify(data)}`);
      }

      console.log(`      Status: ${statusCode || data.status || "IN_PROGRESS"} (elapsed: ${Math.round((Date.now() - startTime) / 1000)}s)...`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for Instagram Reel container ${containerId} to finish processing.`);
}

/**
 * Step 4: Publish the Verified Media Container to Instagram Reels
 */
async function publishReelsContainer(
  accountId: string,
  containerId: string,
  accessToken: string,
  apiVersion: string
): Promise<string> {
  const publishUrl = `https://graph.facebook.com/${apiVersion}/${accountId}/media_publish`;

  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  });

  const res = await fetch(`${publishUrl}?${params.toString()}`, {
    method: "POST",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Instagram media_publish failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error(`Invalid media_publish response: media ID missing.`);
  }

  return data.id;
}

/**
 * Step 5: Fetch Published Reel Permalink for tracking
 */
async function getReelPermalink(
  mediaId: string,
  accessToken: string,
  apiVersion: string
): Promise<string | undefined> {
  try {
    const url = `https://graph.facebook.com/${apiVersion}/${mediaId}?fields=permalink,shortcode&access_token=${accessToken}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as { permalink?: string };
      return data.permalink;
    }
  } catch (_) {}
  return undefined;
}

/**
 * Complete Instagram Reels Publisher Workflow:
 * 1. Create Resumable Container
 * 2. Stream Binary MP4 to rupload.facebook.com
 * 3. Poll container readiness until FINISHED
 * 4. Publish Reel
 * 5. Retrieve public permalink
 */
export async function uploadToInstagramReels(
  videoPath: string,
  caption: string
): Promise<InstagramUploadResult> {
  const creds = getInstagramCredentials();
  if (!creds) {
    throw new Error(
      "Instagram credentials missing in .env! Required: INSTAGRAM_ACCOUNT_ID and INSTAGRAM_ACCESS_TOKEN"
    );
  }

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found at: ${videoPath}`);
  }

  const { accountId, accessToken, apiVersion } = creds;
  console.log(`\n📸 Starting Meta Instagram Reels Auto-Publishing...`);
  console.log(`   👤 Account ID: ${accountId}`);

  // 1. Initialize Container
  console.log(`   📦 Creating Reels media container...`);
  const containerId = await createReelsContainer(accountId, accessToken, caption, apiVersion);
  console.log(`   🆔 Container ID: ${containerId}`);

  // 2. Upload Video Binary via rupload
  await uploadVideoBinary(containerId, videoPath, accessToken, apiVersion);

  // 3. Poll Status
  await pollContainerStatus(containerId, accessToken, apiVersion);

  // 4. Publish
  console.log(`   🚀 Publishing Reel to Instagram feed...`);
  const mediaId = await publishReelsContainer(accountId, containerId, accessToken, apiVersion);
  console.log(`   🎉 Published successfully! Media ID: ${mediaId}`);

  // 5. Get Public Permalink
  const permalink = await getReelPermalink(mediaId, accessToken, apiVersion);
  if (permalink) {
    console.log(`   🔗 Instagram Reel URL: ${permalink}`);
  }

  return {
    mediaId,
    permalink: permalink || `https://www.instagram.com/p/${mediaId}`,
    publishedAt: new Date().toISOString(),
    captionPreview: caption.substring(0, 100).replace(/\n/g, " "),
  };
}
