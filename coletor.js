const mysql = require("mysql2/promise");
const fetch = require("node-fetch");
const cron = require("node-cron");

const TOKEN = process.env.TOKEN_FACEBOOK;
const API_URL = process.env.API_URL;

async function getDB() {
    return mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "facebook_ads"
    });
}

async function coletarStatus() {
    const conn = await getDB();

    // Buscar anúncios salvos
    const [anuncios] = await conn.execute("SELECT id FROM anuncios");

    for (const anuncio of anuncios) {
        try {
            // Consultar na API
            const url = `${API_URL}?access_token=${TOKEN}&ad_ids=${anuncio.id}&fields=id,ad_delivery_stop_time`;
            const resp = await fetch(url);
            const json = await resp.json();

            let ativo = 0;
            if (json.data && json.data.length > 0) {
                const anuncioData = json.data[0];
                ativo = anuncioData.ad_delivery_stop_time ? 0 : 1;
            }

            // Atualizar tabela de anúncios
            await conn.execute("UPDATE anuncios SET ativo = ? WHERE id = ?", [ativo, anuncio.id]);

            // Inserir histórico
            await conn.execute(
                "INSERT INTO historico (anuncio_id, data, ativos) VALUES (?, CURDATE(), ?)",
                [anuncio.id, ativo]
            );

            console.log(`Anúncio ${anuncio.id} → ativo: ${ativo}`);
        } catch (err) {
            console.error(`Erro no anúncio ${anuncio.id}:`, err);
        }
    }

    await conn.end();
}

// Executa todo dia às 2 da manhã
cron.schedule("0 2 * * *", () => {
    console.log("⏳ Rodando coleta diária...");
    coletarStatus();
});

// Se quiser rodar manualmente para teste:
// coletarStatus();
