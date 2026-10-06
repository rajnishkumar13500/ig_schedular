import dotenv from "dotenv";

dotenv.config();

/**
 * Strips corporate legal noise words from company names so titles and hooks stay punchy.
 * e.g., "Kalyan Jewellers India Limited" -> "Kalyan Jewellers"
 * e.g., "Pooja Logistics Limited" -> "Pooja Logistics"
 */
export function cleanCompanyName(rawName: string): string {
  let cleaned = rawName.trim();

  // Strip corporate suffixes (case-insensitive)
  const suffixes = [
    /\b(private\s+limited|pvt\.?\s*ltd\.?)\b/gi,
    /\b(limited|ltd\.?)\b/gi,
    /\b(technologies|technology)\b/gi,
    /\b(industries|industry)\b/gi,
    /\b(holdings|holding)\b/gi,
    /\b(corporation|corp\.?)\b/gi,
    /\b(enterprises|enterprise)\b/gi,
    /\b(financial\s+services|finserve)\b/gi,
    /\b(solutions|services)\b/gi,
    /\bindia\b/gi,
    /& co\.?/gi,
  ];

  for (const pattern of suffixes) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Clean punctuation and multiple spaces
  cleaned = cleaned.replace(/[-–—,:()]/g, " ").replace(/\s+/g, " ").trim();

  // Strip trailing connectors like "and", "&", "of"
  cleaned = cleaned.replace(/\s+(and|&|of|the)$/i, "").trim();

  // If still very long (> 24 characters), keep the first 2-3 most distinct words
  if (cleaned.length > 24) {
    const words = cleaned.split(" ").filter(Boolean);
    if (words.length > 2) {
      cleaned = words.slice(0, 2).join(" ");
    }
  }

  // Fallback if empty
  if (!cleaned) {
    cleaned = rawName.split(" ")[0] || rawName;
  }

  return cleaned.trim();
}

/**
 * Uses Groq (Qwen/Llama) to generate a high-engagement Instagram Reels caption with emojis,
 * structured financial breakdown, engagement triggers, and targeted hashtags.
 */
export async function generateInstagramCaption(
  companyName: string,
  ipoData: any,
  scriptText: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  const shortBrandName = cleanCompanyName(companyName);
  const cleanComp = shortBrandName.toUpperCase();

  const fallbackCaption = `🚨 ${cleanComp} IPO: Apply or Avoid? Complete Review in 60 Seconds! 👇
────────────────────────
Should you invest in the upcoming ${shortBrandName} IPO? Here is everything you need to know before bidding!

📊 Key IPO Highlights:
• Issue Size: ${ipoData?.issue?.totalFormatted || "Check RHP"}
• Price Band: ${ipoData?.issue?.priceBand || "Check RHP"}
• Lot Size: ${ipoData?.issue?.lotSize || "N/A"} shares

📈 Financial Performance:
• Revenue: ${ipoData?.growth?.period1?.revenue || "N/A"} (${ipoData?.growth?.period1?.label || "FY23"}) ➔ ${ipoData?.growth?.period2?.revenue || "N/A"} (${ipoData?.growth?.period2?.label || "FY24"})
• Net Profit (PAT): ${ipoData?.profitability?.patFormatted || "N/A"} (${ipoData?.profitability?.patPeriod || ""})

💡 Analyst Verdict:
${ipoData?.myTake?.suggestion?.headlinePrefix || "Apply with caution"} ${ipoData?.myTake?.suggestion?.highlightWord || ""} ${ipoData?.myTake?.suggestion?.headlineSuffix || "based on valuation and GMP."}

💬 Will you apply for this IPO or skip? Comment 'APPLY' or 'SKIP' below! 👇
🔖 Save this reel so you don't miss the allotment date!
↗️ Share with a friend who is planning to invest.

⚠️ Disclaimer: Strictly for educational purposes only. Not financial or investment advice. Always consult a SEBI registered investment advisor before bidding.

.
.
#IPO #IPOAlert #${shortBrandName.replace(/[^a-zA-Z0-9]/g, "")}IPO #StockMarketIndia #ShareMarket #Nifty50 #Sensex #Investment #StockMarketNews #Trading #IndianStockMarket #FinanceTips #ReelsIndia #ReelsViral #FinanceReels #MutualFunds #StockMarketUpdate`;

  if (!apiKey) {
    console.warn("⚠️ GROQ_API_KEY not found. Using structured template for Instagram caption.");
    return fallbackCaption;
  }

  const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
  console.log(`\n📸 Generating viral Instagram Reels caption via Groq (${model})...`);
  console.log(`   🏷️ Company: "${companyName}" (Brand: "${shortBrandName}")`);

  const prompt = `You are a top Instagram financial content creator and growth strategist specializing in viral Instagram Reels about the stock market and IPOs.

Your task is to write a high-converting, aesthetically formatted Instagram Reel caption for an IPO review of "${shortBrandName}" (Full legal name: ${companyName}).

Financial Data:
- Brand Name: ${shortBrandName}
- Issue Size: ${ipoData?.issue?.totalFormatted || "N/A"}
- Price Band: ${ipoData?.issue?.priceBand || "N/A"}
- Lot Size: ${ipoData?.issue?.lotSize || "N/A"}
- Revenue Growth: ${ipoData?.growth?.period1?.revenue || "N/A"} ➔ ${ipoData?.growth?.period2?.revenue || "N/A"}
- Net Profit: ${ipoData?.profitability?.patFormatted || "N/A"}
- Verdict: ${ipoData?.myTake?.suggestion?.headlinePrefix || "Apply with caution"} ${ipoData?.myTake?.suggestion?.highlightWord || ""} ${ipoData?.myTake?.suggestion?.headlineSuffix || ""}
- Spoken Script: ${scriptText ? scriptText.substring(0, 1000) : "N/A"}

FORMATTING RULES:
1. Hook (Line 1): Bold, high curiosity hook (e.g. "🚨 ${shortBrandName} IPO: Apply or Avoid? Complete Breakdown! 👇").
2. 1-2 sentence preview hook before "more" click.
3. "📊 Key IPO Highlights:" Bullet points for Issue Size, Price Band, Lot Size.
4. "📈 Financial Snapshot:" Topline revenue & PAT figures.
5. "💡 Analyst Take:" 1 sentence verdict based on valuation and risks.
6. "💬 Engagement Call-to-Action:" Ask viewers to comment "APPLY" or "SKIP", plus save/share reminder.
7. "⚠️ Disclaimer:" Standard educational disclaimer (Not financial advice, consult SEBI advisor).
8. 20-25 high-traffic hashtags related to IPOs, Indian stock market, Nifty, and investing.
9. Keep total length strictly between 700 and 1500 characters. Use clean line breaks and emojis.

Return ONLY the raw caption text (no surrounding markdown code blocks, no backticks, no JSON).`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    let caption = data.choices[0]?.message?.content?.trim();

    if (!caption || caption.length < 50) {
      return fallbackCaption;
    }

    // Clean any unwanted surrounding formatting or markdown backticks
    caption = caption.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

    console.log(`✅ Generated Instagram Reels caption (${caption.length} chars)!`);
    return caption;
  } catch (error) {
    console.warn("⚠️ Groq caption generation error. Using template fallback:", error);
    return fallbackCaption;
  }
}
