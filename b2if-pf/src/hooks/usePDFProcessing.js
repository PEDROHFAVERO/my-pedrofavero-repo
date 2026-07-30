/**
 * usePDFProcessing.js — Hook de processamento de PDF
 *
 * Extrai toda a lógica de importação de PDF de PageCategorizador.jsx.
 * Chama a Edge Function process-pdf (Gemini server-side).
 * A GEMINI_API_KEY nunca toca o browser.
 *
 * Responsabilidades:
 *  - Gerenciar estado de loading, progresso, erros e cancelamento
 *  - Orquestrar: extrairTextoPDF → processarPDFViaServidor → autoCategorizar → marcarDuplicatas
 *  - Expor resultado via callback onImport para o componente pai
 */
import { useState, useRef, useCallback } from 'react';
import { extrairTextoPDF, extrairTextoNubankExtrato, detectarBanco } from '../utils/pdfParser.js';
import { processarPDFViaServidor, montarHistoricoCategorizacoes } from '../services/pdf/processPdf.service.js';
import { autoCategorizar } from '../utils/parser.js';
import { marcarDuplicatas, estatisticasDeteccao } from '../utils/fingerprint.js';
import { REGRAS_PADRAO } from '../data/categorias.js';

// ── Notificação de conclusão de PDF quando aba está oculta ──────────────────
// Pisca o título da aba e toca um beep sintético usando AudioContext.
// Para automaticamente quando o usuário voltar à aba ou após N ciclos.
function notificarConclusaoPDF() {
  if (!document.hidden) return; // aba já está visível — não precisa notificar

  const titulo  = document.title;
  const MSG     = '✅ PDF importado!';
  let   ciclos  = 0;
  const MAX     = 8; // pisca 8 vezes (4 por sentido = ~6 segundos)
  let   timerId = null;

  function pararBlink() {
    clearInterval(timerId);
    document.title = titulo;
    document.removeEventListener('visibilitychange', pararBlink);
  }

  // Inicia blink
  timerId = setInterval(() => {
    document.title = document.title === MSG ? titulo : MSG;
    ciclos++;
    if (ciclos >= MAX) pararBlink();
  }, 750);

  // Para automaticamente quando usuário volta à aba
  document.addEventListener('visibilitychange', pararBlink, { once: true });

  // Beep sintético via AudioContext (não requer arquivo externo)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);         // Lá5 — agradável
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch {
    // AudioContext não disponível (ex: política de autoplay) — silencia sem erros
  }
}

/**
 * @param {Object} params
 * @param {import('../types/domain.js').Transacao[]} params.transacoesExistentes - Transações já importadas
 * @param {import('../types/domain.js').Transacao[]} params.regras - Regras de categorização
 * @param {function} params.onResultado - Callback com resultado: ({ transacoes, tipoDoc, compFatura }) => void
 * @param {string}   [params.nomeCliente]   - Nome do cliente titular (usado no prompt de Fluxo Interno)
 * @param {string[]} [params.nomesFamilia]  - Nomes dos membros do núcleo familiar
 * @returns {{
 *   processarArquivos: (arquivos: File[], nomeConta: string, tipoPDF?: string) => Promise<void>,
 *   cancelar: () => void,
 *   carregando: boolean,
 *   loadingMsg: string,
 *   loadingElapsed: number,
 *   erro: string|null,
 *   limparErro: () => void,
 * }}
 */
export function usePDFProcessing({ transacoesExistentes = [], regras = [], onResultado, onVersaoAposImportacao = null, nomeCliente = '', nomesFamilia = [] }) {
  // Monta histórico de categorizações uma vez por render (só muda quando transacoesExistentes muda)
  // Passado ao Gemini como "memória" para replicar decisões anteriores do cliente
  const [carregando, setCarregando]       = useState(false);
  const [loadingMsg, setLoadingMsg]       = useState('');
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [erro, setErro]                   = useState(null);
  const [aviso, setAviso]                 = useState(null); // aviso não-bloqueante (importação parcial)

  const cancelarRef    = useRef(false);
  const timerRef       = useRef(null);

  /** Inicia o timer de elapsed time no overlay de loading */
  function iniciarTimer() {
    setLoadingElapsed(0);
    cancelarRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setLoadingElapsed(s => s + 1);
    }, 1000);
  }

  /** Para o timer */
  function pararTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setLoadingElapsed(0);
  }

  /** Cancela o processamento em andamento */
  const cancelar = useCallback(() => {
    cancelarRef.current = true;
    pararTimer();
    setCarregando(false);
    setLoadingMsg('');
  }, []);

  const limparErro  = useCallback(() => setErro(null), []);
  const limparAviso = useCallback(() => setAviso(null), []);

  /**
   * Processa um ou mais arquivos PDF.
   * @param {File[]} arquivos
   * @param {string} nomeConta
   * @param {'extrato'|'fatura'} [tipoPDF] - Tipo definido pelo usuário (pula identificação por IA)
   */
  const processarArquivos = useCallback(async (arquivos, nomeConta, tipoPDF = 'extrato') => {
    if (!arquivos?.length) return;

    cancelarRef.current = false;
    setCarregando(true);
    setErro(null);
    iniciarTimer();

    const regrasEfetivas = (regras && regras.length > 0) ? regras : REGRAS_PADRAO;
    const todasTransacoes = [];
    let tipoDocFinal = tipoPDF ?? 'extrato';
    let compFaturaFinal = '';
    let bancoIdFinal = '';
    const erros = [];

    try {
      for (let idx = 0; idx < arquivos.length; idx++) {
        if (cancelarRef.current) {
          erros.push('Processamento cancelado pelo usuário.');
          break;
        }

        const file = arquivos[idx];
        const mb = (file.size / 1024 / 1024).toFixed(1);

        try {
          // Etapa 1: extrai texto no browser (rápido, ~1s)
          setLoadingMsg(`Lendo arquivo ${idx + 1}/${arquivos.length} (${mb} MB)…`);
          const textoBase = await extrairTextoPDF(file);

          if (!textoBase || textoBase.length < 50) {
            throw new Error(
              'Este PDF parece ser uma imagem escaneada e não pode ser lido automaticamente. ' +
              'Exporte o extrato em formato digital pelo app do banco.'
            );
          }

          // Detecta o banco ANTES de enviar ao servidor para permitir prompts específicos
          const banco = detectarBanco(textoBase);

          // Nubank extrato: usa extração estruturada por coordenadas X/Y para garantir
          // que TODAS as páginas e transações (entradas E saídas) sejam capturadas.
          // O texto genérico tem problema: layout em 2 colunas trunca valores e
          // linhas de data ficam coladas nas transações sem delimitador claro.
          const textoPDF = (banco === 'nubank')
            ? await extrairTextoNubankExtrato(file)
            : textoBase;

          // Etapa 2: envia para Edge Function (Gemini server-side)
          // tipoPDF e banco são passados para selecionar o prompt correto
          // nomeCliente e nomesFamilia melhoram detecção de Fluxo Interno
          const historicoCategorizacoes = montarHistoricoCategorizacoes(transacoesExistentes);
          console.info(`[usePDFProcessing] histórico: ${historicoCategorizacoes.length} padrões de categorização enviados ao Gemini`);

          const resultado = await processarPDFViaServidor({
            textoPDF,
            nomeConta,
            tipoPDF,
            banco,
            nomeCliente,
            nomesFamilia,
            historicoCategorizacoes,
            onProgress: (msg) => setLoadingMsg(msg),
            onCancel:   () => cancelarRef.current,
          });

          if (resultado.tipoDoc === 'fatura') tipoDocFinal = 'fatura';
          if (resultado.compFatura) compFaturaFinal = resultado.compFatura;
          // Guarda o ID do banco detectado para exibir o logo no modal de revisão
          if (banco && banco !== 'generico') bancoIdFinal = banco;

          // Aviso de importação parcial (PDF muito longo)
          if (resultado.aviso) {
            console.warn('[usePDFProcessing] aviso importação parcial:', resultado.aviso);
            setAviso(resultado.aviso);
          }

          // Etapa 3: auto-categorizar + marcar duplicatas (lógica pura no browser)
          const comCat = autoCategorizar(resultado.transacoes, regrasEfetivas);

          // Log de cobertura de categorização (quantas ficaram sem categoria)
          const semCategoria = comCat.filter(t => !t.categoria).length;
          const totalCat = comCat.length;
          console.info(`[autoCategorizar] ${file.name}: ${totalCat - semCategoria}/${totalCat} categorizadas automaticamente${semCategoria > 0 ? ` (${semCategoria} sem categoria — serão revisadas no modal)` : ' ✓'}`);

          const comDup = marcarDuplicatas(comCat, transacoesExistentes);
          // Log estatísticas de detecção de duplicatas
          const stats = estatisticasDeteccao(comDup);
          if (stats.duplicatas > 0 || stats.sugeridas > 0) {
            console.info(`[fingerprint v2] ${file.name}: ${stats.total} transações, ${stats.duplicatas} duplicatas (A:${stats.porCriterio.A} B:${stats.porCriterio.B} C:${stats.porCriterio.C} E:${stats.porCriterio.E}), ${stats.sugeridas} sugeridas (D:${stats.porCriterio.D})`);
          }
          todasTransacoes.push(...comDup);

        } catch (err) {
          console.error('[usePDFProcessing] erro arquivo', file.name, err);
          erros.push(`${file.name}: ${err?.message || err}`);
        }
      }

    } catch (err) {
      console.error('[usePDFProcessing] erro geral:', err);
      erros.push(err?.message || String(err));
    }

    pararTimer();
    setCarregando(false);
    setLoadingMsg('');

    if (todasTransacoes.length === 0) {
      setErro(erros.length > 0 ? erros.join('\n\n') : 'Nenhuma transação encontrada nos PDFs enviados.');
      return;
    }

    if (erros.length > 0) setErro(erros.join('\n\n'));

    onResultado?.({
      transacoes:  todasTransacoes,
      tipoDoc:     tipoDocFinal,
      compFatura:  compFaturaFinal,
      bancoId:     bancoIdFinal,
    });

    // Notifica o usuário se a aba estiver em segundo plano
    notificarConclusaoPDF();

    // Dispara snapshot de versão após importação bem-sucedida
    // O contexto irá comparar hash antes de criar — sem duplicatas.
    onVersaoAposImportacao?.();

  }, [regras, transacoesExistentes, onResultado]);

  return {
    processarArquivos,
    cancelar,
    carregando,
    loadingMsg,
    loadingElapsed,
    erro,
    limparErro,
    aviso,
    limparAviso,
  };
}
