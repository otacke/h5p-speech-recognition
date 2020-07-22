import 'annyang';
import SpeechRecognitionButton from './h5p-speech-recognition-button';
import SpeechRecognitionUtil from './h5p-speech-recognition-util';

export default class SpeechRecognition {
  /**
   * @constructor
   *
   * @param {object} params Parameters passed by the editor.
   */
  constructor(params = {}, callbacks = {}) {
    // Parameter sanitization
    this.params = SpeechRecognitionUtil.extend({
      commands: [],
      language: 'en-US',
      listenMode: SpeechRecognition.LISTEN_MODE_BUTTON,
      showLabel: true,
      l10n: {
        listening: 'Listening ...',
        noMicrophoneAccess: 'No microphone access',
        pushToSpeak: 'Push to speak'
      }
    }, params);

    // Callback sanitization
    this.callbacks = callbacks || {};
    this.callbacks.onResult = this.callbacks.onResult || (() => {});

    this.params.commands = this.params.commands.reduce((result, command) => {
      result[command] = () => {};
      return result;
    }, {});

    // Button mode
    if (this.params.listenMode === SpeechRecognition.LISTEN_MODE_BUTTON) {
      this.button = new SpeechRecognitionButton(
        {
          showLabel: this.params.showLabel,
          l10n: {
            active: this.params.l10n.listening,
            inactive: this.params.l10n.pushToSpeak,
            noMicrophoneAccess: this.params.noMicrophoneAccess
          }
        },
        {
          onClick: () => {
            this.handleButtonClicked();
          }
        }
      );
      this.button.disable();
    }

    this.checkMicrophoneSupport();
  }

  /**
   * Check for microphone support.
   */
  checkMicrophoneSupport() {
    if (!window.navigator.mediaDevices || !window.navigator.mediaDevices.getUserMedia) {
      this.handleMicrophoneNotAvailable('The document may not be loaded securely, or your browser may not support a microphone.');
      return;
    }

    // IE11 doesn't support Promises, but fails above when checking for mediaDevices
    window.navigator.mediaDevices.getUserMedia({audio: true})
      .then(() => {
        this.handleMicrophoneAvailable();
      })
      .catch((error) => {
        this.handleMicrophoneNotAvailable(error);
      });
  }

  /**
   * Handle microphone not available.
   * @param {string} error Error message.
   */
  handleMicrophoneNotAvailable(error) {
    if (this.button) {
      this.button.getDOM().classList.add('h5p-speech-recognition-no-microphone');
      this.button.setLabel(this.params.l10n.noMicrophoneAccess);
    }

    console.warn('H5P.SpeechRecognition:', error);
  }

  /**
   * Handle microphone available.
   */
  handleMicrophoneAvailable() {
    if (this.params.listenMode === SpeechRecognition.LISTEN_MODE_BUTTON) {
      this.button.enable();
    }

    // Non button mode, start listening right away
    if (
      this.params.listenMode === SpeechRecognition.LISTEN_MODE_CONTINUOUS ||
      this.params.listenMode === SpeechRecognition.LISTEN_MODE_ONCE
    ) {
      this.start();
    }
  }

  /**
   * Start listening.
   */
  start() {
    if (!window.annyang) {
      console.warn('Annyang is missing.');
      return;
    }
    this.annyang = window.annyang;

    this.listening = true;

    if (this.button) {
      this.button.setActive();
    }

    // Setup
    this.annyang.setLanguage(this.params.language);
    this.annyang.addCommands(this.params.commands);

    // Handler for match found
    this.handleResultMatchHandler = this.handleResultMatch.bind(this);
    this.annyang.addCallback('resultMatch', this.handleResultMatchHandler);

    // Handler for no match found
    this.handleResultNoMatchHandler = this.handleResultNoMatch.bind(this);
    this.annyang.addCallback('resultNoMatch', this.handleResultNoMatchHandler);

    // Handler for error
    this.handleErrorHandler = this.handleError.bind(this);
    this.annyang.addCallback('errorNetwork', this.handleErrorHandler);
    this.annyang.addCallback('errorPermissionBlocked', this.handleErrorHandler);
    this.annyang.addCallback('errorPermissionDenied', this.handleErrorHandler);

    this.annyang.start();
  }

  /**
   * Stop listening.
   */
  stop() {
    this.listening = false;

    if (this.button) {
      this.button.setInactive();
    }

    this.annyang.removeCommands();

    this.annyang.removeCallback('resultMatch', this.handleResultMatchHandler);
    this.annyang.removeCallback('resultNoMatch', this.handleResultNoMatchHandler);
    this.annyang.removeCallback('errorNetwork', this.handleErrorHandler);
    this.annyang.removeCallback('errorPermissionBlocked', this.handleErrorHandler);
    this.annyang.removeCallback('errorPermissionDenied', this.handleErrorHandler);
    this.annyang.abort();
  }

  /**
   * Determine whether microphone is listening.
   * @return {boolean} True, if microphone is listening.
   */
  isListening() {
    return this.listening;
  }

  /**
   * Get button DOM.
   * @return {HTMLElement} Button DOM.
   */
  getButtonDOM() {
    return this.button.getDOM();
  }

  /**
   * Enable button.
   */
  enableButton() {
    this.button.enable();
  }

  /**
   * Disable button.
   */
  disableButton() {
    this.button.disable();
  }

  /**
   * Handler for button clicked.
   */
  handleButtonClicked() {
    if (this.isListening()) {
      this.button.setInactive();
      this.stop();
    }
    else {
      this.button.setActive();
      this.start();
    }
  }

  /**
   * Handler for microphone received a matching result to command.
   * @param {string} said What user said.
   * @param {string} command Command to be matched.
   * @param {string[]} phrased Phrases that could be correct.
   */
  handleResultMatch(said, command, phrases) {
    this.reportResults({
      command: command,
      match: true,
      phrases: phrases,
      said: said
    });

    this.checkStop();
  }

  /**
   * Handler for microphone received a non matching result to command.
   * @param {string[]} phrased Phrases that could be correct.
   */
  handleResultNoMatch(phrases) {
    this.reportResults({
      match: false,
      phrases: phrases
    });

    this.checkStop();
  }

  /**
   * Handler for microphone error.
   * @param {string} error Error message.
   */
  handleError(event) {
    console.warn('H5P.SpeechRecognition:', event.error);
    this.stop();
  }

  /**
   * report results to callback.
   * @param {object} results Results from microphone.
   * @param {string} [command] Command to look for.
   * @param {boolean} [match] True for match found, else false.
   * @param {string} [phrases] All phrases that could have been said.
   * @param {string} [said] What the user most likely said.
   */
  reportResults(results = {}) {
    results = SpeechRecognitionUtil.extend({
      command: null,
      match: null,
      phrases: [],
      said: (results.phrases.length === 1) ? results.phrases[0] : null
    }, results);

    this.callbacks.onResult(results);
  }

  /**
   * Check whether listening should be stopped after result was reported.
   */
  checkStop() {
    if (
      this.params.listenMode === SpeechRecognition.LISTEN_MODE_BUTTON ||
      this.params.listenMode === SpeechRecognition.LISTEN_MODE_ONCE
    ) {
      this.stop();
    }
  }
}

// Modes for listening

/** @constant {number} */
SpeechRecognition.LISTEN_MODE_BUTTON = 0;

/** @constant {number} */
SpeechRecognition.LISTEN_MODE_CONTINUOUS = 1;

/** @constant {number} */
SpeechRecognition.LISTEN_MODE_ONCE = 2;
