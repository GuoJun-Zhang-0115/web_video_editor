import MP4Box, { DataStream } from 'mp4box'

const mp4boxfile = MP4Box.createFile()

mp4boxfile.onError = function (e) {}
mp4boxfile.onReady = function (info) {}

export default async function decodeVideoFile(file: File) {
  const { chunks, decoderConfigure } = await getVideoChunk(file)
  getVideoFrames(chunks, decoderConfigure)
}

function getVideoChunk(file: File) {
  return new Promise<{ chunks: EncodedVideoChunk[]; decoderConfigure: VideoDecoderConfig }>((resolve) => {
    const reader = new FileReader()
    reader.readAsArrayBuffer(file)
    reader.onload = (e) => {
      const buffer = (e.target as FileReader).result as MP4Box.MP4ArrayBuffer
      buffer.fileStart = 0
      console.log(buffer)
      let videoTrack: MP4Box.MP4Track | null = null
      const mp4boxfile = MP4Box.createFile()
      mp4boxfile.onReady = function (info) {
        console.log(info)
        videoTrack = info.videoTracks[0]
        console.log(videoTrack)
        mp4boxfile.setExtractionOptions(1)
        mp4boxfile.start()
      }
      mp4boxfile.onError = function (e) {
        console.log(e)
      }
      mp4boxfile.onSamples = function (id, user, samples) {
        console.log(id, user, samples)
        const chunks = samples.map(
          (s) =>
            new EncodedVideoChunk({
              type: s.is_sync ? 'key' : 'delta',
              timestamp: (1e6 * s.cts) / s.timescale,
              duration: (1e6 * s.duration) / s.timescale,
              data: s.data,
            })
        )

        if (!videoTrack) {
        } else {
          resolve({
            chunks,
            decoderConfigure: {
              codec: videoTrack.codec.startsWith('vp08') ? 'vp8' : videoTrack.codec,
              codedWidth: videoTrack.track_width,
              codedHeight: videoTrack.track_height,
              description: description(mp4boxfile.getTrackById(1)),
            },
          })
        }
      }
      mp4boxfile.appendBuffer(buffer)
    }
  })
}

function description(trak: MP4Box.Trak) {
  const entries: any[] = trak.mdia?.minf?.stbl?.stsd?.entries || []
  for (const entry of entries) {
    const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C
    if (box) {
      const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN)
      box.write(stream)
      return new Uint8Array(stream.buffer, 8) // Remove the box header.
    }
  }
  throw new Error('avcC, hvcC, vpcC, or av1C box not found')
}

function getVideoFrames(chunks: EncodedVideoChunk[], decoderConfigure: VideoDecoderConfig) {
  console.log('=================')
  const cvs = document.getElementById('canvas') as HTMLCanvasElement
  cvs.height = 540
  cvs.width = 960
  const ctx = cvs.getContext('2d')

  if (!ctx) {
    return
  }
  const videoDecoder = new VideoDecoder({
    output: (videoFrame) => {
      // console.log('video frame', videoFrame, videoFrame.codedWidth, videoFrame.codedHeight)
      // videoFrame 可绘制到 Canvas 进行额外处理
      if (videoFrame != null) {
        ctx.clearRect(0, 0, cvs.width, cvs.height)
        // 绘制到 Canvas
        ctx.drawImage(videoFrame, 0, 0, videoFrame.codedWidth, videoFrame.codedHeight, 0, 0, cvs.width, cvs.height)
        // 注意，用完立即 close
        videoFrame.close()
      }
    },
    error: console.error,
  })
  videoDecoder.configure(decoderConfigure)

  setInterval(() => {
    const chunk = chunks.shift()
    if (chunk) {
      videoDecoder.decode(chunk)
    }
  }, 1000 / 30)
}
