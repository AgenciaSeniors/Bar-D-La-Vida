// supabase/functions/generar-curiosidad/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
    
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 });
    }

    try {
        const { nombre } = await req.json();
        
        // La clave secreta DEEPSEEK_API_KEY se lee desde el servidor de Supabase.
        const API_KEY = Deno.env.get('DEEPSEEK_API_KEY'); 
        if (!API_KEY) {
            return new Response(JSON.stringify({ error: 'Clave DeepSeek no configurada en el servidor.' }), { status: 500 });
        }

        const prompt = `Escribe un dato curioso e histórico muy breve (máximo 20 palabras) y divertido sobre: "${nombre}". Tono gastronómico y alegre.`;

        // Petición a DeepSeek
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat", 
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 100
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Error HTTP ${response.status}`);
        }

        const data = await response.json();
        const curiosidad = data.choices[0].message.content;

        // Devolver la respuesta al frontend
        return new Response(JSON.stringify({ curiosidad }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message || 'Error desconocido' }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        });
    }
});