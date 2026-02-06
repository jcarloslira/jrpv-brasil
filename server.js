import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// API Hinova - Consulta de Boletos com autenticação em 2 etapas
app.post('/api/jrpv/boletos/consultar', async (req, res) => {
  try {
    // Accept both 'cpf' and 'cpf_associado' formats
    const cpf = req.body.cpf || req.body.cpf_associado;

    if (!cpf) {
      return res.status(400).json({
        success: false,
        error: 'CPF é obrigatório'
      });
    }

    const cleanCpf = cpf.replace(/\D/g, '');
    const HINOVA_BASE_URL = 'https://api.hinova.com.br/api/sga/v2';
    const ASSOCIATION_TOKEN = 'c85f2689ae233297049e633cf0187ec382163ef79e36354c751f56701299f14c699ec643e0f5cb196bc5240a5703927dcee3b53be8e18689489067d6270d180ee3ed1b515be7043d72ab106abf4d425c5727acf5796cc94a586cf4e469218bd5';
    const USER_LOGIN = 'GEANN';
    const USER_PASSWORD = 'TESTE$44';

    // Step 1: Authenticate user to get user token
    const authResponse = await fetch(`${HINOVA_BASE_URL}/usuario/autenticar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${ASSOCIATION_TOKEN}`
      },
      body: JSON.stringify({
        usuario: USER_LOGIN,
        senha: USER_PASSWORD
      })
    });

    if (!authResponse.ok) {
      throw new Error('Falha na autenticação do usuário');
    }

    const authData = await authResponse.json();
    const userToken = authData.token_usuario;

    // Step 2: Get boletos using user token
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const elevenMonthsLater = new Date(now.getFullYear(), now.getMonth() + 11, now.getDate());
    
    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const startDate = formatDate(oneMonthAgo);
    const endDate = formatDate(elevenMonthsLater);

    const boletosResponse = await fetch(`${HINOVA_BASE_URL}/listar/boleto/periodo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        cpf_associado: cleanCpf,
        data_vencimento_inicial: startDate,
        data_vencimento_final: endDate
      })
    });

    if (!boletosResponse.ok) {
      const errorText = await boletosResponse.text();
      console.error('Hinova API Error:', errorText);
      throw new Error('CPF não encontrado ou erro ao consultar boletos');
    }

    const boletosData = await boletosResponse.json();

    res.json({
      success: true,
      data: boletosData
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao consultar boletos'
    });
  }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 JRPV Brasil server running on http://localhost:${PORT}/`);
});
