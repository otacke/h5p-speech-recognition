import SpeechRecognitionUtil from './h5p-speech-recognition-util';

export default class SpeechRecognitionButton {
  /**
   * @constructor
   *
   * @param {object} params Parameters passed by the editor.
   * @param {object} params.l10n Localization strings.
   * @param {string} params.l10n.active Active button text.
   * @param {string} params.l10n.inactive Inactive button text.
   * @param {object} callbacks Callbacks.
   * @param {function} callbacks.onClick Callback for button click.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = SpeechRecognitionUtil.extend({
      showLabel: true,
      l10n: {
        active: 'Listening ...',
        inactive: 'Push to speak',
        noMicrophoneAccess: 'No microphone access'
      }
    }, params);

    this.callbacks = callbacks;
    this.callbacks.onClick = this.callbacks.onClick || (() => {});

    this.button = H5P.JoubelUI.createButton({
      class: 'h5p-speech-recognition-button',
      click: this.callbacks.onClick
    }).get(0);

    this.setLabel(this.params.l10n.inactive);
  }

  /**
   * Get DOM for button.
   * @return {HTMLElement} DOM for button.
   */
  getDOM() {
    return this.button;
  }

  /**
   * Set button label
   * @param {text} text Button label text;
   */
  setLabel(text) {
    // Something responsive might be better, setting the label text conditionally
    this.button.innerText = (this.params.showLabel) ? text : '';
    this.button.title = text;
  }

  /**
   * Set button active (= listening).
   */
  setActive() {
    this.button.classList.add('h5p-speech-recognition-listening');
    this.setLabel(this.params.l10n.active);
  }

  /**
   * Set button inactive (= not listening).
   */
  setInactive() {
    this.button.classList.remove('h5p-speech-recognition-listening');
    this.setLabel(this.params.l10n.inactive);
  }

  /**
   * Enable button.
   */
  enable() {
    this.button.classList.remove('h5p-speech-recognition-disabled');
    this.button.disabled = false;
  }

  /**
   * Disable button.
   */
  disable() {
    this.button.classList.add('h5p-speech-recognition-disabled');
    this.button.disabled = true;
  }

  /**
   * Hide button.
   */
  hide() {
    this.button.classList.add('h5p-speech-recognition-none');
  }

  /**
   * Show button.
   */
  show() {
    this.button.classList.remove('h5p-speech-recognition-none');
  }
}
