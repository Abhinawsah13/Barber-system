import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '../../theme/theme';
import { useTheme } from '../../context/ThemeContext';
import { updateUserProfile } from '../../services/api';

export default function EditProfileScreen({ route, navigation }) {
    const { theme } = useTheme();
    const { user } = route.params;

    const [formData, setFormData] = useState({
        username: user.username || '',
        email: user.email || '',
        phone: user.phone || '',
        age: user.age ? String(user.age) : '',
        gender: user.gender || '',
        address: user.address || '',
        dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : '', // YYYY-MM-DD
        profile_image: user.profile_image || ''
    });

    const [loading, setLoading] = useState(false);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.2,     // ⬇ reduced — keeps base64 small enough for API
            base64: true,
        });

        if (!result.canceled) {
            const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
            setFormData(prev => ({ ...prev, profile_image: base64Img }));
        }
    };

    const handleSave = async () => {
        if (!formData.username || !formData.email) {
            Alert.alert("Error", "Username and Email are required");
            return;
        }

        setLoading(true);
        try {
            await updateUserProfile({
                ...formData,
                age: formData.age ? parseInt(formData.age) : null
            });
            Alert.alert('Success', 'Profile updated successfully', [
                {
                    text: 'OK',
                    onPress: () => {
                        // pass updated data back so the profile screen refreshes instantly
                        navigation.navigate('UserProfile', { updatedUser: { ...formData } });
                    },
                },
            ]);
        } catch (error) {
            Alert.alert("Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    const GenderOption = ({ label, value }) => (
        <TouchableOpacity
            style={[
                styles.genderOption,
                { backgroundColor: theme.inputBg, borderColor: theme.border },
                formData.gender === value && { backgroundColor: theme.primary, borderColor: theme.primary }
            ]}
            onPress={() => handleChange('gender', value)}
        >
            <Text style={[
                styles.genderText,
                { color: theme.textMuted },
                formData.gender === value && { color: '#FFF' }
            ]}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Profile</Text>
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>

                    {/* Profile Image Section */}
                    <View style={styles.imageSection}>
                        {formData.profile_image ? (
                            <Image
                                source={{ uri: formData.profile_image }}
                                style={[styles.profileImage, { backgroundColor: theme.inputBg }]}
                            />
                        ) : (
                            <View style={[styles.profileImage, { backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ fontSize: 40, color: theme.textMuted }}>📷</Text>
                            </View>
                        )}
                        <TouchableOpacity style={[styles.changePhotoBtn, { backgroundColor: theme.card }]} onPress={pickImage}>
                            <Text style={[styles.changePhotoText, { color: theme.primary }]}>Change Photo</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form Fields */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, { color: theme.textLight }]}>Username</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                            value={formData.username}
                            onChangeText={(text) => handleChange('username', text)}
                            placeholder="Enter username"
                            placeholderTextColor={theme.textMuted}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, { color: theme.textLight }]}>Email</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                            value={formData.email}
                            onChangeText={(text) => handleChange('email', text)}
                            placeholder="Enter email"
                            placeholderTextColor={theme.textMuted}
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                            <Text style={[styles.label, { color: theme.textLight }]}>Age</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                                value={formData.age}
                                onChangeText={(text) => handleChange('age', text)}
                                placeholder="Age"
                                placeholderTextColor={theme.textMuted}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={[styles.inputContainer, { flex: 2 }]}>
                            <Text style={[styles.label, { color: theme.textLight }]}>Date of Birth (YYYY-MM-DD)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                                value={formData.dob}
                                onChangeText={(text) => handleChange('dob', text)}
                                placeholder="2000-01-01"
                                placeholderTextColor={theme.textMuted}
                            />
                        </View>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, { color: theme.textLight }]}>Gender</Text>
                        <View style={styles.genderRow}>
                            <GenderOption label="Male" value="Male" />
                            <GenderOption label="Female" value="Female" />
                            <GenderOption label="Other" value="Other" />
                        </View>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, { color: theme.textLight }]}>Phone Number</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                            value={formData.phone}
                            onChangeText={(text) => handleChange('phone', text)}
                            placeholder="Enter phone number"
                            placeholderTextColor={theme.textMuted}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, { color: theme.textLight }]}>Address / Place</Text>
                        <TextInput
                            style={[styles.input, { height: 80, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                            value={formData.address}
                            onChangeText={(text) => handleChange('address', text)}
                            placeholder="Enter your address"
                            placeholderTextColor={theme.textMuted}
                            multiline
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }, loading && styles.disabledBtn]}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.saveText}>Save Changes</Text>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
    },
    backBtn: {
        paddingRight: 20,
    },
    backText: {
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    imageSection: {
        alignItems: 'center',
        marginBottom: 25,
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 15,
    },
    changePhotoBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    changePhotoText: {
        fontWeight: '600',
    },
    inputContainer: {
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
    },
    genderRow: {
        flexDirection: 'row',
        gap: 10,
    },
    genderOption: {
        flex: 1,
        paddingVertical: 12,
        borderWidth: 1,
        borderRadius: 10,
        alignItems: 'center',
    },
    genderText: {
        fontWeight: '600',
    },
    saveBtn: {
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledBtn: {
        opacity: 0.7,
    },
    saveText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
