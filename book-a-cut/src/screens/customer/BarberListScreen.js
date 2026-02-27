import React, { useEffect, useState } from 'react';
import { View, FlatList, TouchableOpacity, Text, Image } from 'react-native';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import axios from 'axios';

import { API_BASE_URL, SOCKET_BASE_URL } from '../../config/server';

export default function BarberListScreen({ navigation }) {
    const [barbers, setBarbers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const socket = io(SOCKET_BASE_URL);

        getLocation();
        socket.emit('join-nearby');
        socket.on('new-barber', (barber) => {
            setBarbers(prev => [...prev, barber]);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const getLocation = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        let location = await Location.getCurrentPositionAsync({});
        fetchBarbers(location.coords.latitude, location.coords.longitude);
    };

    const fetchBarbers = async (lat, lng) => {
        try {
            const res = await axios.get(`${BASE_URL}/barbers/nearby`, {
                params: { lat, lng }
            });
            setBarbers(res.data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const bookBarber = (barber) => {
        navigation.navigate('BookingScreen', {
            barberId: barber.user._id,
            barberName: barber.user.username,
            serviceType: barber.service_type
        });
    };

    if (loading) return <Text>Loading nearby barbers...</Text>;

    return (
        <FlatList
            data={barbers}
            keyExtractor={item => item._id}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={{ flexDirection: 'row', padding: 15, margin: 10, backgroundColor: 'white', borderRadius: 10 }}
                    onPress={() => bookBarber(item)}
                >
                    <Image source={{ uri: item.user.profile_image || 'https://via.placeholder.com/60' }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                    <View style={{ marginLeft: 15, flex: 1 }}>
                        <Text style={{ fontWeight: 'bold' }}>{item.user.username}</Text>
                        <Text>{item.services.join(', ')}</Text>
                        <Text>{item.location.city} • {item.service_type}</Text>
                        <Text>⭐ {item.rating.average || 4.5}</Text>
                    </View>
                </TouchableOpacity>
            )}
        />
    );
}
