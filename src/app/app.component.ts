import { Component, OnInit } from '@angular/core';
import { AudioContext } from 'angular-audio-context';
import { saveAs } from 'file-saver';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  private buffer: any = null;
  private bufferNode: any = null;
  public playing: boolean = false;
  private gain: any = null;
  private panning: any = null;
  private ctx: any = null;


  constructor() {
  }

  initiateAudioContext() {
    this.ctx = new AudioContext();
    this.gain = this.ctx.createGain();
    this.panning = this.ctx.createStereoPanner();
    console.log("Audio Context Initiated");
  }

  choseFile(files: FileList) {
    let blob = files[0];
    let fr = new FileReader();
    fr.onload = (e: any) => {
      this.ctx.decodeAudioData(e.target.result, (buffer) => {
        this.buffer = buffer;
      });
    }
    fr.readAsArrayBuffer(blob);
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.ctx.state === 'suspended'? this.ctx.resume() : null;
    let bufferSourceNode = this.ctx.createBufferSource();
    bufferSourceNode.buffer = this.buffer;
    bufferSourceNode.connect(this.gain).connect(this.panning).connect(this.ctx.destination);
    bufferSourceNode.start();
    this.bufferNode = bufferSourceNode;
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    let bn: AudioBufferSourceNode = this.bufferNode;
    bn.stop();
  }

  change() {
    let gain: GainNode = this.gain;
    let panning: StereoPannerNode = this.panning;
    gain.gain.value = 0.5;
    panning.pan.value = -1;
  }

  async save() {
    let offlineCtx = new OfflineAudioContext(this.bufferNode.buffer.numberOfChannels, this.bufferNode.buffer.length, this.bufferNode.buffer.sampleRate);
    let obs = offlineCtx.createBufferSource();
    obs.buffer = this.buffer;
    let gain = offlineCtx.createGain();
    let panning = offlineCtx.createStereoPanner();
    gain.gain.value = this.gain.gain.value;
    panning.pan.value = this.panning.pan.value;
    obs.connect(gain).connect(panning).connect(offlineCtx.destination);
    obs.start();
    let newBuff;
    await offlineCtx.startRendering().then(r => {
      newBuff = r;
    });

    const [left, right] = [newBuff.getChannelData(0), newBuff.getChannelData(1)]

    // interleaved
    const interleaved = new Float32Array(left.length + right.length)
    for (let src = 0, dst = 0; src < left.length; src++, dst += 2) {
      interleaved[dst] = left[src]
      interleaved[dst + 1] = right[src]
    }

    // get WAV file bytes and audio params of your audio source
    const wavBytes = this.getWavBytes(interleaved.buffer, {
      isFloat: true,       // floating point or 16-bit integer
      numChannels: 2,
      sampleRate: 48000,
    })
    const newFile = new Blob([wavBytes], { type: 'audio/wav' });
    saveAs(newFile, "new.wav");
  }

  getWavBytes(buffer, options) {
    const type = options.isFloat ? Float32Array : Uint16Array
    const numFrames = buffer.byteLength / type.BYTES_PER_ELEMENT

    const headerBytes = this.getWavHeader(Object.assign({}, options, { numFrames }))
    const wavBytes = new Uint8Array(headerBytes.length + buffer.byteLength);

    // prepend header, then add pcmBytes
    wavBytes.set(headerBytes, 0)
    wavBytes.set(new Uint8Array(buffer), headerBytes.length)

    return wavBytes
  }
  getWavHeader(options) {
    const numFrames = options.numFrames
    const numChannels = options.numChannels || 2
    const sampleRate = options.sampleRate || 44100
    const bytesPerSample = options.isFloat ? 4 : 2
    const format = options.isFloat ? 3 : 1

    const blockAlign = numChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = numFrames * blockAlign

    const buffer = new ArrayBuffer(44)
    const dv = new DataView(buffer)

    let p = 0

    function writeString(s) {
      for (let i = 0; i < s.length; i++) {
        dv.setUint8(p + i, s.charCodeAt(i))
      }
      p += s.length
    }

    function writeUint32(d) {
      dv.setUint32(p, d, true)
      p += 4
    }

    function writeUint16(d) {
      dv.setUint16(p, d, true)
      p += 2
    }

    writeString('RIFF')              // ChunkID
    writeUint32(dataSize + 36)       // ChunkSize
    writeString('WAVE')              // Format
    writeString('fmt ')              // Subchunk1ID
    writeUint32(16)                  // Subchunk1Size
    writeUint16(format)              // AudioFormat
    writeUint16(numChannels)         // NumChannels
    writeUint32(sampleRate)          // SampleRate
    writeUint32(byteRate)            // ByteRate
    writeUint16(blockAlign)          // BlockAlign
    writeUint16(bytesPerSample * 8)  // BitsPerSample
    writeString('data')              // Subchunk2ID
    writeUint32(dataSize)            // Subchunk2Size

    return new Uint8Array(buffer)
  }

}
