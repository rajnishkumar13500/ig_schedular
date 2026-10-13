import http from "http";
import url from "url";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const ROOT_DIR = path.resolve(__dirname, "../..");
const KNOWN_PROJECTS = [
  "schedular_shorts_ig",
  "yt shorts schedular",
  "yt fulllength schedular",
  "Automation shorts",
  "Automation fulllength",
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

async function runDriveAuth() {
  console.log("==================================================");
  console.log("🔑  GOOGLE DRIVE OAUTH2 RE-AUTHORIZATION");
  console.log("==================================================");

  const clientId = process.env.GDRIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    console.error("❌ GDRIVE_CLIENT_ID or GDRIVE_CLIENT_SECRET is missing in .env!");
    process.exit(1);
  }

  const redirectUri = "http://localhost:3000/oauth2callback";
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const scopes = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // Force new refresh_token
    scope: scopes,
  });

  console.log("\n👉 STEP 1: Opening browser to authorize Google Drive...\n");
  console.log("If your browser did not open automatically, open this URL:\n");
  console.log(authUrl);
  console.log("\n⏳ Waiting for callback on http://localhost:3000/oauth2callback ...\n");

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url && req.url.startsWith("/oauth2callback")) {
        const parsed = url.parse(req.url, true);
        const code = parsed.query.code as string;

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <html>
              <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 90vh; background: #0b0f19; color: #fff;">
                <div style="text-align: center; padding: 40px; border-radius: 12px; background: #161e2e; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                  <h1 style="color: #10b981; font-size: 32px; margin-bottom: 12px;">✅ Authorization Successful!</h1>
                  <p style="font-size: 16px; color: #9ca3af;">New Google Drive refresh token acquired.</p>
                  <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">You can close this tab and return to your terminal.</p>
                </div>
              </body>
            </html>
          `);

          server.close();

          console.log("📥 Authorization code received! Exchanging for tokens...");
          const { tokens } = await oauth2Client.getToken(code);

          if (!tokens.refresh_token) {
            console.warn("\n⚠️ Google did not return a refresh_token.");
            console.warn("Reason: You may need to revoke existing access at https://myaccount.google.com/connections first, or ensure prompt='consent'.");
            console.log("Tokens received:", tokens);
            process.exit(1);
          }

          console.log("\n==================================================");
          console.log("🎉 NEW GDRIVE_REFRESH_TOKEN ACQUIRED!");
          console.log("==================================================");
          console.log(tokens.refresh_token);
          console.log("==================================================\n");

          const updated = updateAllEnvs("GDRIVE_REFRESH_TOKEN", tokens.refresh_token);
          console.log("💾 Automatically updated local .env files:");
          for (const p of updated) {
            console.log(`   ✓ ${p}`);
          }

          console.log("\n📢 IMPORTANT: Next Steps for GitHub Actions:");
          console.log("1. Open each GitHub repository > Settings > Secrets and variables > Actions");
          console.log("2. Update the repository secret 'GDRIVE_REFRESH_TOKEN' with this new token.");
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

runDriveAuth();
