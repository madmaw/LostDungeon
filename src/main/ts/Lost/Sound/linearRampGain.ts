function linearRampGain(gain: GainNode, now: number, attackVolume: number, sustainVolume, attackSeconds: number, decaySeconds: number, sustainSeconds: number, durationSeconds: number, volumeScale: number) {
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(attackVolume * volumeScale, now + attackSeconds);
    gain.gain.linearRampToValueAtTime(sustainVolume * volumeScale, now + decaySeconds);
    if (sustainSeconds) {
        gain.gain.linearRampToValueAtTime(sustainVolume * volumeScale, now + sustainSeconds);
    }
    gain.gain.linearRampToValueAtTime(0, now + durationSeconds);

}
