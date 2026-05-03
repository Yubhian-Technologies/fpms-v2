import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCrbOcTmLX-1gEmE7-u8d0vhtCWPTpnFrM",
  authDomain: "fpms-dba05.firebaseapp.com",
  projectId: "fpms-dba05",
  storageBucket: "fpms-dba05.firebasestorage.app",
  messagingSenderId: "265911266688",
  appId: "1:265911266688:web:a504fc3e6f731377d3e565",
  measurementId: "G-D0LME174F2",
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);

export default app;
