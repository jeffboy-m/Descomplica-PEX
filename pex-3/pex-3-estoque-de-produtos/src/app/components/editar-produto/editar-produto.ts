import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Produto } from '../../models/produto.model';
import { ProdutoService } from '../../services/produto.service';

@Component({
  selector: 'app-editar-produto',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './editar-produto.html',
  styleUrl: './editar-produto.scss',
})
export class EditarProduto {
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
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Pega o ID da URL
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      const produtoEncontrado = this.produtoService.obterProdutoPorId(id);
      if (produtoEncontrado) {
        this.produto = produtoEncontrado;
      } else {
        alert('Produto não encontrado!');
        this.router.navigate(['/produtos']);
      }
    }
  }

  salvarProduto(): void {
    if (this.validarFormulario()) {
      this.produtoService.atualizarProduto(this.produto);
      alert('Produto atualizado com sucesso!');
      this.router.navigate(['/produtos']);
    }
  }

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
