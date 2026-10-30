import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.night}>
      <StatusBar hidden />
    </View>
  );
}

const styles = StyleSheet.create({
  night: { flex: 1, backgroundColor: '#14102B' },
});
