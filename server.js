const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = express();
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 250 * 1024 * 1024 }
});

app.get("/", (req, res) => {
  res.json({
    service: "HUMANTRACK Audio Engine",
    status: "online"
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/process", upload.single("audio"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Audio file required" });
  }

  const input = req.file.path;
  const output = `${input}-processed.wav`;

  const ffmpeg = spawn("ffmpeg", [
    "-y",
    "-i", input,
    "-af",
    "highpass=f=25,lowpass=f=19500,acompressor=threshold=-18dB:ratio=1.35:attack=15:release=180,loudnorm=I=-14:TP=-1.5:LRA=11",
    "-ar", "48000",
    "-c:a", "pcm_s24le",
    output
  ]);

  ffmpeg.on("close", code => {
    if (code !== 0) {
      return res.status(500).json({ error: "FFmpeg processing failed" });
    }

    res.download(output, "humantrack-processed.wav", () => {
      fs.rm(input, { force: true }, () => {});
      fs.rm(output, { force: true }, () => {});
    });
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`HUMANTRACK Audio Engine running on ${PORT}`);
});
