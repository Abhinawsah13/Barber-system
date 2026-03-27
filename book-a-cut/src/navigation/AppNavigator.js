import React, { useState, useEffect } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { isLoggedIn, getUserData } from '../services/TokenManager';
import { SOCKET_BASE_URL } from '../config/server';

export const navigationRef = createNavigationContainerRef();

// Onboarding Screens
import SplashScreen from "../screens/onboarding/SplashScreen";
import OnboardingScreen1 from "../screens/onboarding/OnboardingScreen1";
import OnboardingScreen2 from "../screens/onboarding/OnboardingScreen2";
import OnboardingScreen3 from "../screens/onboarding/OnboardingScreen3";

// Auth Screens
import RoleSelectionScreen from "../screens/auth/RoleSelectionScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import ForgetPasswordscreen from "../screens/auth/ForgetPasswordscreen";
import ResetPasswordScreen from "../screens/auth/ResetPasswordScreen";
import VerificationPendingScreen from "../screens/auth/VerificationPendingScreen";

// Customer Screens
import HomeScreen from "../screens/customer/HomeScreen";
import HomeServicesScreen from "../screens/customer/HomeServicesScreen";
import BarberDetailsScreen from "../screens/customer/BarberDetailsScreen";
import BookingScreen from "../screens/customer/BookingScreen";
import BookingSuccessScreen from "../screens/customer/BookingSuccessScreen";
import MyBookingsScreen from "../screens/customer/MyBookingsScreen";
import WalletScreen from '../screens/customer/WalletScreen';
import CustomerSettingsScreen from '../screens/customer/CustomerSettingsScreen';
import CalendarScreen from "../screens/customer/CalendarScreen";

// Sprint 4 — New Booking Flow Screens
import ServiceBrowsingScreen from "../screens/customer/ServiceBrowsingScreen";
import BarberSelectionScreen from "../screens/customer/BarberSelectionScreen";
import DateTimePickerScreen from "../screens/customer/DateTimePickerScreen";
import BookingConfirmationScreen from "../screens/customer/BookingConfirmationScreen";
import RateBarberScreen from "../screens/customer/RateBarberScreen";
import NearbyMapScreen from "../screens/customer/NearbyMapScreen";
import MapScreen from "../screens/customer/MapScreen";
import PaymentWebViewScreen from "../screens/customer/PaymentWebViewScreen";

// Barber Screens
import BarberHomeScreen from "../screens/barber/BarberHomeScreen";
import BarberProfileScreen from "../screens/barber/BarberProfileScreen";
import BarberEditProfileScreen from "../screens/barber/BarberEditProfileScreen";
import BarberServicesScreen from "../screens/barber/BarberServicesScreen";
import BarberSettingsScreen from "../screens/barber/BarberSettingsScreen";

// Shared Screens
import UserProfileScreen from "../screens/shared/UserProfileScreen";
import NotificationsScreen from "../screens/shared/NotificationsScreen";
import SettingsScreen from "../screens/shared/SettingsScreen";
import AIChatScreen from '../screens/shared/AIChatScreen';
import EditProfileScreen from '../screens/shared/EditProfileScreen';
import ChangePasswordScreen from '../screens/shared/ChangePasswordScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let socket;
    const initializeAuthAndSocket = async () => {
      await checkAuthStatus();
      
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        const userData = await getUserData();
        if (userData && userData.user_type === 'customer' && userData._id) {
          socket = io(SOCKET_BASE_URL);
          socket.emit('join-user-room', userData._id);
          
          socket.on('booking-completed', (booking) => {
            if (navigationRef.isReady()) {
               navigationRef.navigate('RateBarber', {
                   bookingId: booking._id,
                   barberId: booking.barber?._id || booking.barber,
                   barberName: booking.barber?.username || 'Barber',
                   barberImage: booking.barber?.profile_image || null,
                   serviceName: booking.service?.name || null,
                   date: booking.date,
               });
            }
          });
        }
      }
    };
    
    initializeAuthAndSocket();
    
    return () => {
      if (socket) {
        socket.off('booking-completed');
        socket.disconnect();
      }
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check if user is logged in
      const loggedIn = await isLoggedIn();

      if (loggedIn) {
        // Get user data to determine which home screen to show
        const userData = await getUserData();

        if (userData && userData.user_type === 'barber') {
          setInitialRoute('BarberHome');
        } else if (userData && userData.user_type === 'admin') {
          setInitialRoute('AdminDashboard');
        } else {
          setInitialRoute('Home');
        }
      } else {
        // Check if user has seen onboarding
        const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');

        if (hasSeenOnboarding) {
          setInitialRoute('Login');
        } else {
          setInitialRoute('Splash');
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setInitialRoute('Splash');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading screen while checking auth status
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8F0' }}>
        <ActivityIndicator size="large" color="#B76E22" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={initialRoute}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Onboarding1" component={OnboardingScreen1} />
        <Stack.Screen name="Onboarding2" component={OnboardingScreen2} />
        <Stack.Screen name="Onboarding3" component={OnboardingScreen3} />
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="BarberDetails" component={BarberDetailsScreen} />
        <Stack.Screen name="BookingScreen" component={BookingScreen} />
        {/* 'Booking' is an alias for 'BookingScreen' — keeps old navigation calls working */}
        <Stack.Screen name="Booking" component={BookingScreen} />
        <Stack.Screen name="UserProfile" component={UserProfileScreen} />
        <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="ForgetPassword" component={ForgetPasswordscreen} />
        <Stack.Screen name="BookingSuccess" component={BookingSuccessScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="VerificationPending" component={VerificationPendingScreen} />
        <Stack.Screen name="HomeServices" component={HomeServicesScreen} />
        <Stack.Screen name="AIChat" component={AIChatScreen} />
        <Stack.Screen name="Wallet" component={WalletScreen} />

        {/* Barber Screens */}
        <Stack.Screen name="BarberHome" component={BarberHomeScreen} />
        <Stack.Screen name="BarberProfile" component={BarberProfileScreen} />
        <Stack.Screen name="BarberEditProfile" component={BarberEditProfileScreen} />
        <Stack.Screen name="BarberServices" component={BarberServicesScreen} />
        <Stack.Screen name="BarberSettings" component={BarberSettingsScreen} />

        {/* Customer Screens */}
        <Stack.Screen name="CustomerSettings" component={CustomerSettingsScreen} />
        <Stack.Screen name="Calendar" component={CalendarScreen} />

        {/* Sprint 4 — New Booking Flow */}
        <Stack.Screen name="ServiceBrowsing" component={ServiceBrowsingScreen} />
        <Stack.Screen name="BarberSelection" component={BarberSelectionScreen} />
        <Stack.Screen name="DateTimePicker" component={DateTimePickerScreen} />
        <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
        <Stack.Screen name="RateBarber" component={RateBarberScreen} />
        <Stack.Screen name="NearbyMap" component={NearbyMapScreen} />
        <Stack.Screen name="MapScreen" component={MapScreen} />
        <Stack.Screen name="PaymentWebView" component={PaymentWebViewScreen} options={{ headerShown: false }} />

        {/* Shared Screens */}
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}