(() => {
  const form = document.querySelector('#qr-form');
  const fields = document.querySelector('#fields');
  const output = document.querySelector('#qr-output');
  const emptyHint = document.querySelector('#empty-hint');
  const status = document.querySelector('#preview-status');
  const caption = document.querySelector('#qr-caption');
  const downloadButton = document.querySelector('#download-button');
  const copyButton = document.querySelector('#copy-button');
  const sizeInput = document.querySelector('#qr-size');
  const colorInput = document.querySelector('#qr-color');
  const bgInput = document.querySelector('#bg-color');
  const patternInput = document.querySelector('#qr-pattern');
  const cornerStyleInput = document.querySelector('#corner-style');
  const cornerDotStyleInput = document.querySelector('#corner-dot-style');
  const toast = document.querySelector('#toast');
  let activeType = 'url';
  let toastTimer;
  let qrImage = null;

  const fieldTemplates = {
    url: '<label class="field-group"><span class="field-label">Website or link</span><span class="input-wrap"><span class="input-prefix">↗</span><input name="url" type="url" placeholder="https://yourwebsite.com" autocomplete="url" required><span class="input-hint">Paste any link you want to share</span></span></label>',
    text: '<label class="field-group"><span class="field-label">Your message</span><span class="input-wrap"><textarea name="text" rows="4" maxlength="1800" placeholder="Type a message, address, or anything you’d like to share…" required></textarea><span class="input-hint">Up to 1,800 characters</span></span></label>',
    wifi: '<div class="split-fields"><label class="field-group"><span class="field-label">Network name (SSID)</span><input name="ssid" type="text" placeholder="Your Wi-Fi name" autocomplete="off" required></label><label class="field-group"><span class="field-label">Password</span><input name="password" type="text" placeholder="Your password" autocomplete="off"></label></div><div class="split-fields wifi-bottom"><label class="field-group"><span class="field-label">Security</span><select name="encryption"><option value="WPA">WPA / WPA2</option><option value="WEP">WEP</option><option value="nopass">No password</option></select></label><label class="checkbox-field"><input name="hidden" type="checkbox"><span class="custom-checkbox">✓</span> Hidden network</label></div>',
    email: '<label class="field-group"><span class="field-label">Email address</span><input name="email" type="email" placeholder="hello@example.com" autocomplete="email" required></label><label class="field-group"><span class="field-label">Subject <span class="optional">OPTIONAL</span></span><input name="subject" type="text" placeholder="What’s this about?"></label><label class="field-group"><span class="field-label">Message <span class="optional">OPTIONAL</span></span><textarea name="body" rows="3" placeholder="Write a message…"></textarea></label>',
    phone: '<label class="field-group"><span class="field-label">Phone number</span><span class="input-wrap"><span class="input-prefix">＋</span><input name="phone" type="tel" placeholder="+1 555 123 4567" autocomplete="tel" required><span class="input-hint">Include your country code for best results</span></span></label>'
  };

  function setType(type) {
    activeType = type;
    fields.innerHTML = fieldTemplates[type];
    document.querySelectorAll('.type-tab').forEach((tab) => {
      const selected = tab.dataset.type === type;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
  }

  function getPayload() {
    const data = new FormData(form);
    if (activeType === 'url') {
      const raw = String(data.get('url') || '').trim();
      if (!raw) throw new Error('Add a website link first.');
      const normalized = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
      try {
        const parsed = new URL(normalized);
        if (!parsed.hostname.includes('.')) throw new Error();
      } catch {
        throw new Error('Enter a valid website link, like example.com.');
      }
      return normalized;
    }
    if (activeType === 'text') {
      const value = String(data.get('text') || '').trim();
      if (!value) throw new Error('Write something to put in your QR code.');
      return value;
    }
    if (activeType === 'wifi') {
      const ssid = String(data.get('ssid') || '').trim();
      if (!ssid) throw new Error('Enter your Wi-Fi network name.');
      const encryption = String(data.get('encryption'));
      const escapeWifi = (value) => value.replace(/([\\;,:"'])/g, '\\$1');
      const password = encryption === 'nopass' ? '' : `;P:${escapeWifi(String(data.get('password') || ''))}`;
      return `WIFI:T:${encryption};S:${escapeWifi(ssid)}${password};H:${data.has('hidden') ? 'true' : 'false'};;`;
    }
    if (activeType === 'email') {
      const email = String(data.get('email') || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
      const params = new URLSearchParams();
      const subject = String(data.get('subject') || '').trim();
      const body = String(data.get('body') || '').trim();
      if (subject) params.set('subject', subject);
      if (body) params.set('body', body);
      return `mailto:${email}${params.size ? `?${params.toString()}` : ''}`;
    }
    const phone = String(data.get('phone') || '').trim();
    if (!/^\+?[\d\s().-]{7,20}$/.test(phone)) throw new Error('Enter a valid phone number.');
    return `tel:${phone.replace(/[\s().-]/g, '')}`;
  }

  function currentCanvas() {
    return output.querySelector('canvas');
  }

  function getImage() {
    const canvas = currentCanvas();
    if (canvas) return canvas.toDataURL('image/png');
    const image = output.querySelector('img');
    return image?.src || qrImage;
  }

  async function generate(event) {
    event.preventDefault();
    let value;
    try {
      value = getPayload();
    } catch (error) {
      showToast(error.message, true);
      fields.querySelector('input, textarea')?.focus();
      return;
    }
    if (typeof QRCodeStyling === 'undefined') {
      showToast('QR generator did not load. Check your internet connection and try again.', true);
      return;
    }
    let centerImage;
    try {
      centerImage = await window.qrImageInsert.getImage();
    } catch (error) {
      showToast(error.message, true);
      return;
    }

    output.innerHTML = '';
    output.style.setProperty('--qr-bg', bgInput.value);
    const qrCode = new QRCodeStyling({
      data: value,
      width: Number(sizeInput.value),
      height: Number(sizeInput.value),
      type: 'canvas',
      image: centerImage,
      imageOptions: window.qrImageInsert.imageOptions,
      margin: 0,
      qrOptions: {
        errorCorrectionLevel: 'H'
      },
      dotsOptions: {
        color: colorInput.value,
        type: patternInput.value
      },
      backgroundOptions: {
        color: bgInput.value
      },
      cornersSquareOptions: {
        color: colorInput.value,
        type: cornerStyleInput.value
      },
      cornersDotOptions: {
        color: colorInput.value,
        type: cornerDotStyleInput.value
      }
    });
    qrCode.append(output);
    qrImage = null;
    emptyHint.hidden = true;
    status.innerHTML = '<span class="status-dot"></span> QR code ready';
    status.classList.add('is-ready');
    caption.textContent = 'Looking good. Ready to scan and share.';
    downloadButton.disabled = false;
    copyButton.disabled = false;
    showToast('Your QR code is ready to go!');
  }

  function download() {
    const image = getImage();
    if (!image) return;
    const link = document.createElement('a');
    link.href = image;
    link.download = `pixelqr-${activeType}-qr.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('PNG downloaded — happy sharing!');
  }

  async function copyImage() {
    const image = getImage();
    if (!image) return;
    try {
      const response = await fetch(image);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showToast('QR image copied to clipboard.');
    } catch {
      showToast('Image copy isn’t supported here. Download the PNG instead.', true);
    }
  }

  function updateColorLabel(input, label) {
    label.textContent = input.value.toUpperCase();
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle('toast-error', isError);
    toast.classList.add('show');
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3000);
  }

  document.querySelectorAll('.type-tab').forEach((tab) => tab.addEventListener('click', () => setType(tab.dataset.type)));
  form.addEventListener('submit', generate);
  downloadButton.addEventListener('click', download);
  copyButton.addEventListener('click', copyImage);
  colorInput.addEventListener('input', () => updateColorLabel(colorInput, document.querySelector('#color-value')));
  bgInput.addEventListener('input', () => updateColorLabel(bgInput, document.querySelector('#bg-value')));
  setType('url');
})();
