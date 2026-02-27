import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { verifyEmail, resendOtp } from '../../services/api';
import { setToken } from '../../services/TokenManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function VerificationPendingScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { email } = route.params || {};
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer for resend OTP
  useEffect(() => {
    let timer;
    if (countdown > 0 && !canResend) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [countdown, canResend]);

  const handleVerify = async () => {
    if (code.length < 6) {
      Alert.alert("Invalid Code", "Please enter the 6-digit code sent to your email.");
      return;
    }

    setLoading(true);
    try {
      const response = await verifyEmail(email, code);

      // Save token and user data after successful verification
      if (response.data && response.data.token) {
        await setToken(response.data.token);

        if (response.data.user) {
          await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
        }

        const user = response.data.user;

        Alert.alert("Success!", "Email verified successfully!", [
          {
            text: "Continue",
            onPress: () => {
              // Navigate based on user type
              if (user.user_type === 'barber') {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "BarberHome" }],
                });
              } else {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Home" }],
                });
              }
            }
          }
        ]);
      }
    } catch (error) {
      Alert.alert("Verification Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      Alert.alert("Error", "Email address not found.");
      return;
    }

    setResending(true);
    try {
      const response = await resendOtp(email, 'verify');

      if (response.success) {
        Alert.alert("Code Sent", "A new verification code has been sent to your email.");
        setCountdown(60); // Reset countdown
        setCanResend(false); // Disable resend button
      } else {
        Alert.alert("Resend Failed", response.message || "Failed to resend code");
      }
    } catch (error) {
      Alert.alert("Resend Failed", error.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
              <Text style={[styles.icon, { color: theme.primary }]}>✉️</Text>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              Verify Email
            </Text>
            <Text style={[styles.subtitle, { color: theme.textLight }]}>
              Enter the 6-digit code sent to
            </Text>
            <Text style={[styles.emailText, { color: theme.primary }]}>
              {email || 'your email'}
            </Text>
          </View>

          {/* Input Code */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.textLight }]}>ENTER CODE</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.inputBg,
                color: theme.text,
                borderColor: theme.primary
              }]}
              placeholder="123456"
              placeholderTextColor={theme.textLight}
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
              textAlign="center"
            />
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              { backgroundColor: code.length === 6 ? theme.primary : theme.buttonDisabled }
            ]}
            disabled={code.length !== 6 || loading}
            onPress={handleVerify}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify Now</Text>
            )}
          </TouchableOpacity>

          {/* Resend & Back */}
          <View style={styles.footerLinks}>
            <TouchableOpacity
              onPress={handleResend}
              disabled={!canResend || resending}
              style={{ opacity: canResend && !resending ? 1 : 0.5 }}
            >
              {resending ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={{ color: canResend ? theme.primary : theme.textLight, marginBottom: 20, fontWeight: '600' }}>
                  {canResend ? '↻ Resend Code' : `Resend in ${countdown}s`}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={{ color: theme.textLight }}>Back to Login</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingVertical: 30,
    alignItems: 'center'
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 5,
  },
  emailText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 30,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    alignSelf: 'center',
    letterSpacing: 1,
  },
  input: {
    width: '100%',
    height: 60,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    borderWidth: 1,
    letterSpacing: 5,
  },
  verifyButton: {
    width: '100%',
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  verifyButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footerLinks: {
    alignItems: 'center',
  }
});