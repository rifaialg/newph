/**
 * Utility untuk memproses gambar sebelum dikirim ke OCR engine.
 * Meningkatkan akurasi dengan mengubah ke grayscale dan meningkatkan kontras.
 * DILENGKAPI: Resizing otomatis untuk mencegah browser hang pada gambar resolusi tinggi.
 */

export const preprocessImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // FIX: Gunakan createObjectURL alih-alih FileReader untuk performa dan stabilitas lebih baik
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      // Bersihkan memory
      URL.revokeObjectURL(objectUrl);

      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // --- 1. RESIZING LOGIC (CRITICAL FIX) ---
        // Membatasi dimensi maksimal untuk mencegah loop pixel yang terlalu berat
        const MAX_DIMENSION = 1500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        // --- 2. PIXEL MANIPULATION ---
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Grayscale (Luminosity method)
          let gray = 0.21 * r + 0.72 * g + 0.07 * b;

          // Increase Contrast
          const contrastFactor = 1.2; 
          gray = (gray - 128) * contrastFactor + 128;

          // Binarization (Thresholding)
          const threshold = 170; 
          const finalVal = gray >= threshold ? 255 : 0;

          data[i] = finalVal;     // Red
          data[i + 1] = finalVal; // Green
          data[i + 2] = finalVal; // Blue
        }

        ctx.putImageData(imageData, 0, 0);

        // Return as Data URL (JPEG slightly smaller/faster than PNG for transfer)
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (error) {
        reject(new Error("Gagal memproses gambar (Preprocessing Error)."));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Gagal memuat gambar ke memori. File mungkin rusak atau format tidak didukung."));
    };

    img.src = objectUrl;
  });
};
