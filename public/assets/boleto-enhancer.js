// Script para adicionar informações extras aos boletos (veículo e PIX)
// Funciona em conjunto com o React SPA - observa o DOM e injeta dados adicionais
(function() {
    'use strict';
    
    // Cache para evitar chamadas duplicadas à API
    let cachedBoletos = null;
    let cachedCpf = null;
    let processingQueue = false;

    function init() {
        // Observar mudanças no DOM para detectar quando boletos são renderizados
        const observer = new MutationObserver(function(mutations) {
            let hasNewNodes = false;
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    hasNewNodes = true;
                }
            });
            if (hasNewNodes) {
                debounceEnhance();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Tentar melhorar boletos existentes periodicamente
        setTimeout(enhanceBoletos, 1500);
        setTimeout(enhanceBoletos, 3000);
        setTimeout(enhanceBoletos, 5000);
    }
    
    let debounceTimer = null;
    function debounceEnhance() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(enhanceBoletos, 500);
    }

    function enhanceBoletos() {
        if (processingQueue) return;
        
        // Encontrar todos os cards de boleto (bg-white rounded-lg shadow-md p-6)
        const boletoCards = document.querySelectorAll('.bg-white.rounded-lg.shadow-md.p-6');
        
        if (boletoCards.length === 0) return;
        
        boletoCards.forEach(card => {
            // Verificar se já foi processado
            if (card.dataset.enhanced === 'true') return;
            
            // Procurar o número do boleto no card
            const h3 = card.querySelector('h3');
            if (!h3) return;
            
            const match = h3.textContent.match(/#(\d+)/);
            if (!match) return;
            
            const boletoNumero = match[1];
            card.dataset.boletoNumero = boletoNumero;
            
            // Buscar dados e enriquecer o card
            fetchAndEnhance(boletoNumero, card);
        });
    }
    
    async function fetchAndEnhance(boletoNumero, card) {
        try {
            // Extrair CPF do input
            const cpfInput = document.querySelector('input[type="text"][maxlength]');
            if (!cpfInput || !cpfInput.value) return;
            
            const cpf = cpfInput.value.replace(/\D/g, '');
            if (cpf.length !== 11) return;
            
            // Usar cache se disponível
            let boletos = null;
            if (cachedBoletos && cachedCpf === cpf) {
                boletos = cachedBoletos;
            } else {
                processingQueue = true;
                const response = await fetch('/api/jrpv/boletos/consultar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cpf })
                });
                
                const data = await response.json();
                if (!data.success || !data.data) {
                    processingQueue = false;
                    return;
                }
                
                boletos = data.data;
                cachedBoletos = boletos;
                cachedCpf = cpf;
                processingQueue = false;
            }
            
            // Encontrar o boleto específico
            const boleto = boletos.find(b => String(b.codigo_boleto) === String(boletoNumero));
            if (!boleto) return;
            
            // Marcar como processado
            card.dataset.enhanced = 'true';
            
            // Encontrar o ponto de inserção - antes do botão de WhatsApp
            const whatsappBtn = card.querySelector('button.bg-green-600, button[class*="bg-green-600"]');
            if (!whatsappBtn) return;
            
            // Adicionar informações do veículo
            if (boleto.veiculo && boleto.veiculo.length > 0 && !card.querySelector('[data-veiculo-info]')) {
                const veiculo = boleto.veiculo[0];
                const veiculoDiv = document.createElement('div');
                veiculoDiv.dataset.veiculoInfo = 'true';
                veiculoDiv.className = 'rounded-lg p-4 mb-4';
                veiculoDiv.style.cssText = 'background-color: #f0f9ff; border: 1px solid #bae6fd;';
                veiculoDiv.innerHTML = `
                    <h4 style="font-weight: 600; color: #0c4a6e; margin-bottom: 8px; font-size: 14px;">🚗 Veículo Protegido</h4>
                    <p style="color: #0c4a6e; font-weight: 600; font-size: 15px; margin-bottom: 4px;">
                        ${veiculo.marca || ''} ${veiculo.modelo || ''} ${veiculo.ano_modelo || ''}
                    </p>
                    <p style="color: #0369a1; font-size: 13px;">
                        Placa: ${veiculo.placa || 'N/A'} | Tipo: ${veiculo.tipo_veiculo || 'N/A'}
                    </p>
                `;
                whatsappBtn.parentNode.insertBefore(veiculoDiv, whatsappBtn);
            }
            
            // Adicionar PIX Copia e Cola (se disponível e boleto não pago)
            if (boleto.pix && boleto.pix.copia_cola && boleto.pago !== 'S' && !card.querySelector('[data-pix-info]')) {
                const pixDiv = document.createElement('div');
                pixDiv.dataset.pixInfo = 'true';
                pixDiv.className = 'rounded-lg p-4 mb-4';
                pixDiv.style.cssText = 'background-color: #ecfdf5; border: 1px solid #6ee7b7;';
                
                const pixId = 'pix-' + boletoNumero;
                pixDiv.innerHTML = `
                    <h4 style="font-weight: 600; color: #065f46; margin-bottom: 8px; font-size: 14px;">💚 PIX Copia e Cola</h4>
                    <div style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #d1fae5; font-family: 'Courier New', monospace; font-size: 11px; word-break: break-all; margin-bottom: 10px; max-height: 80px; overflow-y: auto; color: #065f46;" id="${pixId}">
                        ${boleto.pix.copia_cola}
                    </div>
                    <button onclick="(function(btn){ var t=document.getElementById('${pixId}').textContent.trim(); navigator.clipboard.writeText(t).then(function(){ btn.innerHTML='✓ Copiado!'; setTimeout(function(){ btn.innerHTML='📱 Copiar Código PIX'; }, 2000); }); })(this)" 
                            style="background-color: #059669; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; display: flex; align-items: center; transition: background-color 0.3s;">
                        📱 Copiar Código PIX
                    </button>
                `;
                whatsappBtn.parentNode.insertBefore(pixDiv, whatsappBtn);
            }
            
        } catch (error) {
            console.error('Erro ao enriquecer boleto:', error);
            processingQueue = false;
        }
    }
    
    // Inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
