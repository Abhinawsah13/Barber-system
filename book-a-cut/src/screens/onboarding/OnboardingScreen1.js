import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { THEME } from "../../theme/theme";

const { width, height } = Dimensions.get("window");

export default function OnboardingScreen1({ navigation }) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: THEME.background }]}>
      {/* Skip Button - Amber */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => navigation.navigate("RoleSelection")}
      >
        <Text style={[styles.skipText, { color: THEME.primary }]}>Skip</Text>
      </TouchableOpacity>

      {/* Illustration with warm colors */}
      <View style={[styles.illustration, { backgroundColor: THEME.primary + "15" }]}>
        <Text style={[styles.illustrationText, { color: THEME.primary }]}>✂️💈</Text>
        <Text style={[styles.illustrationSubtext, { color: THEME.textLight }]}>
          Premium Grooming
        </Text>
      </View>

      {/* Title with warm colors */}
      <Text style={[styles.title, { color: THEME.text }]}>
        Book your Perfect{"\n"}Haircut Anytime
      </Text>

      {/* Features with checkmarks */}
      <View style={styles.featuresContainer}>
        <View style={styles.featureItem}>
          <View style={[styles.checkmark, { backgroundColor: THEME.primary }]}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
          <Text style={[styles.featureText, { color: THEME.text }]}>Real-time Booking</Text>
        </View>
        <View style={styles.featureItem}>
          <View style={[styles.checkmark, { backgroundColor: THEME.primary }]}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
          <Text style={[styles.featureText, { color: THEME.text }]}>AI Assistant</Text>
        </View>
        <View style={styles.featureItem}>
          <View style={[styles.checkmark, { backgroundColor: THEME.primary }]}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
          <Text style={[styles.featureText, { color: THEME.text }]}>Secure Payments</Text>
        </View>
      </View>

      {/* Dots - Amber active */}
      <View style={styles.dotsContainer}>
        <View style={[styles.dot, styles.activeDot, { backgroundColor: THEME.primary }]} />
        <View style={[styles.dot, { backgroundColor: THEME.border }]} />
        <View style={[styles.dot, { backgroundColor: THEME.border }]} />
      </View>

      {/* Next Button - Amber */}
      <TouchableOpacity
        style={[styles.nextButton, { backgroundColor: THEME.primary }]}
        onPress={() => navigation.navigate("Onboarding2")}
      >
        <Text style={[styles.nextButtonText, { color: "#FFFFFF" }]}>Next</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 25,
  },
  skipButton: {
    alignSelf: "flex-end",
    marginTop: 10,
    padding: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: "500",
  },
  illustration: {
    width: width * 0.7,
    height: height * 0.3,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginTop: height * 0.05,
    marginBottom: 40,
    borderWidth: 2,
    borderColor: "#E8D3C5",
    borderStyle: "dashed",
  },
  illustrationText: {
    fontSize: 70,
    marginBottom: 10,
  },
  illustrationSubtext: {
    fontSize: 14,
    fontStyle: "italic",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 40,
  },
  featuresContainer: {
    width: "100%",
    marginBottom: 50,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    paddingHorizontal: 20,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  checkmarkText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  featureText: {
    fontSize: 18,
    fontWeight: "500",
  },
  dotsContainer: {
    flexDirection: "row",
    marginBottom: 30,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  activeDot: {
    width: 25,
  },
  nextButton: {
    paddingVertical: 16,
    paddingHorizontal: 50,
    borderRadius: 25,
    width: "100%",
    alignItems: "center",
    shadowColor: "rgba(183, 110, 34, 0.3)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
});
