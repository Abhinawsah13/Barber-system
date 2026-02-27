// components/shared/StarRating.js
// Reusable star rating component — supports interactive & read-only modes.
// Uses Text-based stars (no react-native-svg dependency required).
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const Star = ({ filled, size, color, emptyColor, onPress }) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
            style={{ marginHorizontal: 1 }}
            disabled={!onPress}
        >
            <Text
                style={{
                    fontSize: size,
                    color: filled ? color : emptyColor,
                    lineHeight: size + 4,
                }}
            >
                {filled ? '★' : '☆'}
            </Text>
        </TouchableOpacity>
    );
};

/**
 * StarRating
 *
 * Props:
 *  - rating       {number}   current rating (1-5)
 *  - onChange     {function} called with new rating; omit for read-only
 *  - size         {number}   star size in dp (default 28)
 *  - color        {string}   filled star colour (default amber)
 *  - emptyColor   {string}   empty star stroke colour (default #ccc)
 *  - readOnly     {boolean}  force read-only regardless of onChange
 */
const StarRating = ({
    rating = 0,
    onChange,
    size = 28,
    color = '#f59e0b',
    emptyColor = '#d1d5db',
    readOnly = false,
}) => {
    const isInteractive = !readOnly && typeof onChange === 'function';

    return (
        <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    filled={star <= rating}
                    size={size}
                    color={color}
                    emptyColor={emptyColor}
                    onPress={isInteractive ? () => onChange(star) : null}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default StarRating;
