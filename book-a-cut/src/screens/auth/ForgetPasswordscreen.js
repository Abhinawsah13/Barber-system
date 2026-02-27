import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { forgotPassword, verifyResetCode, resetPassword as apiResetPassword } from '../../services/api';

export default function ForgotPasswordScreen({ navigation }) {
  const { theme } = useTheme();
  const [step, setStep] = useState('email'); // 'email' → 'otp' → 'new-password'
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // 🔥 STEP 1: Send Reset Email
  const sendResetCode = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      const response = await forgotPassword(email);
      if (response.success) {
        setResetEmail(email);
        setStep('otp');
        Alert.alert('Success', '6-digit reset code sent to your email!');
      } else {
        Alert.alert('Error', response.message || 'Failed to check email.');
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 STEP 2: Verify Reset OTP (NUMBERS ONLY)
  const verifyResetOtp = async () => {
    if (otpCode.length !== 6) return;

    setLoading(true);
    try {
      const response = await verifyResetCode(resetEmail, otpCode);
      if (response.success) {
        setStep('new-password');
      }
    } catch (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('expired')) {
        Alert.alert('Code Expired', 'This code has expired. Please request a new one.');
      } else if (msg.includes('incorrect')) {
        Alert.alert('Invalid Code', 'The code you entered is incorrect. Please check and try again.');
      } else if (msg.includes('not found')) {
        Alert.alert('Email Not Found', 'This email is no longer in our system.');
      } else {
        Alert.alert('Error', error.message || 'Verification failed');
      }
      setOtpCode('');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 STEP 3: Set New Password
  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiResetPassword(resetEmail, otpCode, newPassword);
      if (response.success) {
        Alert.alert('Success', 'Password reset successfully!', [
          { text: "Login", onPress: () => navigation.navigate('Login') }
        ]);
      } else {
        Alert.alert('Error', response.message || 'Failed to reset password.');
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backText, { color: theme.primary }]}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.contentContainer}>
          <Text style={[styles.title, { color: theme.text }]}>Forgot Password?</Text>
          <Text style={[styles.subtitle, { color: theme.textLight }]}>Enter email to reset</Text>

          <TextInput
            style={[styles.input, {
              backgroundColor: theme.inputBg,
              color: theme.text,
              borderColor: theme.border
            }]}
            placeholder="your@email.com"
            placeholderTextColor={theme.textLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: email ? theme.primary : theme.buttonDisabled }]}
            onPress={sendResetCode}
            disabled={!email || loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Send Reset Code</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 🔥 STEP 2: BIG OTP MODAL SCREEN
  if (step === 'otp') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep('email')}
        >
          <Text style={[styles.backText, { color: theme.primary }]}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.contentContainer}>
          <Text style={[styles.title, { color: theme.text }]}>Enter Reset Code</Text>
          <Text style={[styles.subtitle, { color: theme.textLight }]}>
            Check <Text style={{ fontWeight: 'bold', color: theme.primary }}>{resetEmail}</Text> for 6-digit code
          </Text>

          {/* 🔥 NUMBERS-ONLY OTP INPUT */}
          <TextInput
            style={[
              styles.otpInput,
              {
                backgroundColor: theme.inputBg,
                color: theme.text,
                borderColor: otpCode.length === 6 ? theme.success : theme.primary
              }
            ]}
            placeholder="123456"
            placeholderTextColor={theme.textLight}
            keyboardType="number-pad"           // 🔥 NUMBERS ONLY
            maxLength={6}                       // 🔥 6 DIGITS
            value={otpCode}
            onChangeText={(text) => {
              // 🔥 FORCE NUMBERS ONLY
              setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 6));
            }}
            autoFocus
          />

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: otpCode.length === 6 ? theme.primary : theme.buttonDisabled }
            ]}
            onPress={verifyResetOtp}
            disabled={otpCode.length !== 6 || loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : (
              <Text style={styles.buttonText}>
                Verify ({otpCode.length}/6)
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={sendResetCode} disabled={loading}>
            <Text style={[styles.resendText, { color: theme.primary }]}>Resend Code</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 🔥 STEP 3: New Password
  if (step === 'new-password') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep('otp')}
        >
          <Text style={[styles.backText, { color: theme.primary }]}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.contentContainer}>
          <Text style={[styles.title, { color: theme.text }]}>New Password</Text>
          <Text style={[styles.subtitle, { color: theme.textLight }]}>Enter your new password</Text>

          <TextInput
            style={[styles.input, {
              backgroundColor: theme.inputBg,
              color: theme.text,
              borderColor: theme.border
            }]}
            placeholder="New Password"
            placeholderTextColor={theme.textLight}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: newPassword ? theme.primary : theme.buttonDisabled }]}
            onPress={resetPassword}
            disabled={!newPassword || loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Reset Password</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    width: '100%',
    paddingHorizontal: 30,
    alignItems: 'center',
    paddingTop: 50
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    width: '100%',
    borderWidth: 2,
    padding: 18,
    borderRadius: 15,
    fontSize: 18,
    marginBottom: 25,
  },
  otpInput: {
    width: '100%',
    borderWidth: 3,
    padding: 30,
    borderRadius: 20,
    fontSize: 32,
    textAlign: 'center',
    letterSpacing: 15,
    marginBottom: 35,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  button: {
    backgroundColor: '#9C27B0',
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#9C27B0',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    width: '100%'
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold'
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600'
  },
  resendText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10
  }
});