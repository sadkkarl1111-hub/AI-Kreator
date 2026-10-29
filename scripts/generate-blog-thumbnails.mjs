import fs from "node:fs/promises";
import path from "node:path";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview";
const outputDir = process.argv[2] || "/tmp/ai-kreator-blog-thumbnails";

if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY");
}

const jobs = [
  {
    filename: "prompt-engineering-ai-graphics.jpg",
    prompt:
      "Create a premium editorial cover image for a Polish tech blog article about writing better prompts for AI image generation. Show a modern creative workstation, layered prompt cards, art direction notes, glowing interface panels, cinematic composition, high-end product design aesthetic, realistic digital illustration, no readable text, no logos, landscape 16:10.",
  },
  {
    filename: "ai-social-media-formats.jpg",
    prompt:
      "Create a modern blog cover image about AI graphics for social media formats. Show a designer workspace with multiple canvases for Instagram post, story, Facebook cover and YouTube thumbnail, clear visual differences in aspect ratios, polished UI composition, crisp lighting, premium editorial illustration, no readable text, no logos, landscape 16:10.",
  },
  {
    filename: "gemini-vs-openai-graphics.jpg",
    prompt:
      "Create a sophisticated blog cover image comparing two AI image generation engines. Show a split-screen creative dashboard with two contrasting visual generation styles, abstract model panels, prompt workflow, sleek futuristic studio, premium editorial illustration, no brand logos, no readable text, landscape 16:10.",
  },
  {
    filename: "ai-graphics-rights-ethics.jpg",
    prompt:
      "Create a premium blog cover image about safe and legal use of AI graphics in marketing. Show a modern marketing desk with image review checklist, subtle shield motif, approval workflow, polished brand assets, trustworthy and elegant tone, editorial illustration, no readable text, no logos, landscape 16:10.",
  },
];

const parseImagePart = (payload) => {
  const candidates = payload?.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        return part.inlineData;
      }
    }
  }
  return null;
};

await fs.mkdir(outputDir, { recursive: true });

for (const job of jobs) {
  console.log(`Generating ${job.filename} with ${model}...`);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: job.prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          temperature: 0.8,
        },
      }),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Gemini request failed for ${job.filename}: ${JSON.stringify(payload)}`);
  }

  const inlineData = parseImagePart(payload);
  if (!inlineData?.data) {
    throw new Error(`No image returned for ${job.filename}: ${JSON.stringify(payload)}`);
  }

  const filePath = path.join(outputDir, job.filename);
  await fs.writeFile(filePath, Buffer.from(inlineData.data, "base64"));
  console.log(`Saved ${filePath} (${inlineData.mimeType || "unknown mime"})`);
}

console.log(`All thumbnails generated in ${outputDir}`);
