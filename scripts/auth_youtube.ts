import http from "http";
import url from "url";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const ROOT_DIR = path.resolve(__dirname, "../..");
const KNOWN_PROJECTS = [
  "yt shorts schedular",
  "yt fulllength schedular",
  "schedular_shorts_ig",
];

function updateAllEnvs(tokenKey: string, tokenValue: string) {
  const updatedPaths: string[] = [];
  for (const proj of KNOWN_PROJECTS) {
    const envPath = path.join(ROOT_DIR, proj, ".env");
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, "utf-8");
      const regex = new RegExp(`^${tokenKey}=.*$`, "m");
      if (regex.test(content)) {
        content = content.replace(regex, `${tokenKey}=${tokenValue}`);
      } else {
        content = content.trimEnd() + `\n${tokenKey}=${tokenValue}\n`;
      }
      fs.writeFileSync(envPath, content, "utf-8");
      updatedPaths.push(envPath);
    }
  }
  return updatedPaths;
}

async function runYouTubeAuth() {
  console.log("==================================================");
  console.log("📺  YOUTUBE DATA API V3 OAUTH2 SETUP");
  console.log("==================================================");

  // Fallback to GDRIVE credentials if YOUTUBE is not set
  const clientId =
    process.env.YOUTUBE_CLIENT_ID?.trim() || process.env.GDRIVE_CLIENT_ID?.trim();
  const clientSecret =
    process.env.YOUTUBE_CLIENT_SECRET?.trim() || process.env.GDRIVE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    console.error("❌ Google Client ID or Client Secret is missing in .env!");
    process.exit(1);
  }

  const redirectUri = "http://localhost:3000/oauth2callback";
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const scopes = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
    "https://www.googleapis.com/auth/youtube.readonly",
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // Force refresh_token
    scope: scopes,
  });

  console.log("\n👉 STEP 1: Opening browser to authorize YouTube...\n");
  console.log("If your browser did not open automatically, open this URL:\n");
  console.log(authUrl);
  console.log("\n⏳ Waiting for authorization on http://localhost:3000/oauth2callback ...\n");

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url && req.url.startsWith("/oauth2callback")) {
        const parsed = url.parse(req.url, true);
        const code = parsed.query.code as string;

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <html>
              <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 90vh; background: #0f0f0f; color: #fff;">
                <div style="text-align: center; padding: 40px; border-radius: 12px; background: #212121; box-shadow: 0 4px 20px rgba(0,0,0,0.6);">
                  <h1 style="color: #ff0000; font-size: 32px; margin-bottom: 12px;">📺 YouTube Authorized!</h1>
                  <p style="font-size: 16px; color: #aaaaaa;">New YouTube upload refresh token acquired.</p>
                  <p style="font-size: 14px; color: #717171; margin-top: 20px;">You can now close this tab and return to your terminal.</p>
                </div>
              </body>
            </html>
          `);

          server.close();

          console.log("📥 Authorization code received! Exchanging for tokens...");
          const { tokens } = await oauth2Client.getToken(code);

          if (!tokens.refresh_token) {
            console.warn("\n⚠️ Google did not return a refresh_token.");
            console.log("Tokens:", tokens);
            process.exit(1);
          }

          console.log("\n==================================================");
          console.log("🎉 NEW YOUTUBE_REFRESH_TOKEN ACQUIRED!");
          console.log("==================================================");
          console.log(tokens.refresh_token);
          console.log("==================================================\n");

          const updated = updateAllEnvs("YOUTUBE_REFRESH_TOKEN", tokens.refresh_token);
          console.log("💾 Automatically updated local .env files:");
          for (const p of updated) {
            console.log(`   ✓ ${p}`);
          }

          console.log("\n📢 IMPORTANT: Next Steps for GitHub Actions:");
          console.log("1. Open YouTube scheduler repos (ipo-youtube-publisher, yt-schedular-full-length) > Settings > Secrets and variables > Actions");
          console.log("2. Update the repository secret 'YOUTUBE_REFRESH_TOKEN' with this new token.");
          console.log("3. Ensure Google Cloud Console OAuth Consent Screen is set to 'In production' (Publish App) so it does NOT expire after 7 days.");
          console.log("\n🚀 Done!");
          process.exit(0);
        }
      }
    } catch (err) {
      console.error("❌ Error exchanging code for token:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Authentication error. Check terminal logs.");
      server.close();
      process.exit(1);
    }
  });

  server.listen(3000, () => {
    import("child_process").then(({ exec }) => {
      const startCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
      try {
        exec(`${startCmd} "" "${authUrl}"`, () => {});
      } catch (_) {}
    });
  });
}

runYouTubeAuth();
