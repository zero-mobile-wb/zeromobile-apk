// CRITICAL: Import shim BEFORE everything else
import './shim';

// Now import Expo and app
import { registerRootComponent } from 'expo';
import App from './App';

// Register the app
registerRootComponent(App);