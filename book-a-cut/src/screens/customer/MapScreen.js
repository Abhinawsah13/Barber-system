import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import axios from "axios";

import { API_BASE_URL } from "../../config/server"; // uses your current IP automatically

const BASE_URL = API_BASE_URL;

export default function MapScreen() {
  const [location, setLocation] = useState(null);
  const [barbers, setBarbers] = useState([]);

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    let loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);

    fetchBarbers(loc.coords.latitude, loc.coords.longitude);
  };

  const fetchBarbers = async (lat, lng) => {
    try {
      const res = await axios.get(`${BASE_URL}/barbers/nearby`, {
        params: { lat, lng },
      });
      setBarbers(res.data.data);
    } catch (err) {
      console.log(err);
    }
  };

  if (!location) return <Text style={styles.loading}>Loading map...</Text>;

  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      {/* User Location */}
      <Marker
        coordinate={{
          latitude: location.latitude,
          longitude: location.longitude,
        }}
        title="You"
        pinColor="blue"
      />

      {/* Barbers */}
      {barbers.map((barber) => (
        <Marker
          key={barber._id}
          coordinate={{
            latitude: barber.location.coordinates[1],
            longitude: barber.location.coordinates[0],
          }}
          title={barber.user?.username || "Barber"}
          description={barber.service_type}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  loading: {
    flex: 1,
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
  },
});
