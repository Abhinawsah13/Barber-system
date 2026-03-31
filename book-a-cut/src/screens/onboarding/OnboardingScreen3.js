// src/screens/OnboardingScreen3.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context"; // Fixed import
import { THEME } from "../../theme/theme";

const { width, height } = Dimensions.get("window");

// REMOVED DUPLICATE THEME DEFINITION:
// const THEME = {
//   background: "#FFFCF5",
//   card: "#FFFFFF",
//   text: "#2C1810",
//   textLight: "#8D6E63",
//   primary: "#8B4513",
//   secondary: "#D4A574",
//   border: "#E8D3C5",
//   buttonText: "#FFFFFF",
//   khaltiBg: "#5C2D91",
//   esewaBg: "#2E7D32",
//   paymentCardBg: "#FFF9F3",
// };

export default function OnboardingScreen3({ navigation }) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: THEME.background }]}>
      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => navigation.navigate("RoleSelection")}
      >
        <Text style={[styles.skipText, { color: THEME.primary }]}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.paymentMethods}>
        <View style={[styles.paymentCard, {
          backgroundColor: THEME.paymentCardBg,
          borderColor: THEME.border,
        }]}>
          <View style={[styles.paymentIcon, { backgroundColor: THEME.khaltiBg }]}>
            <Text style={styles.paymentIconText}>K</Text>
          </View>
          <View style={styles.paymentTextContainer}>
            <Text style={[styles.paymentTitle, { color: THEME.text }]}>Khalti</Text>
            <Text style={[styles.paymentStatus, { color: THEME.textLight }]}>
              Wallet Connected
            </Text>
          </View>
        </View>


      </View>

      <Text style={[styles.title, { color: THEME.text }]}>
        Pay with Khalti
      </Text>

      <Text style={[styles.description, { color: THEME.textLight }]}>
        Enjoy seamless cashless payments. Securely book your next haircut using
        Khalti instantly.
      </Text>

      <View style={styles.dotsContainer}>
        <View style={[styles.dot, { backgroundColor: THEME.border }]} />
        <View style={[styles.dot, { backgroundColor: THEME.border }]} />
        <View style={[
          styles.dot,
          styles.activeDot,
          { backgroundColor: THEME.primary }
        ]} />
      </View>

      <TouchableOpacity
        style={[styles.getStartedButton, { backgroundColor: THEME.primary }]}
        onPress={() => navigation.navigate("RoleSelection")}
      >
        <Text style={[styles.getStartedText, { color: THEME.buttonText }]}>
          Get Started
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
  paymentMethods: {
    width: "100%",
    marginTop: height * 0.05,
    marginBottom: 40,
  },
  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
  },
  paymentIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  paymentIconText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  paymentTextContainer: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  paymentStatus: {
    fontSize: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
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
  getStartedButton: {
    paddingVertical: 16,
    paddingHorizontal: 50,
    borderRadius: 25,
    width: "100%",
    alignItems: "center",
  },
  getStartedText: {
    fontSize: 18,
    fontWeight: "600",
  },
});