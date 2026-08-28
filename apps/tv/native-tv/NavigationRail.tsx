import { useState } from 'react';
import { Pressable, StyleSheet, Text, TVFocusGuideView, View } from 'react-native';
import type { Profile } from '@lelibrambas/types';

export const NATIVE_TV_RAIL_WIDTH = 96;
const NAV_ICON_BOX = 68;

export type NativeBrowseSection = 'home' | 'search' | 'collections' | 'library';

const navItems: Array<{ id: NativeBrowseSection; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'search', label: 'Search', icon: '⌕' },
  { id: 'collections', label: 'Collections', icon: '▦' },
  { id: 'library', label: 'Full Library', icon: '▣' },
];

function RailButton({
  icon,
  label,
  selected = false,
  onPress,
  profileAccent,
  profileInitials,
  bottom = false,
}: {
  icon?: string;
  label: string;
  selected?: boolean;
  onPress: () => void;
  profileAccent?: string;
  profileInitials?: string;
  bottom?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={[styles.item, bottom && styles.bottomItem]}
    >
      <View
        style={[
          styles.iconBox,
          selected && styles.selectedIconBox,
          focused && styles.focusedIconBox,
          profileAccent ? { borderColor: profileAccent } : null,
        ]}
      >
        <Text
          style={[
            styles.icon,
            selected && styles.selectedIcon,
            profileInitials ? styles.profileInitials : null,
          ]}
        >
          {profileInitials ?? icon}
        </Text>
      </View>
      {focused ? (
        <View style={styles.popout}>
          <Text style={styles.popoutText}>{label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function NavigationRail({
  active,
  profile,
  onNavigate,
  onProfile,
  onReplayIntro,
}: {
  active: NativeBrowseSection;
  profile: Profile;
  onNavigate: (section: NativeBrowseSection) => void;
  onProfile: () => void;
  onReplayIntro: () => void;
}) {
  return (
    <TVFocusGuideView
      accessibilityLabel="Main navigation"
      autoFocus
      style={styles.rail}
      trapFocusDown
      trapFocusUp
    >
      <RailButton icon="◇" label="Replay introduction" onPress={onReplayIntro} />
      {navItems.map((item) => (
        <RailButton
          icon={item.icon}
          key={item.id}
          label={item.label}
          onPress={() => onNavigate(item.id)}
          selected={active === item.id}
        />
      ))}
      <RailButton
        bottom
        label={`Switch profile. Current profile ${profile.name}`}
        onPress={onProfile}
        profileAccent={profile.accent}
        profileInitials={profile.initials}
      />
    </TVFocusGuideView>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    width: NATIVE_TV_RAIL_WIDTH,
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: 'rgba(3, 5, 11, 0.97)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'visible',
  },
  item: {
    width: NATIVE_TV_RAIL_WIDTH,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 2,
  },
  bottomItem: { marginTop: 'auto' },
  iconBox: {
    width: NAV_ICON_BOX,
    height: NAV_ICON_BOX,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    borderRadius: 16,
    backgroundColor: 'rgba(17, 28, 51, 0.55)',
  },
  selectedIconBox: { backgroundColor: '#152B49' },
  focusedIconBox: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.055 }],
    shadowColor: '#70D8FF',
    shadowOpacity: 0.45,
    shadowRadius: 14,
  },
  icon: { color: '#AAB7CE', fontSize: 39, lineHeight: 48, fontWeight: '500' },
  selectedIcon: { color: '#FFFFFF' },
  profileInitials: { color: '#FFFFFF', fontSize: 21, lineHeight: 25, fontWeight: '800' },
  popout: {
    position: 'absolute',
    left: NATIVE_TV_RAIL_WIDTH - 4,
    minWidth: 160,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#111C33',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 14,
  },
  popoutText: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
});
