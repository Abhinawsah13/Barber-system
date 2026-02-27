import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Dimensions
} from "react-native";
import { THEME } from "../../theme/theme";

const { width } = Dimensions.get("window");

export default function RoleSelectionScreen({ navigation }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [buttonScale] = useState(new Animated.Value(1));

  const handleRoleSelect = (role) => {
    setSelectedRole(role);

    // Button animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleContinue = () => {
    if (!selectedRole) return;

    // Navigation animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate to Register with role parameter
    navigation.navigate("Register", {
      role: selectedRole
    });
  };

  const roleCards = [
    {
      id: "customer",
      emoji: "🧑‍🦱",
      title: "Customer",
      description: "Book barbers & salon services",
      features: ["Book appointments", "Find nearby barbers", "Secure payments", "Ratings & reviews"],
      color: THEME.primary
    },
    {
      id: "barber",
      emoji: "💈",
      title: "Barber",
      description: "Provide services & earn money",
      features: ["Manage appointments", "Set your schedule", "Earn reviews", "Grow your business"],
      color: "#2E7D32" // Green for barber
    }
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: THEME.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: THEME.text }]}>
          Welcome to Barber Booking ✂️
        </Text>
        <Text style={[styles.subtitle, { color: THEME.textLight }]}>
          Choose how you want to use our platform
        </Text>
      </View>

      {/* Role Selection */}
      <View style={styles.roleContainer}>
        {roleCards.map((role) => (
          <TouchableOpacity
            key={role.id}
            style={[
              styles.roleCard,
              selectedRole === role.id && {
                borderColor: role.color,
                borderWidth: 2,
                transform: [{ scale: 1.02 }]
              }
            ]}
            onPress={() => handleRoleSelect(role.id)}
            activeOpacity={0.7}
          >
            {/* Role Emoji */}
            <View style={[
              styles.emojiContainer,
              { backgroundColor: role.color + '20' }
            ]}>
              <Text style={[styles.emoji, { color: role.color }]}>
                {role.emoji}
              </Text>
            </View>

            {/* Role Title */}
            <Text style={[styles.roleTitle, { color: THEME.text }]}>
              {role.title}
            </Text>

            {/* Role Description */}
            <Text style={[styles.roleDesc, { color: THEME.textLight }]}>
              {role.description}
            </Text>

            {/* Features List */}
            <View style={styles.featuresContainer}>
              {role.features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Text style={[styles.featureIcon, { color: role.color }]}>
                    ✓
                  </Text>
                  <Text style={[styles.featureText, { color: THEME.textLight }]}>
                    {feature}
                  </Text>
                </View>
              ))}
            </View>

            {/* Selection Indicator */}
            {selectedRole === role.id && (
              <View style={[
                styles.selectedIndicator,
                { backgroundColor: role.color }
              ]}>
                <Text style={styles.selectedText}>Selected</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Continue Button */}
      <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            {
              backgroundColor: selectedRole ? THEME.primary : THEME.buttonDisabled,
              shadowColor: selectedRole ? THEME.primary + '80' : 'transparent'
            }
          ]}
          disabled={!selectedRole}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>
            {selectedRole ? `Continue as ${selectedRole}` : 'Select a role to continue'}
          </Text>
          {selectedRole && (
            <Text style={styles.continueSubtext}>
              Tap to create your {selectedRole} account
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Login Link */}
      <TouchableOpacity
        style={styles.loginContainer}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={[styles.loginText, { color: THEME.textLight }]}>
          Already have an account?{' '}
          <Text style={{ color: THEME.primary, fontWeight: 'bold' }}>
            Login here
          </Text>
        </Text>
      </TouchableOpacity>

      {/* Info Footer */}
      <View style={styles.footer}>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 25,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  roleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  roleCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emojiContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'center',
  },
  emoji: {
    fontSize: 35,
  },
  roleTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  roleDesc: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  featuresContainer: {
    marginTop: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 20,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 15,
    right: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  selectedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  continueButton: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  continueSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  loginContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 10,
  },
  loginText: {
    fontSize: 15,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
  },
});