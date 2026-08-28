import { Platform } from 'react-native';
import MobileApp from './mobile/MobileApp';
import { NativeTvApp } from './native-tv/NativeTvApp';

export default function NativeApp() {
  if (Platform.isTV) {
    // The native TV shell is available only for the configured Apple target.
    return Platform.OS === 'ios' ? <NativeTvApp /> : null;
  }
  return <MobileApp />;
}
