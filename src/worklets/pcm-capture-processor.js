class PCMCaptureProcessor extends AudioWorkletProcessor {
    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];
        const channel = input[0];

        if (channel && channel.length > 0) {
            this.port.postMessage(channel.slice(0));
        }

        if (output && output[0] && channel) {
            output[0].set(channel);
        }

        return true;
    }
}

registerProcessor('pcm-capture-processor', PCMCaptureProcessor);
