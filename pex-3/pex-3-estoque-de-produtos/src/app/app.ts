import { Component } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  exibirHeader: boolean = true;
  nomeUsuario: string = '';

  constructor(private router: Router) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        // Esconde o header se estiver na rota de login
        this.exibirHeader = !event.url.includes('/login');
        
        // Atualiza o nome do usuário sempre que navegar
        if (this.exibirHeader) {
          this.nomeUsuario = localStorage.getItem('nome_usuario') || 'Usuário';
        }
      }
    });
  }

  logout(): void {
    localStorage.removeItem('usuario_logado');
    localStorage.removeItem('nome_usuario');
    this.router.navigate(['/login']);
  }
}
