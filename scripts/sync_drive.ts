import fs from "fs";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";
import { isIPOAlreadyOnYouTube } from "./tracker";

dotenv.config();

export interface DriveIPOFolders {
  id: string;
  name: string;
  slug: string;
}

export interface DownloadedIPOAssets {
  folderName: string;
  slug: string;
  videoPath: string;
  ipoDataPath: string;
  scriptTextPath: string;
  ipoData: any;
  scriptText: string;
}

export function getDriveClient() {
  const refreshToken = process.env.GDRIVE_REFRESH_TOKEN?.trim();
  const clientId = process.env.GDRIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET?.trim();

  if (!refreshToken || !clientId || !clientSecret) {
    console.error("❌ Google Drive credentials missing in .env!");
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "http://localhost:3000/oauth2callback"
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Finds all unprocessed IPO folders in the Drive parent folder
 */
export async function getUnprocessedIPOsFromDrive(): Promise<DriveIPOFolders[]> {
  const parentFolderId = process.env.GDRIVE_PARENT_FOLDER_ID;
  if (!parentFolderId) {
    throw new Error("GDRIVE_PARENT_FOLDER_ID not set in .env!");
  }

  const drive = getDriveClient();
  if (!drive) throw new Error("Drive client initialization failed.");

  console.log(`\n🔍 Scanning Google Drive folder (${parentFolderId})...`);

  const res = await drive.files.list({
    q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name, createdTime)",
    orderBy: "createdTime desc",
  });

  const folders = res.data.files || [];
  console.log(`📁 Found ${folders.length} folder(s) in Drive.`);

  const unprocessed: DriveIPOFolders[] = [];
  for (const folder of folders) {
    if (!folder.name || !folder.id) continue;
    const slug = folder.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!isIPOAlreadyOnYouTube(slug) && !isIPOAlreadyOnYouTube(folder.name)) {
      unprocessed.push({
        id: folder.id,
        name: folder.name,
        slug,
      });
    } else {
      console.log(`   ⚡ [Already Uploaded] Skipping: "${folder.name}"`);
    }
  }

  return unprocessed;
}

/**
 * Downloads a Drive file to local disk
 */
async function downloadDriveFile(drive: any, fileId: string, destPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const dest = fs.createWriteStream(destPath);

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );

  return new Promise((resolve, reject) => {
    res.data
      .on("end", () => resolve())
      .on("error", (err: any) => reject(err))
      .pipe(dest);
  });
}

/**
 * Downloads the video and asset files for a selected IPO folder
 */
export async function downloadIPOAssetsFromDrive(
  folder: DriveIPOFolders,
  tempBaseDir: string = path.resolve(__dirname, "../temp")
): Promise<DownloadedIPOAssets | null> {
  const drive = getDriveClient();
  if (!drive) return null;

  const targetDir = path.join(tempBaseDir, folder.slug);
  fs.mkdirSync(targetDir, { recursive: true });

  console.log(`\n📥 Downloading assets for "${folder.name}" into temp/${folder.slug}...`);

  // 1. List files inside company folder
  const folderContent = await drive.files.list({
    q: `'${folder.id}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
  });

  const files = folderContent.data.files || [];
  let videoFile = files.find((f) => f.name?.endsWith(".mp4"));
  let assetsFolder = files.find(
    (f) => f.name === "assets" && f.mimeType === "application/vnd.google-apps.folder"
  );

  if (!videoFile) {
    console.error(`❌ No .mp4 video found in folder "${folder.name}"`);
    return null;
  }

  // 2. Download MP4
  const videoLocalPath = path.join(targetDir, videoFile.name!);
  console.log(`   📹 Downloading video: ${videoFile.name}...`);
  await downloadDriveFile(drive, videoFile.id!, videoLocalPath);
  console.log(`   ✅ Video downloaded (${(fs.statSync(videoLocalPath).size / 1024 / 1024).toFixed(1)} MB)`);

  // 3. Find files in assets/ subfolder
  let ipoDataContent: any = {};
  let scriptTextContent: string = "";
  const ipoDataLocalPath = path.join(targetDir, "ipo_data.json");
  const scriptTextLocalPath = path.join(targetDir, "script.txt");

  if (assetsFolder) {
    const assetsContent = await drive.files.list({
      q: `'${assetsFolder.id}' in parents and trashed = false`,
      fields: "files(id, name)",
    });

    const aFiles = assetsContent.data.files || [];
    const ipoDataFile = aFiles.find((f) => f.name === "ipo_data.json");
    const scriptFile = aFiles.find((f) => f.name === "script.txt");

    if (ipoDataFile) {
      console.log(`   📊 Downloading ipo_data.json...`);
      await downloadDriveFile(drive, ipoDataFile.id!, ipoDataLocalPath);
      try {
        ipoDataContent = JSON.parse(fs.readFileSync(ipoDataLocalPath, "utf-8"));
      } catch (_) {}
    }

    if (scriptFile) {
      console.log(`   📝 Downloading script.txt...`);
      await downloadDriveFile(drive, scriptFile.id!, scriptTextLocalPath);
      scriptTextContent = fs.readFileSync(scriptTextLocalPath, "utf-8");
    }
  }

  return {
    folderName: folder.name,
    slug: folder.slug,
    videoPath: videoLocalPath,
    ipoDataPath: ipoDataLocalPath,
    scriptTextPath: scriptTextLocalPath,
    ipoData: ipoDataContent,
    scriptText: scriptTextContent,
  };
}

// Standalone CLI runner
if (require.main === module) {
  (async () => {
    const unprocessed = await getUnprocessedIPOsFromDrive();
    console.log(`\n📋 Found ${unprocessed.length} unworked IPO folder(s) ready for YouTube:`);
    unprocessed.forEach((u, i) => console.log(`   ${i + 1}. ${u.name} (slug: ${u.slug})`));
  })();
}
