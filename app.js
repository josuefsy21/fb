require('dotenv').config();
const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 3355;
const app = express();

const { engine } = require('express-handlebars');
const fetch = require('node-fetch');
const mysql = ('mysql2/promise');
const path = require('path');

app.use(express.json());
app.use(cors());
app.engine('hbs', engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

async function getDB() {
    return mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'facebook_ads'
    });
}

// Salvar anúncio no DB
app.post('/salvar', async (req, res) => {
    const { id, titulo } = req.body;
    const conn = await getDB();
    await conn.execute('INSERT IGNORE INTO anuncios (id, titulo) VALUES (?, ?)', [id, titulo]);
    await conn.end();
    res.redirect('/grafico');
});

// Página do gráfico
app.get('/grafico', async (req, res) => {
    const conn = await getDB();
    const [anuncios] = await conn.execute('SELECT * FROM anuncios');
    await conn.end();
    res.render('grafico', { title: 'Gráfico', anuncios });
});

// API para histórico
app.get('/api/historico/:id', async (req, res) => {
    const conn = await getDB();
    const [dados] = await conn.execute(
        'SELECT data, ativos FROM historico WHERE anuncio_id = ? ORDER BY data ASC',
        [req.params.id]
    );
    await conn.end();
    res.json(dados);
});


app.get('/', async (req, res) => {
    const termo = req.query.termo || '';
    let anuncios = [];
    const API_URL = process.env.API_URL;
    const TOKEN = process.env.TOKEN_FACEBOOK;
    const pais = 'BR';

    if (termo) {
        const url = `${API_URL}?access_token=${TOKEN}&search_terms=${encodeURIComponent(termo)}&ad_reached_countries=['${pais}']&fields=id,ad_creative_body,ad_snapshot_url,ad_delivery_stop_time&limit=10`;
        const response = await fetch(url);
        const json = await response.json();
        console.log('Resposta da API:', json); // para debug
        anuncios = json.data || [];
    }

    res.render('index', { title: 'Pesquisar', termo, anuncios });
});


app.listen(PORT, () => {
    console.log(`--SERVER ON RUNNING IN PORT@${PORT}--`);
});