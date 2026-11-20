/** Life speaks the visitor's language. The building signs stay in English, like a brand. */
export type LifeLanguage = 'en' | 'fr' | 'de' | 'es' | 'hi'

export const LIFE_LANGUAGES: { id: LifeLanguage; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'fr', name: 'Français' },
  { id: 'de', name: 'Deutsch' },
  { id: 'es', name: 'Español' },
  { id: 'hi', name: 'हिन्दी' },
]

const STRINGS = {
  liveCode: { en: 'Live code', fr: 'Code du live', de: 'Live-Code', es: 'Código del live', hi: 'लाइव कोड' },
  liveCodeHint: { en: 'Enter the 6-character code shown in the live to watch it here on stage.', fr: 'Entre le code à 6 caractères affiché dans le live pour le regarder ici, sur scène.', de: 'Gib den 6-stelligen Code aus dem Live ein, um es hier auf der Bühne zu sehen.', es: 'Escribe el código de 6 caracteres del live para verlo aquí en el escenario.', hi: 'लाइव में दिखाया गया 6 अक्षरों का कोड डालें और यहाँ मंच पर देखें।' },
  enterEvent: { en: 'Enter the event', fr: 'Entrer dans l’événement', de: 'Zum Event', es: 'Entrar al evento', hi: 'इवेंट में जाएँ' },
  codeUnknown: { en: 'No running live with this code.', fr: 'Aucun live en cours avec ce code.', de: 'Kein laufendes Live mit diesem Code.', es: 'Ningún live en curso con este código.', hi: 'इस कोड से कोई लाइव नहीं चल रहा।' },
  enterHere: { en: 'Walk through the glowing door or tap to enter', fr: 'Tu peux entrer par ici : passe la porte lumineuse ou appuie', de: 'Hier kannst du rein: durch die leuchtende Tür gehen oder tippen', es: 'Puedes entrar por aquí: cruza la puerta iluminada o toca', hi: 'यहाँ से अंदर जाएँ: चमकते दरवाज़े से जाएँ या टैप करें' },
  walkInHall: { en: 'walk to your seat', fr: 'marche jusqu’à ta place', de: 'geh zu deinem Platz', es: 'camina hasta tu asiento', hi: 'अपनी सीट तक चलें' },
  sit: { en: 'Sit down', fr: 'S’asseoir', de: 'Hinsetzen', es: 'Sentarse', hi: 'बैठें' },
  stand: { en: 'Stand up', fr: 'Se lever', de: 'Aufstehen', es: 'Levantarse', hi: 'खड़े हों' },
  getOut: { en: 'Walk', fr: 'Marcher', de: 'Aussteigen', es: 'Caminar', hi: 'पैदल चलें' },
  getIn: { en: 'Drive', fr: 'Conduire', de: 'Einsteigen', es: 'Conducir', hi: 'ड्राइव करें' },
  backToCar: { en: 'Walk back to your vehicle', fr: 'Retourne à ton véhicule', de: 'Geh zurück zu deinem Fahrzeug', es: 'Vuelve a tu vehículo', hi: 'अपने वाहन के पास जाएँ' },
  shop: { en: 'Shop', fr: 'Boutique', de: 'Shop', es: 'Tienda', hi: 'दुकान' },
  shopFree: { en: 'Everything here is free.', fr: 'Tout est gratuit ici.', de: 'Hier ist alles kostenlos.', es: 'Aquí todo es gratis.', hi: 'यहाँ सब कुछ मुफ़्त है।' },
  coupe: { en: 'Sports car', fr: 'Sportive', de: 'Sportwagen', es: 'Deportivo', hi: 'स्पोर्ट्स कार' },
  suv: { en: 'SUV', fr: 'SUV', de: 'SUV', es: 'SUV', hi: 'एसयूवी' },
  moto: { en: 'Motorbike', fr: 'Moto', de: 'Motorrad', es: 'Moto', hi: 'मोटरसाइकिल' },
  paint: { en: 'Paint', fr: 'Couleur du véhicule', de: 'Lackierung', es: 'Pintura', hi: 'रंग' },
  outfit: { en: 'Outfit', fr: 'Tenue', de: 'Outfit', es: 'Ropa', hi: 'कपड़े' },
  chooseLanguage: { en: 'Choose your language', fr: 'Choisis ta langue', de: 'Wähle deine Sprache', es: 'Elige tu idioma', hi: 'अपनी भाषा चुनें' },
  welcomeTitle: { en: 'Welcome to happyClash City', fr: 'Bienvenue à happyClash City', de: 'Willkommen in happyClash City', es: 'Bienvenido a happyClash City', hi: 'happyClash City में आपका स्वागत है' },
  welcomeText: {
    en: 'Your car is waiting. Eight worlds light up the sky: drive to one, walk in and take a seat for the Clashes on stage.',
    fr: 'Ta voiture t’attend. Huit mondes illuminent le ciel : roule jusqu’à l’un d’eux, entre et prends place pour les Clashs sur scène.',
    de: 'Dein Auto wartet. Acht Welten leuchten in den Himmel: Fahr zu einer, geh hinein und nimm Platz für die Clashes auf der Bühne.',
    es: 'Tu coche te espera. Ocho mundos iluminan el cielo: conduce hasta uno, entra y toma asiento para los Clashes en el escenario.',
    hi: 'आपकी कार तैयार है। आठ दुनिया आसमान को रोशन करती हैं: किसी एक तक ड्राइव करें, अंदर जाएँ और मंच पर होने वाले Clash के लिए सीट लें।',
  },
  start: { en: 'Get in the car', fr: 'Monter dans la voiture', de: 'Einsteigen', es: 'Subir al coche', hi: 'कार में बैठें' },
  loading: { en: 'Building the city…', fr: 'Construction de la ville…', de: 'Die Stadt wird gebaut…', es: 'Construyendo la ciudad…', hi: 'शहर बन रहा है…' },
  hintKeys: {
    en: 'Arrows or W A S D to drive',
    fr: 'Flèches ou Z Q S D pour rouler',
    de: 'Pfeiltasten oder W A S D zum Fahren',
    es: 'Flechas o W A S D para conducir',
    hi: 'चलाने के लिए तीर या W A S D',
  },
  hintTouch: {
    en: 'Steer on the left, gas and brake on the right',
    fr: 'Tourne à gauche de l’écran, accélère et freine à droite',
    de: 'Links lenken, rechts Gas und Bremse',
    es: 'Gira a la izquierda, acelera y frena a la derecha',
    hi: 'बाईं ओर स्टीयर करें, दाईं ओर गैस और ब्रेक',
  },
  goTo: { en: 'Go to', fr: 'Aller à', de: 'Fahren zu', es: 'Ir a', hi: 'जाएँ' },
  enter: { en: 'Open the door', fr: 'Ouvrir la porte', de: 'Tür öffnen', es: 'Abrir la puerta', hi: 'दरवाज़ा खोलें' },
  elevator: { en: 'Taking the elevator', fr: 'Dans l’ascenseur', de: 'Im Aufzug', es: 'En el ascensor', hi: 'लिफ़्ट में' },
  seated: {
    en: 'You are seated. The Clashes of this world will play on this stage.',
    fr: 'Tu es assis. Les Clashs de ce monde se joueront sur cette scène.',
    de: 'Du sitzt. Die Clashes dieser Welt finden auf dieser Bühne statt.',
    es: 'Ya estás sentado. Los Clashes de este mundo se jugarán en este escenario.',
    hi: 'आप बैठ गए हैं। इस दुनिया के Clash इसी मंच पर होंगे।',
  },
  lookAround: { en: 'Drag to look around', fr: 'Glisse pour regarder autour', de: 'Ziehen zum Umsehen', es: 'Desliza para mirar', hi: 'चारों ओर देखने के लिए खींचें' },
  leave: { en: 'Back to the car', fr: 'Retour à la voiture', de: 'Zurück zum Auto', es: 'Volver al coche', hi: 'कार पर वापस' },
  language: { en: 'Language', fr: 'Langue', de: 'Sprache', es: 'Idioma', hi: 'भाषा' },
  close: { en: 'Leave Life', fr: 'Quitter Life', de: 'Life verlassen', es: 'Salir de Life', hi: 'Life से बाहर' },
  arrived: { en: 'You have arrived', fr: 'Tu es arrivé', de: 'Du bist angekommen', es: 'Has llegado', hi: 'आप पहुँच गए' },
  comingSoon: { en: 'Clashes start soon', fr: 'Les Clashs commencent bientôt', de: 'Clashes starten bald', es: 'Los Clashes empiezan pronto', hi: 'Clash जल्द शुरू होंगे' },
} satisfies Record<string, Record<LifeLanguage, string>>

export type LifeText = keyof typeof STRINGS

export const t = (language: LifeLanguage, key: LifeText) => STRINGS[key][language]

const STORAGE_KEY = 'hc:life-language'

export function savedLifeLanguage(): LifeLanguage | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return LIFE_LANGUAGES.some((language) => language.id === value) ? (value as LifeLanguage) : null
  } catch {
    return null
  }
}

export function saveLifeLanguage(language: LifeLanguage) {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Without storage the visitor simply picks again next time.
  }
}
