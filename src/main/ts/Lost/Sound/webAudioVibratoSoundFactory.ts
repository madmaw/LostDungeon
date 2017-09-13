function webAudioVibratoSoundFactory(
    audioContext: AudioContext,
    listenerLocationSource: () => Matrix4[],
    startFrequency: number, 
    endFrequency: number,
    vibrations: number, 
    durationSeconds: number
): SoundEffect {

    return function (intensity: number, soundLocation: Matrix4[]) {
        if (FEATURE_SOUND) {
            if (audioContext) {
                let listenerLocation = listenerLocationSource();
                let volumeScale = calculateVolume(listenerLocation, soundLocation);

                var now = audioContext.currentTime;

                var oscillator = audioContext.createOscillator();
                oscillator.frequency.setValueAtTime(startFrequency, now);
                oscillator.frequency.linearRampToValueAtTime(endFrequency, now + durationSeconds);
                oscillator.type = 'square';
                oscillator.start();

                var gain = audioContext.createGain();
                linearRampGain(gain, now, 0.2, 0.1, 0, durationSeconds * 0.1, durationSeconds * 0.2, durationSeconds, volumeScale);

                var vibrato = audioContext.createOscillator();
                vibrato.frequency.value = vibrations / durationSeconds;
                vibrato.type = 'sawtooth';
                vibrato.start();

                var vibratoGain = audioContext.createGain();
                vibratoGain.gain.value = -1000;

                oscillator.connect(gain);
                //gain.connect(vibratoGain);
                vibrato.connect(vibratoGain);
                vibratoGain.connect(oscillator.detune);
                gain.connect(audioContext.destination);

                setTimeout(function () {
                    oscillator.disconnect();
                    gain.disconnect();
                    vibratoGain.disconnect();
                    oscillator.stop();
                    vibrato.stop();
                }, durationSeconds * 1000);
            }

        }


    }

}
