import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  usuario: string = '';
  senha: string = '';
  erro: boolean = false;

  constructor(private router: Router) {}

  entrar(): void {
    // Simulação simples: aceita qualquer coisa se não estiver vazio
    // Ou podemos forçar um admin/admin
    if (this.usuario && this.senha) {
      // Salva o 'token' de autenticação e o nome do usuário
      localStorage.setItem('usuario_logado', 'true');
      localStorage.setItem('nome_usuario', this.usuario);
      this.router.navigate(['/produtos']);
    } else {
      this.erro = true;
    }
  }
}
