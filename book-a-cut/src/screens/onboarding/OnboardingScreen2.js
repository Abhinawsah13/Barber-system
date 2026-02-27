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

export default function OnboardingScreen2({ navigation }) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: THEME.background }]}>
      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => navigation.navigate("RoleSelection")}
      >
        <Text style={[styles.skipText, { color: THEME.primary }]}>Skip</Text>
      </TouchableOpacity>

      <View style={[styles.locationStatus, { backgroundColor: THEME.statusBg }]}>
        <Text style={[styles.locationText, { color: THEME.primary }]}>
          Arriving at your location...
        </Text>
      </View>

      <View style={[styles.illustration, { backgroundColor: THEME.primary + "15" }]}>
        <View style={styles.iconContainer}>
          <Text style={[styles.vanIcon, { color: THEME.primary }]}>🚐</Text>
          <View style={[styles.locationPin, { backgroundColor: THEME.primary }]}>
            <Text style={styles.pinText}>📍</Text>
          </View>
        </View>
        <Text style={[styles.illustrationSubtext, { color: THEME.textLight }]}>
          Barber on the way
        </Text>
      </View>

      <View style={styles.titleContainer}>
        <Text style={[styles.titleLine1, { color: THEME.text }]}>
          Barber at Your
        </Text>
        <View style={styles.titleLine2Container}>
          <View style={[styles.titleUnderline, { backgroundColor: THEME.primary }]} />
          <Text style={[styles.titleLine2, { color: THEME.primary }]}>
            Doorstep
          </Text>
          <View style={[styles.titleUnderline, { backgroundColor: THEME.primary }]} />
        </View>
      </View>

      <Text style={[styles.description, { color: THEME.textLight }]}>
        Why travel? Book a professional barber to come directly to your home for
        a convenient, premium grooming experience.
      </Text>

      <View style={styles.dotsContainer}>
        <View style={[styles.dot, { backgroundColor: THEME.border }]} />
        <View style={[styles.dot, styles.activeDot, { backgroundColor: THEME.primary }]} />
        <View style={[styles.dot, { backgroundColor: THEME.border }]} />
      </View>

      <TouchableOpacity
        style={[styles.nextButton, { backgroundColor: THEME.primary }]}
        onPress={() => navigation.navigate("Onboarding3")}
      >
        <Text style={[styles.nextButtonText, { color: "#FFFFFF" }]}>
          Next
        </Text>
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
  locationStatus: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 20,
    marginBottom: 30,
  },
  locationText: {
    fontSize: 14,
    fontWeight: "500",
  },
  illustration: {
    width: width * 0.7,
    height: height * 0.3,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#E8D3C5",
  },
  iconContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  vanIcon: {
    fontSize: 70,
  },
  locationPin: {
    position: "absolute",
    right: -10,
    top: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  pinText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  illustrationSubtext: {
    fontSize: 14,
    marginTop: 15,
    fontStyle: "italic",
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  titleLine1: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 5,
  },
  titleLine2Container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  titleLine2: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 36,
    marginHorizontal: 10,
  },
  titleUnderline: {
    width: 30,
    height: 4,
    borderRadius: 2,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 10,
    marginBottom: 50,
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
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
});