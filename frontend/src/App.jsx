import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import ChatBox from "./components/ChatBox.jsx";
import HowItWorks from "./components/HowItWorks.jsx";
import ResultsDashboard from "./components/ResultsDashboard.jsx";
import UploadCard from "./components/UploadCard.jsx";
import { auth, googleProvider } from "./firebase.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const DISCLAIMER =
  "This is educational information only and not a medical diagnosis. Please consult a qualified healthcare professional for medical advice.";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "gu", label: "Gujarati" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
];

const TRANSLATIONS = {
  en: {
    brand: "Labwise AI",
    login: "Login",
    logout: "Logout",
    dark: "Dark",
    light: "Light",
    heroTitle: "Labwise AI",
    heroSubtitle: "Understand your blood report in minutes.",
    workflowEyebrow: "Workflow",
    howItWorks: "How it works",
    steps: [
      ["Upload Report", "Add a blood report PDF from your device."],
      ["Extract Lab Values", "The backend reads the PDF and organizes test values."],
      ["Ask Questions", "Chat about the uploaded report in simple educational language."],
    ],
    uploadTitle: "Upload blood report PDF",
    uploadHelp: "Drag and drop your report here, or click to browse.",
    pdfOnly: "PDF files only",
    uploadReport: "Upload Report",
    uploading: "Uploading...",
    analyzeReport: "Analyze Report",
    analyzing: "Analyzing...",
    uploadFirstError: "Choose a PDF blood report first.",
    analyzeFirstError: "Upload a report before analyzing.",
    uploadingNotice: "Uploading report...",
    analyzingNotice: "Analyzing report...",
    reportChat: "Report Chat",
    askAssistant: "Ask the assistant",
    ready: "Ready",
    uploadFirst: "Upload first",
    quickQuestions: ["Which values are abnormal?", "What should I ask my doctor?", "Is my cholesterol normal?"],
    chatPlaceholder: "Why is my hemoglobin low?",
    send: "Send",
    sending: "Sending...",
    chatWelcome:
      "Hi, I can help explain the uploaded blood report in simple educational language. Upload and analyze a PDF, then ask about values, reference ranges, or doctor discussion points.",
    analysis: "Analysis",
    resultsDashboard: "Results dashboard",
    normal: "Normal",
    abnormal: "Abnormal",
    totalTests: "Total Tests",
    withinRange: "Within listed range",
    abnormalDescription: "Low, high, unknown, or critical",
    extractedFromReport: "Extracted from report",
    reportBreakdown: "Report Breakdown",
    summaryOfAnalysis: "Summary of Analysis",
    needsReview: "Needs closer review",
    looksGood: "Looks good",
    noReview:
      "No extracted values were flagged for closer review based on the listed reference ranges.",
    noNormal: "No clearly normal values were detected from the extracted results.",
    summaryNote:
      "Review the lab values table below for full details and discuss flagged results with a healthcare professional.",
    markedTemplate: ({ testName, status, value, range }) =>
      `${testName} is marked ${status} at ${value}, compared with the listed range of ${range}.`,
    normalTemplate: ({ testName, value }) => `${testName} appears within the listed range at ${value}.`,
    labValues: "Lab Values",
    noLabValues: "No lab values were extracted yet.",
    doctorPoints: "Doctor Discussion Points",
    tableHeaders: ["Test", "Value", "Reference Range", "Status", "Explanation"],
    dashboard: "Dashboard",
    emptyTitle: "Your lab value summary will appear here",
    emptyText: "Upload and analyze a PDF to see normal, abnormal, and total extracted values.",
    disclaimer:
      "This is educational information only and not a medical diagnosis. Please consult a qualified healthcare professional for medical advice.",
  },
  hi: {
    brand: "Labwise AI",
    login: "लॉगिन",
    logout: "लॉगआउट",
    dark: "डार्क",
    light: "लाइट",
    heroTitle: "Labwise AI",
    heroSubtitle: "अपनी ब्लड रिपोर्ट को मिनटों में समझें।",
    workflowEyebrow: "वर्कफ्लो",
    howItWorks: "यह कैसे काम करता है",
    steps: [
      ["रिपोर्ट अपलोड करें", "अपने डिवाइस से ब्लड रिपोर्ट PDF जोड़ें।"],
      ["लैब वैल्यू निकालें", "बैकएंड PDF पढ़कर टेस्ट वैल्यू व्यवस्थित करता है।"],
      ["सवाल पूछें", "अपलोड की गई रिपोर्ट के बारे में सरल शैक्षिक भाषा में चैट करें।"],
    ],
    uploadTitle: "ब्लड रिपोर्ट PDF अपलोड करें",
    uploadHelp: "रिपोर्ट को यहां खींचें और छोड़ें, या ब्राउज़ करने के लिए क्लिक करें।",
    pdfOnly: "केवल PDF फाइलें",
    uploadReport: "रिपोर्ट अपलोड करें",
    uploading: "अपलोड हो रहा है...",
    analyzeReport: "रिपोर्ट विश्लेषण करें",
    analyzing: "विश्लेषण हो रहा है...",
    uploadFirstError: "पहले PDF ब्लड रिपोर्ट चुनें।",
    analyzeFirstError: "विश्लेषण से पहले रिपोर्ट अपलोड करें।",
    uploadingNotice: "रिपोर्ट अपलोड हो रही है...",
    analyzingNotice: "रिपोर्ट का विश्लेषण हो रहा है...",
    reportChat: "रिपोर्ट चैट",
    askAssistant: "असिस्टेंट से पूछें",
    ready: "तैयार",
    uploadFirst: "पहले अपलोड करें",
    quickQuestions: ["कौन सी वैल्यू असामान्य हैं?", "मुझे डॉक्टर से क्या पूछना चाहिए?", "क्या मेरा कोलेस्ट्रॉल सामान्य है?"],
    chatPlaceholder: "मेरा हीमोग्लोबिन कम क्यों है?",
    send: "भेजें",
    sending: "भेजा जा रहा है...",
    chatWelcome:
      "नमस्ते, मैं अपलोड की गई ब्लड रिपोर्ट को सरल शैक्षिक भाषा में समझाने में मदद कर सकता हूं। PDF अपलोड और विश्लेषण करें, फिर वैल्यू, रेंज या डॉक्टर से चर्चा वाले सवाल पूछें।",
    analysis: "विश्लेषण",
    resultsDashboard: "परिणाम डैशबोर्ड",
    normal: "सामान्य",
    abnormal: "असामान्य",
    totalTests: "कुल टेस्ट",
    withinRange: "दी गई रेंज में",
    abnormalDescription: "कम, ज्यादा, अज्ञात या गंभीर",
    extractedFromReport: "रिपोर्ट से निकाला गया",
    reportBreakdown: "रिपोर्ट विभाजन",
    summaryOfAnalysis: "विश्लेषण सारांश",
    needsReview: "करीब से समीक्षा करें",
    looksGood: "अच्छा दिखता है",
    noReview: "दी गई संदर्भ रेंज के आधार पर कोई निकाली गई वैल्यू समीक्षा के लिए फ्लैग नहीं हुई।",
    noNormal: "निकाले गए परिणामों में कोई स्पष्ट सामान्य वैल्यू नहीं मिली।",
    summaryNote: "पूरी जानकारी के लिए नीचे लैब वैल्यू तालिका देखें और फ्लैग किए गए परिणामों पर स्वास्थ्य विशेषज्ञ से चर्चा करें।",
    markedTemplate: ({ testName, status, value, range }) =>
      `${testName} को ${status} के रूप में ${value} पर चिह्नित किया गया है, जबकि सूचीबद्ध रेंज ${range} है।`,
    normalTemplate: ({ testName, value }) => `${testName} ${value} पर सूचीबद्ध रेंज में दिखता है।`,
    labValues: "लैब वैल्यू",
    noLabValues: "अभी कोई लैब वैल्यू नहीं निकाली गई।",
    doctorPoints: "डॉक्टर से चर्चा के बिंदु",
    tableHeaders: ["टेस्ट", "वैल्यू", "संदर्भ रेंज", "स्थिति", "व्याख्या"],
    dashboard: "डैशबोर्ड",
    emptyTitle: "आपकी लैब वैल्यू सारांश यहां दिखाई देगी",
    emptyText: "सामान्य, असामान्य और कुल निकाली गई वैल्यू देखने के लिए PDF अपलोड और विश्लेषण करें।",
    disclaimer: "यह केवल शैक्षिक जानकारी है, मेडिकल निदान नहीं। कृपया चिकित्सा सलाह के लिए योग्य स्वास्थ्य पेशेवर से सलाह लें।",
  },
  gu: {
    brand: "Labwise AI",
    login: "લોગિન",
    logout: "લોગઆઉટ",
    dark: "ડાર્ક",
    light: "લાઇટ",
    heroTitle: "Labwise AI",
    heroSubtitle: "તમારી બ્લડ રિપોર્ટ મિનિટોમાં સમજો.",
    workflowEyebrow: "વર્કફ્લો",
    howItWorks: "આ કેવી રીતે કામ કરે છે",
    steps: [
      ["રિપોર્ટ અપલોડ કરો", "તમારા ડિવાઇસમાંથી બ્લડ રિપોર્ટ PDF ઉમેરો."],
      ["લેબ મૂલ્યો કાઢો", "બેકએન્ડ PDF વાંચે છે અને ટેસ્ટ મૂલ્યો ગોઠવે છે."],
      ["પ્રશ્નો પૂછો", "અપલોડ કરેલી રિપોર્ટ વિશે સરળ શૈક્ષણિક ભાષામાં ચેટ કરો."],
    ],
    uploadTitle: "બ્લડ રિપોર્ટ PDF અપલોડ કરો",
    uploadHelp: "તમારી રિપોર્ટ અહીં ખેંચીને મૂકો, અથવા બ્રાઉઝ કરવા ક્લિક કરો.",
    pdfOnly: "ફક્ત PDF ફાઇલો",
    uploadReport: "રિપોર્ટ અપલોડ કરો",
    uploading: "અપલોડ થઈ રહ્યું છે...",
    analyzeReport: "રિપોર્ટ વિશ્લેષણ કરો",
    analyzing: "વિશ્લેષણ થઈ રહ્યું છે...",
    uploadFirstError: "પહેલાં PDF બ્લડ રિપોર્ટ પસંદ કરો.",
    analyzeFirstError: "વિશ્લેષણ પહેલાં રિપોર્ટ અપલોડ કરો.",
    uploadingNotice: "રિપોર્ટ અપલોડ થઈ રહી છે...",
    analyzingNotice: "રિપોર્ટનું વિશ્લેષણ થઈ રહ્યું છે...",
    reportChat: "રિપોર્ટ ચેટ",
    askAssistant: "સહાયકને પૂછો",
    ready: "તૈયાર",
    uploadFirst: "પહેલાં અપલોડ કરો",
    quickQuestions: ["કયા મૂલ્યો અસામાન્ય છે?", "મારે ડૉક્ટરને શું પૂછવું જોઈએ?", "મારું કોલેસ્ટ્રોલ સામાન્ય છે?"],
    chatPlaceholder: "મારું હીમોગ્લોબિન ઓછું કેમ છે?",
    send: "મોકલો",
    sending: "મોકલી રહ્યું છે...",
    chatWelcome:
      "નમસ્તે, હું અપલોડ કરેલી બ્લડ રિપોર્ટને સરળ શૈક્ષણિક ભાષામાં સમજાવવામાં મદદ કરી શકું છું. PDF અપલોડ અને વિશ્લેષણ કરો, પછી મૂલ્યો, રેન્જ અથવા ડૉક્ટર ચર્ચા મુદ્દાઓ વિશે પૂછો.",
    analysis: "વિશ્લેષણ",
    resultsDashboard: "પરિણામ ડેશબોર્ડ",
    normal: "સામાન્ય",
    abnormal: "અસામાન્ય",
    totalTests: "કુલ ટેસ્ટ",
    withinRange: "સૂચિબદ્ધ રેન્જમાં",
    abnormalDescription: "ઓછું, વધારે, અજ્ઞાત અથવા ગંભીર",
    extractedFromReport: "રિપોર્ટમાંથી કાઢ્યું",
    reportBreakdown: "રિપોર્ટ વિભાજન",
    summaryOfAnalysis: "વિશ્લેષણ સારાંશ",
    needsReview: "વધુ સમીક્ષા જરૂરી",
    looksGood: "સારું લાગે છે",
    noReview: "સૂચિબદ્ધ સંદર્ભ રેન્જ આધારે કોઈ કાઢેલા મૂલ્યો વધુ સમીક્ષા માટે ચિહ્નિત થયા નથી.",
    noNormal: "કાઢેલા પરિણામોમાં કોઈ સ્પષ્ટ સામાન્ય મૂલ્યો મળ્યા નથી.",
    summaryNote: "સંપૂર્ણ વિગતો માટે નીચેની લેબ મૂલ્યોની ટેબલ જુઓ અને ચિહ્નિત પરિણામો વિશે આરોગ્ય નિષ્ણાત સાથે ચર્ચા કરો.",
    markedTemplate: ({ testName, status, value, range }) =>
      `${testName} ${value} પર ${status} તરીકે ચિહ્નિત છે, સૂચિબદ્ધ રેન્જ ${range} ની સરખામણીમાં.`,
    normalTemplate: ({ testName, value }) => `${testName} ${value} પર સૂચિબદ્ધ રેન્જમાં લાગે છે.`,
    labValues: "લેબ મૂલ્યો",
    noLabValues: "હજુ સુધી કોઈ લેબ મૂલ્યો કાઢવામાં આવ્યા નથી.",
    doctorPoints: "ડૉક્ટર ચર્ચા મુદ્દા",
    tableHeaders: ["ટેસ્ટ", "મૂલ્ય", "સંદર્ભ રેન્જ", "સ્થિતિ", "સમજૂતી"],
    dashboard: "ડેશબોર્ડ",
    emptyTitle: "તમારા લેબ મૂલ્યોનો સારાંશ અહીં દેખાશે",
    emptyText: "સામાન્ય, અસામાન્ય અને કુલ કાઢેલા મૂલ્યો જોવા PDF અપલોડ અને વિશ્લેષણ કરો.",
    disclaimer: "આ માત્ર શૈક્ષણિક માહિતી છે, તબીબી નિદાન નથી. કૃપા કરીને તબીબી સલાહ માટે યોગ્ય આરોગ્ય નિષ્ણાતની સલાહ લો.",
  },
  fr: {
    brand: "Labwise AI",
    login: "Connexion",
    logout: "Déconnexion",
    dark: "Sombre",
    light: "Clair",
    heroTitle: "Labwise AI",
    heroSubtitle: "Comprenez votre bilan sanguin en quelques minutes.",
    workflowEyebrow: "Flux",
    howItWorks: "Fonctionnement",
    steps: [
      ["Importer le rapport", "Ajoutez un PDF de bilan sanguin depuis votre appareil."],
      ["Extraire les valeurs", "Le backend lit le PDF et organise les valeurs de test."],
      ["Poser des questions", "Discutez du rapport importé dans un langage éducatif simple."],
    ],
    uploadTitle: "Importer le PDF du bilan sanguin",
    uploadHelp: "Glissez-déposez votre rapport ici, ou cliquez pour parcourir.",
    pdfOnly: "Fichiers PDF uniquement",
    uploadReport: "Importer le rapport",
    uploading: "Importation...",
    analyzeReport: "Analyser le rapport",
    analyzing: "Analyse...",
    uploadFirstError: "Choisissez d'abord un rapport sanguin PDF.",
    analyzeFirstError: "Importez un rapport avant l'analyse.",
    uploadingNotice: "Importation du rapport...",
    analyzingNotice: "Analyse du rapport...",
    reportChat: "Chat du rapport",
    askAssistant: "Demander à l'assistant",
    ready: "Prêt",
    uploadFirst: "Importer d'abord",
    quickQuestions: ["Quelles valeurs sont anormales ?", "Que dois-je demander à mon médecin ?", "Mon cholestérol est-il normal ?"],
    chatPlaceholder: "Pourquoi mon hémoglobine est-elle basse ?",
    send: "Envoyer",
    sending: "Envoi...",
    chatWelcome:
      "Bonjour, je peux aider à expliquer le bilan sanguin importé dans un langage éducatif simple. Importez et analysez un PDF, puis posez des questions sur les valeurs, les plages de référence ou les points à discuter avec un médecin.",
    analysis: "Analyse",
    resultsDashboard: "Tableau des résultats",
    normal: "Normal",
    abnormal: "Anormal",
    totalTests: "Total des tests",
    withinRange: "Dans la plage indiquée",
    abnormalDescription: "Bas, élevé, inconnu ou critique",
    extractedFromReport: "Extrait du rapport",
    reportBreakdown: "Répartition du rapport",
    summaryOfAnalysis: "Résumé de l'analyse",
    needsReview: "À examiner de plus près",
    looksGood: "Semble correct",
    noReview: "Aucune valeur extraite n'a été signalée pour un examen plus approfondi selon les plages indiquées.",
    noNormal: "Aucune valeur clairement normale n'a été détectée dans les résultats extraits.",
    summaryNote: "Consultez le tableau des valeurs ci-dessous pour tous les détails et discutez des résultats signalés avec un professionnel de santé.",
    markedTemplate: ({ testName, status, value, range }) =>
      `${testName} est marqué ${status} à ${value}, comparé à la plage indiquée de ${range}.`,
    normalTemplate: ({ testName, value }) => `${testName} semble dans la plage indiquée à ${value}.`,
    labValues: "Valeurs de laboratoire",
    noLabValues: "Aucune valeur de laboratoire n'a encore été extraite.",
    doctorPoints: "Points à discuter avec le médecin",
    tableHeaders: ["Test", "Valeur", "Plage de référence", "Statut", "Explication"],
    dashboard: "Tableau",
    emptyTitle: "Le résumé de vos valeurs de laboratoire apparaîtra ici",
    emptyText: "Importez et analysez un PDF pour voir les valeurs normales, anormales et totales extraites.",
    disclaimer: "Ces informations sont uniquement éducatives et ne constituent pas un diagnostic médical. Consultez un professionnel de santé qualifié pour un avis médical.",
  },
  es: {
    brand: "Labwise AI",
    login: "Iniciar sesión",
    logout: "Cerrar sesión",
    dark: "Oscuro",
    light: "Claro",
    heroTitle: "Labwise AI",
    heroSubtitle: "Entiende tu informe de sangre en minutos.",
    workflowEyebrow: "Flujo",
    howItWorks: "Cómo funciona",
    steps: [
      ["Subir informe", "Agrega un PDF de análisis de sangre desde tu dispositivo."],
      ["Extraer valores", "El backend lee el PDF y organiza los valores de laboratorio."],
      ["Hacer preguntas", "Chatea sobre el informe subido en lenguaje educativo sencillo."],
    ],
    uploadTitle: "Subir PDF del análisis de sangre",
    uploadHelp: "Arrastra y suelta tu informe aquí, o haz clic para buscar.",
    pdfOnly: "Solo archivos PDF",
    uploadReport: "Subir informe",
    uploading: "Subiendo...",
    analyzeReport: "Analizar informe",
    analyzing: "Analizando...",
    uploadFirstError: "Elige primero un informe de sangre en PDF.",
    analyzeFirstError: "Sube un informe antes de analizar.",
    uploadingNotice: "Subiendo informe...",
    analyzingNotice: "Analizando informe...",
    reportChat: "Chat del informe",
    askAssistant: "Preguntar al asistente",
    ready: "Listo",
    uploadFirst: "Sube primero",
    quickQuestions: ["¿Qué valores son anormales?", "¿Qué debo preguntarle a mi médico?", "¿Mi colesterol es normal?"],
    chatPlaceholder: "¿Por qué está baja mi hemoglobina?",
    send: "Enviar",
    sending: "Enviando...",
    chatWelcome:
      "Hola, puedo ayudar a explicar el informe de sangre subido en lenguaje educativo sencillo. Sube y analiza un PDF, luego pregunta sobre valores, rangos de referencia o puntos para hablar con el médico.",
    analysis: "Análisis",
    resultsDashboard: "Panel de resultados",
    normal: "Normal",
    abnormal: "Anormal",
    totalTests: "Total de pruebas",
    withinRange: "Dentro del rango indicado",
    abnormalDescription: "Bajo, alto, desconocido o crítico",
    extractedFromReport: "Extraído del informe",
    reportBreakdown: "Desglose del informe",
    summaryOfAnalysis: "Resumen del análisis",
    needsReview: "Requiere revisión",
    looksGood: "Se ve bien",
    noReview: "Ningún valor extraído fue marcado para revisión según los rangos de referencia indicados.",
    noNormal: "No se detectaron valores claramente normales en los resultados extraídos.",
    summaryNote: "Revisa la tabla de valores de laboratorio abajo para más detalles y comenta los resultados marcados con un profesional de salud.",
    markedTemplate: ({ testName, status, value, range }) =>
      `${testName} está marcado como ${status} en ${value}, comparado con el rango indicado de ${range}.`,
    normalTemplate: ({ testName, value }) => `${testName} parece estar dentro del rango indicado en ${value}.`,
    labValues: "Valores de laboratorio",
    noLabValues: "Aún no se extrajeron valores de laboratorio.",
    doctorPoints: "Puntos para hablar con el médico",
    tableHeaders: ["Prueba", "Valor", "Rango de referencia", "Estado", "Explicación"],
    dashboard: "Panel",
    emptyTitle: "El resumen de tus valores de laboratorio aparecerá aquí",
    emptyText: "Sube y analiza un PDF para ver valores normales, anormales y el total extraído.",
    disclaimer: "Esta es información educativa solamente y no es un diagnóstico médico. Consulta a un profesional de salud calificado para obtener consejo médico.",
  },
};

export default function App() {
  const [file, setFile] = useState(null);
  const [reportId, setReportId] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [theme, setTheme] = useState("light");
  const [language, setLanguage] = useState("en");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const selectedLanguage = LANGUAGES.find((item) => item.code === language) || LANGUAGES[0];
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
  }, []);

  async function loginWithGoogle() {
    setAuthError("");
    setError("");
    if (!auth || !googleProvider) {
      setAuthError("Firebase login is not configured. Check VITE_FIREBASE_* environment variables and restart the dev server.");
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (event) {
      setAuthError(event.message || "Google login failed.");
    }
  }

  async function logout() {
    setAuthError("");
    setError("");
    if (!auth) return;

    try {
      await signOut(auth);
    } catch (event) {
      setError(event.message || "Logout failed.");
    }
  }

  async function uploadReport() {
    if (!file) {
      setError(t.uploadFirstError);
      return;
    }

    setError("");
    setAnalysis(null);
    setUploadLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload-report`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Upload failed.");
      setReportId(data.report_id);
    } catch (event) {
      setError(event.message);
    } finally {
      setUploadLoading(false);
    }
  }

  async function analyzeReport() {
    if (!reportId) {
      setError(t.analyzeFirstError);
      return;
    }

    setError("");
    setAnalyzeLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/analyze-report/${reportId}`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Analysis failed.");
      setAnalysis(data);
    } catch (event) {
      setError(event.message);
    } finally {
      setAnalyzeLoading(false);
    }
  }

  return (
    <main className={`appShell ${theme === "dark" ? "darkTheme" : "lightTheme"}`}>
      <header className="appHeader">
        <div className="headerControls">
          {user ? (
            <>
              <span className="userBadge">{user.displayName || user.email}</span>
              <button className="loginButton" type="button" onClick={logout}>
                {t.logout}
              </button>
            </>
          ) : (
            <button className="loginButton" type="button" onClick={loginWithGoogle} disabled={authLoading}>
              {t.login}
            </button>
          )}
          <button
            className="themeToggle"
            type="button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? t.light : t.dark}
          </button>
          <label className="languageControl">
            <span className="srOnly">Language</span>
            <select
              value={selectedLanguage.code}
              onChange={(event) => setLanguage(event.target.value)}
              aria-label="Select language"
            >
              {LANGUAGES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      {authError && <div className="authError">{authError}</div>}

      <section className="hero">
        <div className="heroContent">
          <h1>{t.heroTitle}</h1>
          <p>{t.heroSubtitle}</p>
        </div>
        <div className="heroIllustration" aria-hidden="true">
          <img src="/labwise-hero.svg" alt="" />
        </div>
      </section>

      <HowItWorks labels={t} />

      <div className="workspaceGrid">
        <div>
          <UploadCard
            file={file}
            onFileSelect={setFile}
            onUpload={uploadReport}
            onAnalyze={analyzeReport}
            reportReady={Boolean(reportId)}
            uploadLoading={uploadLoading}
            analyzeLoading={analyzeLoading}
            labels={t}
          />
        </div>

        <ChatBox reportId={reportId} labels={t} />
      </div>

      {(uploadLoading || analyzeLoading) && (
        <div className="notice">{uploadLoading ? t.uploadingNotice : t.analyzingNotice}</div>
      )}
      {error && <div className="error">{error}</div>}

      {analysis ? <ResultsDashboard analysis={analysis} labels={t} /> : <EmptyDashboard labels={t} />}

      <footer className="disclaimer">{analysis?.safety_disclaimer || t.disclaimer || DISCLAIMER}</footer>
    </main>
  );
}

function EmptyDashboard({ labels }) {
  return (
    <section className="emptyDashboard">
      <div>
        <p className="eyebrow">{labels.dashboard}</p>
        <h2>{labels.emptyTitle}</h2>
        <p>{labels.emptyText}</p>
      </div>
    </section>
  );
}
