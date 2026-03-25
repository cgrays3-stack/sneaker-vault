export type ParsedLabelResult = {
  brand: string | null;
  model: string | null;
  official_product_name: string | null;
  common_nickname: string | null;
  colorway: string | null;
  sku: string | null;
  size: string | null;
};

export type SneakerContext = {
  nickname?: string | null;
  brand?: string | null;
  model?: string | null;
  official_product_name?: string | null;
  common_nickname?: string | null;
  colorway?: string | null;
  sku?: string | null;
  size?: string | null;
};

function buildContextText(context?: SneakerContext) {
  if (!context) return "No existing sneaker metadata available.";

  const entries = [
    ["nickname", context.nickname],
    ["brand", context.brand],
    ["model", context.model],
    ["official_product_name", context.official_product_name],
    ["common_nickname", context.common_nickname],
    ["colorway", context.colorway],
    ["sku", context.sku],
    ["size", context.size],
  ].filter(([, value]) => !!value);

  if (!entries.length) {
    return "No existing sneaker metadata available.";
  }

  return entries.map(([key, value]) => `${key}: ${value}`).join("\n");
}

export async function parseSneakerFromImageAndContext(
  imageUrl: string,
  context?: SneakerContext
): Promise<ParsedLabelResult> {
  if (!imageUrl) {
    throw new Error("Missing imageUrl.");
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const contextText = buildContextText(context);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You identify sneaker metadata using a sneaker photo or box label image plus existing metadata hints. " +
            "Use the image as primary evidence. Use the provided metadata as supporting context only. " +
            "Only return values supported by the image and/or the provided context. " +
            "Do not invent data. Use null when uncertain.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extract brand, model, official_product_name, common_nickname, colorway, sku, and size.\n\n" +
                "Existing metadata hints:\n" +
                contextText,
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "sneaker_metadata",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              brand: { type: ["string", "null"] },
              model: { type: ["string", "null"] },
              official_product_name: { type: ["string", "null"] },
              common_nickname: { type: ["string", "null"] },
              colorway: { type: ["string", "null"] },
              sku: { type: ["string", "null"] },
              size: { type: ["string", "null"] },
            },
            required: [
              "brand",
              "model",
              "official_product_name",
              "common_nickname",
              "colorway",
              "sku",
              "size",
            ],
          },
        },
      },
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${raw}`);
  }

  let apiData: any;
  try {
    apiData = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned non-JSON response.");
  }

  const content = apiData.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No structured output returned.");
  }

  try {
    return JSON.parse(content) as ParsedLabelResult;
  } catch {
    throw new Error("Structured output could not be parsed.");
  }
}

export async function parseSneakerBoxLabelFromImageUrl(
  imageUrl: string
): Promise<ParsedLabelResult> {
  return parseSneakerFromImageAndContext(imageUrl);
}