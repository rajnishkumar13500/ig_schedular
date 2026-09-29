import dotenv from "dotenv";

dotenv.config();

export interface YouTubeAIMetadata {
  title: string;
  description: string;
  tags: string[];
  pinnedComment: string;
}

/**
 * Strips corporate legal noise words from company names so titles stay punchy and under length limits.
 * e.g., "Kalyan Jewellers India Limited" -> "Kalyan Jewellers"
 * e.g., "Pooja Logistics Limited" -> "Pooja Logistics"
 */
export function cleanCompanyNameForTitle(rawName: string): string {
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

  // If still very long (> 22 characters), extract the first 2-3 most distinct words
  if (cleaned.length > 22) {
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
 * Uses Groq (Qwen/Llama) to generate viral YouTube Shorts metadata with strict length constraints
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
  const shortBrandName = cleanCompanyNameForTitle(companyName);

  console.log(`\n🤖 Generating viral YouTube metadata via Groq (${model})...`);
  console.log(`   🏷️ Raw Name: "${companyName}" ➔ Short Brand: "${shortBrandName}"`);

  const prompt = `You are an elite YouTube growth strategist & financial content creator specializing in high-retention viral YouTube Shorts about the Indian stock market.

Your task is to generate complete, high-CTR, SEO-optimized metadata for an IPO review YouTube Short about "${shortBrandName}" (Full legal name: ${companyName}).

Financial Data & Context:
- Company Brand: ${shortBrandName}
- Issue Size: ${ipoData?.issue?.totalFormatted || "N/A"}
- Price Band: ${ipoData?.issue?.priceBand || "N/A"}
- Lot Size: ${ipoData?.issue?.lotSize || "N/A"}
- Revenue Growth: ${ipoData?.growth?.period1?.revenue || "N/A"} (${ipoData?.growth?.period1?.label}) -> ${ipoData?.growth?.period2?.revenue || "N/A"} (${ipoData?.growth?.period2?.label})
- Profitability (PAT): ${ipoData?.profitability?.patFormatted || "N/A"} (${ipoData?.profitability?.patPeriod || "N/A"})
- Recommendation / Take: ${ipoData?.myTake?.suggestion?.headlinePrefix || "Apply with caution"} ${ipoData?.myTake?.suggestion?.highlightWord || ""} ${ipoData?.myTake?.suggestion?.headlineSuffix || ""}
- Narration Script:
${scriptText ? scriptText.substring(0, 1400) : "N/A"}

CRITICAL TITLE REQUIREMENTS (STRICT):
1. "title": MUST be strictly UNDER 60 characters total, punchy, and MUST end with "#Shorts".
   Mobile YouTube cuts off titles longer than 65 characters!
   DO NOT use long corporate suffixes in the title (use "${shortBrandName}").
   Formula: "${shortBrandName} IPO: [Hook / Psychological Trigger] 🚨 #Shorts"
   Approved Hooks: "Apply or Avoid?", "Big Trap?", "Reality Check!", "Truth Revealed!"
   Examples:
   - "${shortBrandName} IPO: Apply or Avoid? 🚨 #Shorts"
   - "Is ${shortBrandName} IPO a Trap? ⚠️ #Shorts"
   - "${shortBrandName} IPO Review: Shocking Truth! #Shorts"

2. "description":
   - First 2 lines: High hook summary (before viewer clicks "more").
   - 📌 IPO Quick Snapshot: Clean bullet points with Issue Size, Price Band, Lot Size.
   - 📊 Financial Highlights: Topline revenue growth & net profit figures.
   - ⚠️ SEBI Compliance Disclaimer: Clear standard disclaimer ("For educational purposes only. Not financial or investment advice. Consult a SEBI registered advisor before investing.").
   - 🏷️ Hashtags: 5-8 trending hashtags at bottom (e.g. #${shortBrandName.replace(/[^a-zA-Z0-9]/g, "")}IPO #IPONews #StockMarketIndia #Shorts #IPOReview).

3. "tags": Array of 15-20 targeted, high-search-volume keywords (e.g. "${shortBrandName.toLowerCase()} ipo", "${companyName.toLowerCase()} ipo", "${shortBrandName.toLowerCase()} ipo gmp", "${shortBrandName.toLowerCase()} ipo review", "upcoming ipo 2026", "stock market shorts", "ipo apply or avoid").

4. "pinnedComment": A friendly, high-engagement question designed to spark instant viewer discussions (e.g. "Will you be applying for ${shortBrandName} IPO or skipping this one? Share your thoughts below! 👇").

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

    // Strict Double-Lock Safeguard: Enforce Title Length <= 65 chars & ensure #Shorts
    let finalTitle = (parsed.title || "").trim();
    if (!finalTitle.includes("#Shorts")) {
      finalTitle = `${finalTitle} #Shorts`.trim();
    }

    if (finalTitle.length > 65) {
      console.warn(`⚠️ Generated title was too long (${finalTitle.length} chars). Applying safe fallback clamp.`);
      finalTitle = `${shortBrandName} IPO: Apply or Avoid? 🚨 #Shorts`;
      if (finalTitle.length > 65) {
        finalTitle = `${shortBrandName.slice(0, 18).trim()} IPO: Apply or Avoid? 🚨 #Shorts`;
      }
    }

    parsed.title = finalTitle;

    console.log(`✅ Generated viral metadata!`);
    console.log(`   📌 Title (${parsed.title.length} chars): "${parsed.title}"`);
    console.log(`   🏷️ Tags count: ${parsed.tags?.length || 0}`);
    return parsed;
  } catch (error) {
    console.warn("⚠️ Groq metadata generation error. Falling back to template:", error);
    const cleanComp = shortBrandName.toUpperCase();
    const fallbackTitle = `${cleanComp} IPO: Apply or Avoid? 🚨 #Shorts`;

    return {
      title: fallbackTitle.length <= 65 ? fallbackTitle : `${cleanComp.slice(0, 18).trim()} IPO: Apply or Avoid? 🚨 #Shorts`,
      description: `Complete breakdown of ${cleanComp} IPO! Key metrics, valuation, growth, and risks analyzed.\n\n📌 IPO Details:\n• Issue Size: ${ipoData?.issue?.totalFormatted || "Check RHP"}\n• Price Band: ${ipoData?.issue?.priceBand || "Check RHP"}\n• Lot Size: ${ipoData?.issue?.lotSize || "N/A"}\n\n⚠️ Disclaimer: Strictly for educational purposes only. Not investment or financial advice.\n\n#${cleanComp.replace(/[^a-zA-Z0-9]/g, "")}IPO #IPONews #StockMarketIndia #Shorts #StockMarket`,
      tags: [
        `${shortBrandName.toLowerCase()} ipo`,
        `${companyName.toLowerCase()} ipo`,
        `${shortBrandName.toLowerCase()} ipo review`,
        `${shortBrandName.toLowerCase()} ipo gmp`,
        "ipo review today",
        "upcoming ipo 2026",
        "stock market india",
        "share market shorts",
        "stock market shorts",
        "ipo apply or avoid",
      ],
      pinnedComment: `Will you be applying for ${cleanComp} IPO or avoiding? Let us know in the comments below! 👇`,
    };
  }
}
