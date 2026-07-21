import * as http from 'http';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath((ffmpegStatic as string).replace(/app\.asar/i, 'app.asar.unpacked'));
}
if (ffprobeStatic) {
  ffmpeg.setFfprobePath(ffprobeStatic.path.replace(/app\.asar/i, 'app.asar.unpacked'));
}

const ffprobeCache = new Map<string, ffmpeg.FfprobeData>();

export function startStreamingServer() {
  const streamingServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const filepath = url.searchParams.get('path');
      
      if (!filepath) {
        res.statusCode = 400;
        return res.end('Missing path');
      }

      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*'
      });

      const startTime = url.searchParams.get('startTime');

      // Check cache first for instant metadata
      let metadata = ffprobeCache.get(filepath);
      
      if (!metadata) {
        metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
          ffmpeg.ffprobe(filepath, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        ffprobeCache.set(filepath, metadata);
      }

      const vStream = metadata.streams.find(s => s.codec_type === 'video');
      const aStream = metadata.streams.find(s => s.codec_type === 'audio');
      
      const vcodec = (vStream?.codec_name === 'h264') ? 'copy' : 'libx264';
      const acodec = (aStream?.codec_name === 'aac') ? 'copy' : 'aac';

      let command = ffmpeg(filepath);
      
      if (startTime && parseFloat(startTime) > 0) {
        if (vcodec === 'copy') {
          // Output seek for copy: Drops packets up to startTime and starts at the NEXT keyframe.
          // This prevents the player from snapping backward to previous keyframes.
          command = command.setStartTime(parseFloat(startTime));
        } else {
          // Input seek for transcode: Fast and accurate.
          command = command.seekInput(parseFloat(startTime));
        }
      }

      const outputOptions = [
        '-movflags frag_keyframe+empty_moov', // Enable fragmented mp4 for streaming
        '-preset ultrafast', // Fast encoding
        `-vcodec ${vcodec}`, // Dynamic video codec
        `-acodec ${acodec}`, // Dynamic audio codec
        '-threads 0'
      ];

      if (vcodec === 'libx264') {
        outputOptions.push('-tune zerolatency', '-tune fastdecode');
      }

      command
        .format('mp4')
        .outputOptions(outputOptions)
        .on('error', (err) => {
          console.error('FFmpeg streaming error:', err);
          if (!res.writableEnded) res.end();
        })
        .pipe(res, { end: true });
        
      req.on('close', () => {
        // ffmpeg process is automatically killed when pipe destination closes
      });
    } catch (err) {
      console.error('Streaming server error:', err);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end();
      }
    }
  });

  streamingServer.listen(4000, () => {
    console.log('Streaming server listening on port 4000');
  });

  return streamingServer;
}
