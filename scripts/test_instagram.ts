import dotenv from "dotenv";
import { getInstagramCredentials } from "./publish_instagram";

dotenv.config();

async function testInstagramConnection() {
  console.log("==================================================");
  console.log("📸  TESTING INSTAGRAM GRAPH API CREDENTIALS");
  console.log("==================================================");

  const creds = getInstagramCredentials();
  if (!creds) {
    console.error("\n❌ Instagram credentials missing in .env!");
    console.error("Please add the following to your .env file:");
    console.error("   INSTAGRAM_ACCOUNT_ID=your_instagram_business_account_id");
    console.error("   INSTAGRAM_ACCESS_TOKEN=your_never_expiring_access_token");
    console.error("   GRAPH_API_VERSION=v21.0 (optional, defaults to v21.0)\n");
    process.exit(1);
  }

  const { accountId, accessToken, apiVersion } = creds;
  console.log(`\n🔍 Verifying Account ID: ${accountId}`);
  console.log(`🌐 Graph API Version:    ${apiVersion}`);
  console.log(`🔑 Access Token:         ${accessToken.substring(0, 8)}...${accessToken.slice(-6)}`);

  try {
    // 1. Fetch Instagram Account Details
    const accountUrl = `https://graph.facebook.com/${apiVersion}/${accountId}?fields=id,username,name,biography,followers_count,media_count&access_token=${accessToken}`;
    const res = await fetch(accountUrl);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`\n❌ Failed to query Instagram account (${res.status}):`);
      console.error(`   ${errText}\n`);
      console.error("💡 Troubleshooting tips:");
      console.error("1. Ensure your Instagram account is switched to a Professional (Creator or Business) account.");
      console.error("2. Ensure the Instagram account is linked to a Facebook Page.");
      console.error("3. Ensure the token has 'instagram_content_publish' and 'instagram_basic' permissions.");
      process.exit(1);
    }

    const data = await res.json();
    console.log("\n✅ Successfully authenticated with Meta Instagram Graph API!");
    console.log(`   👤 Username:        @${data.username || "N/A"}`);
    console.log(`   🏷️  Display Name:    ${data.name || "N/A"}`);
    console.log(`   👥 Followers:       ${data.followers_count ?? "N/A"}`);
    console.log(`   🎬 Media Posts:     ${data.media_count ?? "N/A"}`);

    // 2. Check 24-hour Content Publishing Limit / Quota
    const limitUrl = `https://graph.facebook.com/${apiVersion}/${accountId}/content_publishing_limit?fields=quota_usage,config&access_token=${accessToken}`;
    try {
      const limitRes = await fetch(limitUrl);
      if (limitRes.ok) {
        const limitData = await limitRes.json();
        const usage = limitData.data?.[0]?.quota_usage ?? 0;
        const maxLimit = limitData.data?.[0]?.config?.quota_total ?? 50;
        console.log(`\n📊 24-Hour Publishing Quota: ${usage} / ${maxLimit} posts used`);
      }
    } catch (_) {}

    console.log("\n==================================================");
    console.log("🎉  INSTAGRAM CONNECTION IS 100% READY FOR AUTOMATION!");
    console.log("==================================================\n");
  } catch (err: any) {
    console.error("\n❌ Unexpected connection error:", err.message || err);
    process.exit(1);
  }
}

testInstagramConnection();
