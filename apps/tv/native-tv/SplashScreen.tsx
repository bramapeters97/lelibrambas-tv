import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import {
  SPLASH_BACKGROUND_DELAY_MS,
  SPLASH_FINAL_HOLD_MS,
  SPLASH_LOGO_ANIMATION_MS,
  type SplashPhase,
} from './state';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<SplashPhase>('background');
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const loaderRotation = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  useEffect(() => {
    let mounted = true;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    const loaderAnimation = Animated.loop(
      Animated.timing(loaderRotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const backgroundTimer = setTimeout(() => {
      if (!mounted) return;
      setPhase('logo');
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: SPLASH_LOGO_ANIMATION_MS,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: SPLASH_LOGO_ANIMATION_MS,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
      ]).start(({ finished: animationFinished }) => {
        if (!mounted || !animationFinished) return;
        setPhase('hold');
        loaderAnimation.start();
        holdTimer = setTimeout(() => {
          if (!mounted || finished.current) return;
          finished.current = true;
          setPhase('done');
          onDone();
        }, SPLASH_FINAL_HOLD_MS);
      });
    }, SPLASH_BACKGROUND_DELAY_MS);

    return () => {
      mounted = false;
      clearTimeout(backgroundTimer);
      if (holdTimer) clearTimeout(holdTimer);
      logoOpacity.stopAnimation();
      logoScale.stopAnimation();
      loaderAnimation.stop();
      loaderRotation.stopAnimation();
    };
  }, [loaderRotation, logoOpacity, logoScale, onDone]);

  const loaderTransform = {
    transform: [
      {
        rotate: loaderRotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  return (
    <View accessibilityLabel="LELIBRAMBAS+ introduction" style={styles.root}>
      {phase !== 'background' ? (
        <Animated.View
          style={[styles.logoBlock, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        >
          <Text style={styles.logo}>
            LELIBRAMBAS<Text style={styles.plus}>+</Text>
          </Text>
          <Text style={styles.subtitle}>A PRIVATE FAMILY ARCHIVE</Text>
        </Animated.View>
      ) : null}

      {phase === 'hold' ? (
        <Animated.View accessibilityLabel="Loading" style={[styles.loader, loaderTransform]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#071A36',
  },
  logoBlock: { alignItems: 'center', justifyContent: 'center' },
  logo: {
    color: '#F7F9FE',
    fontSize: 72,
    fontWeight: '800',
    letterSpacing: 6,
  },
  plus: { color: '#70D8FF' },
  subtitle: {
    marginTop: 18,
    color: '#E9C778',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 6,
  },
  loader: {
    position: 'absolute',
    top: '67%',
    width: 36,
    height: 36,
    borderWidth: 4,
    borderColor: 'rgba(233, 199, 120, 0.25)',
    borderTopColor: '#E9C778',
    borderRadius: 18,
  },
});
