import { Injectable } from '@angular/core';
import { Produto } from '../models/produto.model';

@Injectable({
  providedIn: 'root'
})
export class ProdutoService {
  private chaveLocalStorage = 'estoque_produtos';

  constructor() { }

  // === MÉTODOS DE ACESSO AOS DADOS ===

  // Listar todos os produtos
  listarProdutos(): Produto[] {
    const dados = localStorage.getItem(this.chaveLocalStorage);
    if (dados) {
      return JSON.parse(dados);
    }
    // Se não houver dados, retorna lista inicial padrão (mock)
    this.inicializarDadosPadrao();
    return this.listarProdutos(); // Chama recursivamente para pegar os dados recém-criados
  }

  // Inicializa com dados padrão se estiver vazio
  private inicializarDadosPadrao(): void {
    const produtosIniciais: Produto[] = [
      { id: 1, nome: 'Ácido Hialurônico', categoria: 'Injetáveis', quantidade: 12, unidade: 'ampola', validade: '2026-08-10' },
      { id: 2, nome: 'Botox (Toxina Botulínica)', categoria: 'Injetáveis', quantidade: 4, unidade: 'frasco', validade: '2025-12-01' },
      { id: 3, nome: 'Luvas de Látex P', categoria: 'Descartáveis', quantidade: 50, unidade: 'caixa', validade: '2027-01-15' },
      { id: 4, nome: 'Máscara Facial Calmante', categoria: 'Cosméticos', quantidade: 8, unidade: 'unidade', validade: '2025-06-20' },
      { id: 5, nome: 'Seringa 3ml', categoria: 'Descartáveis', quantidade: 100, unidade: 'unidade', validade: '2028-05-30' },
      { id: 6, nome: 'Creme Anestésico', categoria: 'Cosméticos', quantidade: 3, unidade: 'bisnaga', validade: '2025-09-10' }
    ];
    this.salvarNoLocalStorage(produtosIniciais);
  }

  // Buscar produto por ID
  obterProdutoPorId(id: number): Produto | undefined {
    const produtos = this.listarProdutos();
    return produtos.find(p => p.id === id);
  }

  // Cadastrar um novo produto
  cadastrarProduto(produto: Produto): void {
    const produtos = this.listarProdutos();
    // Gera um ID único simples usando o timestamp atual
    produto.id = new Date().getTime(); 
    produtos.push(produto);
    this.salvarNoLocalStorage(produtos);
  }

  // Atualizar um produto existente
  atualizarProduto(produtoAtualizado: Produto): void {
    let produtos = this.listarProdutos();
    
    // Encontra o índice do produto na lista pelo ID
    const index = produtos.findIndex(p => p.id === produtoAtualizado.id);
    
    if (index !== -1) {
      produtos[index] = produtoAtualizado;
      this.salvarNoLocalStorage(produtos);
    }
  }

  // Remover um produto pelo ID
  removerProduto(id: number): void {
    let produtos = this.listarProdutos();
    // Filtra a lista mantendo apenas os produtos que NÃO têm o ID informado
    produtos = produtos.filter(p => p.id !== id);
    this.salvarNoLocalStorage(produtos);
  }

  // === MÉTODOS AUXILIARES ===

  // Salva a lista atualizada no localStorage
  private salvarNoLocalStorage(produtos: Produto[]): void {
    localStorage.setItem(this.chaveLocalStorage, JSON.stringify(produtos));
  }
}
