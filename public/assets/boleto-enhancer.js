// Script para adicionar informações extras aos boletos
(function() {
    'use strict';
    
    // Aguardar o DOM carregar
    function init() {
        // Observar mudanças no DOM para detectar quando boletos são renderizados
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    enhanceBoletos();
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Tentar melhorar boletos existentes
        setTimeout(enhanceBoletos, 1000);
    }
    
    function enhanceBoletos() {
        // Encontrar todos os cards de boleto
        const boletoCards = document.querySelectorAll('[class*="bg-white"][class*="rounded"]');
        
        boletoCards.forEach(card => {
            // Verificar se já foi processado
            if (card.dataset.enhanced) return;
            card.dataset.enhanced = 'true';
            
            // Procurar pela seção de linha digitável
            const linhaDigitavelSection = Array.from(card.querySelectorAll('div')).find(div => 
                div.textContent.includes('Linha Digitavel para Pagamento') ||
                div.textContent.includes('Linha digitavel nao disponivel')
            );
            
            if (!linhaDigitavelSection) return;
            
            // Tentar encontrar dados do boleto no contexto
            const boletoNumero = card.querySelector('h3')?.textContent.match(/#(\d+)/)?.[1];
            if (!boletoNumero) return;
            
            // Buscar dados completos do boleto via API
            fetchBoletoData(boletoNumero, card, linhaDigitavelSection);
        });
    }
    
    async function fetchBoletoData(boletoNumero, card, insertPoint) {
        try {
            // Extrair CPF do formulário se disponível
            const cpfInput = document.querySelector('input[type="text"]');
            if (!cpfInput || !cpfInput.value) return;
            
            const cpf = cpfInput.value.replace(/\D/g, '');
            
            const response = await fetch('/api/jrpv/boletos/consultar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpf })
            });
            
            const data = await response.json();
            if (!data.success || !data.data) return;
            
            // Encontrar o boleto específico
            const boleto = data.data.find(b => b.codigo_boleto == boletoNumero);
            if (!boleto) return;
            
            // Adicionar informações do veículo
            if (boleto.veiculo && boleto.veiculo[0]) {
                addVeiculoInfo(card, boleto.veiculo[0], insertPoint);
            }
            
            // Adicionar linha digitável se disponível
            if (boleto.linha_digitavel && !boleto.linha_digitavel.includes('Não foi possível')) {
                addLinhaDigitavel(insertPoint, boleto.linha_digitavel);
            }
            
            // Adicionar PIX se disponível
            if (boleto.pix && boleto.pix.copia_cola) {
                addPixInfo(insertPoint, boleto.pix.copia_cola);
            }
            
        } catch (error) {
            console.error('Erro ao buscar dados do boleto:', error);
        }
    }
    
    function addVeiculoInfo(card, veiculo, insertPoint) {
        // Verificar se já existe
        if (card.querySelector('[data-veiculo-info]')) return;
        
        const veiculoDiv = document.createElement('div');
        veiculoDiv.dataset.veiculoInfo = 'true';
        veiculoDiv.className = 'bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4';
        veiculoDiv.innerHTML = `
            <h4 class="font-semibold text-blue-800 mb-2">🚗 Veículo Protegido</h4>
            <p class="text-blue-900 font-medium">${veiculo.marca} ${veiculo.modelo} ${veiculo.ano_modelo}</p>
            <p class="text-blue-700 text-sm">Placa: ${veiculo.placa} | Tipo: ${veiculo.tipo_veiculo}</p>
        `;
        
        insertPoint.parentNode.insertBefore(veiculoDiv, insertPoint);
    }
    
    function addLinhaDigitavel(insertPoint, linhaDigitavel) {
        // Procurar o container de linha digitável existente
        const container = insertPoint.querySelector('div[class*="bg-white"]');
        if (!container) return;
        
        // Verificar se já foi adicionado
        if (container.querySelector('[data-linha-real]')) return;
        
        // Substituir o conteúdo
        container.innerHTML = `
            <div data-linha-real="true" class="bg-white p-3 rounded border font-mono text-sm break-all mb-3">
                ${linhaDigitavel}
            </div>
            <button onclick="navigator.clipboard.writeText('${linhaDigitavel}').then(() => { this.textContent = '✓ Copiado!'; setTimeout(() => this.textContent = 'Copiar Linha Digitável', 2000); })" 
                    class="bg-blue-600 text-white py-2 px-4 rounded text-sm font-medium hover:bg-blue-700 transition-colors flex items-center">
                📋 Copiar Linha Digitável
            </button>
        `;
    }
    
    function addPixInfo(insertPoint, pixCopiaECola) {
        // Verificar se já existe
        if (insertPoint.parentNode.querySelector('[data-pix-info]')) return;
        
        const pixDiv = document.createElement('div');
        pixDiv.dataset.pixInfo = 'true';
        pixDiv.className = 'bg-green-50 border border-green-200 rounded-lg p-4 mb-4';
        pixDiv.innerHTML = `
            <h4 class="font-semibold text-green-800 mb-2">💚 PIX Copia e Cola</h4>
            <div class="bg-white p-3 rounded border font-mono text-xs break-all mb-3 max-h-24 overflow-y-auto">
                ${pixCopiaECola}
            </div>
            <button onclick="navigator.clipboard.writeText('${pixCopiaECola}').then(() => { this.textContent = '✓ Copiado!'; setTimeout(() => this.textContent = 'Copiar Código PIX', 2000); })" 
                    class="bg-green-600 text-white py-2 px-4 rounded text-sm font-medium hover:bg-green-700 transition-colors flex items-center">
                📱 Copiar Código PIX
            </button>
        `;
        
        insertPoint.parentNode.insertBefore(pixDiv, insertPoint);
    }
    
    // Inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
