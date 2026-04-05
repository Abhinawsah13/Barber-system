// screens/customer/PaymentWebViewScreen.js
// ✅ WebView-based payment handler for Khalti & eSewa (works with Expo Go)
import React, { useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { verifyKhaltiPayment, verifyKhaltiTopUp } from '../../services/api';

export default function PaymentWebViewScreen({ navigation, route }) {
    const { theme } = useTheme();
    const {
        paymentUrl,
        gateway,
        pidx,
        bookingIntent,    // ✅ booking data — booking is created AFTER payment verification
        transactionId,    // for top-up
        amount,
        type = 'booking', // 'booking' or 'topup'
        onSuccessRoute = 'BookingSuccess',
        successParams = {},
    } = route.params;

    const webViewRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const verifyingRef = useRef(false); // prevent double calls

    // ─── Detect payment result from URL changes ───────────────────────────────
    const handleNavigationChange = async (navState) => {
        const url = navState.url;
        console.log(`[PaymentWebView] Nav: ${url}`);

        if (gateway === 'khalti') {
            // Khalti redirects to return_url with ?pidx=...&status=Completed
            if (url.includes('/payment') && url.includes('status=Completed')) {
                await handleKhaltiSuccess(url);
            } else if (url.includes('callback') && url.includes('pidx')) {
                // Alternative: Khalti hits our callback URL
                await handleKhaltiSuccess(url);
            } else if (url.includes('status=User+canceled') || url.includes('status=User%20canceled') || url.includes('status=Canceled')) {
                Alert.alert('Cancelled', 'Payment was cancelled.');
                navigation.goBack();
            }
        }


    };

    const handleKhaltiSuccess = async (url) => {
        if (verifyingRef.current) return;
        verifyingRef.current = true;
        setVerifying(true);

        try {
            // Extract pidx from URL or use the one passed in route params
            let returnedPidx = pidx;
            try {
                const urlParts = url.split('?');
                if (urlParts[1]) {
                    const params = new URLSearchParams(urlParts[1]);
                    if (params.get('pidx')) returnedPidx = params.get('pidx');
                }
            } catch (e) { /* use original pidx */ }

            const result = type === 'topup'
                ? await verifyKhaltiTopUp(returnedPidx, transactionId)
                : await verifyKhaltiPayment(returnedPidx, bookingIntent);

            if (result.success) {
                Alert.alert('Payment Successful! 🎉', type === 'topup' ? 'Your wallet has been topped up.' : 'Your booking has been confirmed and paid.');
                
                if (type === 'topup') {
                    navigation.replace('Wallet'); // Go back to wallet to see new balance
                } else {
                    navigation.replace(onSuccessRoute, {
                        ...successParams,
                        paymentMethod: 'khalti',
                        transactionId: result.transactionId,
                        paymentStatus: 'paid',
                    });
                }
            } else {
                Alert.alert('Verification Failed', result.message || 'Please contact support.');
                navigation.goBack();
            }
        } catch (e) {
            console.error('[Khalti Verify Error]', e);
            Alert.alert('Error', 'Payment verification failed. Please contact support.');
            navigation.goBack();
        } finally {
            setVerifying(false);
            verifyingRef.current = false;
        }
    };



    // Determine WebView source — Khalti uses URL, eSewa uses HTML form
    const webViewSource = { uri: paymentUrl };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => {
                    Alert.alert('Cancel Payment', 'Are you sure you want to cancel?', [
                        { text: 'No', style: 'cancel' },
                        { text: 'Yes, Cancel', style: 'destructive', onPress: () => navigation.goBack() }
                    ]);
                }}>
                    <Text style={[styles.cancelBtn, { color: '#E53935' }]}>✕ Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>
                    💜 Khalti Payment
                </Text>
                <Text style={[styles.amountText, { color: theme.primary }]}>Rs {amount}</Text>
            </View>

            {/* Verifying overlay */}
            {verifying && (
                <View style={styles.verifyingOverlay}>
                    <View style={styles.verifyingCard}>
                        <ActivityIndicator size="large" color={'#5C2D91'} />
                        <Text style={styles.verifyingText}>Verifying payment...</Text>
                        <Text style={styles.verifyingSubtext}>Please wait, do not close the app</Text>
                    </View>
                </View>
            )}

            {/* WebView */}
            <WebView
                ref={webViewRef}
                source={webViewSource}
                onNavigationStateChange={handleNavigationChange}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                startInLoadingState
                renderLoading={() => (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={'#5C2D91'} />
                        <Text style={{ marginTop: 12, color: '#666', fontSize: 14 }}>
                            Loading Khalti...
                        </Text>
                    </View>
                )}
                javaScriptEnabled
                domStorageEnabled
                thirdPartyCookiesEnabled
                sharedCookiesEnabled
                style={{ flex: 1 }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    cancelBtn: { fontWeight: '600', fontSize: 14 },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    amountText: { fontWeight: '700', fontSize: 14 },
    loadingContainer: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF',
    },
    verifyingOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center', alignItems: 'center', zIndex: 999,
    },
    verifyingCard: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        width: '80%',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    verifyingText: { marginTop: 16, fontSize: 17, color: '#333', fontWeight: '700' },
    verifyingSubtext: { marginTop: 6, fontSize: 13, color: '#999' },
});
