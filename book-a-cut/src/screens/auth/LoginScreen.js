import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  Image, // Added Image
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loginUser, verifyEmail, resendOtp } from "../../services/api";
import { useTheme } from "../../context/ThemeContext";
import { setToken } from "../../services/TokenManager";

export default function LoginScreen({ navigation }) {
  const { theme } = useTheme();
  // ... rest of the code remains same
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Verify Modal State
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [verifying, setVerifying] = useState(false);

  const isFormValid = () => {
    return email && password;
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLogin = async () => {
    if (!isFormValid()) return;

    setLoading(true);
    try {
      const response = await loginUser(email, password);
      console.log("Login Response:", response);

      // Save token and user data to AsyncStorage
      if (response.data && response.data.token) {
        await setToken(response.data.token);

        if (response.data.user) {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));

          const user = response.data.user;
          // Navigate based on user type
          if (user.user_type === 'barber') {
            navigation.reset({ index: 0, routes: [{ name: "BarberHome" }] });
          } else if (user.user_type === 'admin') {
            navigation.reset({ index: 0, routes: [{ name: "AdminDashboard" }] });
          } else {
            navigation.reset({ index: 0, routes: [{ name: "Home" }] });
          }
        }
      }
    } catch (error) {
      // ── Handle Specific Error Cases ──

      // 1. Email not registered
      if (error.message.includes("not registered")) {
        Alert.alert(
          "Not Found",
          "This email is not registered yet.",
          [
            { text: "Go to Sign Up", onPress: () => navigation.navigate("RoleSelection") },
            { text: "Cancel", style: "cancel" }
          ]
        );
      }
      // 2. Email not verified
      else if (error.message.includes("not verified")) {
        Alert.alert(
          "Verification Required",
          "Your email is not verified.",
          [
            { text: "Back to Sign Up", onPress: () => navigation.navigate("RoleSelection") },
            {
              text: "Try again with verified email",
              onPress: () => {
                setEmail("");
                setPassword("");
              }
            }
          ]
        );
      }
      // 3. Normal errors (wrong password, etc)
      else {
        Alert.alert("Login Failed", error.message || "Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter a 6-digit code');
      return;
    }

    setVerifying(true);
    try {
      const response = await verifyEmail(userEmail, otpCode);

      // Save token and user data after successful verification
      if (response.data && response.data.token) {
        await setToken(response.data.token);

        if (response.data.user) {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
        }

        const user = response.data.user;

        setShowVerifyModal(false);

        // Navigate based on user type
        if (user.user_type === 'barber') {
          navigation.reset({ index: 0, routes: [{ name: "BarberHome" }] });
        } else if (user.user_type === 'admin') {
          navigation.reset({ index: 0, routes: [{ name: "AdminDashboard" }] });
        } else {
          navigation.reset({ index: 0, routes: [{ name: "Home" }] });
        }
      }
    } catch (error) {
      Alert.alert('Verification Failed', error.message || 'Invalid code');
      setOtpCode('');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendOtp(userEmail, 'verify');
      Alert.alert('Resent!', 'New code sent to your email');
    } catch (error) {
      Alert.alert('Error', 'Failed to resend code');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Warm decorative element */}
          <View style={[styles.decorativeCircle, { backgroundColor: theme.primary + "20" }]} />

          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require("../../../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: theme.text }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { color: theme.textLight }]}>
              Sign in to continue
            </Text>
          </View>

          {/* Form Card */}
          <View style={[
            styles.card,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              shadowColor: "rgba(139, 92, 66, 0.1)",
            }
          ]}>
            {/* Email Field */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.textLight }]}>
                EMAIL
              </Text>
              <TextInput
                placeholder="jiara@example.com"
                placeholderTextColor="#B0A196"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.border,
                    color: theme.text,
                  }
                ]}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password Field with Toggle */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.textLight }]}>
                PASSWORD
              </Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="*****"
                  placeholderTextColor="#B0A196"
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.border,
                      color: theme.text,
                    }
                  ]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={togglePasswordVisibility}
                >
                  <Text style={[styles.eyeIcon, { color: theme.textLight }]}>
                    {showPassword ? "🙈" : "👁️"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password - Amber */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation.navigate("ForgetPassword")}
            >
              <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {/* Login Button - Amber */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                {
                  backgroundColor: isFormValid() && !loading
                    ? theme.primary
                    : theme.buttonDisabled,
                  borderColor: theme.primary,
                  shadowColor: "rgba(183, 110, 34, 0.3)",
                },
              ]}
              onPress={handleLogin}
              disabled={!isFormValid() || loading}
            >
              <Text style={styles.loginButtonText}>
                {loading ? "Logging in..." : "Login"}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Sign Up Link */}
            <View style={styles.signupContainer}>
              <Text style={[styles.signupText, { color: theme.textLight }]}>
                Don't have an account?{" "}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate("RoleSelection")}>
                <Text style={[styles.signupLink, { color: theme.primary }]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 🔥 SIMPLE VERIFY MODAL */}
      <Modal
        visible={showVerifyModal}
        transparent={true}
        animationType="slide"
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.7)'
        }}>
          <View style={{
            backgroundColor: theme.card,
            padding: 30,
            borderRadius: 20,
            width: '85%',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.border
          }}>
            <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: theme.text }}>
              Verify Email
            </Text>
            <Text style={{ textAlign: 'center', marginBottom: 20, color: theme.textLight }}>
              Check {userEmail} for 6-digit code
            </Text>

            <TextInput
              style={{
                borderWidth: 3,
                borderColor: otpCode.length === 6 ? '#4CAF50' : theme.primary,
                padding: 25,
                width: 280,
                borderRadius: 20,
                fontSize: 32,
                textAlign: 'center',
                letterSpacing: 20,
                marginBottom: 25,
                backgroundColor: theme.inputBg,
                color: theme.text,
                fontWeight: 'bold'
              }}
              placeholder="456789"
              placeholderTextColor={theme.textLight}
              keyboardType="number-pad"
              maxLength={6}
              value={otpCode}
              onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
              autoFocus
            />

            <TouchableOpacity
              style={{
                backgroundColor: theme.primary,
                paddingHorizontal: 30,
                paddingVertical: 12,
                borderRadius: 10,
                marginBottom: 10,
                width: '100%',
                alignItems: 'center'
              }}
              onPress={handleVerify}
              disabled={verifying}
            >
              {verifying ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Verify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleResend} style={{ marginTop: 10 }}>
              <Text style={{ color: theme.primary, fontWeight: '600' }}>Resend Code</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowVerifyModal(false)} style={{ marginTop: 15 }}>
              <Text style={{ color: theme.textLight }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 25,
    paddingVertical: 20,
  },
  decorativeCircle: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -40,
    left: -40,
    opacity: 0.1,
    zIndex: -1,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  card: {
    borderRadius: 20,
    padding: 25,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 30,
    borderWidth: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    paddingRight: 50,
  },
  eyeButton: {
    position: "absolute",
    right: 15,
    top: 15,
    padding: 5,
  },
  eyeIcon: {
    fontSize: 20,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 25,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: "500",
  },
  loginButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    width: "100%",
    marginVertical: 20,
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signupText: {
    fontSize: 16,
  },
  signupLink: {
    fontSize: 16,
    fontWeight: "bold",
  },
});