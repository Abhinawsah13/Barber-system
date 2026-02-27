import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { getToken, removeToken } from '../../services/TokenManager';
import { getProfile } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

export default function UserProfileScreen({ navigation, route }) {
    const { theme } = useTheme();
    const [user, setUser] = useState({
        username: "Loading...",
        email: "",
        phone: ""
    });
    const [isBarberMode, setIsBarberMode] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchProfile = async () => {
        try {
            const userData = await getProfile();
            if (userData) {
                setUser(userData);
            }
        } catch (error) {
            console.log("Error fetching profile", error);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchProfile();
        }, [])
    );

    // when returning from EditProfile, apply the saved data right away
    useEffect(() => {
        const updated = route.params?.updatedUser;
        if (updated) {
            setUser(prev => ({ ...prev, ...updated }));
        }
    }, [route.params?.updatedUser]);

    const isProfileIncomplete = !user.phone || !user.profile_image;

    const accountItems = [
        { icon: "📅", label: "My Bookings", screen: "MyBookings", color: theme.primary },
        { icon: "💳", label: "Wallet & Payments", screen: "Wallet", color: theme.primary },
        { icon: "🤖", label: "AI Preferences", screen: null, action: () => alert("AI Preferences coming soon!") },
    ];

    const generalItems = [
        { icon: "⚙️", label: "Settings", screen: "Settings", color: theme.textMuted },
        { icon: "❓", label: "Help & Support", screen: null, action: () => alert("Help & Support coming soon!") },
    ];

    const handleLogout = async () => {
        await removeToken();
        navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
        });
    };

    const handleBarberModeToggle = (value) => {
        setIsBarberMode(value);
        if (value) {
            navigation.navigate("BarberHome");
            setIsBarberMode(false);
        }
    };

    const renderMenuItem = (item, index) => (
        <TouchableOpacity
            key={index}
            style={[styles.menuItem, { borderBottomColor: theme.border }]}
            onPress={() => {
                if (item.action) {
                    item.action();
                } else if (item.screen) {
                    navigation.navigate(item.screen);
                }
            }}
        >
            <View style={[styles.iconContainer, { backgroundColor: theme.primary + '10' }]}>
                <Text style={{ fontSize: 20 }}>{item.icon}</Text>
            </View>
            <Text style={[styles.menuLabel, { color: theme.text }]}>{item.label}</Text>
            <Text style={[styles.chevron, { color: theme.textMuted }]}>›</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
                    <Text style={[styles.headerBackText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
                <View style={styles.headerBack} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Incomplete Profile Warning */}
                {isProfileIncomplete && (
                    <TouchableOpacity
                        style={[styles.warningCard, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}
                        onPress={() => navigation.navigate("EditProfile", { user })}
                    >
                        <Text style={[styles.warningText, { color: theme.warning }]}>⚠️ Complete your profile info & photo</Text>
                    </TouchableOpacity>
                )}

                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <View>
                        {user.profile_image ? (
                            <Image
                                source={{ uri: user.profile_image }}
                                style={[styles.avatar, { borderColor: theme.primary, backgroundColor: theme.inputBg }]}
                            />
                        ) : (
                            <View style={[styles.avatar, { borderColor: theme.primary, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ fontSize: 40, color: theme.textMuted }}>👤</Text>
                            </View>
                        )}
                        <TouchableOpacity style={[styles.cameraBtn, { backgroundColor: theme.primary, borderColor: theme.card }]} onPress={() => navigation.navigate("EditProfile", { user })}>
                            <Text style={{ fontSize: 12, color: '#FFF' }}>📷</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                        style={styles.editIcon}
                        onPress={() => navigation.navigate("EditProfile", { user })}
                    >
                        <Text style={{ fontSize: 18, color: theme.primary }}>✎</Text>
                    </TouchableOpacity>

                    <Text style={[styles.username, { color: theme.text }]}>{user.username}</Text>
                    <Text style={[styles.email, { color: theme.textLight }]}>{user.email}</Text>
                    <Text style={[styles.phone, { color: theme.textLight }]}>{user.phone || "No phone number"}</Text>
                </View>

                {/* Barber Mode Toggle - Only for Barbers */}
                {user.user_type === 'barber' && (
                    <View style={[styles.toggleCard, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.shadow }]}>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.scissorsIcon, { color: theme.primary }]}>✂️</Text>
                                <Text style={[styles.toggleTitle, { color: theme.text }]}>Barber Mode</Text>
                            </View>
                            <Text style={[styles.toggleSubtitle, { color: theme.textMuted }]}>Switch to manage appointments</Text>
                        </View>
                        <Switch
                            trackColor={{ false: theme.border, true: theme.primaryLight }}
                            thumbColor={isBarberMode ? theme.primary : "#F5F5F5"}
                            onValueChange={handleBarberModeToggle}
                            value={isBarberMode}
                        />
                    </View>
                )}

                {/* Account Section */}
                <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>ACCOUNT</Text>
                <View style={[styles.menuContainer, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.shadow }]}>
                    {accountItems.map(renderMenuItem)}
                </View>

                {/* General Section */}
                <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>GENERAL</Text>
                <View style={[styles.menuContainer, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.shadow }]}>
                    {generalItems.map(renderMenuItem)}
                </View>

                {/* Logout */}
                <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: theme.error + '10' }]} onPress={handleLogout}>
                    <Text style={[styles.logoutText, { color: theme.error }]}>↪ Log Out</Text>
                </TouchableOpacity>

                <Text style={[styles.versionText, { color: theme.textMuted }]}>Version 2.4.0</Text>

                <View style={{ height: 80 }} />

            </ScrollView>

            {/* Bottom Nav Placeholder (Visual Only) */}
            <View style={[styles.bottomNav, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.navigate("Home")} style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, color: theme.textMuted }}>🏠</Text>
                    <Text style={{ fontSize: 10, color: theme.textMuted }}>Home</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('ServiceBrowsing')} style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, color: theme.textMuted }}>🔍</Text>
                    <Text style={{ fontSize: 10, color: theme.textMuted }}>Explore</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('AIChat')} style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, color: theme.textMuted }}>💬</Text>
                    <Text style={{ fontSize: 10, color: theme.textMuted }}>AI Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, color: theme.primary }}>👤</Text>
                    <Text style={{ fontSize: 10, color: theme.primary }}>Profile</Text>
                </TouchableOpacity>
            </View>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    headerBack: {
        width: 40,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    headerBackText: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    profileSection: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 30,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
    },
    cameraBtn: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    editIcon: {
        position: 'absolute',
        top: 0,
        right: 0,
    },
    username: {
        marginTop: 15,
        fontSize: 22,
        fontWeight: 'bold',
    },
    email: {
        marginTop: 4,
    },
    phone: {
        marginTop: 2,
        fontSize: 12,
    },
    toggleCard: {
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        marginBottom: 30,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    scissorsIcon: {
        marginRight: 10,
        fontSize: 16,
    },
    toggleTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    toggleSubtitle: {
        fontSize: 12,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 10,
        marginTop: 10,
    },
    menuContainer: {
        borderRadius: 16,
        paddingHorizontal: 15,
        marginBottom: 20,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    menuLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
    },
    chevron: {
        fontSize: 20,
    },
    logoutBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
        marginBottom: 20,
        padding: 15,
        borderRadius: 12,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    versionText: {
        textAlign: 'center',
        fontSize: 12,
    },
    bottomNav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 15,
        borderTopWidth: 1,
    },
    warningCard: {
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        marginTop: 20,
        borderWidth: 1,
        alignItems: 'center',
    },
    warningText: {
        fontWeight: 'bold',
    }
});
