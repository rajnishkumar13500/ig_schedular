import dotenv from "dotenv";

dotenv.config();

export interface YouTubeAIMetadata {
  title: string;
  description: string;
  tags: string[];
  pinnedComment: string;
}

/**
 * Uses Groq to generate viral YouTube Shorts metadata
 */
export async function generateYouTubeMetadata(
  companyName: string,
  ipoData: any,
  scriptText: string
): Promise<YouTubeAIMetadata> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY missing in .env!");
  }

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  console.log(`\n🤖 Generating viral YouTube metadata via Groq (${model})...`);

  const prompt = `You are an elite YouTube growth strategist & financial content creator specializing in high-retention viral YouTube Shorts about the Indian stock market.

Your task is to generate complete, high-CTR, SEO-optimized metadata for an IPO review YouTube Short about "${companyName}".

Financial Data & Context:
- Company: ${companyName}
- Issue Size: ${ipoData?.issue?.totalFormatted || "N/A"}
- Price Band: ${ipoData?.issue?.priceBand || "N/A"}
- Lot Size: ${ipoData?.issue?.lotSize || "N/A"}
- Revenue: ${ipoData?.growth?.period1?.revenue || "N/A"} (${ipoData?.growth?.period1?.label}) -> ${ipoData?.growth?.period2?.revenue || "N/A"} (${ipoData?.growth?.period2?.label})
- Profitability (PAT): ${ipoData?.profitability?.patFormatted || "N/A"} (${ipoData?.profitability?.patPeriod || "N/A"})
- Recommendation / Take: ${ipoData?.myTake?.suggestion?.headlinePrefix || "Apply with caution"} ${ipoData?.myTake?.suggestion?.highlightWord || ""} ${ipoData?.myTake?.suggestion?.headlineSuffix || ""}
- Narration Script Used:
${scriptText ? scriptText.substring(0, 1500) : "N/A"}

REQUIREMENTS:
1. "title": Must be extremely clickable, high-CTR, punchy, under 70 characters total, and end with #Shorts.
   Example: "${companyName} IPO Review: Apply or Avoid? 🚨 #Shorts" or "Is ${companyName} IPO a TRAP? ⚠️ (Reality Check) #Shorts"
2. "description":
   - First 2 lines: High hook summary (before viewer clicks "more").
   - 📌 IPO Quick Snapshot: Clean bullet points with Issue Size, Price Band, Lot Size, Dates.
   - 📊 Financial Highlights: Topline revenue growth & net profit figures.
   - ⚠️ SEBI Compliance Disclaimer: Clear standard disclaimer ("For educational purposes only. Not financial or investment advice. Consult a SEBI registered advisor.").
   - 🏷️ Hashtags: 5-8 trending hashtags at bottom (e.g. #${companyName.replace(/[^a-zA-Z0-9]/g, "")}IPO #IPONews #StockMarketIndia #Shorts #IPOReview).
3. "tags": Array of 15-20 targeted, high-search-volume keywords (e.g. "${companyName.toLowerCase()} ipo", "${companyName.toLowerCase()} ipo gmp", "${companyName.toLowerCase()} ipo review", "upcoming ipo 2026", "stock market shorts", "ipo apply or avoid").
4. "pinnedComment": A friendly, high-engagement question designed to get viewers commenting immediately (e.g. "Will you be applying for ${companyName} or skipping this one? Share your strategy in the comments! 👇").

Return ONLY a valid JSON object matching this exact schema (no markdown, no backticks):
{
  "title": "...",
  "description": "...",
  "tags": ["tag1", "tag2", ...],
  "pinnedComment": "..."
}`;

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
        temperature: 0.6,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content) as YouTubeAIMetadata;
    console.log(`✅ Generated viral metadata!`);
    console.log(`   📌 Title: "${parsed.title}"`);
    console.log(`   🏷️ Tags count: ${parsed.tags?.length || 0}`);
    return parsed;
  } catch (error) {
    console.warn("⚠️ Groq metadata generation error. Falling back to template:", error);
    const cleanComp = companyName.toUpperCase();
    return {
      title: `${cleanComp} IPO Review: Apply or Avoid? 🚨 #Shorts`,
      description: `Complete analysis of ${cleanComp} IPO! Key metrics, valuation, growth, and risks analyzed.\n\n📌 IPO Details:\n• Issue Size: ${ipoData?.issue?.totalFormatted || "Check RHP"}\n• Price Band: ${ipoData?.issue?.priceBand || "Check RHP"}\n• Lot Size: ${ipoData?.issue?.lotSize || "N/A"}\n\n⚠️ Disclaimer: Strictly for educational purposes only. Not investment or financial advice.\n\n#${cleanComp.replace(/[^a-zA-Z0-9]/g, "")}IPO #IPONews #StockMarketIndia #Shorts #StockMarket`,
      tags: [
        `${companyName.toLowerCase()} ipo`,
        `${companyName.toLowerCase()} ipo review`,
        `${companyName.toLowerCase()} ipo gmp`,
        "ipo review today",
        "upcoming ipo 2026",
        "stock market india",
        "share market shorts",
        "stock market shorts",
      ],
      pinnedComment: `Will you be applying for ${cleanComp} IPO or avoiding? Let us know in the comments below! 👇`,
    };
  }
}
