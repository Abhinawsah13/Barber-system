import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { changePassword } from '../../services/api';

export default function ChangePasswordScreen({ navigation }) {
    const { theme } = useTheme();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const validateInputs = () => {
        if (!oldPassword || !newPassword || !confirmPassword) {
            Alert.alert('Error', 'All fields are required');
            return false;
        }

        if (newPassword.length < 6) {
            Alert.alert('Error', 'New password must be at least 6 characters');
            return false;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match');
            return false;
        }

        if (oldPassword === newPassword) {
            Alert.alert('Error', 'New password must be different from old password');
            return false;
        }

        return true;
    };

    const handleChangePassword = async () => {
        if (!validateInputs()) return;

        setLoading(true);
        try {
            await changePassword({
                oldPassword,
                newPassword
            });

            Alert.alert(
                'Success',
                'Password changed successfully!',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.goBack()
                    }
                ]
            );

            // Clear fields
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');

        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Text style={{ fontSize: 24, color: theme.text }}>←</Text>
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>Change Password</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Info Card */}
                    <View style={[styles.infoCard, { backgroundColor: theme.cardSecondary, borderColor: theme.border }]}>
                        <Text style={[styles.infoText, { color: theme.textLight }]}>
                            🔒 Choose a strong password with at least 6 characters
                        </Text>
                    </View>

                    {/* Old Password */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, { color: theme.text }]}>Current Password</Text>
                        <View style={[styles.passwordContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="Enter current password"
                                placeholderTextColor={theme.textMuted}
                                secureTextEntry={!showOldPassword}
                                value={oldPassword}
                                onChangeText={setOldPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowOldPassword(!showOldPassword)} style={styles.eyeBtn}>
                                <Text style={{ fontSize: 18 }}>{showOldPassword ? '👁️' : '👁️‍🗨️'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* New Password */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, { color: theme.text }]}>New Password</Text>
                        <View style={[styles.passwordContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="Enter new password"
                                placeholderTextColor={theme.textMuted}
                                secureTextEntry={!showNewPassword}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeBtn}>
                                <Text style={{ fontSize: 18 }}>{showNewPassword ? '👁️' : '👁️‍🗨️'}</Text>
                            </TouchableOpacity>
                        </View>
                        {newPassword.length > 0 && newPassword.length < 6 && (
                            <Text style={[styles.errorText, { color: theme.error }]}>
                                Password must be at least 6 characters
                            </Text>
                        )}
                    </View>

                    {/* Confirm Password */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, { color: theme.text }]}>Confirm New Password</Text>
                        <View style={[styles.passwordContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="Re-enter new password"
                                placeholderTextColor={theme.textMuted}
                                secureTextEntry={!showConfirmPassword}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                                <Text style={{ fontSize: 18 }}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
                            </TouchableOpacity>
                        </View>
                        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                            <Text style={[styles.errorText, { color: theme.error }]}>
                                Passwords do not match
                            </Text>
                        )}
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[
                            styles.submitBtn,
                            { backgroundColor: theme.primary },
                            loading && { opacity: 0.7 }
                        ]}
                        onPress={handleChangePassword}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.submitBtnText}>Change Password</Text>
                        )}
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    backBtn: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    infoCard: {
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 30,
    },
    infoText: {
        fontSize: 14,
        lineHeight: 20,
    },
    inputContainer: {
        marginBottom: 25,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 15,
    },
    input: {
        flex: 1,
        paddingVertical: 15,
        fontSize: 16,
    },
    eyeBtn: {
        padding: 5,
    },
    errorText: {
        fontSize: 12,
        marginTop: 5,
    },
    submitBtn: {
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
