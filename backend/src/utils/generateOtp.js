const generateOtp = () => {
    // 🔥 PURE 6-DIGIT NUMBERS ONLY: 123456, 456789, etc.
    const numbers = '0123456789';
    let otp = '';

    for (let i = 0; i < 6; i++) {
        otp += numbers[Math.floor(Math.random() * 10)];
    }

    return otp; // Returns "456789" (NUMBERS ONLY)
};

export default generateOtp;
