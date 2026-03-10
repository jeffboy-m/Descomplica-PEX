import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Produto } from '../../models/produto.model';
import { ProdutoService } from '../../services/produto.service';

@Component({
  selector: 'app-cadastro-produto',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cadastro-produto.html',
  styleUrl: './cadastro-produto.scss',
})
export class CadastroProduto {
  // Objeto inicial vazio para o formulário
  produto: Produto = {
    id: 0,
    nome: '',
    categoria: '',
    quantidade: 0,
    unidade: '',
    validade: ''
  };

  constructor(
    private produtoService: ProdutoService,
    private router: Router
  ) {}

  // Função chamada ao enviar o formulário
  salvarProduto(): void {
    if (this.validarFormulario()) {
      this.produtoService.cadastrarProduto(this.produto);
      alert('Produto cadastrado com sucesso!');
      this.router.navigate(['/produtos']); // Volta para a lista
    }
  }

  // Validação simples
  validarFormulario(): boolean {
    if (!this.produto.nome || !this.produto.categoria || !this.produto.unidade || !this.produto.validade) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return false;
    }
    if (this.produto.quantidade < 0) {
      alert('A quantidade não pode ser negativa.');
      return false;
    }
    return true;
  }
}
