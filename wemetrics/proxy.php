<?php
// ATIVA A EXIBIÇÃO DE ERROS PARA DIAGNÓSTICO
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Função para fazer a chamada à API do Gemini com diagnóstico de erros
function get_company_analysis($companyName, $companySite) {
    // --- COLOQUE SUA CHAVE DA API DO GEMINI AQUI ---
    $geminiApiKey = 'AIzaSyAK3cuAHzSLytjSA9bSQdBXAWbUchBlE-Y';
    $modelToUse = "gemini-1.5-flash-latest"; // Um modelo recente e eficiente do Gemini
    
    // O endpoint da API do Gemini
    $geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' . $modelToUse . ':generateContent?key=' . $geminiApiKey;

    $prompt = "Realize uma análise completa e detalhada da empresa \"$companyName\", com site \"$companySite\". Pesquise na internet, incluindo o site oficial, sites de avaliação como Reclame Aqui e Google Meu Negócio. Retorne sua resposta ESTRITAMENTE em formato de um objeto JSON, com as seguintes chaves: \"briefing\", \"pontos_positivos\", \"pontos_negativos\", \"comentarios_positivos_reais\", \"comentarios_negativos_reais\", \"resumo_google\", \"resumo_reclameaqui\", \"produtos\", \"servicos\". Para \"produtos\" e \"servicos\", se não for aplicável, retorne um array vazio [].";

    // O payload (corpo da requisição) no formato do Gemini
    $payload = json_encode([
        'contents' => [
            ['parts' => [
                ['text' => $prompt]
            ]]
        ],
        // Adicionando configuração para garantir saída em JSON
        'generationConfig' => [
            'responseMimeType' => 'application/json',
        ]
    ]);

    $ch = curl_init($geminiApiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
        // Note que o cabeçalho 'Authorization' não é mais necessário
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 120); // Aumentado o timeout para o Gemini

    $response = curl_exec($ch);
    
    if (curl_errno($ch)) {
        $error_msg = curl_error($ch);
        curl_close($ch);
        return ['data' => null, 'error' => 'Erro de conexão (cURL): ' . $error_msg];
    }

    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    if ($http_code !== 200) {
        $apiError = $result['error']['message'] ?? 'Erro desconhecido';
        return ['data' => null, 'error' => "Erro da API Gemini (Código HTTP: $http_code). Mensagem: " . htmlspecialchars($apiError)];
    }
    
    if ($result === null) {
        return ['data' => null, 'error' => 'A API retornou uma resposta que não é um JSON válido. Resposta: ' . htmlspecialchars($response)];
    }

    // A estrutura da resposta do Gemini é diferente
    if (isset($result['candidates'][0]['content']['parts'][0]['text'])) {
        $content = $result['candidates'][0]['content']['parts'][0]['text'];
        $analysis = json_decode($content, true);
        
        if ($analysis === null) {
            return ['data' => null, 'error' => 'O conteúdo retornado pela API não é um JSON interno válido. Conteúdo: ' . htmlspecialchars($content)];
        }
        
        return ['data' => $analysis, 'error' => null];
    }
    
    return ['data' => null, 'error' => 'A resposta da API não teve a estrutura esperada (candidates -> content -> parts -> text). Resposta: ' . htmlspecialchars($response)];
}

// Função para renderizar um card de resultado
function render_card($title, $content) {
    echo '<div class="analysis-card">';
    echo '<h3>' . htmlspecialchars($title) . '</h3>';
    if (is_array($content) && !empty($content)) {
        echo '<ul>';
        foreach ($content as $item) {
            echo '<li>' . htmlspecialchars($item) . '</li>';
        }
        echo '</ul>';
    } elseif (is_string($content) && !empty($content)) {
        echo '<p>' . nl2br(htmlspecialchars($content)) . '</p>';
    } else {
        echo '<p>N/A</p>';
    }
    echo '</div>';
}

// Início do processamento
$planName = null;
$analysisData = null;
$errorMessage = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['planName']) && isset($_POST['clientSite'])) {
        $planName = $_POST['planName'];
        $clientSite = $_POST['clientSite'];
        $result = get_company_analysis($planName, $clientSite);
        $analysisData = $result['data'];
        $errorMessage = $result['error'];
    } else {
        $errorMessage = "Nome da empresa ou site não foram enviados.";
    }
}
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Resultado da Análise - AREA51</title>
    <style>
        :root { --bg:#1f2937; --panel:#111827; --card:#0b1220; --muted:#9ca3af; --text:#e5e7eb; --accent:#0099FF; --border:#374151; --danger:#ef4444 }
        * { box-sizing: border-box; }
        body { margin:0; background:var(--bg); color:var(--text); font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans; }
        .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
        h1 { margin: 0 0 6px 0; font-size: 28px; font-weight: 800; }
        a.back-link { color: var(--accent); text-decoration: none; display: inline-block; margin-bottom: 20px; }
        .analysis-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 1024px) { .analysis-grid { grid-template-columns: repeat(2, 1fr); } }
        .analysis-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
        .analysis-card h3 { color: var(--accent); font-size: 16px; font-weight: 700; margin: 0 0 10px 0; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
        .analysis-card p, .analysis-card ul { margin: 0; font-size: 14px; line-height: 1.6; color: var(--text); }
        .analysis-card ul { padding-left: 20px; }
        .analysis-card li { margin-bottom: 8px; }
        .error-message { background: rgba(239, 68, 68, 0.1); color: var(--danger); padding: 20px; border-radius: 14px; border: 1px solid var(--danger); }
        .error-message code { background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Resultado da Análise para "<?php echo htmlspecialchars($planName ?? '...'); ?>"</h1>
        <a href="iaempresa.html" class="back-link">&larr; Voltar para a pesquisa</a>

        <?php if ($errorMessage): ?>
            <div class="error-message">
                <h2>Ocorreu um Erro</h2>
                <p><?php echo $errorMessage; ?></p>
            </div>
        <?php elseif ($analysisData): ?>
            <div class="analysis-grid">
                <?php
                render_card('BRIEFING DA EMPRESA', $analysisData['briefing'] ?? null);
                render_card('RESUMO DAS AVALIAÇÕES DO GOOGLE MEU NEGÓCIO', $analysisData['resumo_google'] ?? null);
                render_card('RESUMO DAS AVALIAções DO RECLAME AQUI', $analysisData['resumo_reclameaqui'] ?? null);
                render_card('PONTOS POSITIVOS', $analysisData['pontos_positivos'] ?? null);
                render_card('PONTOS NEGATIVOS', $analysisData['pontos_negativos'] ?? null);
                render_card('COMENTÁRIOS POSITIVOS', $analysisData['comentarios_positivos_reais'] ?? null);
                render_card('COMENTÁRIOS NEGATIVOS', $analysisData['comentarios_negativos_reais'] ?? null);
                if (!empty($analysisData['produtos'])) {
                    render_card('PRODUTOS QUE COMERCIALIZA', $analysisData['produtos']);
                }
                if (!empty($analysisData['servicos'])) {
                    render_card('SERVIÇOS QUE OFERECE', $analysisData['servicos']);
                }
                ?>
            </div>
        <?php else: ?>
             <div class="error-message">
                <h2>Formulário não enviado</h2>
                <p>Por favor, volte e preencha o formulário de pesquisa.</p>
            </div>
        <?php endif; ?>
    </div>
</body>
</html>