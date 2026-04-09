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
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
  Image
} from "react-native";
import { registerUser, verifyEmail, resendOtp } from "../../services/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

const { width, height } = Dimensions.get("window");

export default function RegisterScreen({ navigation, route }) {
  const { role } = route.params || { role: 'customer' }; // Default to customer if not provided

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: role,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [buttonScale] = useState(new Animated.Value(1));

  const [buttonGlow] = useState(new Animated.Value(0));
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();

  // OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Check if form is valid
  const isFormValid = () => {
    const { name, email, phone, password, confirmPassword } = formData;
    return (
      name.trim().length > 0 &&
      email.trim().length > 0 &&
      phone.trim().length >= 10 && // Basic phone validation
      password.length >= 6 &&
      confirmPassword.length >= 6 &&
      password === confirmPassword
    );
  };

  // Handle input change
  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });

    // Animate button when form becomes valid
    if (!isFormValid()) {
      // Check if form WILL be valid after this change
      const futureForm = { ...formData, [field]: value };
      const willBeValid = (
        futureForm.name.trim().length > 0 &&
        futureForm.email.trim().length > 0 &&
        futureForm.phone.trim().length >= 10 &&
        futureForm.password.length >= 6 &&
        futureForm.confirmPassword.length >= 6 &&
        futureForm.password === futureForm.confirmPassword
      );

      if (willBeValid) {
        // Button glow animation
        Animated.sequence([
          Animated.timing(buttonGlow, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(buttonScale, {
            toValue: 1.02,
            friction: 3,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  };

  const handleRegister = async () => {
    if (!isFormValid()) {
      const { name, email, phone, password, confirmPassword } = formData;
      if (!name.trim()) return Alert.alert("Wait!", "Please enter your full name first. 😊");
      if (!email.trim() || !email.includes('@')) return Alert.alert("Wait!", "Please enter a valid email address.");
      if (phone.trim().length < 10) return Alert.alert("Wait!", "Please enter a valid 10-digit phone number.");
      if (password.length < 6) return Alert.alert("Wait!", "Password must be at least 6 characters long.");
      if (password !== confirmPassword) return Alert.alert("Wait!", "Passwords do not match. Please check again.");
      return;
    }

    setLoading(true);
    try {
      const response = await registerUser(formData);

      // api.js returns: { success, message, data: { email, requiresVerification } }
      const requiresVerification = response?.data?.requiresVerification || response?.requiresVerification;
      const emailFromServer = response?.data?.email || formData.email;

      if (requiresVerification) {
        setRegisteredEmail(emailFromServer);
        setShowOtpModal(true);
      } else {
        // Direct success (no OTP needed)
        Alert.alert("Success", "Account created! Please log in.");
        navigation.navigate('Login');
      }
    } catch (error) {
      Alert.alert("Registration Failed", error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupVerify = async () => {
    if (otpCode.length !== 6) return;

    setLoading(true);
    try {
      const response = await verifyEmail(registeredEmail, otpCode);

      // api.js returns parsed JSON directly (not wrapped in .data like Axios)
      if (response?.success) {
        Alert.alert('Success!', 'Account verified! You can login now.', [
          {
            text: "OK", onPress: () => {
              setShowOtpModal(false);
              navigation.navigate('Login');
            }
          }
        ]);
      } else {
        Alert.alert('Error', response?.message || 'Verification failed. Please try again.');
        setOtpCode('');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Invalid code. Please try again.');
      setOtpCode('');
    } finally {
      setLoading(false);
    }
  };


  const handleResendOtp = async () => {
    try {
      await resendOtp(registeredEmail, 'verify');
      Alert.alert('Success', 'New code sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to resend');
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Button glow animation value
  const glowAnimation = buttonGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 15],
  });

  // Button shadow animation
  const shadowAnimation = buttonGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

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
          {/* Header */}
          <View style={styles.header}>
            {role === 'barber' && (
              <Image
                source={require("../../../assets/barber.png")}
                style={styles.headerImage}
                resizeMode="contain"
              />
            )}
            <Text style={[styles.title, { color: theme.text }]}>
              {role === 'barber' ? 'Barber Registration' : 'Create Account'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textLight }]}>
              {role === 'barber' ? 'Join our platform to grow your business' : 'Join us to book your next cut.'}
            </Text>
          </View>

          {/* Form Card */}
          <View style={[styles.card, {
            backgroundColor: theme.card,
            borderColor: theme.border,
          }]}>
            {/* Name Field */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.textLight }]}>
                NAME
              </Text>
              <TextInput
                placeholder="Jlara Martins"
                placeholderTextColor="#B0A196"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: formData.name ? theme.primary : theme.border,
                    color: theme.text,
                  }
                ]}
                value={formData.name}
                onChangeText={(text) => handleInputChange("name", text)}
                autoCapitalize="words"
              />
            </View>

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
                    borderColor: formData.email ? theme.primary : theme.border,
                    color: theme.text,
                  }
                ]}
                value={formData.email}
                onChangeText={(text) => handleInputChange("email", text)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Phone Field */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.textLight }]}>
                PHONE NUMBER
              </Text>
              <TextInput
                placeholder="+1 (555) 000-0000"
                placeholderTextColor="#B0A196"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: formData.phone ? theme.primary : theme.border,
                    color: theme.text,
                  }
                ]}
                value={formData.phone}
                onChangeText={(text) => handleInputChange("phone", text)}
                keyboardType="phone-pad"
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
                      borderColor: formData.password ? theme.primary : theme.border,
                      color: theme.text,
                    }
                  ]}
                  value={formData.password}
                  onChangeText={(text) => handleInputChange("password", text)}
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
              {formData.password.length > 0 && formData.password.length < 6 && (
                <Text style={[styles.validationText, { color: "#CD5C5C" }]}>
                  Password must be at least 6 characters
                </Text>
              )}
            </View>

            {/* Confirm Password Field with Toggle */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.textLight }]}>
                CONFIRM PASSWORD
              </Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="*****"
                  placeholderTextColor="#B0A196"
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: formData.confirmPassword ?
                        (formData.password === formData.confirmPassword ? theme.success : "#CD5C5C")
                        : theme.border,
                      color: theme.text,
                    }
                  ]}
                  value={formData.confirmPassword}
                  onChangeText={(text) => handleInputChange("confirmPassword", text)}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={toggleConfirmPasswordVisibility}
                >
                  <Text style={[styles.eyeIcon, { color: theme.textLight }]}>
                    {showConfirmPassword ? "🙈" : "👁️"}
                  </Text>
                </TouchableOpacity>
              </View>
              {formData.confirmPassword.length > 0 &&
                formData.password !== formData.confirmPassword && (
                  <Text style={[styles.validationText, { color: "#CD5C5C" }]}>
                    Passwords do not match
                  </Text>
                )}
              {formData.confirmPassword.length > 0 &&
                formData.password === formData.confirmPassword && (
                  <Text style={[styles.validationText, { color: theme.success }]}>
                    ✓ Passwords match
                  </Text>
                )}
            </View>

            {/* Sign Up Button with Animations */}
            <Animated.View
              style={{
                transform: [{ scale: buttonScale }],
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowRadius: glowAnimation,
                shadowOpacity: shadowAnimation,
              }}
            >
              <TouchableOpacity
                style={[
                  styles.signupButton,
                  {
                    backgroundColor: isFormValid()
                      ? theme.primary
                      : (theme.background === "#121212" ? "#444" : theme.buttonDisabled),
                    opacity: loading ? 0.7 : 1,
                  },
                ]}
                onPress={handleRegister}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.signupButtonText}>
                      {isFormValid() ? "🎉 Sign Up Now!" : "Sign Up"}
                    </Text>
                    {isFormValid() && (
                      <Text style={styles.buttonSubtext}>
                        Tap to create your account
                      </Text>
                    )}
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Form Status Indicator */}
            <View style={styles.statusIndicator}>
              {["name", "email", "phone", "password", "confirmPassword"].map((field, index) => (
                <View
                  key={field}
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: formData[field] &&
                        (field !== "confirmPassword" || formData.password === formData.confirmPassword)
                        ? theme.success
                        : "#E0E0E0",
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={[styles.loginText, { color: theme.textLight }]}>
              Already have an account?{" "}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={[styles.loginLink, { color: theme.primary }]}>
                Log In
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 🔥 NUMBERS-ONLY OTP MODAL */}
      <Modal visible={showOtpModal} transparent animationType="fade">
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.8)'
        }}>
          <View style={{
            backgroundColor: theme.card,
            padding: 35,
            borderRadius: 25,
            width: '92%',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 25,
            elevation: 10,
            borderWidth: 1,
            borderColor: theme.border
          }}>
            <Text style={{
              fontSize: 26,
              fontWeight: 'bold',
              marginBottom: 15,
              color: theme.text
            }}>
              Verify Email
            </Text>
            <Text style={{
              textAlign: 'center',
              marginBottom: 35,
              color: theme.textLight,
              fontSize: 16
            }}>
              6-digit code sent to{' '}
              <Text style={{ fontWeight: 'bold', color: theme.text }}>{registeredEmail}</Text>
            </Text>

            {/* 🔥 PERFECT 6-DIGIT NUMBER INPUT */}
            <TextInput
              style={{
                borderWidth: 3,
                borderColor: theme.primary,
                padding: 25,
                width: 280,
                borderRadius: 20,
                fontSize: 32,
                textAlign: 'center',
                letterSpacing: 20,
                backgroundColor: theme.inputBg,
                fontWeight: '900',
                fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                color: theme.text,
                shadowColor: theme.primary,
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 8,
                marginBottom: 30
              }}
              placeholder=""
              placeholderTextColor={theme.textLight}
              keyboardType="number-pad"           // 🔥 NUMBERS ONLY
              maxLength={6}                       // 🔥 6 DIGITS
              value={otpCode}
              onChangeText={(text) => {
                // 🔥 FORCE 0-9 ONLY, MAX 6 DIGITS
                const numbersOnly = text.replace(/[^0-9]/g, '').slice(0, 6);
                setOtpCode(numbersOnly);
              }}
            />

            <TouchableOpacity
              style={{
                backgroundColor: theme.primary,
                paddingHorizontal: 50,
                paddingVertical: 18,
                borderRadius: 20,
                marginBottom: 15,
                shadowColor: theme.primary,
                shadowOpacity: 0.5,
                shadowRadius: 15,
                elevation: 12,
                opacity: otpCode.length !== 6 ? 0.7 : 1
              }}
              onPress={handleSignupVerify}
              disabled={otpCode.length !== 6 || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{
                  color: 'white',
                  fontSize: 20,
                  fontWeight: 'bold'
                }}>
                  Verify ({otpCode.length}/6)
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResendOtp}
              disabled={loading}
            >
              <Text style={{
                color: theme.primary,
                fontWeight: '700',
                fontSize: 16
              }}>
                Resend Code
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowOtpModal(false)}
              style={{ marginTop: 20 }}
            >
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
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  headerImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
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
    marginBottom: 30,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
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
  validationText: {
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  signupButton: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  signupButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  buttonSubtext: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    marginTop: 4,
  },
  statusIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 15,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginText: {
    fontSize: 16,
  },
  loginLink: {
    fontSize: 16,
    fontWeight: "bold",
  },
});