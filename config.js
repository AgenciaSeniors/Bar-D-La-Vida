const CONFIG = {
    SUPABASE_URL: 'https://mvtatdvpsjynvayhhksc.supabase.co',
    SUPABASE_KEY: 'sb_publishable_XtV2kYHISXME2K-STuHmdw_UUGTZyvS',
    // Usamos el modelo más estable para evitar errores 404
    GEMINI_KEY: 'AIzaSyA5Ku1Rk1dXTl_pfXQ3wEwvkaENfguMYN8' 
};

// Cliente Global de Supabase

const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
