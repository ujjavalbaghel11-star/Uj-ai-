<script src="/app.js" defer></script>
<script src="/jarvis-voice.js" defer></script>
(() => {
  if (!('speechSynthesis' in window)) return;

  const synth = window.speechSynthesis;
  const originalSpeak = synth.speak.bind(synth);

  function getVoice(lang) {
    const voices = synth.getVoices();
    const language = (lang || 'en-IN').split('-')[0].toLowerCase();

    const matching = voices.filter(v =>
      v.lang.toLowerCase().startsWith(language)
    );

    return matching.find(v =>
      /male|david|daniel|george|james|mark|guy/i.test(v.name)
    ) || matching[0] || null;
  }

  synth.speak = function (utterance) {
    const mode = document.querySelector('[data-mode].active')
      ?.dataset.mode;

    if (mode === 'jarvis' &&
        utterance instanceof SpeechSynthesisUtterance) {
      const lang = utterance.lang ||
        (/[\u0900-\u097F]/.test(utterance.text) ? 'hi-IN' : 'en-IN');

      const voice = getVoice(lang);
      if (voice) utterance.voice = voice;

      utterance.rate = 0.92;
      utterance.pitch = 0.72;
      utterance.volume = 1;
    }

    originalSpeak(utterance);
  };
})();
