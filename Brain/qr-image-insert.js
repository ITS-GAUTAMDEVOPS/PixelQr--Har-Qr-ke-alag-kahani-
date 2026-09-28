(() => {
  const imageInput = document.querySelector('#qr-image');

  window.qrImageInsert = {
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.3,
      margin: 6
    },
    getImage() {
      const file = imageInput.files[0];
      if (!file) return Promise.resolve(undefined);
      if (!file.type.startsWith('image/')) {
        return Promise.reject(new Error('Choose a valid image file.'));
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(reader.result), { once: true });
        reader.addEventListener('error', () => reject(new Error('Could not read that image. Please try another file.')), { once: true });
        reader.readAsDataURL(file);
      });
    }
  };
})();