const CONFIG = {
    SUPABASE_URL: 'https://qspwtmfmolvqlzsbwlzv.supabase.co',
    SUPABASE_KEY: 'sb_publishable_ba5r8nJ5o49w1b9TURDLBA_EbMC_lWU',
    // Usamos el modelo más estable para evitar errores 404
    GEMINI_KEY: 'AIzaSyAQNSLLZSNIWjAW4b9Ifke1TWT5YPtZ0cE' 
};

// Cliente Global de Supabase
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);