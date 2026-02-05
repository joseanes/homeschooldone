// Create an alarm sound using Web Audio API
export const playAlarmSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for beep sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Set frequency for a pleasant alarm sound (A4 note)
    oscillator.frequency.value = 440;
    oscillator.type = 'sine';
    
    // Set volume
    gainNode.gain.value = 0.3;
    
    // Play three short beeps
    const beepDuration = 0.2; // 200ms per beep
    const pauseDuration = 0.1; // 100ms pause between beeps
    const currentTime = audioContext.currentTime;
    
    // First beep
    oscillator.start(currentTime);
    gainNode.gain.setValueAtTime(0.3, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + beepDuration);
    
    // Second beep
    gainNode.gain.setValueAtTime(0.3, currentTime + beepDuration + pauseDuration);
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + (beepDuration * 2) + pauseDuration);
    
    // Third beep
    gainNode.gain.setValueAtTime(0.3, currentTime + (beepDuration * 2) + (pauseDuration * 2));
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + (beepDuration * 3) + (pauseDuration * 2));
    
    // Stop after all beeps
    oscillator.stop(currentTime + (beepDuration * 3) + (pauseDuration * 2) + 0.1);
    
    // Clean up
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
      audioContext.close();
    };
  } catch (error) {
    console.error('Error playing alarm sound:', error);
    // Fallback to console beep if Web Audio API is not available
    console.log('\x07'); // ASCII bell character
  }
};