import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated, // Use Animated from react-native
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { THEME } from "../../theme/theme";

const { width, height } = Dimensions.get("window");

export default function SplashScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      navigation.replace("Onboarding1");
    }, 3000);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: THEME.background }]}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: THEME.card,
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
            shadowColor: "rgba(139, 92, 66, 0.15)",
          },
        ]}
      >
        {/* Warm colored icon circle */}
        <View style={[styles.logoContainer, { backgroundColor: THEME.primary + "30" }]}>
          <Text style={[styles.logoIcon, { color: THEME.primary }]}>✂️</Text>
        </View>

        <Text style={[styles.title, { color: THEME.text }]}>BOOK-A-CUT</Text>
        <Text style={[styles.subtitle, { color: THEME.textLight }]}>Booking</Text>

        <View style={[styles.divider, { backgroundColor: THEME.primary }]} />

        <Text style={[styles.version, { color: THEME.textLight }]}>Version 1.0.0</Text>
      </Animated.View>

      {/* Warm decorative elements */}
      <View style={[styles.decorativeCircle1, { backgroundColor: THEME.primary + "20" }]} />
      <View style={[styles.decorativeCircle2, { backgroundColor: THEME.secondary + "20" }]} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: width * 0.85,
    height: height * 0.75,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  logoIcon: {
    fontSize: 60,
  },
  title: {
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: "500",
    marginBottom: 40,
  },
  divider: {
    width: 100,
    height: 3,
    marginVertical: 30,
    borderRadius: 2,
  },
  version: {
    fontSize: 14,
    position: "absolute",
    bottom: 30,
  },
  decorativeCircle1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -50,
    left: -50,
    zIndex: -1,
  },
  decorativeCircle2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    bottom: -30,
    right: -30,
    zIndex: -1,
  },
});