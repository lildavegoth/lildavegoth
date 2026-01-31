let audioContext;
let source;
let audioBuffer;
let isPlaying = false;
let currentTime = 0;
let startTime = 0;
let duration = 0;
let onEndedCallback = null;

self.addEventListener('message', (event) => {
    const { action, data } = event.data;
    
    if (action === 'init') {
        audioContext = new (self.AudioContext || self.webkitAudioContext)();
    }
    
    if (action === 'load') {
        audioContext.decodeAudioData(data.arrayBuffer).then((buffer) => {
            audioBuffer = buffer;
            duration = buffer.duration;
            self.postMessage({ action: 'loaded', duration: duration });
        });
    }
    
    if (action === 'play') {
        if (!isPlaying && audioBuffer) {
            source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(0, currentTime);
            startTime = audioContext.currentTime - currentTime;
            isPlaying = true;
            
            source.onended = () => {
                isPlaying = false;
                currentTime = 0;
                self.postMessage({ action: 'ended' });
            };
        }
    }
    
    if (action === 'pause') {
        if (isPlaying && source) {
            source.stop();
            currentTime = audioContext.currentTime - startTime;
            isPlaying = false;
        }
    }
    
    if (action === 'seek') {
        if (isPlaying && source) {
            source.stop();
            currentTime = data.time;
            source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(0, currentTime);
            startTime = audioContext.currentTime - currentTime;
            source.onended = () => {
                isPlaying = false;
                currentTime = 0;
                self.postMessage({ action: 'ended' });
            };
        } else {
            currentTime = data.time;
        }
    }
    
    if (action === 'stop') {
        if (isPlaying && source) {
            source.stop();
        }
        isPlaying = false;
        currentTime = 0;
        audioBuffer = null;
    }
    
    if (action === 'getTime') {
        if (isPlaying) {
            currentTime = audioContext.currentTime - startTime;
        }
        self.postMessage({ action: 'timeUpdate', time: currentTime });
    }
});