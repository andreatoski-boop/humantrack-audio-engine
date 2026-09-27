const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");

const app = express();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 250 * 1024 * 1024 }
});

app.get("/", (req, res) => {
  res.json({
    service: "HUMANTRACK Audio Engine",
    status: "online",
    engine: "musical-processing-v2"
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/process", upload.single("audio"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "Audio file required"
    });
  }

  const input = req.file.path;
  const output = `${input}-processed.wav`;

  /*
    HUMANTRACK MUSICAL PROCESSING V2

    Objetivo:
    - preservar duración y sincronización
    - conservar voz y ritmo
    - procesamiento dinámico más natural
    - modificación espectral moderada
    - controlar transitorios y picos
    - mantener salida profesional WAV 24-bit / 48 kHz
  */

  const audioFilter = [
    "highpass=f=24",
    "lowpass=f=19800",
    "equalizer=f=110:t=q:w=1.1:g=0.6",
    "equalizer=f=320:t=q:w=1.0:g=-0.4",
    "equalizer=f=2400:t=q:w=1.2:g=0.45",
    "equalizer=f=7200:t=q:w=1.1:g=-0.35",
    "acompressor=threshold=-20dB:ratio=1.22:attack=18:release=220:makeup=1",
    "alimiter=limit=0.94:attack=5:release=70",
    "loudnorm=I=-14:TP=-1.5:LRA=10"
  ].join(",");

  const ffmpeg = spawn("ffmpeg", [
    "-y",
    "-i", input,
    "-vn",
    "-af", audioFilter,
    "-ar", "48000",
    "-ac", "2",
    "-c:a", "pcm_s24le",
    output
  ]);

  let stderr = "";

  ffmpeg.stderr.on("data", data => {
    stderr += data.toString();
  });

  ffmpeg.on("error", err => {
    console.error("FFmpeg start error:", err);

    fs.rm(input, { force: true }, () => {});
    fs.rm(output, { force: true }, () => {});

    if (!res.headersSent) {
      res.status(500).json({
        error: "FFmpeg could not start"
      });
    }
  });

  ffmpeg.on("close", code => {
    if (code !== 0) {
      console.error("FFmpeg processing failed:", stderr);

      fs.rm(input, { force: true }, () => {});
      fs.rm(output, { force: true }, () => {});

      if (!res.headersSent) {
        return res.status(500).json({
          error: "FFmpeg processing failed"
        });
      }

      return;
    }

    if (!fs.existsSync(output)) {
      fs.rm(input, { force: true }, () => {});

      return res.status(500).json({
        error: "Processed audio was not created"
      });
    }

    res.download(
      output,
      "humantrack-processed.wav",
      err => {
        if (err) {
          console.error("Download error:", err);
        }

        fs.rm(input, { force: true }, () => {});
        fs.rm(output, { force: true }, () => {});
      }
    );
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `HUMANTRACK Audio Engine V2 running on ${PORT}`
  );
});
