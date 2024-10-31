const fs = require('fs');

exports.getRandomNumber = () => {
    // Menghasilkan angka acak antara 0.0001 dan 0.001
    const min = 0.0001;
    const max = 0.001;
    const randomNum = Math.random() * (max - min) + min;

    // Membulatkan hingga 5 digit desimal
    return parseFloat(randomNum.toFixed(5));
}

// Membaca file .txt dan memuat private key ke dalam array
exports.loadPrivateKeys = (filePath) => {
    const data = fs.readFileSync(filePath, 'utf-8');
    return data.split('\n').map(line => line.trim()).filter(line => line);
}