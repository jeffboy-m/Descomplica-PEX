import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Produto } from '../../models/produto.model';
import { ProdutoService } from '../../services/produto.service';

@Component({
  selector: 'app-lista-produtos',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './lista-produtos.html',
  styleUrl: './lista-produtos.scss',
})
export class ListaProdutos {
  produtos: Produto[] = [];
  termoBusca: string = '';

  constructor(private produtoService: ProdutoService) {}

  // Executado ao iniciar o componente
  ngOnInit(): void {
    this.carregarProdutos();
  }

  // Busca a lista atualizada do serviço e aplica filtro se houver busca
  carregarProdutos(): void {
    const todosProdutos = this.produtoService.listarProdutos();
    
    if (this.termoBusca.trim()) {
      const termo = this.termoBusca.toLowerCase();
      this.produtos = todosProdutos.filter(p => 
        p.nome.toLowerCase().includes(termo) || 
        p.categoria.toLowerCase().includes(termo)
      );
    } else {
      this.produtos = todosProdutos;
    }
  }

  // Método chamado ao digitar no campo de busca
  filtrarProdutos(): void {
    this.carregarProdutos();
  }

  // Remove um produto e atualiza a lista
  removerProduto(id: number): void {
    if (confirm('Tem certeza que deseja remover este produto?')) {
      this.produtoService.removerProduto(id);
      this.carregarProdutos();
    }
  }
}
