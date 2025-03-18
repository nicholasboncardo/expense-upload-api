import express from "express";
import multer from "multer";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const upload = multer();

const GOOGLE_CLOUD_VISION_API_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

app.post("/api/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const base64Image = req.file.buffer.toString("base64");

    const visionResponse = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_VISION_API_KEY}`,
      {
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: "TEXT_DETECTION" }],
          },
        ],
      }
    );

    const extractedText = visionResponse.data.responses[0]?.fullTextAnnotation?.text || "";

    const chatGptResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Extract structured expense data from the following OCR text: ${extractedText}`,
          },
        ],
      },
      {
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      }
    );

    const structuredData = chatGptResponse.data.choices?.[0]?.message?.content || "{}";
    let parsedData;
    try {
      parsedData = JSON.parse(structuredData);
    } catch (error) {
      console.error("Failed to parse ChatGPT response", error);
      return res.status(500).json({ success: false, error: "Failed to parse AI response." });
    }

    res.json({ success: true, ...parsedData });
  } catch (error) {
    console.error("OCR processing error", error);
    res.status(500).json({ success: false, error: "OCR processing failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
