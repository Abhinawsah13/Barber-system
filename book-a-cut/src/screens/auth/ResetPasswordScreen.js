import React, { useState, useEffect } from 'react';
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
import { THEME } from '../../theme/theme';
import { resetPassword, resendOtp } from '../../services/api';

export default function ResetPasswordScreen({ navigation, route }) {
  const { email } = route.params || {};
  const [code, setCode] = useState('');
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60); // 60 seconds countdown
  const [canResend, setCanResend] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

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

  // Check password strength
  const checkPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });

    if (field === 'newPassword') {
      setPasswordStrength(checkPasswordStrength(value));
    }
  };

  const getPasswordStrengthText = () => {
    const strength = passwordStrength;
    if (strength === 0) return { text: 'Very Weak', color: THEME.error };
    if (strength <= 2) return { text: 'Weak', color: THEME.error };
    if (strength === 3) return { text: 'Good', color: THEME.warning };
    if (strength === 4) return { text: 'Strong', color: THEME.success };
    if (strength >= 5) return { text: 'Very Strong', color: THEME.success };
    return { text: '', color: THEME.textLight };
  };

  const getPasswordStrengthColor = () => {
    const strength = passwordStrength;
    if (strength === 0) return '#DC3545';
    if (strength <= 2) return '#DC3545';
    if (strength === 3) return '#FFC107';
    if (strength === 4) return '#28A745';
    if (strength >= 5) return '#28A745';
    return '#E8D3C5';
  };

  const validateForm = () => {
    const { newPassword, confirmPassword } = formData;

    if (!code.trim()) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return false;
    }

    if (code.length !== 6) {
      Alert.alert('Error', 'Code must be 6 digits');
      return false;
    }

    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return false;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    return true;
  };

  const handleResetPassword = async () => {
    if (!validateForm()) return;

    if (!email) {
      Alert.alert('Error', 'Email not found. Please go back and try again.');
      navigation.navigate('ForgetPassword');
      return;
    }

    setLoading(true);
    try {
      const response = await resetPassword(email, code, formData.newPassword);

      if (response.success) {
        Alert.alert(
          'Success!',
          'Your password has been reset successfully. You can now login with your new password.',
          [
            {
              text: 'Go to Login',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      const errorMessage = error.message || 'Network error. Please try again.';

      if (errorMessage.includes('expired') || errorMessage.includes('Invalid')) {
        Alert.alert(
          'Code Expired',
          'This reset code has expired or is invalid. Please request a new one.',
          [
            {
              text: 'Request New Code',
              onPress: () => navigation.navigate('ForgetPassword')
            }
          ]
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (!email) {
      Alert.alert('Error', 'Email not found');
      return;
    }

    setResending(true);
    try {
      const response = await resendOtp(email, 'reset');

      if (response.success) {
        Alert.alert('Success', 'A new reset code has been sent to your email');
        setCountdown(60); // Reset countdown
        setCanResend(false); // Disable resend button
      } else {
        Alert.alert('Error', response.message || 'Failed to resend code');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      Alert.alert('Error', error.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: THEME.background }]}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={[styles.backButtonText, { color: THEME.primary }]}>← Back</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: THEME.primary + '20' }]}>
              <Text style={[styles.icon, { color: THEME.primary }]}>�</Text>
            </View>
            <Text style={[styles.title, { color: THEME.text }]}>
              Reset Password
            </Text>
            <Text style={[styles.subtitle, { color: THEME.textLight }]}>
              Enter the code sent to
            </Text>
            <Text style={[styles.emailText, { color: THEME.primary, marginTop: 5, fontWeight: 'bold' }]}>
              {email || 'your email'}
            </Text>
          </View>

          {/* Form Card */}
          <View style={[styles.card, {
            backgroundColor: THEME.card,
            borderColor: THEME.border,
          }]}>
            {/* Code Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: THEME.textLight }]}>
                RESET CODE
              </Text>
              <TextInput
                placeholder="123456"
                placeholderTextColor="#B0A196"
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: THEME.inputBg,
                    borderColor: code ? THEME.primary : THEME.border,
                    color: THEME.text,
                  }
                ]}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
                editable={!loading}
              />
              <Text style={[styles.helperText, { color: THEME.textLight }]}>
                Enter the 6-digit code from your email
              </Text>
            </View>

            {/* New Password */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: THEME.textLight }]}>
                NEW PASSWORD
              </Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="Enter new password"
                  placeholderTextColor="#B0A196"
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: THEME.inputBg,
                      borderColor: formData.newPassword ? getPasswordStrengthColor() : THEME.border,
                      color: THEME.text,
                    }
                  ]}
                  value={formData.newPassword}
                  onChangeText={(text) => handleInputChange('newPassword', text)}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  <Text style={[styles.eyeIcon, { color: THEME.textLight }]}>
                    {showPassword ? '🙈' : '👁️'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Password Strength Indicator */}
              {formData.newPassword.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBar}>
                    <View
                      style={[
                        styles.strengthFill,
                        {
                          width: `${(passwordStrength / 5) * 100}%`,
                          backgroundColor: getPasswordStrengthColor()
                        }
                      ]}
                    />
                  </View>
                  <Text style={[styles.strengthText, { color: getPasswordStrengthText().color }]}>
                    {getPasswordStrengthText().text}
                  </Text>
                </View>
              )}

              {/* Password Requirements */}
              <View style={styles.requirementsContainer}>
                <Text style={[styles.requirementsTitle, { color: THEME.textLight }]}>
                  Password must contain:
                </Text>
                <View style={styles.requirementItem}>
                  <Text style={[
                    styles.requirementIcon,
                    { color: formData.newPassword.length >= 6 ? THEME.success : THEME.textLight }
                  ]}>
                    {formData.newPassword.length >= 6 ? '✓' : '•'}
                  </Text>
                  <Text style={[
                    styles.requirementText,
                    {
                      color: formData.newPassword.length >= 6 ? THEME.success : THEME.textLight,
                      fontWeight: formData.newPassword.length >= 6 ? '600' : '400'
                    }
                  ]}>
                    At least 6 characters
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Text style={[
                    styles.requirementIcon,
                    { color: /[A-Z]/.test(formData.newPassword) ? THEME.success : THEME.textLight }
                  ]}>
                    {/[A-Z]/.test(formData.newPassword) ? '✓' : '•'}
                  </Text>
                  <Text style={[
                    styles.requirementText,
                    {
                      color: /[A-Z]/.test(formData.newPassword) ? THEME.success : THEME.textLight,
                      fontWeight: /[A-Z]/.test(formData.newPassword) ? '600' : '400'
                    }
                  ]}>
                    One uppercase letter
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Text style={[
                    styles.requirementIcon,
                    { color: /[0-9]/.test(formData.newPassword) ? THEME.success : THEME.textLight }
                  ]}>
                    {/[0-9]/.test(formData.newPassword) ? '✓' : '•'}
                  </Text>
                  <Text style={[
                    styles.requirementText,
                    {
                      color: /[0-9]/.test(formData.newPassword) ? THEME.success : THEME.textLight,
                      fontWeight: /[0-9]/.test(formData.newPassword) ? '600' : '400'
                    }
                  ]}>
                    One number
                  </Text>
                </View>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: THEME.textLight }]}>
                CONFIRM PASSWORD
              </Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="Confirm new password"
                  placeholderTextColor="#B0A196"
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: THEME.inputBg,
                      borderColor: formData.confirmPassword ?
                        (formData.newPassword === formData.confirmPassword ? THEME.success : THEME.error)
                        : THEME.border,
                      color: THEME.text,
                    }
                  ]}
                  value={formData.confirmPassword}
                  onChangeText={(text) => handleInputChange('confirmPassword', text)}
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  <Text style={[styles.eyeIcon, { color: THEME.textLight }]}>
                    {showConfirmPassword ? '🙈' : '👁️'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Match Indicator */}
              {formData.confirmPassword.length > 0 && (
                <View style={styles.matchContainer}>
                  <Text style={[
                    styles.matchText,
                    {
                      color: formData.newPassword === formData.confirmPassword ? THEME.success : THEME.error
                    }
                  ]}>
                    {formData.newPassword === formData.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </Text>
                </View>
              )}
            </View>

            {/* Reset Button */}
            <TouchableOpacity
              style={[
                styles.resetButton,
                {
                  backgroundColor: formData.newPassword && formData.confirmPassword && !loading ? THEME.success : THEME.buttonDisabled,
                  opacity: formData.newPassword && formData.confirmPassword && !loading ? 1 : 0.7
                }
              ]}
              onPress={handleResetPassword}
              disabled={!formData.newPassword || !formData.confirmPassword || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.resetButtonText}>
                  Reset Password
                </Text>
              )}
            </TouchableOpacity>

            {/* Security Note */}
            <View style={styles.securityNote}>
              <Text style={[styles.securityIcon, { color: THEME.warning }]}>🔒</Text>
              <Text style={[styles.securityText, { color: THEME.textLight }]}>
                Your new password will be encrypted and securely stored.
              </Text>
            </View>
          </View>

          {/* Help Section */}
          <View style={[styles.helpCard, { backgroundColor: THEME.inputBg, borderColor: THEME.border }]}>
            <Text style={[styles.helpTitle, { color: THEME.text }]}>
              Need Help?
            </Text>
            <Text style={[styles.helpText, { color: THEME.textLight }]}>
              • Use a strong, unique password{'\n'}
              • Don't reuse passwords from other sites{'\n'}
              • Consider using a password manager
            </Text>
          </View>

          {/* Navigation Links */}
          <View style={styles.navContainer}>
            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={[styles.loginText, { color: THEME.primary }]}>
                ← Back to Login
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.resendButton,
                { opacity: canResend && !resending ? 1 : 0.5 }
              ]}
              onPress={handleResendOtp}
              disabled={!canResend || resending}
            >
              {resending ? (
                <ActivityIndicator size="small" color={THEME.primary} />
              ) : (
                <Text style={[styles.resendText, { color: canResend ? THEME.primary : THEME.textLight }]}>
                  {canResend ? '↻ Resend Code' : `Resend in ${countdown}s`}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Success Tips */}
          <View style={styles.tipsContainer}>
            <Text style={[styles.tipsTitle, { color: THEME.text }]}>
              After resetting:
            </Text>
            <View style={styles.tipItem}>
              <Text style={[styles.tipIcon, { color: THEME.success }]}>✓</Text>
              <Text style={[styles.tipText, { color: THEME.textLight }]}>
                Login with your new password
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={[styles.tipIcon, { color: THEME.success }]}>✓</Text>
              <Text style={[styles.tipText, { color: THEME.textLight }]}>
                Update password on other devices
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={[styles.tipIcon, { color: THEME.success }]}>✓</Text>
              <Text style={[styles.tipText, { color: THEME.textLight }]}>
                Enable 2-factor authentication if available
              </Text>
            </View>
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
  backButton: {
    paddingHorizontal: 25,
    paddingVertical: 15,
    paddingTop: 10,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
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
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  emailText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 25,
    marginBottom: 20,
    borderWidth: 1,
  },
  inputContainer: {
    marginBottom: 25,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: 'bold',
    borderWidth: 1,
    letterSpacing: 5,
  },
  helperText: {
    fontSize: 12,
    marginTop: 8,
    marginLeft: 5,
  },
  card: {
    borderRadius: 16,
    padding: 25,
    marginBottom: 20,
    borderWidth: 1,
  },
  inputContainer: {
    marginBottom: 25,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    padding: 5,
  },
  eyeIcon: {
    fontSize: 20,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E8D3C5',
    borderRadius: 2,
    marginRight: 10,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 70,
  },
  requirementsContainer: {
    marginTop: 15,
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  requirementIcon: {
    fontSize: 14,
    width: 20,
  },
  requirementText: {
    fontSize: 12,
  },
  matchContainer: {
    marginTop: 10,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resetButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  securityIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  securityText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  helpCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    marginBottom: 25,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 13,
    lineHeight: 20,
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    paddingHorizontal: 10,
  },
  loginLink: {
    paddingVertical: 10,
  },
  loginText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resendButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tipsContainer: {
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 15,
  },
  tipIcon: {
    fontSize: 16,
    width: 24,
    fontWeight: 'bold',
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },
});